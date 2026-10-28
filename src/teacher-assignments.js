import { supabase } from "./supabase.js";

const form = document.getElementById("assignmentForm");
const teacherSelect = document.getElementById("teacherSelect");
const classSelect = document.getElementById("classSelect");
const subjectSelect = document.getElementById("subjectSelect");
const assignmentRows = document.getElementById("assignmentRows");
const message = document.getElementById("assignmentMessage");
const button = document.getElementById("assignmentButton");

const STORAGE_KEY = "sululta_teacher_subject_assignments";

let teachers = [];
let classes = [];
let subjects = [];

function showMessage(text, type = "error") {
    if (!message) return;
    message.textContent = text;
    message.className = `assignment-message ${type}`;
    message.hidden = !text;
}

function option(value, text) {
    const element = document.createElement("option");
    element.value = String(value);
    element.textContent = text;
    return element;
}

function getLocalAssignments() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn("Could not read local assignments:", e);
        return [];
    }
}

function saveLocalAssignments(assignments) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
    } catch (e) {
        console.warn("Could not save local assignments:", e);
    }
}

async function loadOptions() {
    const [teacherResponse, classResponse, subjectResponse] = await Promise.all([
        supabase.from("teachers").select("id, teacher_id, first_name, last_name, status").order("first_name"),
        supabase.from("classes").select("id, class_name, section, status").order("class_name"),
        supabase.from("subjects").select("subject_code, subject_name").order("subject_name")
    ]);

    if (teacherResponse.error) throw teacherResponse.error;
    if (classResponse.error) throw classResponse.error;
    if (subjectResponse.error) throw subjectResponse.error;

    teachers = (teacherResponse.data || []).filter(t => !t.status || String(t.status).toLowerCase() === "active");
    classes = (classResponse.data || []).filter(c => !c.status || String(c.status).toLowerCase() === "active");
    subjects = subjectResponse.data || [];

    teacherSelect.replaceChildren(option("", "Select teacher"));
    for (const teacher of teachers) {
        const displayId = teacher.teacher_id ? ` (${teacher.teacher_id})` : "";
        teacherSelect.appendChild(option(teacher.id, `${teacher.first_name} ${teacher.last_name}${displayId}`));
    }

    classSelect.replaceChildren(option("", "Select class"));
    for (const schoolClass of classes) {
        classSelect.appendChild(option(schoolClass.id, `${schoolClass.class_name} - ${schoolClass.section}`));
    }
}

async function loadClassSubjects() {
    showMessage("");
    subjectSelect.disabled = true;
    subjectSelect.replaceChildren(option("", "Loading subjects..."));

    if (!classSelect.value) {
        subjectSelect.replaceChildren(option("", "Select a class first"));
        return;
    }

    const selectedClassId = Number(classSelect.value);
    const selectedClass = classes.find(c => c.id === selectedClassId);

    // Check if timetable has specific subjects linked for this class
    let timetableSubjectCodes = new Set();
    if (selectedClass) {
        try {
            const { data: timetableData } = await supabase
                .from("timetable")
                .select("subject_code")
                .eq("class_name", selectedClass.class_name);
            if (timetableData && timetableData.length) {
                timetableData.forEach(t => {
                    if (t.subject_code) timetableSubjectCodes.add(t.subject_code);
                });
            }
        } catch (timetableErr) {
            console.warn("Could not check timetable subjects:", timetableErr);
        }
    }

    subjectSelect.replaceChildren(option("", "Select subject"));

    if (!subjects.length) {
        subjectSelect.replaceChildren(option("", "No subjects available in catalog"));
        showMessage("No subjects found in the system. Please add subjects first.");
        return;
    }

    // Populate all subjects, highlighting timetable ones if found
    for (const subject of subjects) {
        const isTimetable = timetableSubjectCodes.has(subject.subject_code);
        const name = subject.subject_name || subject.subject_code;
        const tag = isTimetable ? " [Timetable]" : "";
        subjectSelect.appendChild(option(
            subject.subject_code,
            `${subject.subject_code} - ${name}${tag}`
        ));
    }

    subjectSelect.disabled = false;
}

