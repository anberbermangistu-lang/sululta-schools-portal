import { supabase } from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const attendanceId = params.get("id");

const loading = document.getElementById("loading");
const deleteCard = document.getElementById("deleteCard");
const errorCard = document.getElementById("errorCard");
const deleteButton = document.getElementById("deleteButton");
const message = document.getElementById("formMessage");

const studentId = document.getElementById("studentId");
const studentName = document.getElementById("studentName");
const studentClass = document.getElementById("studentClass");
const attendanceDate = document.getElementById("attendanceDate");
const attendanceStatus = document.getElementById("attendanceStatus");

let attendance = null;

async function loadAttendance() {
    if (!attendanceId) {
        showError("Attendance ID is missing.");
        return;
    }

    const { data, error } = await supabase
        .from("attendance")
        .select(`
            id,
            student_id,
            attendance_date,
            status,
            students (
                id,
                student_id,
                first_name,
                last_name,
                class,
                section
            )
        `)
        .eq("id", attendanceId)
        .single();

    if (error) {
        console.error("Failed to load attendance:", error);
        showError(`Failed to load attendance: ${error.message}`);
        return;
    }

    if (!data) {
        showError("Attendance record not found.");
        return;
    }

    attendance = data;

    const student = data.students || {};
    const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim();

    studentId.textContent = student.student_id || "-";
    studentName.textContent = fullName || "-";
    studentClass.textContent = student.class
        ? `${student.class}${student.section ? ` - ${student.section}` : ""}`
        : "-";
    attendanceDate.textContent = formatDate(data.attendance_date);
    attendanceStatus.textContent = data.status || "-";

    loading.style.display = "none";
    deleteCard.style.display = "block";
}

async function deleteAttendance() {
    if (!attendance) {
        showMessage("Attendance record is not available.", "error");
        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to delete this attendance record?"
    );

    if (!confirmed) {
        return;
    }

    deleteButton.disabled = true;
    deleteButton.textContent = "Deleting...";
    hideMessage();

    const { error } = await supabase
        .from("attendance")
        .delete()
        .eq("id", attendance.id);

    if (error) {
        console.error("Failed to delete attendance:", error);
        showMessage(`Failed to delete attendance: ${error.message}`, "error");
        deleteButton.disabled = false;
        deleteButton.textContent = "🗑️ Delete Attendance";
        return;
    }

    const { data: check, error: checkError } = await supabase
        .from("attendance")
        .select("id")
        .eq("id", attendance.id)
        .maybeSingle();

    if (checkError) {
        console.error("Failed to verify deletion:", checkError);
        showMessage("Delete request completed, but verification failed.", "error");
        deleteButton.disabled = false;
        deleteButton.textContent = "🗑️ Delete Attendance";
        return;
    }

    if (check) {
        showMessage("The attendance record was not deleted.", "error");
        deleteButton.disabled = false;
        deleteButton.textContent = "🗑️ Delete Attendance";
        return;
    }

    showMessage("Attendance deleted successfully.", "success");
    deleteButton.textContent = "✓ Deleted";

    setTimeout(() => {
        window.location.href = `dashboard.html?refresh=${Date.now()}`;
    }, 800);
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function showMessage(text, type) {
    message.textContent = text;
    message.className = `form-message ${type}`;
    message.style.display = "block";
}

function hideMessage() {
    message.textContent = "";
    message.className = "form-message";
    message.style.display = "none";
}

function showError(text) {
    loading.style.display = "none";
    deleteCard.style.display = "none";
    errorCard.style.display = "block";

    const errorText = errorCard.querySelector(".table-empty");

    if (errorText) {
        errorText.textContent = text;
    }
}

deleteButton?.addEventListener("click", deleteAttendance);

document.addEventListener("DOMContentLoaded", loadAttendance);