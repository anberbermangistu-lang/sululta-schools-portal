import { supabase } from "./supabase.js";

const messageBox = document.getElementById("messageBox");
const resultContent = document.getElementById("resultContent");
const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const retryButton = document.getElementById("retryButton");
const sidebarToggle = document.getElementById("sidebarToggle");

let currentResult = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    setupSidebar();
    setupActions();
    await loadResult();
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

function setupActions() {
    retryButton?.addEventListener("click", loadResult);

    document.addEventListener("click", async event => {
        const deleteButton =
            event.target.closest("#deleteResultButton");

        if (!deleteButton || !currentResult) {
            return;
        }

        event.preventDefault();

        const confirmed = window.confirm(
            `Are you sure you want to delete the result for "${currentResult.student_id}"?`
        );

        if (!confirmed) {
            return;
        }

        await deleteResult(currentResult.id);
    });

    const logoutButton =
        document.querySelector(".logout-button");

    logoutButton?.addEventListener("click", async event => {
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
    });
}

async function loadResult() {
    showLoading();

    const params =
        new URLSearchParams(
            window.location.search
        );

    const resultId =
        params.get("id");

    if (!resultId) {
        showError(
            "No result ID was provided in the URL."
        );

        return;
    }

    console.log(
        "Loading result ID:",
        resultId
    );

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
            "Supabase result error:",
            error
        );

        showError(
            `Failed to load result: ${error.message}`
        );

        return;
    }

    console.log(
        "Result data:",
        data
    );

    if (!data) {
        showError(
            `No result was found with ID ${resultId}.`
        );

        return;
    }

    currentResult = data;

    renderResult(data);
}

function renderResult(result) {
    if (loadingState) {
        loadingState.hidden = true;
    }

    if (errorState) {
        errorState.hidden = true;
    }

    if (!resultContent) {
        return;
    }

    resultContent.hidden = false;

    setText(
        "resultStudentId",
        result.student_id
    );

    setText(
        "resultStudentIdDetail",
        result.student_id
    );

    setText(
        "resultSubjectCode",
        result.subject_code
    );

    setText(
        "resultExamType",
        result.exam_type
    );

    setText(
        "resultMark",
        result.mark !== null &&
        result.mark !== undefined
            ? formatMark(result.mark)
            : "N/A"
    );

    setText(
        "resultGrade",
        result.grade
    );

    setText(
        "resultRemark",
        result.remark
    );

    setText(
        "resultCreatedAt",
        formatDateTime(result.created_at)
    );

    updateGradeBadge(
        result.grade
    );

    const editButton =
        document.getElementById(
            "editResultButton"
        );

    if (editButton) {
        editButton.href =
            `edit.html?id=${encodeURIComponent(result.id)}`;
    }

    const deleteButton =
        document.getElementById(
            "deleteResultButton"
        );

    if (deleteButton) {
        deleteButton.dataset.id =
            result.id;
    }

    updatePageTitle(result);
}

function updateGradeBadge(grade) {
    const badge =
        document.getElementById(
            "resultGradeBadge"
        );

    if (!badge) {
        return;
    }

    const cleanGrade =
        String(grade || "N/A")
            .trim()
            .toUpperCase();

    badge.textContent =
        cleanGrade || "N/A";

    badge.className =
        "result-grade-badge";

    if (cleanGrade === "A") {
        badge.classList.add(
            "grade-a"
        );
    } else if (cleanGrade === "B") {
        badge.classList.add(
            "grade-b"
        );
    } else if (cleanGrade === "C") {
        badge.classList.add(
            "grade-c"
        );
    } else if (cleanGrade === "D") {
        badge.classList.add(
            "grade-d"
        );
    } else if (cleanGrade === "F") {
        badge.classList.add(
            "grade-f"
        );
    }
}

async function deleteResult(resultId) {
    showMessage(
        "Deleting result...",
        "info"
    );

    const { error } =
        await supabase
            .from("results")
            .delete()
            .eq("id", resultId);

    if (error) {
        console.error(
            "Failed to delete result:",
            error
        );

        showMessage(
            error.message ||
            "Unable to delete the result.",
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

function showLoading() {
    if (loadingState) {
        loadingState.hidden = false;
    }

    if (errorState) {
        errorState.hidden = true;
    }

    if (resultContent) {
        resultContent.hidden = true;
    }
}

function showError(message) {
    if (loadingState) {
        loadingState.hidden = true;
    }

    if (resultContent) {
        resultContent.hidden = true;
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
        "Result page error:",
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

function setText(id, value) {
    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    ) {
        element.textContent =
            "N/A";

        return;
    }

    element.textContent =
        String(value);
}

function formatMark(mark) {
    const number =
        Number(mark);

    if (Number.isNaN(number)) {
        return String(mark);
    }

    if (Number.isInteger(number)) {
        return String(number);
    }

    return number.toFixed(2);
}

function formatDateTime(value) {
    if (!value) {
        return "N/A";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "N/A";
    }

    return date.toLocaleString(
        "en-US",
        {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }
    );
}

function updatePageTitle(result) {
    const studentId =
        result.student_id ||
        "Result";

    document.title =
        `${studentId} Result | Sululta School Portal`;
}