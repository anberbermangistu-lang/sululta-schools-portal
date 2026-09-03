import { supabase } from "./supabase.js";

const messageBox = document.getElementById("messageBox");
const refreshButton = document.getElementById("refreshResults");
const searchInput = document.getElementById("resultSearch");
const examTypeFilter = document.getElementById("examTypeFilter");
const gradeFilter = document.getElementById("gradeFilter");
const clearFiltersButton = document.getElementById("clearFilters");
const tableBody = document.getElementById("resultsTableBody");

const totalResults = document.getElementById("totalResults");
const totalStudents = document.getElementById("totalStudents");
const totalSubjects = document.getElementById("totalSubjects");
const totalExamTypes = document.getElementById("totalExamTypes");

const recordBadge = document.getElementById("recordBadge");
const recordSummary = document.getElementById("recordSummary");

let results = [];

document.addEventListener("DOMContentLoaded", init);

async function init() {
    setupSidebar();
    setupLogout();
    setupEvents();
    await loadResults();
}

function setupSidebar() {
    const toggle = document.getElementById("sidebarToggle");
    const page = document.querySelector(".admin-page");

    if (!toggle || !page) return;

    toggle.addEventListener("click", () => {
        page.classList.toggle("sidebar-collapsed");
    });
}

function setupLogout() {
    const button = document.getElementById("logoutButton");

    if (!button) return;

    button.addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.href = "/index.html";
    });
}

function setupEvents() {
    refreshButton?.addEventListener("click", loadResults);

    searchInput?.addEventListener("input", renderResults);

    examTypeFilter?.addEventListener("change", renderResults);

    gradeFilter?.addEventListener("change", renderResults);

    clearFiltersButton?.addEventListener("click", clearFilters);

    tableBody?.addEventListener("click", handleTableAction);
}

async function loadResults() {
    showMessage("", false);

    setLoadingState();

    try {
        const { data, error } = await supabase
            .from("results")
            .select("*")
            .order("id", { ascending: false });

        if (error) {
            throw error;
        }

        results = data || [];

        updateStats();
        populateFilters();
        renderResults();

    } catch (error) {
        console.error(error);

        results = [];

        updateStats();
        renderResults();

        showMessage(
            error.message || "Failed to load result records.",
            true
        );
    }
}

function updateStats() {
    const studentSet = new Set();
    const subjectSet = new Set();
    const examTypeSet = new Set();

    results.forEach(result => {
        if (result.student_id !== null && result.student_id !== undefined) {
            studentSet.add(String(result.student_id));
        }

        if (result.subject_code) {
            subjectSet.add(String(result.subject_code));
        }

        if (result.exam_type) {
            examTypeSet.add(String(result.exam_type));
        }
    });

    if (totalResults) {
        totalResults.textContent = results.length;
    }

    if (totalStudents) {
        totalStudents.textContent = studentSet.size;
    }

    if (totalSubjects) {
        totalSubjects.textContent = subjectSet.size;
    }

    if (totalExamTypes) {
        totalExamTypes.textContent = examTypeSet.size;
    }
}

function populateFilters() {
    const examTypes = [
        ...new Set(
            results
                .map(result => result.exam_type)
                .filter(Boolean)
        )
    ].sort();

    const grades = [
        ...new Set(
            results
                .map(result => result.grade)
                .filter(Boolean)
        )
    ].sort();

    const selectedExamType = examTypeFilter?.value || "";
    const selectedGrade = gradeFilter?.value || "";

    if (examTypeFilter) {
        examTypeFilter.innerHTML = `
            <option value="">
                All Exam Types
            </option>
        `;

        examTypes.forEach(type => {
            const option = document.createElement("option");
            option.value = type;
            option.textContent = type;
            examTypeFilter.appendChild(option);
        });

        examTypeFilter.value = selectedExamType;
    }

    if (gradeFilter) {
        gradeFilter.innerHTML = `
            <option value="">
                All Grades
            </option>
        `;

        grades.forEach(grade => {
            const option = document.createElement("option");
            option.value = grade;
            option.textContent = grade;
            gradeFilter.appendChild(option);
        });

        gradeFilter.value = selectedGrade;
    }
}

