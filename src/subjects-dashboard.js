import { supabase } from "./supabase.js";

const messageBox =
    document.getElementById("message");

const totalSubjects =
    document.getElementById("totalSubjects");

const totalGrades =
    document.getElementById("totalGrades");

const totalCredits =
    document.getElementById("totalCredits");

const activeSubjects =
    document.getElementById("activeSubjects");

const subjectSearch =
    document.getElementById("subjectSearch");

const gradeFilter =
    document.getElementById("gradeFilter");

const statusFilter =
    document.getElementById("statusFilter");

const clearFilters =
    document.getElementById("clearFilters");

const refreshSubjects =
    document.getElementById("refreshSubjects");

const subjectsTableBody =
    document.getElementById("subjectsTableBody");

const recordBadge =
    document.getElementById("recordBadge");

const recordSummary =
    document.getElementById("recordSummary");

let subjects = [];

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupSidebar();
        setupLogout();
        setupEvents();
        loadSubjects();

    }
);

function setupEvents() {

    subjectSearch?.addEventListener(
        "input",
        renderSubjects
    );

    gradeFilter?.addEventListener(
        "change",
        renderSubjects
    );

    statusFilter?.addEventListener(
        "change",
        renderSubjects
    );

    clearFilters?.addEventListener(
        "click",
        clearAllFilters
    );

    refreshSubjects?.addEventListener(
        "click",
        loadSubjects
    );

    subjectsTableBody?.addEventListener(
        "click",
        handleTableAction
    );
}

async function loadSubjects() {

    showLoading();

    try {

        const {
            data,
            error
        } = await supabase
            .from("subjects")
            .select("*")
            .order("id", {
                ascending: true
            });

        if (error) {
            throw error;
        }

        subjects = data || [];

        updateStatistics();
        populateGradeFilter();
        renderSubjects();

    } catch (error) {

        console.error(
            "Subject loading error:",
            error
        );

        subjects = [];

        updateStatistics();

        subjectsTableBody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="table-empty"
                >
                    Unable to load subject records.
                </td>
            </tr>
        `;

        updateRecordInfo(0);

        showMessage(
            error.message ||
            "Unable to load subjects.",
            "error"
        );
    }
}

function updateStatistics() {

    const total =
        subjects.length;

    const grades =
        new Set(
            subjects
                .map(
                    subject =>
                        String(
                            subject.grade_level || ""
                        ).trim()
                )
                .filter(Boolean)
        ).size;

    const credits =
        subjects.reduce(
            (sum, subject) =>
                sum +
                Number(
                    subject.credit || 0
                ),
            0
        );

    const active =
        subjects.filter(
            subject =>
                normalizeStatus(
                    subject.status
                ) === "active"
        ).length;

    if (totalSubjects) {
        totalSubjects.textContent =
            total;
    }

    if (totalGrades) {
        totalGrades.textContent =
            grades;
    }

    if (totalCredits) {
        totalCredits.textContent =
            credits;
    }

    if (activeSubjects) {
        activeSubjects.textContent =
            active;
    }
}

function populateGradeFilter() {

    if (!gradeFilter) {
        return;
    }

    const currentValue =
        gradeFilter.value;

    const grades =
        [
            ...new Set(
                subjects
                    .map(
                        subject =>
                            String(
                                subject.grade_level || ""
                            ).trim()
                    )
                    .filter(Boolean)
            )
        ]
        .sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    undefined,
                    {
                        numeric: true
                    }
                )
        );

    gradeFilter.innerHTML = `
        <option value="">
            All Grade Levels
        </option>
    `;

    grades.forEach(
        grade => {

            const option =
                document.createElement(
                    "option"
                );

            option.value = grade;
            option.textContent = grade;

            gradeFilter.appendChild(
                option
            );
        }
    );

    if (
        grades.includes(
            currentValue
        )
    ) {
        gradeFilter.value =
            currentValue;
    }
}

function renderSubjects() {

    const search =
        String(
            subjectSearch?.value || ""
        )
            .trim()
            .toLowerCase();

    const grade =
        String(
            gradeFilter?.value || ""
        )
            .trim()
            .toLowerCase();

    const status =
        String(
            statusFilter?.value || ""
        )
            .trim()
            .toLowerCase();

    const filtered =
        subjects.filter(
            subject => {

                const name =
                    String(
                        subject.subject_name ||
                        subject.name ||
                        ""
                    ).toLowerCase();

                const code =
                    String(
                        subject.subject_code ||
                        subject.code ||
                        ""
                    ).toLowerCase();

                const gradeLevel =
                    String(
                        subject.grade_level ||
                        ""
                    ).toLowerCase();

                const description =
                    String(
                        subject.description ||
                        ""
                    ).toLowerCase();

                const subjectStatus =
                    normalizeStatus(
                        subject.status
                    );

                const matchesSearch =
                    !search ||
                    name.includes(search) ||
                    code.includes(search) ||
                    gradeLevel.includes(search) ||
                    description.includes(search);

                const matchesGrade =
                    !grade ||
                    gradeLevel === grade;

                const matchesStatus =
                    !status ||
                    subjectStatus === status;

                return (
                    matchesSearch &&
                    matchesGrade &&
                    matchesStatus
                );
            }
        );

    updateRecordInfo(
        filtered.length
    );

    if (!filtered.length) {

        subjectsTableBody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="table-empty"
                >
                    No subjects found.
                </td>
            </tr>
        `;

        return;
    }

    subjectsTableBody.innerHTML =
        filtered
            .map(
                (subject, index) =>
                    createSubjectRow(
                        subject,
                        index + 1
                    )
            )
            .join("");
}

