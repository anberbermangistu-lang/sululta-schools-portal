import { supabase } from "./supabase.js";

const refreshButton = document.getElementById("refreshStudents");
const totalRecords = document.getElementById("totalAttendance");
const presentRecords = document.getElementById("presentCount");
const absentRecords = document.getElementById("absentCount");
const attendanceTableBody = document.getElementById("attendanceTableBody");
const attendanceRecordBadge = document.getElementById("attendanceBadge");
const attendanceRecordSummary = document.getElementById("attendanceSummary");
const studentName = document.getElementById("studentName");
const studentId = document.getElementById("studentId");
const studentMessage = document.getElementById("studentMessage");
const statusFilter = document.getElementById("statusFilter");
const searchInput = document.getElementById("studentSearch");
const clearFilters = document.getElementById("clearFilters");
const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");

let currentStudent = null;
let attendanceRecords = [];

document.addEventListener("DOMContentLoaded", initialize);

window.addEventListener("pageshow", async () => {
    await checkAuthentication();
});

sidebarToggle?.addEventListener("click", () => {
    document
        .querySelector(".admin-page")
        ?.classList.toggle("sidebar-collapsed");
});

refreshButton?.addEventListener("click", loadAttendance);
statusFilter?.addEventListener("change", renderAttendance);
searchInput?.addEventListener("input", renderAttendance);

clearFilters?.addEventListener("click", () => {
    if (statusFilter) {
        statusFilter.value = "all";
    }

    if (searchInput) {
        searchInput.value = "";
    }

    renderAttendance();
});

logoutButton?.addEventListener("click", logout);

async function initialize() {
    await loadStudentAndAttendance();
}

async function checkAuthentication() {
    try {
        const {
            data: { user },
            error
        } = await supabase.auth.getUser();

        if (error || !user) {
            window.location.replace("/login.html");
        }
    } catch (error) {
        console.error("Authentication error:", error);
        window.location.replace("/login.html");
    }
}

async function loadStudentAndAttendance() {
    hideMessage();

    try {
        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser();

        if (authError || !user) {
            window.location.replace("/login.html");
            return;
        }

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .select(`
                id,
                first_name,
                last_name,
                email,
                role,
                status
            `)
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            console.error("Profile error:", profileError);
            showMessage("Unable to load your account information.");
            return;
        }

        if (!profile) {
            showMessage("Your account profile could not be found.");
            return;
        }

        const role = String(profile.role || "")
            .trim()
            .toLowerCase();

        if (role !== "student") {
            showMessage("This page is only available for student accounts.");
            return;
        }

        const emailAddress = String(
            profile.email || user.email || ""
        )
            .trim()
            .toLowerCase();

        if (!emailAddress) {
            showMessage(
                "Your student account does not have an email address."
            );
            return;
        }

        const {
            data: student,
            error: studentError
        } = await supabase
            .from("students")
            .select(`
                id,
                student_id,
                first_name,
                last_name,
                email,
                status
            `)
            .ilike("email", emailAddress)
            .maybeSingle();

        if (studentError) {
            console.error("Student error:", studentError);
            showMessage("Unable to load your student information.");
            return;
        }

        if (!student) {
            showMessage("No student record is linked to this account.");
            return;
        }

        currentStudent = student;

        updateStudentInfo(student);
        await loadAttendance();
    } catch (error) {
        console.error("Attendance page error:", error);
        showMessage("Unable to load your attendance.");
    }
}

function updateStudentInfo(student) {
    const first = String(student.first_name || "").trim();
    const last = String(student.last_name || "").trim();
    const fullName = `${first} ${last}`.trim() || "Student";

    if (studentName) {
        studentName.textContent = fullName;
    }

    if (studentId) {
        studentId.textContent = student.student_id || "-";
    }
}

async function loadAttendance() {
    if (!currentStudent) {
        return;
    }

    showLoading();

    try {
        const {
            data,
            error
        } = await supabase
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
            .eq("student_id", currentStudent.id)
            .order("attendance_date", {
                ascending: false
            });

        if (error) {
            console.error("Attendance loading error:", error);
            attendanceRecords = [];
            updateCounters();
            renderAttendance();
            showMessage("Unable to load attendance records.");
            return;
        }

        attendanceRecords = data || [];

        updateCounters();
        renderAttendance();
    } catch (error) {
        console.error("Attendance error:", error);
        attendanceRecords = [];
        updateCounters();
        renderAttendance();
        showMessage("Unable to load attendance records.");
    }
}

