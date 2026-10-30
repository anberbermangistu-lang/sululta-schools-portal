import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const appUrl = Deno.env.get("APP_URL");

if (!supabaseUrl || !anonKey || !serviceRoleKey || !appUrl) {
    throw new Error("Missing required Supabase function environment variables.");
}

const allowedOrigins = (Deno.env.get("ALLOWED_ORIGINS") || appUrl)
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

function response(request: Request, body: Record<string, unknown>, status = 200) {
    const origin = request.headers.get("Origin") || "";
    const headers = new Headers({
        "Content-Type": "application/json",
        "Vary": "Origin"
    });

    if (allowedOrigins.includes(origin)) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info");
        headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    }

    return new Response(JSON.stringify(body), { status, headers });
}

function optionalText(value: unknown) {
    if (typeof value !== "string") return null;
    const text = value.trim();
    return text || null;
}

function getErrorDetails(error: unknown) {
    if (error instanceof Error) return { message: error.message };
    if (error && typeof error === "object") {
        const details = error as Record<string, unknown>;
        if (typeof details.message === "string" && details.message.trim()) {
            return {
                message: details.message,
                ...(typeof details.code === "string" ? { code: details.code } : {})
            };
        }
    }
    return { message: "Account creation failed." };
}

async function removeCreatedUser(
    serviceClient: ReturnType<typeof createClient>,
    userId: string
) {
    const { error } = await serviceClient.auth.admin.deleteUser(userId);
    if (error) {
        console.error("Could not roll back newly created Auth user:", error.message);
        throw new Error("Account setup failed and cleanup was unsuccessful. Contact the Supabase administrator.");
    }
}

