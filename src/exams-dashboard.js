import { supabase } from "./supabase.js";

const message = document.getElementById("message");

const totalExams = document.getElementById("totalExams");
const totalExamTypes = document.getElementById("totalExamTypes");
const totalGradeLevels = document.getElementById("totalGradeLevels");
const upcomingExams = document.getElementById("upcomingExams");

const examSearch = document.getElementById("examSearch");
const examTypeFilter = document.getElementById("examTypeFilter");
const gradeLevelFilter = document.getElementById("gradeLevelFilter");

const examsTableBody = document.getElementById("examsTableBody");
const recordBadge = document.getElementById("recordBadge");
const recordSummary = document.getElementById("recordSummary");

const refreshExams = document.getElementById("refreshExams");

let exams = [];

document.addEventListener("DOMContentLoaded", () => {
    loadExams();
    setupEvents();
    setupSidebar();
    setupLogout();
});

function setupEvents() {

    examSearch?.addEventListener(
        "input",
        renderExams
    );

    examTypeFilter?.addEventListener(
        "change",
        renderExams
    );

    gradeLevelFilter?.addEventListener(
        "change",
        renderExams
    );

    refreshExams?.addEventListener(
        "click",
        loadExams
    );

    examsTableBody?.addEventListener(
        "click",
        handleTableAction
    );
}

async function loadExams() {

    showMessage("", false);

    showLoading();

    try {

        const {
            data,
            error
        } = await supabase
            .from("exams")
            .select("*")
            .order("start_date", {
                ascending: true
            });

        if (error) {
            throw error;
        }

        exams = data || [];

        populateFilters();
        updateStatistics();
        renderExams();

    } catch (error) {

        console.error(
            "Exams loading error:",
            error
        );

        exams = [];

        updateStatistics();

        examsTableBody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="table-empty"
                >
                    Unable to load exam records.
                </td>
            </tr>
        `;

        updateRecordInfo(0);

        showMessage(
            error.message ||
            "Unable to load exams.",
            true
        );
    }
}

function populateFilters() {

    if (examTypeFilter) {

        const currentValue =
            examTypeFilter.value;

        const types = [
            ...new Set(
                exams
                    .map(exam =>
                        String(
                            exam.exam_type ||
                            exam.type ||
                            ""
                        ).trim()
                    )
                    .filter(Boolean)
            )
        ].sort();

        examTypeFilter.innerHTML = `
            <option value="">
                All Exam Types
            </option>
        `;

        types.forEach(type => {

            const option =
                document.createElement("option");

            option.value = type;

            option.textContent = type;

            examTypeFilter.appendChild(
                option
            );
        });

        if (
            types.includes(currentValue)
        ) {
            examTypeFilter.value =
                currentValue;
        }
    }

    if (gradeLevelFilter) {

        const currentValue =
            gradeLevelFilter.value;

        const grades = [
            ...new Set(
                exams
                    .map(exam =>
                        String(
                            exam.grade_level ||
                            exam.grade ||
                            ""
                        ).trim()
                    )
                    .filter(Boolean)
            )
        ].sort((a, b) =>
            a.localeCompare(b, undefined, {
                numeric: true
            })
        );

        gradeLevelFilter.innerHTML = `
            <option value="">
                All Grade Levels
            </option>
        `;

        grades.forEach(grade => {

            const option =
                document.createElement("option");

            option.value = grade;

            option.textContent = grade;

            gradeLevelFilter.appendChild(
                option
            );
        });

        if (
            grades.includes(currentValue)
        ) {
            gradeLevelFilter.value =
                currentValue;
        }
    }
}

function updateStatistics() {

    const total =
        exams.length;

    const types = new Set(
        exams
            .map(exam =>
                String(
                    exam.exam_type ||
                    exam.type ||
                    ""
                ).trim()
            )
            .filter(Boolean)
    );

    const grades = new Set(
        exams
            .map(exam =>
                String(
                    exam.grade_level ||
                    exam.grade ||
                    ""
                ).trim()
            )
            .filter(Boolean)
    );

    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );

    const upcoming =
        exams.filter(exam => {

            const dateValue =
                exam.start_date ||
                exam.exam_date ||
                exam.date;

            if (!dateValue) {
                return false;
            }

            const date =
                new Date(dateValue);

            return (
                !Number.isNaN(
                    date.getTime()
                ) &&
                date >= today
            );
        }).length;

    if (totalExams) {
        totalExams.textContent =
            total;
    }

    if (totalExamTypes) {
        totalExamTypes.textContent =
            types.size;
    }

    if (totalGradeLevels) {
        totalGradeLevels.textContent =
            grades.size;
    }

    if (upcomingExams) {
        upcomingExams.textContent =
            upcoming;
    }
}

function renderExams() {

    const search =
        String(
            examSearch?.value || ""
        )
            .trim()
            .toLowerCase();

    const type =
        String(
            examTypeFilter?.value || ""
        )
            .trim()
            .toLowerCase();

    const grade =
        String(
            gradeLevelFilter?.value || ""
        )
            .trim()
            .toLowerCase();

    const filteredExams =
        exams.filter(exam => {

            const name =
                String(
                    exam.name ||
                    exam.exam_name ||
                    exam.title ||
                    ""
                ).toLowerCase();

            const examType =
                String(
                    exam.exam_type ||
                    exam.type ||
                    ""
                ).toLowerCase();

            const gradeLevel =
                String(
                    exam.grade_level ||
                    exam.grade ||
                    ""
                ).toLowerCase();

            const description =
                String(
                    exam.description ||
                    ""
                ).toLowerCase();

            const matchesSearch =
                !search ||
                name.includes(search) ||
                examType.includes(search) ||
                gradeLevel.includes(search) ||
                description.includes(search);

            const matchesType =
                !type ||
                examType === type;

            const matchesGrade =
                !grade ||
                gradeLevel === grade;

            return (
                matchesSearch &&
                matchesType &&
                matchesGrade
            );
        });

    if (!filteredExams.length) {

        examsTableBody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="table-empty"
                >
                    No exams found.
                </td>
            </tr>
        `;

        updateRecordInfo(0);

        return;
    }

    examsTableBody.innerHTML =
        filteredExams
            .map(
                (exam, index) =>
                    createExamRow(
                        exam,
                        index + 1
                    )
            )
            .join("");

    updateRecordInfo(
        filteredExams.length
    );
}

