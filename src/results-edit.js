import { supabase } from "./supabase.js";

const messageBox = document.getElementById("messageBox");
const resultForm = document.getElementById("resultForm");
const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const retryButton = document.getElementById("retryButton");
const saveButton = document.getElementById("saveButton");
const sidebarToggle = document.getElementById("sidebarToggle");

const studentIdInput = document.getElementById("studentId");
const subjectCodeInput = document.getElementById("subjectCode");
const examTypeInput = document.getElementById("examType");
const markInput = document.getElementById("mark");
const gradeInput = document.getElementById("grade");
const remarkInput = document.getElementById("remark");

let resultId = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    setupSidebar();
    setupEvents();

    const params = new URLSearchParams(
        window.location.search
    );

    resultId = params.get("id");

    if (!resultId) {
        showError("No result ID was provided.");
        return;
    }

    await loadResult();
}

function setupSidebar() {
    const sidebar =
        document.querySelector(".admin-sidebar");

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

function setupEvents() {
    resultForm?.addEventListener(
        "submit",
        handleSubmit
    );

    markInput?.addEventListener(
        "input",
        calculateResult
    );

    retryButton?.addEventListener(
        "click",
        loadResult
    );

    const logoutButton =
        document.querySelector(".logout-button");

    logoutButton?.addEventListener(
        "click",
        async event => {
            event.preventDefault();

            const { error } =
                await supabase.auth.signOut();

            if (error) {
                showMessage(
                    error.message ||
                    "Unable to logout.",
                    "error"
                );

                return;
            }

            window.location.href =
                "../login.html";
        }
    );
}

async function loadResult() {
    showLoading();

    const { data, error } =
        await supabase
            .from("results")
            .select(`
                id,
                student_id,
                subject_code,
                exam_type,
                mark,
                grade,
                remark,
                created_at
            `)
            .eq("id", resultId)
            .maybeSingle();

    if (error) {
        console.error(
            "Failed to load result:",
            error
        );

        showError(
            `Failed to load result: ${error.message}`
        );

        return;
    }

    if (!data) {
        showError(
            `No result was found with ID ${resultId}.`
        );

        return;
    }

    fillForm(data);

    showForm();

    document.title =
        `${data.student_id || "Result"} - Edit Result | Sululta School Portal`;
}

function fillForm(result) {
    if (studentIdInput) {
        studentIdInput.value =
            result.student_id || "";
    }

    if (subjectCodeInput) {
        subjectCodeInput.value =
            result.subject_code || "";
    }

    if (examTypeInput) {
        examTypeInput.value =
            result.exam_type || "";
    }

    if (markInput) {
        markInput.value =
            result.mark ?? "";
    }

    if (gradeInput) {
        gradeInput.value =
            result.grade || "";
    }

    if (remarkInput) {
        remarkInput.value =
            result.remark || "";
    }
}

function calculateResult() {
    const mark =
        Number(markInput?.value);

    if (
        markInput?.value === "" ||
        Number.isNaN(mark)
    ) {
        gradeInput.value = "";
        remarkInput.value = "";
        return;
    }

    const result =
        getGradeAndRemark(mark);

    gradeInput.value =
        result.grade;

    remarkInput.value =
        result.remark;
}

function getGradeAndRemark(mark) {
    if (mark >= 90) {
        return {
            grade: "A+",
            remark: "Excellent"
        };
    }

    if (mark >= 80) {
        return {
            grade: "A",
            remark: "Very Good"
        };
    }

    if (mark >= 70) {
        return {
            grade: "B",
            remark: "Good"
        };
    }

    if (mark >= 60) {
        return {
            grade: "C",
            remark: "Satisfactory"
        };
    }

    if (mark >= 50) {
        return {
            grade: "D",
            remark: "Pass"
        };
    }

    return {
        grade: "F",
        remark: "Fail"
    };
}

async function handleSubmit(event) {
    event.preventDefault();

    if (!resultId) {
        showMessage(
            "Result ID is missing.",
            "error"
        );

        return;
    }

    const studentId =
        studentIdInput.value.trim();

    const subjectCode =
        subjectCodeInput.value.trim();

    const examType =
        examTypeInput.value;

    const mark =
        Number(markInput.value);

    if (!studentId) {
        showMessage(
            "Please enter the student ID.",
            "error"
        );

        studentIdInput.focus();
        return;
    }

    if (!subjectCode) {
        showMessage(
            "Please enter the subject code.",
            "error"
        );

        subjectCodeInput.focus();
        return;
    }

    if (!examType) {
        showMessage(
            "Please select the exam type.",
            "error"
        );

        examTypeInput.focus();
        return;
    }

    if (
        Number.isNaN(mark) ||
        mark < 0 ||
        mark > 100
    ) {
        showMessage(
            "Mark must be between 0 and 100.",
            "error"
        );

        markInput.focus();
        return;
    }

    const calculated =
        getGradeAndRemark(mark);

    gradeInput.value =
        calculated.grade;

    remarkInput.value =
        calculated.remark;

    setSaving(true);

    const { error } =
        await supabase
            .from("results")
            .update({
                student_id: studentId,
                subject_code: subjectCode,
                exam_type: examType,
                mark: mark,
                grade: calculated.grade,
                remark: calculated.remark
            })
            .eq("id", resultId);

    setSaving(false);

    if (error) {
        console.error(
            "Failed to update result:",
            error
        );

        showMessage(
            `Failed to update result: ${error.message}`,
            "error"
        );

        return;
    }

    showMessage(
        "Result updated successfully.",
        "success"
    );

    setTimeout(() => {
        window.location.href =
            `view.html?id=${encodeURIComponent(resultId)}`;
    }, 800);
}

function setSaving(saving) {
    if (!saveButton) {
        return;
    }

    saveButton.disabled =
        saving;

    saveButton.textContent =
        saving
            ? "Saving Changes..."
            : "Save Changes";
}

function showLoading() {
    if (loadingState) {
        loadingState.hidden = false;
    }

    if (errorState) {
        errorState.hidden = true;
    }

    if (resultForm) {
        resultForm.hidden = true;
    }
}

function showForm() {
    if (loadingState) {
        loadingState.hidden = true;
    }

    if (errorState) {
        errorState.hidden = true;
    }

    if (resultForm) {
        resultForm.hidden = false;
    }
}

function showError(message) {
    if (loadingState) {
        loadingState.hidden = true;
    }

    if (resultForm) {
        resultForm.hidden = true;
    }

    if (errorState) {
        errorState.hidden = false;

        const errorMessage =
            errorState.querySelector(
                ".error-message"
            );

        if (errorMessage) {
            errorMessage.textContent =
                message;
        }
    }

    console.error(
        "Result edit error:",
        message
    );
}

function showMessage(
    message,
    type = "success"
) {
    if (!messageBox) {
        return;
    }

    messageBox.textContent =
        message;

    messageBox.className =
        `message ${type}`;

    setTimeout(() => {
        if (!messageBox) {
            return;
        }

        messageBox.textContent =
            "";

        messageBox.className =
            "message";
    }, 4000);
}