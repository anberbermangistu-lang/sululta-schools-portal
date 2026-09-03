import { supabase } from "./supabase.js";

const tableBody =
    document.getElementById("attendanceTableBody");

const message =
    document.getElementById("message");

const refreshButton =
    document.getElementById("refreshAttendance");

const logoutButton =
    document.getElementById("logoutButton");

const sidebarToggle =
    document.getElementById("sidebarToggle");

const sidebar =
    document.querySelector(".admin-sidebar");

let currentParent = null;
let currentStudent = null;
let attendance = [];

document.addEventListener(
    "DOMContentLoaded",
    initialize
);

async function initialize() {

    setupSidebar();

    setupLogout();

    const allowed =
        await checkParent();

    if (!allowed) {
        return;
    }

    await loadChild();

    refreshButton?.addEventListener(
        "click",
        async () => {

            await loadChild();

        }
    );
}

async function checkParent() {

    const {
        data: { user },
        error: authError
    } =
        await supabase.auth.getUser();

    if (authError || !user) {

        window.location.href =
            "/login.html";

        return false;
    }

    const {
        data: profile,
        error: profileError
    } =
        await supabase
            .from("profiles")
            .select(`
                id,
                first_name,
                last_name,
                username,
                email,
                role,
                status,
                photo_url
            `)
            .eq(
                "id",
                user.id
            )
            .maybeSingle();

    if (profileError || !profile) {

        await supabase.auth.signOut();

        window.location.href =
            "/login.html";

        return false;
    }

    const role =
        String(
            profile.role || ""
        )
            .trim()
            .toLowerCase();

    const status =
        String(
            profile.status || ""
        )
            .trim()
            .toLowerCase();

    if (role !== "parent") {

        if (role === "admin") {

            window.location.href =
                "/admin/dashboard.html";

        } else if (role === "teacher") {

            window.location.href =
                "/teachers/dashboard.html";

        } else {

            window.location.href =
                "/login.html";
        }

        return false;
    }

    if (status !== "active") {

        await supabase.auth.signOut();

        window.location.href =
            "/login.html";

        return false;
    }

    const {
        data: parent,
        error: parentError
    } =
        await supabase
            .from("parents")
            .select(`
                id,
                parent_id,
                first_name,
                last_name,
                gender,
                relationship,
                phone,
                email,
                address,
                occupation,
                user_id,
                student_id,
                status,
                photo_url
            `)
            .eq(
                "user_id",
                user.id
            )
            .maybeSingle();

    if (parentError) {

        console.error(
            "Parent error:",
            parentError
        );

        showMessage(
            parentError.message,
            "error"
        );

        return false;
    }

    if (!parent) {

        showMessage(
            "Parent record was not found.",
            "error"
        );

        return false;
    }

    currentParent =
        parent;

    displayParent(
        profile,
        parent
    );

    return true;
}

async function loadChild() {

    if (!currentParent) {
        return;
    }

    if (!currentParent.student_id) {

        currentStudent =
            null;

        attendance = [];

        updateStatistics();

        showEmpty(
            "No child is linked to this parent account."
        );

        showMessage(
            "No child is linked to this parent account.",
            "error"
        );

        return;
    }

    setLoading();

    const {
        data: student,
        error
    } =
        await supabase
            .from("students")
            .select(`
                id,
                student_id,
                first_name,
                last_name,
                gender,
                class_id,
                class,
                section,
                phone,
                email,
                address,
                date_of_birth,
                status,
                photo_url
            `)
            .eq(
                "id",
                currentParent.student_id
            )
            .maybeSingle();

    if (error) {

        console.error(
            "Student error:",
            error
        );

        currentStudent =
            null;

        attendance = [];

        updateStatistics();

        showMessage(
            error.message,
            "error"
        );

        showEmpty(
            "Unable to load your child's information."
        );

        return;
    }

    if (!student) {

        currentStudent =
            null;

        attendance = [];

        updateStatistics();

        showMessage(
            "The child linked to this parent account was not found.",
            "error"
        );

        showEmpty(
            "Child record not found."
        );

        return;
    }

    currentStudent =
        student;

    displayChild(
        student
    );

    await loadAttendance(
        student.id
    );
}