function createExamRow(
    exam,
    number
) {

    const name =
        escapeHtml(
            exam.name ||
            exam.exam_name ||
            exam.title ||
            "Untitled Exam"
        );

    const examType =
        escapeHtml(
            exam.exam_type ||
            exam.type ||
            "N/A"
        );

    const gradeLevel =
        escapeHtml(
            exam.grade_level ||
            exam.grade ||
            "N/A"
        );

    const startDate =
        formatDate(
            exam.start_date ||
            exam.exam_date ||
            exam.date
        );

    const endDate =
        formatDate(
            exam.end_date
        );

    const description =
        escapeHtml(
            exam.description ||
            "—"
        );

    return `
        <tr>

            <td>
                ${number}
            </td>

            <td>
                <strong>
                    ${name}
                </strong>
            </td>

            <td>
                ${examType}
            </td>

            <td>
                ${gradeLevel}
            </td>

            <td>
                ${startDate}
            </td>

            <td>
                ${endDate}
            </td>

            <td>
                ${description}
            </td>

            <td>

                <div class="table-actions">

                    <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        data-action="view"
                        data-id="${exam.id}"
                    >
                        View
                    </button>

                    <button
                        type="button"
                        class="btn btn-primary btn-sm"
                        data-action="edit"
                        data-id="${exam.id}"
                    >
                        Edit
                    </button>

                    <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        data-action="delete"
                        data-id="${exam.id}"
                    >
                        Delete
                    </button>

                </div>

            </td>

        </tr>
    `;
}

function handleTableAction(event) {

    const button =
        event.target.closest(
            "button[data-action]"
        );

    if (!button) {
        return;
    }

    const id =
        button.dataset.id;

    const action =
        button.dataset.action;

    if (!id) {
        return;
    }

    if (action === "view") {

        window.location.href =
            `view.html?id=${encodeURIComponent(id)}`;

        return;
    }

    if (action === "edit") {

        window.location.href =
            `edit.html?id=${encodeURIComponent(id)}`;

        return;
    }

    if (action === "delete") {

        deleteExam(id);
    }
}

async function deleteExam(id) {

    const exam =
        exams.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!exam) {
        return;
    }

    const examName =
        exam.name ||
        exam.exam_name ||
        exam.title ||
        "this exam";

    const confirmed =
        window.confirm(
            `Delete "${examName}"?`
        );

    if (!confirmed) {
        return;
    }

    try {

        const {
            error
        } = await supabase
            .from("exams")
            .delete()
            .eq("id", id);

        if (error) {
            throw error;
        }

        showMessage(
            "Exam deleted successfully.",
            false
        );

        await loadExams();

    } catch (error) {

        console.error(
            "Exam deletion error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to delete exam.",
            true
        );
    }
}

function showLoading() {

    if (!examsTableBody) {
        return;
    }

    examsTableBody.innerHTML = `
        <tr>
            <td
                colspan="8"
                class="table-empty"
            >
                Loading exam records...
            </td>
        </tr>
    `;
}

function updateRecordInfo(count) {

    if (recordBadge) {

        recordBadge.textContent =
            `${count} ${
                count === 1
                    ? "Record"
                    : "Records"
            }`;
    }

    if (recordSummary) {

        recordSummary.textContent =
            `Showing ${count} ${
                count === 1
                    ? "record"
                    : "records"
            }`;
    }
}

function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return escapeHtml(
            String(value)
        );
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

function showMessage(
    text,
    isError
) {

    if (!message) {
        return;
    }

    if (!text) {

        message.hidden = true;
        message.textContent = "";

        return;
    }

    message.hidden = false;

    message.textContent =
        text;

    message.classList.toggle(
        "message-error",
        Boolean(isError)
    );

    message.classList.toggle(
        "message-success",
        !isError
    );
}

function setupSidebar() {

    document
        .getElementById("sidebarToggle")
        ?.addEventListener(
            "click",
            () => {

                document
                    .querySelector(
                        ".admin-sidebar"
                    )
                    ?.classList.toggle(
                        "open"
                    );
            }
        );
}

function setupLogout() {

    document
        .getElementById("logoutButton")
        ?.addEventListener(
            "click",
            async () => {

                const {
                    error
                } =
                    await supabase.auth.signOut();

                if (error) {

                    console.error(
                        "Logout error:",
                        error
                    );

                    showMessage(
                        "Unable to sign out.",
                        true
                    );

                    return;
                }

                window.location.href =
                    "/login.html";
            }
        );
}

function escapeHtml(value) {

    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}