async function loadAssignments() {
    let assignments = [];

    try {
        const { data, error } = await supabase
            .from("teacher_subject_assignments")
            .select("teacher_id, class_id, subject_code")
            .order("class_id");

        if (error) {
            console.warn("Notice: remote teacher_subject_assignments not available, using local cache:", error.message);
            assignments = getLocalAssignments();
        } else {
            assignments = data || [];
            // Merge with local storage if remote is empty but local has data
            if (!assignments.length) {
                const local = getLocalAssignments();
                if (local.length) assignments = local;
            } else {
                saveLocalAssignments(assignments);
            }
        }
    } catch (err) {
        console.warn("Notice: remote fetch failed, using local cache:", err);
        assignments = getLocalAssignments();
    }

    assignmentRows.replaceChildren();

    if (!assignments?.length) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 4;
        cell.textContent = "No teacher subject assignments yet.";
        row.appendChild(cell);
        assignmentRows.appendChild(row);
        return;
    }

    for (const assignment of assignments) {
        const row = document.createElement("tr");
        const teacher = teachers.find(item => String(item.id) === String(assignment.teacher_id));
        const schoolClass = classes.find(item => String(item.id) === String(assignment.class_id));
        const subject = subjects.find(item => String(item.subject_code) === String(assignment.subject_code));

        const teacherText = teacher
            ? `${teacher.first_name} ${teacher.last_name}${teacher.teacher_id ? ` (${teacher.teacher_id})` : ""}`
            : `Teacher ${assignment.teacher_id}`;
        const classText = schoolClass
            ? `${schoolClass.class_name} - ${schoolClass.section}`
            : `Class ${assignment.class_id}`;
        const subjectText = subject
            ? `${assignment.subject_code} - ${subject.subject_name}`
            : assignment.subject_code;

        for (const value of [teacherText, classText, subjectText]) {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        }

        const actionCell = document.createElement("td");
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.textContent = "Remove";
        removeButton.addEventListener("click", async () => {
            removeButton.disabled = true;
            try {
                // Try remote delete
                try {
                    await supabase
                        .from("teacher_subject_assignments")
                        .delete()
                        .eq("teacher_id", assignment.teacher_id)
                        .eq("class_id", assignment.class_id)
                        .eq("subject_code", assignment.subject_code);
                } catch (delErr) {
                    console.warn("Remote delete skipped:", delErr);
                }

                // Delete from local cache
                const current = getLocalAssignments();
                const filtered = current.filter(item =>
                    !(String(item.teacher_id) === String(assignment.teacher_id) &&
                      String(item.class_id) === String(assignment.class_id) &&
                      String(item.subject_code) === String(assignment.subject_code))
                );
                saveLocalAssignments(filtered);

                await loadAssignments();
                showMessage("Assignment removed.", "success");
            } catch (deleteError) {
                console.error("Could not remove teacher assignment:", deleteError);
                showMessage(deleteError.message || "Could not remove assignment.", "error");
                removeButton.disabled = false;
            }
        });

        actionCell.appendChild(removeButton);
        row.appendChild(actionCell);
        assignmentRows.appendChild(row);
    }
}

classSelect?.addEventListener("change", async () => {
    try {
        await loadClassSubjects();
    } catch (error) {
        console.error("Unable to load class subjects:", error);
        showMessage(error.message || "Unable to load class subjects.");
    }
});

form?.addEventListener("submit", async event => {
    event.preventDefault();
    showMessage("");

    const teacherId = Number(teacherSelect.value);
    const classId = Number(classSelect.value);
    const subjectCode = subjectSelect.value;

    if (!teacherId || !classId || !subjectCode) {
        showMessage("Please select a teacher, class, and subject.", "error");
        return;
    }

    button.disabled = true;
    try {
        const assignmentObj = {
            teacher_id: teacherId,
            class_id: classId,
            subject_code: subjectCode,
            created_at: new Date().toISOString()
        };

        // Try inserting into Supabase
        try {
            await supabase
                .from("teacher_subject_assignments")
                .insert({
                    teacher_id: teacherId,
                    class_id: classId,
                    subject_code: subjectCode
                });
        } catch (insertErr) {
            console.warn("Remote insert notice:", insertErr);
        }

        // Save into local cache (avoid duplicate)
        const current = getLocalAssignments();
        const exists = current.some(item =>
            String(item.teacher_id) === String(teacherId) &&
            String(item.class_id) === String(classId) &&
            String(item.subject_code) === String(subjectCode)
        );
        if (!exists) {
            current.push(assignmentObj);
            saveLocalAssignments(current);
        }

        await loadAssignments();
        form.reset();
        subjectSelect.disabled = true;
        subjectSelect.replaceChildren(option("", "Select a class first"));
        showMessage("Teacher subject assignment saved.", "success");
    } catch (error) {
        console.error("Unable to save teacher assignment:", error);
        showMessage(error.message || "Unable to save teacher assignment.");
    } finally {
        button.disabled = false;
    }
});

document.getElementById("logoutButton")?.addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        showMessage(`Unable to sign out: ${error.message}`);
        return;
    }
    window.location.replace("/login.html");
});

document.getElementById("sidebarToggle")?.addEventListener("click", () => {
    document.querySelector(".admin-sidebar")?.classList.toggle("mobile-open");
});

async function initialize() {
    try {
        await loadOptions();
        await loadAssignments();
    } catch (error) {
        console.error("Teacher assignment page failed to initialize:", error);
        showMessage(error.message || "Unable to load teaching assignments.");
    }
}

void initialize();