async function loadAttendance(
    studentId
) {

    if (!studentId) {
        return;
    }

    if (tableBody) {

        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="table-empty"
                >
                    Loading attendance...
                </td>
            </tr>
        `;
    }

    const {
        data,
        error
    } =
        await supabase
            .from("attendance")
            .select(`
                id,
                student_id,
                attendance_date,
                status,
                remark,
                recorded_by,
                created_at
            `)
            .eq(
                "student_id",
                studentId
            )
            .order(
                "attendance_date",
                {
                    ascending: false
                }
            );

    if (error) {

        console.error(
            "Attendance error:",
            error
        );

        attendance = [];

        updateStatistics();

        showMessage(
            error.message,
            "error"
        );

        showEmpty(
            "Unable to load attendance records."
        );

        return;
    }

    attendance =
        data || [];

    updateStatistics();

    renderAttendance();
}

function displayParent(
    profile,
    parent
) {

    const fullName =
        `${parent.first_name || profile.first_name || ""} ${parent.last_name || profile.last_name || ""}`
            .trim() ||
        profile.username ||
        "Parent";

    setText(
        "parentHeaderName",
        fullName
    );

    const avatar =
        document.getElementById(
            "parentAvatar"
        );

    const photo =
        parent.photo_url ||
        profile.photo_url;

    if (!avatar) {
        return;
    }

    if (photo) {

        avatar.innerHTML =
            "";

        const image =
            document.createElement(
                "img"
            );

        image.src =
            photo;

        image.alt =
            fullName;

        avatar.appendChild(
            image
        );

    } else {

        avatar.textContent =
            fullName
                .charAt(0)
                .toUpperCase();
    }
}

function displayChild(
    student
) {

    const fullName =
        `${student.first_name || ""} ${student.last_name || ""}`
            .trim() ||
        "Student";

    const className =
        student.class ||
        "—";

    const status =
        String(
            student.status || ""
        )
            .trim()
            .toLowerCase();

    const statusText =
        status
            ? capitalize(status)
            : "—";

    setText(
        "studentName",
        fullName
    );

    setText(
        "attendanceDescription",
        `Attendance record for ${fullName}.`
    );

    setText(
        "recordSummary",
        `Showing ${attendance.length} records`
    );
}

function updateStatistics() {

    const total =
        attendance.length;

    const present =
        attendance.filter(
            record =>
                normalizeStatus(
                    record.status
                ) === "present"
        ).length;

    const absent =
        attendance.filter(
            record =>
                normalizeStatus(
                    record.status
                ) === "absent"
        ).length;

    setText(
        "totalAttendance",
        total
    );

    setText(
        "presentCount",
        present
    );

    setText(
        "absentCount",
        absent
    );

    setText(
        "recordBadge",
        `${total} Record${total === 1 ? "" : "s"}`
    );

    setText(
        "recordSummary",
        `Showing ${total} record${total === 1 ? "" : "s"}`
    );
}

function renderAttendance() {

    if (!tableBody) {
        return;
    }

    if (!attendance.length) {

        showEmpty(
            "No attendance records found for your child."
        );

        return;
    }

    tableBody.innerHTML =
        attendance
            .map(
                (record, index) => {

                    const status =
                        normalizeStatus(
                            record.status
                        );

                    const statusText =
                        formatStatus(
                            status
                        );

                    const statusClass =
                        getStatusClass(
                            status
                        );

                    return `
                        <tr>

                            <td>
                                ${index + 1}
                            </td>

                            <td>
                                ${formatDate(
                                    record.attendance_date
                                )}
                            </td>

                            <td>

                                <span
                                    class="status-badge ${statusClass}"
                                >
                                    ${escapeHtml(
                                        statusText
                                    )}
                                </span>

                            </td>

                            <td>
                                ${escapeHtml(
                                    record.remark ||
                                    "—"
                                )}
                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}

function setLoading() {

    setText(
        "studentName",
        "Loading..."
    );

    setText(
        "attendanceDescription",
        "Loading your child's attendance record..."
    );

    setText(
        "totalAttendance",
        "0"
    );

    setText(
        "presentCount",
        "0"
    );

    setText(
        "absentCount",
        "0"
    );

    setText(
        "recordBadge",
        "0 Records"
    );

    setText(
        "recordSummary",
        "Showing 0 records"
    );

    if (tableBody) {

        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="4"
                    class="table-empty"
                >
                    Loading attendance...
                </td>
            </tr>
        `;
    }
}

function showEmpty(
    text
) {

    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = `
        <tr>
            <td
                colspan="4"
                class="table-empty"
            >
                ${escapeHtml(text)}
            </td>
        </tr>
    `;
}

function showMessage(
    text,
    type = "info"
) {

    if (!message) {
        return;
    }

    message.textContent =
        text;

    message.className =
        `message ${type}`;

    message.hidden =
        false;
}

function normalizeStatus(
    value
) {

    return String(
        value || ""
    )
        .trim()
        .toLowerCase();
}

function formatStatus(
    status
) {

    if (!status) {
        return "Unknown";
    }

    return status
        .replace(
            /_/g,
            " "
        )
        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );
}

function getStatusClass(
    status
) {

    if (status === "present") {
        return "status-present";
    }

    if (status === "absent") {
        return "status-absent";
    }

    if (status === "late") {
        return "status-late";
    }

    if (status === "excused") {
        return "status-excused";
    }

    return "";
}

function formatDate(
    value
) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return String(value);
    }

    return date.toLocaleDateString(
        "en-US",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}

function capitalize(
    value
) {

    const text =
        String(value);

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );
}

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );

    if (element) {

        element.textContent =
            value;
    }
}

function setupSidebar() {

    sidebarToggle?.addEventListener(
        "click",
        () => {

            sidebar?.classList.toggle(
                "mobile-open"
            );
        }
    );
}

function setupLogout() {

    logoutButton?.addEventListener(
        "click",
        async () => {

            const {
                error
            } =
                await supabase.auth.signOut();

            if (error) {

                console.error(
                    "Logout error:",
                    error
                );

                showMessage(
                    error.message,
                    "error"
                );

                return;
            }

            window.location.href =
                "/login.html";
        }
    );
}

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}