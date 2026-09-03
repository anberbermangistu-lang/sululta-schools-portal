import { supabase } from "./supabase.js";

const form = document.getElementById("resultForm");
const studentIdInput = document.getElementById("studentId");
const subjectCodeInput = document.getElementById("subjectCode");
const examTypeInput = document.getElementById("examType");
const markInput = document.getElementById("mark");
const gradeInput = document.getElementById("grade");
const remarkInput = document.getElementById("remark");
const saveButton = document.getElementById("saveButton");
const messageBox = document.getElementById("messageBox");
const sidebarToggle = document.getElementById("sidebarToggle");

document.addEventListener("DOMContentLoaded", initialize);

function initialize() {
    setupSidebar();
    setupMarkCalculation();
    setupForm();
    setupLogout();
}

function setupSidebar() {
    const sidebar = document.querySelector(".admin-sidebar");

    sidebarToggle?.addEventListener("click", event => {
        event.stopPropagation();
        sidebar?.classList.toggle("open");
    });

    document.addEventListener("click", event => {
        if (
            window.innerWidth <= 900 &&
            sidebar?.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            !sidebarToggle?.contains(event.target)
        ) {
            sidebar.classList.remove("open");
        }
    });
}

function setupMarkCalculation() {
    markInput?.addEventListener("input", calculateResult);
}

function calculateResult() {
    const value = markInput?.value;

    if (value === "") {
        gradeInput.value = "";
        remarkInput.value = "";
        return;
    }

    const mark = Number(value);

    if (!Number.isFinite(mark) || mark < 0 || mark > 100) {
        gradeInput.value = "";
        remarkInput.value = "";
        return;
    }

    if (mark >= 90) {
        gradeInput.value = "A+";
        remarkInput.value = "Excellent";
    } else if (mark >= 80) {
        gradeInput.value = "A";
        remarkInput.value = "Very Good";
    } else if (mark >= 70) {
        gradeInput.value = "B";
        remarkInput.value = "Good";
    } else if (mark >= 60) {
        gradeInput.value = "C";
        remarkInput.value = "Satisfactory";
    } else if (mark >= 50) {
        gradeInput.value = "D";
        remarkInput.value = "Pass";
    } else {
        gradeInput.value = "F";
        remarkInput.value = "Fail";
    }
}

function setupForm() {
    form?.addEventListener("submit", handleSubmit);
}

async function handleSubmit(event) {
    event.preventDefault();

    const studentId = studentIdInput?.value.trim();
    const subjectCode = subjectCodeInput?.value.trim();
    const examType = examTypeInput?.value;
    const markValue = markInput?.value;

    if (!studentId) {
        showMessage("Please enter the student ID.", "error");
        studentIdInput?.focus();
        return;
    }

    if (!subjectCode) {
        showMessage("Please enter the subject code.", "error");
        subjectCodeInput?.focus();
        return;
    }

    if (!examType) {
        showMessage("Please select the exam type.", "error");
        examTypeInput?.focus();
        return;
    }

    if (markValue === "") {
        showMessage("Please enter the mark.", "error");
        markInput?.focus();
        return;
    }

    const mark = Number(markValue);

    if (!Number.isFinite(mark) || mark < 0 || mark > 100) {
        showMessage(
            "Mark must be a number between 0 and 100.",
            "error"
        );
        markInput?.focus();
        return;
    }

    calculateResult();

    const grade = gradeInput?.value || "";
    const remark = remarkInput?.value || "";

    const resultData = {
        student_id: String(studentId),
        subject_code: String(subjectCode),
        exam_type: String(examType),
        mark: mark,
        grade: String(grade),
        remark: String(remark)
    };

    console.log("Submitting result:", resultData);

    setSaving(true);

    const { data, error } = await supabase
        .from("results")
        .insert(resultData)
        .select()
        .single();

    if (error) {
        console.error("Failed to save result:", error);
        console.error("Error message:", error?.message);
        console.error("Error details:", error?.details);
        console.error("Error hint:", error?.hint);
        console.error("Error code:", error?.code);

        const fullError = [
            error?.message,
            error?.details,
            error?.hint
        ]
            .filter(Boolean)
            .join(" ");

        showMessage(
            fullError || "Unable to save the result.",
            "error"
        );

        setSaving(false);
        return;
    }

    console.log("Result saved:", data);

    showMessage(
        "Result saved successfully.",
        "success"
    );

    form.reset();

    if (gradeInput) {
        gradeInput.value = "";
    }

    if (remarkInput) {
        remarkInput.value = "";
    }

    setTimeout(() => {
        window.location.href = "dashboard.html";
    }, 1000);
}

function setSaving(saving) {
    if (!saveButton) {
        return;
    }

    saveButton.disabled = saving;
    saveButton.textContent = saving
        ? "Saving..."
        : "Save Result";
}

function showMessage(message, type = "success") {
    if (!messageBox) {
        return;
    }

    messageBox.textContent = message;
    messageBox.className = `message ${type}`;

    messageBox.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

    if (type !== "error") {
        setTimeout(() => {
            if (!messageBox) {
                return;
            }

            messageBox.textContent = "";
            messageBox.className = "message";
        }, 4000);
    }
}

function setupLogout() {
    const logoutButton = document.querySelector(".logout-button");

    logoutButton?.addEventListener("click", async event => {
        event.preventDefault();

        const { error } = await supabase.auth.signOut();

        if (error) {
            showMessage(
                error.message || "Unable to logout. Please try again.",
                "error"
            );
            return;
        }

        window.location.href = "../login.html";
    });
}