Deno.serve(async request => {
    if (!allowedOrigins.includes(request.headers.get("Origin") || "")) {
        return response(request, { error: "Origin is not allowed." }, 403);
    }

    if (request.method === "OPTIONS") return response(request, {}, 200);
    if (request.method !== "POST") {
        return response(request, { error: "Method not allowed." }, 405);
    }

    const accessToken = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!accessToken) return response(request, { error: "Authentication is required." }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    let createdUserId: string | null = null;
    let createdProfileId: string | null = null;
    let createdRecordId: number | null = null;
    let recordTable: "students" | "teachers" | null = null;

    try {
        const { data: { user: actor }, error: authError } =
            await userClient.auth.getUser(accessToken);

        if (authError || !actor) {
            return response(request, { error: "Your session is invalid or expired." }, 401);
        }

        const { data: actorProfile, error: actorProfileError } = await serviceClient
            .from("profiles")
            .select("role, status")
            .eq("id", actor.id)
            .maybeSingle();

        if (actorProfileError) throw actorProfileError;
        if (
            String(actorProfile?.role || "").toLowerCase() !== "admin" ||
            String(actorProfile?.status || "").toLowerCase() !== "active"
        ) {
            return response(request, { error: "Administrator access is required." }, 403);
        }

        const payload = await request.json();
        const role = String(payload?.role || "").trim().toLowerCase();
        const email = String(payload?.email || "").trim().toLowerCase();
        const password = typeof payload?.password === "string" ? payload.password : "";
        const submittedRecord = payload?.record;

        if (payload?.mode === "link-existing") {
            const firstName = optionalText(payload.first_name);
            const lastName = optionalText(payload.last_name);
            const username = optionalText(payload.username);
            const phone = optionalText(payload.phone);
            const recordId = payload.record_id == null ? null : Number(payload.record_id);

            if (!["admin", "teacher", "student"].includes(role)) {
                return response(request, { error: "Choose Admin, Teacher, or Student." }, 400);
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return response(request, { error: "Enter a valid email address." }, 400);
            }
            if (password.length < 8) {
                return response(request, { error: "Temporary passwords must be at least 8 characters." }, 400);
            }
            if (!firstName || !lastName) {
                return response(request, { error: "First name and last name are required." }, 400);
            }
            if (
                role !== "admin" &&
                (recordId === null || !Number.isSafeInteger(recordId) || recordId < 1)
            ) {
                return response(request, { error: "Select the matching school record." }, 400);
            }

            let teacherRecord:
                | { id: number; user_id: string | null; status: string | null }
                | null = null;

            if (role === "teacher" && recordId !== null) {
                const { data, error: teacherError } = await serviceClient
                    .from("teachers")
                    .select("id, user_id, status")
                    .eq("id", recordId)
                    .maybeSingle();

                if (teacherError) throw teacherError;
                teacherRecord = data;
                if (
                    !teacherRecord ||
                    teacherRecord.user_id ||
                    String(teacherRecord.status || "").toLowerCase() !== "active"
                ) {
                    return response(request, { error: "The selected teacher record is missing, inactive, or already linked to an account." }, 409);
                }
            }

            if (role === "student" && recordId !== null) {
                const { data: studentRecord, error: studentError } = await serviceClient
                    .from("students")
                    .select("id, status")
                    .eq("id", recordId)
                    .maybeSingle();

                if (studentError) throw studentError;
                if (
                    !studentRecord ||
                    String(studentRecord.status || "").toLowerCase() !== "active"
                ) {
                    return response(request, { error: "The selected student record is missing or inactive." }, 409);
                }

                const { data: linkedProfile, error: profileLookupError } = await serviceClient
                    .from("profiles")
                    .select("id")
                    .eq("student_id", recordId)
                    .maybeSingle();

                if (profileLookupError) throw profileLookupError;
                if (linkedProfile) {
                    return response(request, { error: "The selected student already has an account." }, 409);
                }
            }

            const { data: authData, error: createUserError } =
                await serviceClient.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                    user_metadata: { first_name: firstName, last_name: lastName, role }
                });

            if (createUserError) throw createUserError;
            if (!authData.user) throw new Error("Supabase did not return the created user.");
            createdUserId = authData.user.id;

            const profile = {
                id: createdUserId,
                first_name: firstName,
                last_name: lastName,
                full_name: `${firstName} ${lastName}`,
                email,
                username,
                phone,
                role,
                status: "active",
                ...(role === "student" && recordId !== null ? { student_id: recordId } : {})
            };
            const { error: profileError } = await serviceClient
                .from("profiles")
                .insert(profile);

            if (profileError) throw profileError;
            createdProfileId = createdUserId;

            if (teacherRecord && recordId !== null) {
                const { data: linkedTeacher, error: linkError } = await serviceClient
                    .from("teachers")
                    .update({ user_id: createdUserId, email })
                    .eq("id", recordId)
                    .is("user_id", null)
                    .select("id")
                    .maybeSingle();

                if (linkError) throw linkError;
                if (!linkedTeacher) {
                    throw new Error("The teacher record was linked by another administrator. Please retry.");
                }
            }

            return response(request, { success: true }, 200);
        }

        if (!["teacher", "student"].includes(role)) {
            return response(request, { error: "Only teacher and student accounts can be created here." }, 400);
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return response(request, { error: "Enter a valid email address." }, 400);
        }
        if (password.length < 8) {
            return response(request, { error: "Temporary passwords must be at least 8 characters." }, 400);
        }
        if (!submittedRecord || typeof submittedRecord !== "object" || Array.isArray(submittedRecord)) {
            return response(request, { error: "Provide the school record details." }, 400);
        }

        recordTable = role === "teacher" ? "teachers" : "students";
        const firstName = optionalText(submittedRecord.first_name);
        const lastName = optionalText(submittedRecord.last_name);
        const recordStatus = String(submittedRecord.status || "active").trim().toLowerCase();

        if (!firstName || !lastName) {
            return response(request, { error: "First name and last name are required." }, 400);
        }
        if (!["active", "inactive"].includes(recordStatus)) {
            return response(request, { error: "Choose a valid account status." }, 400);
        }

        const record: Record<string, string | number | null> = role === "teacher"
            ? {
                teacher_id: optionalText(submittedRecord.teacher_id),
                first_name: firstName,
                last_name: lastName,
                phone: optionalText(submittedRecord.phone),
                gender: optionalText(submittedRecord.gender),
                qualification: optionalText(submittedRecord.qualification),
                department: optionalText(submittedRecord.department || submittedRecord.subject),
                address: optionalText(submittedRecord.address),
                photo_url: optionalText(submittedRecord.photo_url),
                email,
                status: recordStatus,
                user_id: null as string | null
            }
            : {
                student_id: optionalText(submittedRecord.student_id),
                first_name: firstName,
                last_name: lastName,
                date_of_birth: optionalText(submittedRecord.date_of_birth),
                gender: optionalText(submittedRecord.gender),
                class_id: Number(submittedRecord.class_id),
                phone: optionalText(submittedRecord.phone),
                address: optionalText(submittedRecord.address),
                photo_url: optionalText(submittedRecord.photo_url),
                email,
                status: recordStatus
            };

        if (role === "teacher" && !record.teacher_id) {
            return response(request, { error: "Teacher ID is required." }, 400);
        }
        if (role === "student" && !record.student_id) {
            return response(request, { error: "Student ID is required." }, 400);
        }
        if (
            role === "student" &&
            (typeof record.class_id !== "number" ||
                !Number.isSafeInteger(record.class_id) ||
                record.class_id < 1)
        ) {
            return response(request, { error: "Select a valid class." }, 400);
        }

        if (role === "student") {
            const { data: schoolClass, error: classError } = await serviceClient
                .from("classes")
                .select("class_name, section")
                .eq("id", record.class_id)
                .maybeSingle();

            if (classError) throw classError;
            if (!schoolClass) {
                return response(request, { error: "The selected class does not exist." }, 400);
            }
            record.class = String(schoolClass.class_name);
            record.section = optionalText(schoolClass.section);
        }

        const { data: authData, error: createUserError } =
            await serviceClient.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { first_name: firstName, last_name: lastName, role }
            });

        if (createUserError) throw createUserError;
        if (!authData.user) throw new Error("Supabase did not return the created user.");
        createdUserId = authData.user.id;

        if (role === "teacher") record.user_id = createdUserId;
        const { data: schoolRecord, error: recordError } = await serviceClient
            .from(recordTable)
            .insert(record)
            .select("id")
            .single();

        if (recordError) throw recordError;
        createdRecordId = Number(schoolRecord.id);

        const profile = {
            id: createdUserId,
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`,
            email,
            role,
            status: recordStatus,
            ...(role === "student" ? { student_id: createdRecordId } : {})
        };
        const { error: profileError } = await serviceClient
            .from("profiles")
            .insert(profile);

        if (profileError) throw profileError;
        createdProfileId = createdUserId;

        return response(request, { success: true }, 200);
    } catch (error) {
        console.error("admin-create-school-account failed:", error instanceof Error ? error.message : error);

        if (createdProfileId) {
            const { error: deleteProfileError } = await serviceClient
                .from("profiles")
                .delete()
                .eq("id", createdProfileId);
            if (deleteProfileError) {
                console.error("Could not roll back newly created profile:", deleteProfileError.message);
                return response(request, {
                    error: "Account setup failed and profile cleanup was unsuccessful. Contact the Supabase administrator."
                }, 500);
            }
        }

        if (createdRecordId !== null && recordTable) {
            const { error: deleteRecordError } = await serviceClient
                .from(recordTable)
                .delete()
                .eq("id", createdRecordId);
            if (deleteRecordError) {
                console.error("Could not roll back newly created school record:", deleteRecordError.message);
                return response(request, {
                    error: "Account setup failed and school-record cleanup was unsuccessful. Contact the Supabase administrator."
                }, 500);
            }
        }

        if (createdUserId) {
            try {
                await removeCreatedUser(serviceClient, createdUserId);
            } catch (cleanupError) {
                return response(request, {
                    error: cleanupError instanceof Error ? cleanupError.message : "Account setup cleanup failed."
                }, 500);
            }
        }

        const details = getErrorDetails(error);
        return response(request, { error: details.message, ...("code" in details ? { code: details.code } : {}) }, 400);
    }
});
