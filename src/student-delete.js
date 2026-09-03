import { supabase } from "./supabase.js";

const info = document.getElementById("studentInfo");
const button = document.getElementById("deleteButton");
const message = document.getElementById("messageBox");

const id = new URLSearchParams(window.location.search).get("id");

let student = null;

loadStudent();

async function loadStudent() {

    if (!id) {
        showMessage("Student ID is missing.", "error");
        return;
    }

    const { data, error } = await supabase
        .from("students")
        .select(`
            id,
            student_id,
            first_name,
            last_name,
            class,
            section,
            photo
        `)
        .eq("id", id)
        .single();

    if (error) {
        console.error(error);
        showMessage("Unable to load student.", "error");
        return;
    }

    student = data;

    info.innerHTML = `
        <strong>${escapeHtml(data.first_name)} ${escapeHtml(data.last_name)}</strong>
        <span>ID: ${escapeHtml(data.student_id)}</span>
        <span>Class: ${escapeHtml(data.class || "N/A")}</span>
        <span>Section: ${escapeHtml(data.section || "N/A")}</span>
    `;
}

button.addEventListener("click", async function () {

    if (!student) {
        showMessage("Student information is not loaded.", "error");
        return;
    }

    const confirmed = confirm(
        `Are you sure you want to delete ${student.first_name} ${student.last_name}?`
    );

    if (!confirmed) {
        return;
    }

    button.disabled = true;
    button.textContent = "Deleting...";

    const { error } = await supabase
        .from("students")
        .delete()
        .eq("id", student.id);

    if (error) {

        console.error("Delete error:", error);

        showMessage(
            "Unable to delete student: " + error.message,
            "error"
        );

        button.disabled = false;
        button.textContent = "🗑 Delete Student";

        return;
    }

    showMessage(
        "Student deleted successfully.",
        "success"
    );

    setTimeout(() => {
        window.location.href = "dashboard.html";
    }, 1000);
});

function showMessage(text, type) {

    if (!message) return;

    message.textContent = text;
    message.className = "message " + type;
}

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}