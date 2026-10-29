import { supabase, getSession, getUserProfile, getRoleDashboard } from "./supabase.js";

let teacher = null;
let currentUser = null;
let classes = [];
let students = [];
let selectedClassId = "";
let selectedDate = "";

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    setupSidebar();
    setupLogout();

    const authenticated = await getTeacher();

    if (!authenticated) {
        return;
    }

    setupHeader();
    setupDate();
    setupButtons();

    await loadClasses();
}

async function getTeacher() {
    const session = await getSession();
    const user = session?.user;

    if (!user) {
        window.location.href = "/login.html";
        return false;
    }

    currentUser = user;

    const profile = await getUserProfile(user.id);
    const role = String(profile?.role || "").trim().toLowerCase();

    if (role && role !== "teacher" && role !== "admin") {
        const dest = getRoleDashboard(role);
        if (dest) window.location.href = dest;
        return false;
    }

    let teacherRecord = null;
    try {
        const { data } = await supabase
            .from("teachers")
            .select(`
                id,
                teacher_id,
                first_name,
                last_name,
                gender,
                phone,
                email,
                qualification,
                photo_url,
                user_id,
                status
            `)
            .eq("user_id", user.id)
            .maybeSingle();
        teacherRecord = data;
    } catch (e) {
        console.warn("Teacher record fetch notice:", e);
    }

    if (!teacherRecord && user.email) {
        try {
            const { data } = await supabase
                .from("teachers")
                .select(`
                    id,
                    teacher_id,
                    first_name,
                    last_name,
                    gender,
                    phone,
                    email,
                    qualification,
                    photo_url,
                    user_id,
                    status
                `)
                .ilike("email", user.email.trim())
                .maybeSingle();
            if (data) {
                teacherRecord = data;
                await supabase.from("teachers").update({ user_id: user.id }).eq("id", teacherRecord.id);
            }
        } catch (_) {}
    }

    if (!teacherRecord) {
        showMessage("Your teacher account is not connected to a teacher record.");
        return false;
    }

    teacher = teacherRecord;
    return true;
}

async function loadClasses() {
    const select = document.getElementById("classSelect");

    if (!select) {
        return;
    }

    select.innerHTML = `
        <option value="">
            Loading classes...
        </option>
    `;

    const {
        data,
        error
    } = await supabase
        .from("classes")
        .select(`
            id,
            class_name,
            section,
            room_number,
            class_teacher,
            academic_year,
            status
        `)
        .eq("status", "active")
        .order("class_name", {
            ascending: true
        })
        .order("section", {
            ascending: true
        });

    if (error) {
        console.error("Load classes error:", error);

        select.innerHTML = `
            <option value="">
                Unable to load classes
            </option>
        `;

        showMessage(
            "Unable to load your classes: " + error.message
        );

        return;
    }

    classes = data || [];

    select.innerHTML = `
        <option value="">
            Select Class
        </option>
    `;

    classes.forEach(item => {
        const option = document.createElement("option");

        option.value = String(item.id);

        option.textContent =
            `${item.class_name} - Section ${item.section}`;

        select.appendChild(option);
    });

    if (classes.length === 0) {
        showMessage(
            "No active classes are assigned to you."
        );
    }
}

async function loadAttendance() {
    const classSelect =
        document.getElementById("classSelect");

    const dateInput =
        document.getElementById("attendanceDate");

    selectedClassId =
        classSelect?.value || "";

    selectedDate =
        dateInput?.value || "";

    if (!selectedClassId) {
        showMessage("Please select a class.");
        return;
    }

    if (!selectedDate) {
        showMessage("Please select a date.");
        return;
    }

    const selectedClass =
        classes.find(
            item =>
                String(item.id) ===
                String(selectedClassId)
        );

    if (!selectedClass) {
        showMessage("Selected class was not found.");
        return;
    }

    showMessage("Loading students...", "success");

    const {
        data: studentData,
        error: studentError
    } = await supabase
        .from("students")
        .select(`
            id,
            student_id,
            first_name,
            last_name,
            gender,
            photo_url,
            class_id
        `)
        .eq(
            "class_id",
            Number(selectedClassId)
        )
        .eq(
            "status",
            "active"
        )
        .order("first_name", {
            ascending: true
        })
        .order("last_name", {
            ascending: true
        });

    if (studentError) {
        console.error(
            "Load students error:",
            studentError
        );

        showMessage(
            "Unable to load students: " +
            studentError.message
        );

        return;
    }

    students = studentData || [];

    const {
        data: attendanceData,
        error: attendanceError
    } = await supabase
        .from("attendance")
        .select(`
            id,
            student_id,
            attendance_date,
            status,
            remark,
            recorded_by
        `)
        .eq(
            "attendance_date",
            selectedDate
        )
        .in(
            "student_id",
            students.map(student => student.id)
        );

    if (attendanceError) {
        console.error(
            "Load attendance error:",
            attendanceError
        );

        showMessage(
            "Unable to load attendance: " +
            attendanceError.message
        );

        return;
    }

    const attendanceMap = new Map();

    (attendanceData || []).forEach(record => {
        attendanceMap.set(
            String(record.student_id),
            record
        );
    });

    renderStudents(
        selectedClass,
        attendanceMap
    );
}

