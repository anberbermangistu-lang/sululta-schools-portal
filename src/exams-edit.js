import { supabase } from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const examId = params.get("id");

const form = document.getElementById("examForm");
const formCard = document.getElementById("formCard");
const loading = document.getElementById("loading");
const formMessage = document.getElementById("formMessage");
const saveButton = document.getElementById("saveButton");

const examName = document.getElementById("exam_name");
const examType = document.getElementById("exam_type");
const gradeLevel = document.getElementById("grade_level");
const startDate = document.getElementById("start_date");
const endDate = document.getElementById("end_date");
const description = document.getElementById("description");

async function loadExam() {
    if (!examId) {
        showMessage("Exam ID is missing.", "error");
        loading.style.display = "none";
        return;
    }

    const { data, error } = await supabase
        .from("exams")
        .select("*")
        .eq("id", examId)
        .single();

    if (error) {
        console.error("Failed to load exam:", error);
        showMessage("Failed to load exam: " + error.message, "error");
        loading.style.display = "none";
        return;
    }

    if (!data) {
        showMessage("Exam not found.", "error");
        loading.style.display = "none";
        return;
    }

    examName.value = data.exam_name || "";
    examType.value = data.exam_type || "";
    gradeLevel.value = data.grade_level || "";
    startDate.value = data.start_date || "";
    endDate.value = data.end_date || "";
    description.value = data.description || "";

    loading.style.display = "none";
    formCard.style.display = "block";
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    clearMessage();

    const updatedName = examName.value.trim();
    const updatedType = examType.value;
    const updatedGrade = gradeLevel.value;
    const updatedStartDate = startDate.value;
    const updatedEndDate = endDate.value;
    const updatedDescription = description.value.trim();

    if (!updatedName) {
        showMessage("Please enter the exam name.", "error");
        return;
    }

    if (!updatedType) {
        showMessage("Please select the exam type.", "error");
        return;
    }

    if (!updatedGrade) {
        showMessage("Please select the grade level.", "error");
        return;
    }

    if (!updatedStartDate) {
        showMessage("Please select the start date.", "error");
        return;
    }

    if (!updatedEndDate) {
        showMessage("Please select the end date.", "error");
        return;
    }

    if (new Date(updatedEndDate) < new Date(updatedStartDate)) {
        showMessage(
            "End date cannot be earlier than the start date.",
            "error"
        );
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Updating...";

    const { data, error } = await supabase
        .from("exams")
        .update({
            exam_name: updatedName,
            exam_type: updatedType,
            grade_level: updatedGrade,
            start_date: updatedStartDate,
            end_date: updatedEndDate,
            description: updatedDescription || null,
            updated_at: new Date().toISOString()
        })
        .eq("id", examId)
        .select()
        .single();

    if (error) {
        console.error("Failed to update exam:", error);

        showMessage(
            "Failed to update exam: " + error.message,
            "error"
        );

        saveButton.disabled = false;
        saveButton.textContent = "💾 Update Exam";
        return;
    }

    showMessage("Exam updated successfully.", "success");

    saveButton.textContent = "✓ Updated";

    setTimeout(() => {
        window.location.href = `view.html?id=${examId}`;
    }, 800);
});

function showMessage(text, type) {
    formMessage.textContent = text;
    formMessage.className = `form-message ${type}`;
    formMessage.style.display = "block";
}

function clearMessage() {
    formMessage.textContent = "";
    formMessage.className = "form-message";
    formMessage.style.display = "none";
}

document.addEventListener("DOMContentLoaded", loadExam);