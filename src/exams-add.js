import { supabase } from "./supabase.js";

const form = document.getElementById("examForm");
const saveButton = document.getElementById("saveButton");
const formMessage = document.getElementById("formMessage");

form.addEventListener("submit", async (event) => {

    event.preventDefault();

    clearMessage();

    const examName = document.getElementById("exam_name").value.trim();
    const examType = document.getElementById("exam_type").value;
    const gradeLevel = document.getElementById("grade_level").value;
    const startDate = document.getElementById("start_date").value;
    const endDate = document.getElementById("end_date").value;
    const description = document.getElementById("description").value.trim();

    if (!examName) {
        showMessage("Please enter the exam name.", "error");
        return;
    }

    if (!examType) {
        showMessage("Please select the exam type.", "error");
        return;
    }

    if (!gradeLevel) {
        showMessage("Please select the grade level.", "error");
        return;
    }

    if (!startDate) {
        showMessage("Please select the start date.", "error");
        return;
    }

    if (!endDate) {
        showMessage("Please select the end date.", "error");
        return;
    }

    if (new Date(endDate) < new Date(startDate)) {
        showMessage(
            "End date cannot be earlier than the start date.",
            "error"
        );
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    const { data, error } = await supabase
        .from("exams")
        .insert([
            {
                exam_name: examName,
                exam_type: examType,
                grade_level: gradeLevel,
                start_date: startDate,
                end_date: endDate,
                description: description || null
            }
        ])
        .select()
        .single();

    if (error) {

        console.error("Failed to add exam:", error);

        showMessage(
            "Failed to add exam: " + error.message,
            "error"
        );

        saveButton.disabled = false;
        saveButton.textContent = "💾 Save Exam";

        return;
    }

    console.log("Exam added successfully:", data);

    showMessage(
        "Exam added successfully.",
        "success"
    );

    saveButton.textContent = "✓ Saved";

    setTimeout(() => {
        window.location.href = "dashboard.html";
    }, 800);
});


function showMessage(text, type) {

    formMessage.textContent = text;

    formMessage.className =
        `form-message ${type}`;

    formMessage.style.display = "block";
}


function clearMessage() {

    formMessage.textContent = "";

    formMessage.className =
        "form-message";

    formMessage.style.display = "none";
}