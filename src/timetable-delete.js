import { supabase } from "./supabase.js";

const loading = document.getElementById("loading");
const deleteCard = document.getElementById("deleteCard");
const errorCard = document.getElementById("errorCard");

const deleteButton = document.getElementById("deleteButton");
const viewButton = document.getElementById("viewButton");

const deleteMessage = document.getElementById("deleteMessage");
const errorMessage = document.getElementById("errorMessage");

const params = new URLSearchParams(window.location.search);
const timetableId = params.get("id");

function showError(message) {
    loading.style.display = "none";
    deleteCard.style.display = "none";
    errorCard.style.display = "block";

    errorMessage.textContent = message;
}

function showMessage(message, type) {
    deleteMessage.textContent = message;
    deleteMessage.className = `form-message ${type}`;
    deleteMessage.style.display = "block";
}

function formatTime(value) {
    if (!value) {
        return "—";
    }

    const parts = String(value).split(":");

    if (parts.length < 2) {
        return String(value);
    }

    let hour = Number(parts[0]);
    const minute = parts[1];

    if (Number.isNaN(hour)) {
        return String(value);
    }

    const period = hour >= 12 ? "PM" : "AM";

    hour = hour % 12;

    if (hour === 0) {
        hour = 12;
    }

    return `${hour}:${minute} ${period}`;
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value || "—";
    }
}

async function loadTimetable() {
    if (!timetableId) {
        showError("No timetable record ID was provided.");
        return;
    }

    if (!/^\d+$/.test(timetableId)) {
        showError("Invalid timetable record ID.");
        return;
    }

    const { data, error } = await supabase
        .from("timetable")
        .select(`
            id,
            class_name,
            section,
            subject_code,
            subject_name,
            day,
            start_time,
            end_time,
            room_number,
            academic_year
        `)
        .eq("id", timetableId)
        .single();

    if (error) {
        console.error("Failed to load timetable:", error);

        if (error.code === "PGRST116") {
            showError("The requested timetable record was not found.");
        } else {
            showError(
                error.message ||
                "Unable to load timetable record."
            );
        }

        return;
    }

    if (!data) {
        showError("The requested timetable record was not found.");
        return;
    }

    setText("className", data.class_name);
    setText("section", data.section);
    setText("subjectName", data.subject_name);
    setText("subjectCode", data.subject_code);
    setText("day", data.day);
    setText(
        "time",
        `${formatTime(data.start_time)} - ${formatTime(data.end_time)}`
    );
    setText("roomNumber", data.room_number);
    setText("academicYear", data.academic_year);

    viewButton.href =
        `view.html?id=${encodeURIComponent(data.id)}`;

    loading.style.display = "none";
    errorCard.style.display = "none";
    deleteCard.style.display = "block";
}

async function deleteTimetable() {
    const confirmed = window.confirm(
        "Are you sure you want to permanently delete this timetable record?"
    );

    if (!confirmed) {
        return;
    }

    deleteButton.disabled = true;
    deleteButton.textContent = "Deleting...";

    showMessage(
        "Deleting timetable record...",
        "warning"
    );

    const { error } = await supabase
        .from("timetable")
        .delete()
        .eq("id", timetableId);

    if (error) {
        console.error("Failed to delete timetable:", error);

        showMessage(
            error.message ||
            "Failed to delete timetable record.",
            "error"
        );

        deleteButton.disabled = false;
        deleteButton.textContent = "🗑️ Delete Timetable";

        return;
    }

    showMessage(
        "Timetable deleted successfully. Returning to timetable records...",
        "success"
    );

    setTimeout(() => {
        window.location.href = "dashboard.html";
    }, 1000);
}

deleteButton.addEventListener(
    "click",
    deleteTimetable
);

document.addEventListener(
    "DOMContentLoaded",
    loadTimetable
);