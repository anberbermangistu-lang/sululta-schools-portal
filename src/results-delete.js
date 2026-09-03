import { supabase } from "./supabase.js";

const messageBox = document.getElementById("messageBox");
const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const deleteContent = document.getElementById("deleteContent");
const deleteButton = document.getElementById("deleteButton");
const retryButton = document.getElementById("retryButton");
const sidebarToggle = document.getElementById("sidebarToggle");

const studentId = document.getElementById("studentId");
const subjectCode = document.getElementById("subjectCode");
const examType = document.getElementById("examType");
const mark = document.getElementById("mark");
const grade = document.getElementById("grade");
const remark = document.getElementById("remark");

let resultId = null;
let currentResult = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    setupSidebar();
    setupEvents();

    const params =
        new URLSearchParams(window.location.search);

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
    retryButton?.addEventListener(
        "click",
        loadResult
    );

    deleteButton?.addEventListener(
        "click",
        handleDelete
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
                    "Unable to logout. Please try again.",
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
            `Unable to load this result: ${error.message}`
        );

        return;
    }

    if (!data) {
        showError(
            "The requested result could not be found."
        );

        return;
    }

    currentResult = data;

    renderResult(data);

    showContent();

    document.title =
        `${data.student_id || "Result"} | Delete Result | Sululta School Portal`;
}

function renderResult(result) {
    if (studentId) {
        studentId.textContent =
            result.student_id || "N/A";
    }

    if (subjectCode) {
        subjectCode.textContent =
            result.subject_code || "N/A";
    }

    if (examType) {
        examType.textContent =
            result.exam_type || "N/A";
    }

    if (mark) {
        mark.textContent =
            result.mark ?? "N/A";
    }

    if (grade) {
        grade.textContent =
            result.grade || "N/A";
    }

    if (remark) {
        remark.textContent =
            result.remark || "N/A";
    }
}

async function handleDelete() {
    if (!resultId || !currentResult) {
        showMessage(
            "No result is selected.",
            "error"
        );

        return;
    }

    const student =
        currentResult.student_id || "this student";

    const subject =
        currentResult.subject_code || "this subject";

    const confirmed =
        window.confirm(
            `Are you sure you want to delete the result for ${student} (${subject})?\n\nThis action cannot be undone.`
        );

    if (!confirmed) {
        return;
    }

    setDeleting(true);

    const { error } =
        await supabase
            .from("results")
            .delete()
            .eq("id", resultId);

    setDeleting(false);

    if (error) {
        console.error(
            "Failed to delete result:",
            error
        );

        showMessage(
            `Unable to delete result: ${error.message}`,
            "error"
        );

        return;
    }

    showMessage(
        "Result deleted successfully.",
        "success"
    );

    setTimeout(() => {
        window.location.href =
            "dashboard.html";
    }, 800);
}

function setDeleting(deleting) {
    if (!deleteButton) {
        return;
    }

    deleteButton.disabled =
        deleting;

    deleteButton.textContent =
        deleting
            ? "Deleting..."
            : "🗑️ Delete Result";
}

function showLoading() {
    if (loadingState) {
        loadingState.hidden = false;
    }

    if (errorState) {
        errorState.hidden = true;
    }

    if (deleteContent) {
        deleteContent.hidden = true;
    }
}

function showContent() {
    if (loadingState) {
        loadingState.hidden = true;
    }

    if (errorState) {
        errorState.hidden = true;
    }

    if (deleteContent) {
        deleteContent.hidden = false;
    }
}

function showError(message) {
    if (loadingState) {
        loadingState.hidden = true;
    }

    if (deleteContent) {
        deleteContent.hidden = true;
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
        "Result delete error:",
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