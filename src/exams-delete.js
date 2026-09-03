import { supabase } from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const examId = params.get("id");

const loading = document.getElementById("loading");
const deleteCard = document.getElementById("deleteCard");
const deleteButton = document.getElementById("deleteButton");
const formMessage = document.getElementById("formMessage");

const examName = document.getElementById("examName");
const examType = document.getElementById("examType");
const gradeLevel = document.getElementById("gradeLevel");
const startDate = document.getElementById("startDate");
const endDate = document.getElementById("endDate");


async function loadExam() {

    if (!examId) {

        showMessage(
            "Exam ID is missing.",
            "error"
        );

        loading.style.display = "none";

        return;
    }


    const { data, error } = await supabase
        .from("exams")
        .select("*")
        .eq("id", examId)
        .single();


    if (error) {

        console.error(
            "Failed to load exam:",
            error
        );

        showMessage(
            "Failed to load exam: " + error.message,
            "error"
        );

        loading.style.display = "none";

        return;
    }


    if (!data) {

        showMessage(
            "Exam not found.",
            "error"
        );

        loading.style.display = "none";

        return;
    }


    examName.textContent =
        data.exam_name || "-";

    examType.textContent =
        data.exam_type || "-";

    gradeLevel.textContent =
        data.grade_level || "-";

    startDate.textContent =
        formatDate(data.start_date);

    endDate.textContent =
        formatDate(data.end_date);


    loading.style.display = "none";

    deleteCard.style.display = "block";
}


deleteButton.addEventListener(
    "click",
    async () => {

        const confirmed = window.confirm(
            "Are you sure you want to delete this exam? This action cannot be undone."
        );


        if (!confirmed) {
            return;
        }


        deleteButton.disabled = true;

        deleteButton.textContent =
            "Deleting...";


        clearMessage();


        const { error } = await supabase
            .from("exams")
            .delete()
            .eq("id", examId);


        if (error) {

            console.error(
                "Failed to delete exam:",
                error
            );


            showMessage(
                "Failed to delete exam: " +
                error.message,
                "error"
            );


            deleteButton.disabled = false;

            deleteButton.textContent =
                "🗑️ Delete Exam";

            return;
        }


        showMessage(
            "Exam deleted successfully.",
            "success"
        );


        deleteButton.textContent =
            "✓ Deleted";


        setTimeout(() => {

            window.location.href =
                "dashboard.html";

        }, 800);

    }
);


function formatDate(value) {

    if (!value) {
        return "-";
    }


    const date =
        new Date(value + "T00:00:00");


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


function showMessage(text, type) {

    formMessage.textContent = text;

    formMessage.className =
        `form-message ${type}`;

    formMessage.style.display =
        "block";
}


function clearMessage() {

    formMessage.textContent = "";

    formMessage.className =
        "form-message";

    formMessage.style.display =
        "none";
}


document.addEventListener(
    "DOMContentLoaded",
    loadExam
);