function updateCounters() {
    const total = attendanceRecords.length;

    const present = attendanceRecords.filter(record =>
        normalizeStatus(record.status) === "present"
    ).length;

    const absent = attendanceRecords.filter(record =>
        normalizeStatus(record.status) === "absent"
    ).length;

    if (totalRecords) {
        totalRecords.textContent = total;
    }

    if (presentRecords) {
        presentRecords.textContent = present;
    }

    if (absentRecords) {
        absentRecords.textContent = absent;
    }

    if (attendanceRecordBadge) {
        attendanceRecordBadge.textContent =
            `${total} ${total === 1 ? "Record" : "Records"}`;
    }

    if (attendanceRecordSummary) {
        attendanceRecordSummary.textContent =
            `Showing ${total} ${total === 1 ? "record" : "records"}`;
    }
}

function renderAttendance() {
    if (!attendanceTableBody) {
        return;
    }

    const selectedStatus = normalizeStatus(
        statusFilter?.value || "all"
    );

    const searchValue = String(
        searchInput?.value || ""
    )
        .trim()
        .toLowerCase();

    const filtered = attendanceRecords.filter(record => {
        const status = normalizeStatus(record.status);

        if (
            selectedStatus !== "all" &&
            status !== selectedStatus
        ) {
            return false;
        }

        if (!searchValue) {
            return true;
        }

        const date = String(
            record.attendance_date || ""
        ).toLowerCase();

        const remarks = String(
            record.remark || ""
        ).toLowerCase();

        return (
            date.includes(searchValue) ||
            status.includes(searchValue) ||
            remarks.includes(searchValue)
        );
    });

    if (!filtered.length) {
        attendanceTableBody.innerHTML = `
            <tr>
                <td colspan="4">
                    No attendance records found.
                </td>
            </tr>
        `;

        if (attendanceRecordSummary) {
            attendanceRecordSummary.textContent = "Showing 0 records";
        }

        if (attendanceRecordBadge) {
            attendanceRecordBadge.textContent = "0 Records";
        }

        return;
    }

    attendanceTableBody.innerHTML = filtered
        .map((record, index) => {
            const date = formatDate(
                record.attendance_date
            );

            const status = formatStatus(
                record.status
            );

            const remarks = record.remark || "-";

            return `
                <tr>
                    <td>${index + 1}</td>
                    <td>${escapeHtml(date)}</td>
                    <td>
                        <span class="status-badge status-${normalizeStatus(record.status)}">
                            ${escapeHtml(status)}
                        </span>
                    </td>
                    <td>${escapeHtml(remarks)}</td>
                </tr>
            `;
        })
        .join("");

    if (attendanceRecordSummary) {
        attendanceRecordSummary.textContent =
            `Showing ${filtered.length} ${filtered.length === 1 ? "record" : "records"}`;
    }

    if (attendanceRecordBadge) {
        attendanceRecordBadge.textContent =
            `${filtered.length} ${filtered.length === 1 ? "Record" : "Records"}`;
    }
}

function showLoading() {
    if (!attendanceTableBody) {
        return;
    }

    attendanceTableBody.innerHTML = `
        <tr>
            <td colspan="4">
                Loading attendance...
            </td>
        </tr>
    `;
}

function normalizeStatus(value) {
    return String(value || "")
        .trim()
        .toLowerCase();
}

function formatStatus(value) {
    const status = normalizeStatus(value);

    if (!status) {
        return "-";
    }

    return (
        status.charAt(0).toUpperCase() +
        status.slice(1)
    );
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    const dateValue = String(value);

    const date = new Date(
        dateValue.includes("T")
            ? dateValue
            : `${dateValue}T00:00:00`
    );

    if (Number.isNaN(date.getTime())) {
        return dateValue;
    }

    return date.toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showMessage(message) {
    if (!studentMessage) {
        return;
    }

    studentMessage.textContent = message;
    studentMessage.hidden = false;
    studentMessage.className = "message error";
}

function hideMessage() {
    if (!studentMessage) {
        return;
    }

    studentMessage.textContent = "";
    studentMessage.hidden = true;
}

async function logout() {
    try {
        if (logoutButton) {
            logoutButton.disabled = true;
        }

        const { error } = await supabase.auth.signOut();

        if (error) {
            throw error;
        }

        window.location.replace("/login.html");
    } catch (error) {
        console.error("Logout error:", error);

        showMessage(
            "Unable to logout. Please try again."
        );

        if (logoutButton) {
            logoutButton.disabled = false;
        }
    
}
}