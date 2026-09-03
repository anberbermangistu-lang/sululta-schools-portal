import { supabase } from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const examId = params.get("id");

const loading = document.getElementById("loading");
const examContent = document.getElementById("examContent");
const message = document.getElementById("message");
const editButton = document.getElementById("editButton");

async function loadExam() {

    if (!examId) {
        showError("Exam ID is missing.");
        return;
    }

    const { data, error } = await supabase
        .from("exams")
        .select("*")
        .eq("id", examId)
        .single();

    if (error) {
        console.error("Failed to load exam:", error);
        showError("Failed to load exam.");
        return;
    }

    if (!data) {
        showError("Exam not found.");
        return;
    }

    displayExam(data);
}


function displayExam(exam) {

    document.getElementById("examName").textContent =
        exam.exam_name || "-";

    document.getElementById("examType").textContent =
        exam.exam_type || "-";

    document.getElementById("detailExamName").textContent =
        exam.exam_name || "-";

    document.getElementById("detailExamType").textContent =
        exam.exam_type || "-";

    document.getElementById("detailGradeLevel").textContent =
        exam.grade_level || "-";

    document.getElementById("detailStartDate").textContent =
        formatDate(exam.start_date);

    document.getElementById("detailEndDate").textContent =
        formatDate(exam.end_date);

    document.getElementById("detailDescription").textContent =
        exam.description || "-";

    document.getElementById("detailCreatedAt").textContent =
        formatDateTime(exam.created_at);

    document.getElementById("detailUpdatedAt").textContent =
        formatDateTime(exam.updated_at);

    if (editButton) {
        editButton.href = `edit.html?id=${exam.id}`;
    }

    loading.style.display = "none";
    examContent.style.display = "block";
}


function formatDate(value) {

    if (!value) {
        return "-";
    }

    const date = new Date(value + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
        return "-";
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


function formatDateTime(value) {

    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleString(
        "en-US",
        {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }
    );
}


function showError(text) {

    if (loading) {
        loading.style.display = "none";
    }

    if (examContent) {
        examContent.style.display = "none";
    }

    if (message) {

        message.textContent = text;

        message.style.display = "block";

        message.className = "message error";
    }
}


document.addEventListener(
    "DOMContentLoaded",
    loadExam
);