function createSubjectRow(
    subject,
    number
) {

    const name =
        subject.subject_name ||
        subject.name ||
        "N/A";

    const code =
        subject.subject_code ||
        subject.code ||
        "N/A";

    const grade =
        subject.grade_level ||
        "N/A";

    const credit =
        Number(
            subject.credit || 0
        );

    const description =
        subject.description ||
        "N/A";

    const status =
        normalizeStatus(
            subject.status
        );

    const statusClass =
        status === "active"
            ? "status-active"
            : "status-inactive";

    return `
        <tr>

            <td>
                ${number}
            </td>

            <td>
                <strong>
                    ${escapeHtml(name)}
                </strong>
            </td>

            <td>
                ${escapeHtml(code)}
            </td>

            <td>
                ${escapeHtml(grade)}
            </td>

            <td>
                ${credit}
            </td>

            <td>
                ${escapeHtml(description)}
            </td>

            <td>
                <span
                    class="status-badge ${statusClass}"
                >
                    ${capitalize(status)}
                </span>
            </td>

            <td>

                <div class="table-actions">

                    <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        data-action="view"
                        data-id="${subject.id}"
                    >
                        View
                    </button>

                    <button
                        type="button"
                        class="btn btn-primary btn-sm"
                        data-action="edit"
                        data-id="${subject.id}"
                    >
                        Edit
                    </button>

                    <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        data-action="delete"
                        data-id="${subject.id}"
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
            `/subjects/view.html?id=${encodeURIComponent(id)}`;

        return;
    }

    if (action === "edit") {

        window.location.href =
            `/subjects/edit.html?id=${encodeURIComponent(id)}`;

        return;
    }

    if (action === "delete") {

        deleteSubject(
            id,
            button
        );
    }
}

async function deleteSubject(
    id,
    button
) {

    const subject =
        subjects.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!subject) {
        return;
    }

    const name =
        subject.subject_name ||
        subject.name ||
        "this subject";

    const confirmed =
        window.confirm(
            `Delete "${name}"?`
        );

    if (!confirmed) {
        return;
    }

    button.disabled = true;
    button.textContent =
        "Deleting...";

    try {

        const {
            error
        } = await supabase
            .from("subjects")
            .delete()
            .eq("id", id);

        if (error) {
            throw error;
        }

        showMessage(
            "Subject deleted successfully.",
            "success"
        );

        await loadSubjects();

    } catch (error) {

        console.error(
            "Subject deletion error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to delete subject.",
            "error"
        );

        button.disabled = false;
        button.textContent =
            "Delete";
    }
}

function clearAllFilters() {

    if (subjectSearch) {
        subjectSearch.value = "";
    }

    if (gradeFilter) {
        gradeFilter.value = "";
    }

    if (statusFilter) {
        statusFilter.value = "";
    }

    renderSubjects();
}

function updateRecordInfo(
    count
) {

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

function showLoading() {

    if (!subjectsTableBody) {
        return;
    }

    subjectsTableBody.innerHTML = `
        <tr>
            <td
                colspan="8"
                class="table-empty"
            >
                Loading subject records...
            </td>
        </tr>
    `;
}

function normalizeStatus(
    value
) {

    const status =
        String(value || "")
            .trim()
            .toLowerCase();

    return status === "inactive"
        ? "inactive"
        : "active";
}

function capitalize(value) {

    const text =
        String(value || "");

    if (!text) {
        return "";
    }

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
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

function showMessage(
    text,
    type
) {

    if (!messageBox) {
        return;
    }

    messageBox.textContent =
        text;

    messageBox.className =
        `message ${type}`;

    messageBox.hidden = false;

    setTimeout(
        () => {
            messageBox.hidden = true;
        },
        4000
    );
}

function setupSidebar() {

    const toggle =
        document.getElementById(
            "sidebarToggle"
        );

    const sidebar =
        document.querySelector(
            ".admin-sidebar"
        );

    if (!toggle || !sidebar) {
        return;
    }

    toggle.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "mobile-open"
            );
        }
    );
}

function setupLogout() {

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
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
                    "error"
                );

                return;
            }

            window.location.href =
                "/login.html";
        }
    );
}