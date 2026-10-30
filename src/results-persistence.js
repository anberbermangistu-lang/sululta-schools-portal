import { getAssessmentDetails } from "./assessment-config.js";

function getRecordKey(record) {
    return JSON.stringify([record.student_id, record.subject_code, record.exam_type]);
}

function isMissingMaxMarkColumn(error) {
    const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
    return message.includes("max_mark") &&
        (error?.code === "PGRST204" || error?.code === "42703" ||
            message.includes("schema cache") || message.includes("does not exist"));
}

function toLegacyScale(record) {
    const details = getAssessmentDetails(record.exam_type);
    if (!details.category || details.maxMark === details.sourceMaxMark) {
        const { max_mark, ...legacyRecord } = record;
        return legacyRecord;
    }

    const { max_mark, ...legacyRecord } = record;
    return {
        ...legacyRecord,
        mark: Number((record.mark / details.maxMark * details.sourceMaxMark).toFixed(2))
    };
}

function validateRecord(record) {
    const mark = Number(record.mark);
    const maximum = Number(record.max_mark);
    if (!Number.isFinite(mark) || !Number.isFinite(maximum) || maximum <= 0 || mark < 0 || mark > maximum) {
        throw new Error(`Mark for ${record.exam_type} must be between 0 and ${maximum || "the configured maximum"}.`);
    }
    return { ...record, mark, max_mark: maximum };
}

export function getResultsWriteError(error) {
    const message = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""}`.toLowerCase();
    const missingMaxMark = message.includes("max_mark") &&
        (error?.code === "PGRST204" || error?.code === "42703" ||
            message.includes("schema cache") || message.includes("does not exist"));

    if (!missingMaxMark) return error;

    return new Error(
        "The results database is missing the max_mark column. Apply supabase/migrations/20261030102000_results_assessment_scales_and_class_rank.sql in the Supabase SQL Editor, then refresh the Supabase API schema cache and try again.",
        { cause: error }
    );
}

export async function insertAssessmentRecord(supabase, record) {
    const preparedRecord = validateRecord(record);
    let { data, error } = await supabase
        .from("results")
        .insert(preparedRecord)
        .select()
        .single();

    if (error && isMissingMaxMarkColumn(error)) {
        ({ data, error } = await supabase
            .from("results")
            .insert(toLegacyScale(preparedRecord))
            .select()
            .single());
    }

    if (error) throw getResultsWriteError(error);
    return data;
}

export async function updateAssessmentRecord(supabase, id, record) {
    const preparedRecord = validateRecord(record);
    let { error } = await supabase
        .from("results")
        .update(preparedRecord)
        .eq("id", id);

    if (error && isMissingMaxMarkColumn(error)) {
        ({ error } = await supabase
            .from("results")
            .update(toLegacyScale(preparedRecord))
            .eq("id", id));
    }

    if (error) throw getResultsWriteError(error);
}

export async function saveAssessmentRecords(supabase, records) {
    if (!records.length) {
        throw new Error("No assessment marks were provided.");
    }

    const incomingByKey = new Map();
    for (const record of records) {
        const preparedRecord = validateRecord(record);

        const key = getRecordKey(record);
        if (incomingByKey.has(key)) {
            throw new Error(`Duplicate assessment in this save: ${record.subject_code} — ${record.exam_type}.`);
        }
        incomingByKey.set(key, preparedRecord);
    }

    const preparedRecords = [...incomingByKey.values()];
    const studentIds = [...new Set(preparedRecords.map(record => record.student_id))];
    const subjectCodes = [...new Set(preparedRecords.map(record => record.subject_code))];
    const examTypes = [...new Set(preparedRecords.map(record => record.exam_type))];
    const { data: existingRecords, error: lookupError } = await supabase
        .from("results")
        .select("id, student_id, subject_code, exam_type, created_at")
        .in("student_id", studentIds)
        .in("subject_code", subjectCodes)
        .in("exam_type", examTypes)
        .order("created_at", { ascending: false });

    if (lookupError) throw lookupError;

    const existingByKey = new Map();
    for (const record of existingRecords || []) {
        const key = getRecordKey(record);
        if (!existingByKey.has(key)) existingByKey.set(key, record);
    }

    let updated = 0;
    const inserts = [];
    const updates = [];
    for (const record of preparedRecords) {
        const existing = existingByKey.get(getRecordKey(record));
        if (!existing) {
            inserts.push(record);
            continue;
        }

        updates.push({ record, id: existing.id });
    }

    for (const { record, id } of updates) {
        const { error } = await supabase
            .from("results")
            .update(record)
            .eq("id", id);
        if (error) {
            if (!isMissingMaxMarkColumn(error)) throw getResultsWriteError(error);
            const { error: fallbackError } = await supabase
                .from("results")
                .update(toLegacyScale(record))
                .eq("id", id);
            if (fallbackError) throw fallbackError;
        }
        updated++;
    }

    if (inserts.length) {
        const { error } = await supabase.from("results").insert(inserts);
        if (error) {
            if (!isMissingMaxMarkColumn(error)) throw getResultsWriteError(error);
            const { error: fallbackError } = await supabase
                .from("results")
                .insert(inserts.map(toLegacyScale));
            if (fallbackError) throw fallbackError;
        }
    }

    return { updated, inserted: inserts.length };
}