function getFilteredResults() {
    const search = (searchInput?.value || "")
        .trim()
        .toLowerCase();

    const examType = examTypeFilter?.value || "";
    const grade = gradeFilter?.value || "";

    return results.filter(result => {
        const studentId = String(result.student_id ?? "").toLowerCase();
        const subjectCode = String(result.subject_code ?? "").toLowerCase();
        const exam = String(result.exam_type ?? "").toLowerCase();
        const mark = String(result.mark ?? "").toLowerCase();
        const resultGrade = String(result.grade ?? "").toLowerCase();
        const remark = String(result.remark ?? "").toLowerCase();

        const matchesSearch =
            !search ||
            studentId.includes(search) ||
            subjectCode.includes(search) ||
            exam.includes(search) ||
            mark.includes(search) ||
            resultGrade.includes(search) ||
            remark.includes(search);

        const matchesExamType =
            !examType ||
            String(result.exam_type ?? "") === examType;

        const matchesGrade =
            !grade ||
            String(result.grade ?? "") === grade;

        return (
            matchesSearch &&
            matchesExamType &&
            matchesGrade
        );
    });
}

function renderResults() {
    if (!tableBody) return;

    const filteredResults = getFilteredResults();

    tableBody.innerHTML = "";

    if (filteredResults.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="table-empty"
                >
                    No result records found.
                </td>
            </tr>
        `;

        updateRecordInfo(0);

        return;
    }

    filteredResults.forEach((result, index) => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>
                ${index + 1}
            </td>

            <td>
                ${escapeHtml(result.student_id ?? "—")}
            </td>

            <td>
                ${escapeHtml(result.subject_code ?? "—")}
            </td>

            <td>
                ${escapeHtml(result.exam_type ?? "—")}
            </td>

            <td>
                ${escapeHtml(result.mark ?? "—")}
            </td>

            <td>
                ${escapeHtml(result.grade ?? "—")}
            </td>

            <td>
                ${escapeHtml(result.remark ?? "—")}
            </td>

            <td>
                <div class="table-actions">

                    <a
                        href="/results/view.html?id=${encodeURIComponent(result.id)}"
                        class="action-button action-view"
                    >
                        View
                    </a>

                    <a
                        href="/results/edit.html?id=${encodeURIComponent(result.id)}"
                        class="action-button action-edit"
                    >
                        Edit
                    </a>

                    <button
                        type="button"
                        class="action-button action-delete"
                        data-action="delete"
                        data-id="${result.id}"
                    >
                        Delete
                    </button>

                </div>
            </td>
        `;

        tableBody.appendChild(row);
    });

    updateRecordInfo(filteredResults.length);
}

function updateRecordInfo(count) {
    if (recordBadge) {
        recordBadge.textContent =
            `${count} ${count === 1 ? "Record" : "Records"}`;
    }

    if (recordSummary) {
        recordSummary.textContent =
            `Showing ${count} of ${results.length} records`;
    }
}

async function handleTableAction(event) {
    const button = event.target.closest(
        '[data-action="delete"]'
    );

    if (!button) return;

    const id = button.dataset.id;

    if (!id) return;

    const confirmed = window.confirm(
        "Are you sure you want to delete this result?"
    );

    if (!confirmed) return;

    button.disabled = true;

    try {
        const { error } = await supabase
            .from("results")
            .delete()
            .eq("id", id);

        if (error) {
            throw error;
        }

        results = results.filter(
            result => String(result.id) !== String(id)
        );

        updateStats();
        populateFilters();
        renderResults();

        showMessage(
            "Result deleted successfully.",
            false
        );

    } catch (error) {
        console.error(error);

        showMessage(
            error.message || "Failed to delete result.",
            true
        );

        button.disabled = false;
    }
}

function clearFilters() {
    if (searchInput) {
        searchInput.value = "";
    }

    if (examTypeFilter) {
        examTypeFilter.value = "";
    }

    if (gradeFilter) {
        gradeFilter.value = "";
    }

    renderResults();
}

function setLoadingState() {
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td
                colspan="8"
                class="table-empty"
            >
                Loading result records...
            </td>
        </tr>
    `;
}

function showMessage(message, isError = false) {
    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.hidden = !message;

    messageBox.classList.toggle(
        "error",
        Boolean(isError)
    );

    messageBox.classList.toggle(
        "success",
        Boolean(message) && !isError
    );
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}