function renderStudents(
    selectedClass,
    attendanceMap
) {
    const panel =
        document.getElementById("attendancePanel");

    const title =
        document.getElementById("selectedClassTitle");

    const count =
        document.getElementById("studentCount");

    const body =
        document.getElementById("attendanceTableBody");

    if (panel) {
        panel.hidden = false;
    }

    if (title) {
        title.textContent =
            `${selectedClass.class_name} - Section ${selectedClass.section}`;
    }

    if (count) {
        count.textContent =
            `${students.length} Students`;
    }

    if (!body) {
        return;
    }

    if (students.length === 0) {
        body.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="table-empty">
                    No active students found in this class.
                </td>
            </tr>
        `;

        showMessage(
            "No active students are assigned to this class."
        );

        return;
    }

    body.innerHTML =
        students.map(student => {

            const existing =
                attendanceMap.get(
                    String(student.id)
                );

            const status =
                normalizeStatus(
                    existing?.status
                );

            const remark =
                existing?.remark || "";

            const fullName =
                `${student.first_name || ""} ${student.last_name || ""}`
                    .trim() ||
                "Unnamed Student";

            return `
                <tr data-student-id="${escapeHtml(student.id)}">

                    <td>

                        <strong>
                            ${escapeHtml(fullName)}
                        </strong>

                    </td>

                    <td>
                        ${escapeHtml(
                            student.student_id || "—"
                        )}
                    </td>

                    <td>

                        <select
                            class="attendance-status"
                            data-student-id="${escapeHtml(student.id)}">

                            <option
                                value="Present"
                                ${status === "Present" ? "selected" : ""}>
                                Present
                            </option>

                            <option
                                value="Absent"
                                ${status === "Absent" ? "selected" : ""}>
                                Absent
                            </option>

                            <option
                                value="Late"
                                ${status === "Late" ? "selected" : ""}>
                                Late
                            </option>

                            <option
                                value="Excused"
                                ${status === "Excused" ? "selected" : ""}>
                                Excused
                            </option>

                        </select>

                    </td>

                    <td>

                        <input
                            type="text"
                            class="attendance-remarks"
                            data-student-id="${escapeHtml(student.id)}"
                            value="${escapeHtml(remark)}"
                            placeholder="Optional">

                    </td>

                </tr>
            `;
        }).join("");

    showMessage(
        `${students.length} student(s) loaded.`,
        "success"
    );
}

async function saveAttendance() {
    if (!selectedClassId) {
        showMessage("Please select a class.");
        return;
    }

    if (!selectedDate) {
        showMessage("Please select a date.");
        return;
    }

    if (students.length === 0) {
        showMessage(
            "There are no students to save."
        );
        return;
    }

    const saveButton =
        document.getElementById("saveAttendance");

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
    }

    try {
        const records = students.map(student => {

            const statusElement =
                document.querySelector(
                    `.attendance-status[data-student-id="${student.id}"]`
                );

            const remarkElement =
                document.querySelector(
                    `.attendance-remarks[data-student-id="${student.id}"]`
                );

            return {
                student_id: student.id,
                attendance_date: selectedDate,
                status:
                    statusElement?.value ||
                    "Present",
                remark:
                    remarkElement?.value.trim() ||
                    "",
                recorded_by: currentUser.id
            };
        });

        const studentIds =
            records.map(record => record.student_id);

        const {
            data: existingRecords,
            error: existingError
        } = await supabase
            .from("attendance")
            .select(`
                id,
                student_id
            `)
            .eq(
                "attendance_date",
                selectedDate
            )
            .in(
                "student_id",
                studentIds
            );

        if (existingError) {
            throw existingError;
        }

        const existingMap = new Map();

        (existingRecords || []).forEach(record => {
            existingMap.set(
                String(record.student_id),
                record.id
            );
        });

        const inserts = [];
        const updates = [];

        records.forEach(record => {

            const existingId =
                existingMap.get(
                    String(record.student_id)
                );

            if (existingId) {

                updates.push({
                    id: existingId,
                    status: record.status,
                    remark: record.remark,
                    recorded_by: record.recorded_by
                });

            } else {

                inserts.push(record);

            }
        });

        if (inserts.length > 0) {

            const {
                error: insertError
            } = await supabase
                .from("attendance")
                .insert(inserts);

            if (insertError) {
                throw insertError;
            }
        }

        for (const record of updates) {

            const {
                error: updateError
            } = await supabase
                .from("attendance")
                .update({
                    status: record.status,
                    remark: record.remark,
                    recorded_by: record.recorded_by
                })
                .eq(
                    "id",
                    record.id
                );

            if (updateError) {
                throw updateError;
            }
        }

        showMessage(
            "Attendance saved successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "Save attendance error:",
            error
        );

        showMessage(
            "Unable to save attendance: " +
            error.message
        );

    } finally {

        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent =
                "Save Attendance";
        }
    }
}

function markAll(status) {
    document
        .querySelectorAll(".attendance-status")
        .forEach(select => {
            select.value = status;
        });
}

function setupButtons() {
    document
        .getElementById("loadAttendance")
        ?.addEventListener(
            "click",
            loadAttendance
        );

    document
        .getElementById("saveAttendance")
        ?.addEventListener(
            "click",
            saveAttendance
        );

    document
        .getElementById("markAllPresent")
        ?.addEventListener(
            "click",
            () => markAll("Present")
        );

    document
        .getElementById("markAllAbsent")
        ?.addEventListener(
            "click",
            () => markAll("Absent")
        );
}

function setupDate() {
    const dateInput =
        document.getElementById("attendanceDate");

    if (!dateInput) {
        return;
    }

    const now = new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            now.getDate()
        ).padStart(2, "0");

    dateInput.value =
        `${year}-${month}-${day}`;
}

function setupHeader() {
    const fullName =
        `${teacher.first_name || ""} ${teacher.last_name || ""}`
            .trim() ||
        "Teacher";

    const name =
        document.getElementById(
            "teacherHeaderName"
        );

    const avatar =
        document.getElementById(
            "teacherAvatar"
        );

    if (name) {
        name.textContent =
            fullName;
    }

    if (!avatar) {
        return;
    }

    if (teacher.photo_url) {

        avatar.innerHTML = "";

        const image =
            document.createElement("img");

        image.src =
            teacher.photo_url;

        image.alt =
            fullName;

        image.style.width = "100%";
        image.style.height = "100%";
        image.style.objectFit = "cover";
        image.style.borderRadius = "50%";

        avatar.appendChild(image);

    } else {

        avatar.textContent =
            fullName
                .charAt(0)
                .toUpperCase();
    }
}

function setupSidebar() {
    const toggle =
        document.getElementById(
            "sidebarToggle"
        );

    const sidebar =
        document.querySelector(
            ".admin-sidebar"
        );

    if (!toggle || !sidebar) {
        return;
    }

    toggle.addEventListener(
        "click",
        () => {
            sidebar.classList.toggle(
                "mobile-open"
            );
        }
    );
}

function setupLogout() {
    const button =
        document.getElementById(
            "logoutButton"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        async () => {

            const {
                error
            } = await supabase.auth.signOut();

            if (error) {
                console.error(
                    "Logout error:",
                    error
                );

                showMessage(
                    error.message
                );

                return;
            }

            window.location.href =
                "/login.html";
        }
    );
}

function normalizeStatus(value) {
    const status =
        String(value || "")
            .trim()
            .toLowerCase();

    if (status === "absent") {
        return "Absent";
    }

    if (status === "late") {
        return "Late";
    }

    if (status === "excused") {
        return "Excused";
    }

    return "Present";
}

function showMessage(
    message,
    type = "error"
) {
    const element =
        document.getElementById(
            "attendanceMessage"
        );

    if (!element) {
        return;
    }

    element.textContent =
        message;

    element.className =
        `form-message ${type}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}