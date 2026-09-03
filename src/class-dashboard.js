import { supabase } from "./supabase.js";

const tableBody =
    document.getElementById("classesTableBody");

const searchInput =
    document.getElementById("classSearch");

const statusFilter =
    document.getElementById("statusFilter");

const clearFilters =
    document.getElementById("clearFilters");

const refreshButton =
    document.getElementById("refreshClasses");

const totalClasses =
    document.getElementById("totalClasses");

const totalStudents =
    document.getElementById("totalStudents");

const assignedTeachers =
    document.getElementById("assignedTeachers");

const activeClasses =
    document.getElementById("activeClasses");

const recordBadge =
    document.getElementById("recordBadge");

const recordSummary =
    document.getElementById("recordSummary");

const messageBox =
    document.getElementById("message");

let allClasses = [];

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupSidebar();
        setupLogout();
        setupEvents();
        loadClasses();

    }
);

function setupEvents() {

    searchInput?.addEventListener(
        "input",
        renderClasses
    );

    statusFilter?.addEventListener(
        "change",
        renderClasses
    );

    clearFilters?.addEventListener(
        "click",
        clearAllFilters
    );

    refreshButton?.addEventListener(
        "click",
        refreshClasses
    );

    tableBody?.addEventListener(
        "click",
        handleTableAction
    );
}

async function loadClasses() {

    showLoading();

    try {

        const {
            data,
            error
        } = await supabase
            .from("classes")
            .select(`
                id,
                class_name,
                section,
                room_number,
                class_teacher,
                academic_year,
                status,
                created_at,
                updated_at
            `)
            .order("id", {
                ascending: true
            });

        if (error) {
            throw error;
        }

        allClasses = data || [];

        await loadTeacherNames();
        await loadStudentCounts();

        updateStatistics();
        renderClasses();

    } catch (error) {

        console.error(
            "Class loading error:",
            error
        );

        allClasses = [];

        updateStatistics();

        if (tableBody) {

            tableBody.innerHTML = `
                <tr>
                    <td
                        colspan="9"
                        class="table-empty"
                    >
                        Unable to load class records.
                    </td>
                </tr>
            `;

        }

        updateRecordInformation(0);

        showMessage(
            error.message ||
            "Failed to load class records.",
            "error"
        );
    }
}

async function loadTeacherNames() {

    const teacherIds = [
        ...new Set(
            allClasses
                .map(item => item.class_teacher)
                .filter(
                    id =>
                        id !== null &&
                        id !== undefined &&
                        String(id).trim() !== ""
                )
        )
    ];

    if (!teacherIds.length) {

        allClasses =
            allClasses.map(item => ({
                ...item,
                teacher_name: null
            }));

        return;
    }

    const {
        data: teachers,
        error
    } = await supabase
        .from("teachers")
        .select(`
            id,
            first_name,
            last_name,
            teacher_id
        `)
        .in("id", teacherIds);

    if (error) {

        console.error(
            "Teacher loading error:",
            error
        );

        return;
    }

    const teacherMap = {};

    (teachers || []).forEach(
        teacher => {

            const fullName =
                `${teacher.first_name || ""} ${teacher.last_name || ""}`
                    .trim();

            teacherMap[String(teacher.id)] =
                fullName ||
                teacher.teacher_id ||
                `Teacher #${teacher.id}`;
        }
    );

    allClasses =
        allClasses.map(item => ({
            ...item,
            teacher_name:
                teacherMap[
                    String(item.class_teacher)
                ] || null
        }));
}

async function loadStudentCounts() {

    if (!allClasses.length) {
        return;
    }

    const classIds =
        allClasses.map(
            item => item.id
        );

    const {
        data: students,
        error
    } = await supabase
        .from("students")
        .select("id, class_id")
        .in("class_id", classIds);

    if (error) {

        console.error(
            "Student count error:",
            error
        );

        allClasses =
            allClasses.map(item => ({
                ...item,
                student_count: 0
            }));

        return;
    }

    const counts = {};

    (students || []).forEach(
        student => {

            const classId =
                String(student.class_id);

            counts[classId] =
                (counts[classId] || 0) + 1;
        }
    );

    allClasses =
        allClasses.map(item => ({
            ...item,
            student_count:
                counts[String(item.id)] || 0
        }));
}

function updateStatistics() {

    const total =
        allClasses.length;

    const active =
        allClasses.filter(
            item =>
                String(item.status || "")
                    .trim()
                    .toLowerCase() ===
                "active"
        ).length;

    const teachers =
        allClasses.filter(
            item =>
                item.class_teacher !== null &&
                item.class_teacher !== undefined &&
                String(item.class_teacher).trim() !== ""
        ).length;

    const students =
        allClasses.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.student_count || 0
                ),
            0
        );

    if (totalClasses) {
        totalClasses.textContent = total;
    }

    if (totalStudents) {
        totalStudents.textContent = students;
    }

    if (assignedTeachers) {
        assignedTeachers.textContent = teachers;
    }

    if (activeClasses) {
        activeClasses.textContent = active;
    }
}

function renderClasses() {

    const search =
        String(
            searchInput?.value || ""
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
        allClasses.filter(
            item => {

                const className =
                    String(
                        item.class_name || ""
                    ).toLowerCase();

                const section =
                    String(
                        item.section || ""
                    ).toLowerCase();

                const room =
                    String(
                        item.room_number || ""
                    ).toLowerCase();

                const academicYear =
                    String(
                        item.academic_year || ""
                    ).toLowerCase();

                const teacherId =
                    String(
                        item.class_teacher || ""
                    ).toLowerCase();

                const teacherName =
                    String(
                        item.teacher_name || ""
                    ).toLowerCase();

                const itemStatus =
                    String(
                        item.status || ""
                    )
                        .trim()
                        .toLowerCase();

                const matchesSearch =
                    !search ||
                    className.includes(search) ||
                    section.includes(search) ||
                    room.includes(search) ||
                    academicYear.includes(search) ||
                    teacherId.includes(search) ||
                    teacherName.includes(search);

                const matchesStatus =
                    !status ||
                    itemStatus === status;

                return (
                    matchesSearch &&
                    matchesStatus
                );
            }
        );

    updateRecordInformation(
        filtered.length
    );

    if (!filtered.length) {

        if (tableBody) {

            tableBody.innerHTML = `
                <tr>
                    <td
                        colspan="9"
                        class="table-empty"
                    >
                        No classes found.
                    </td>
                </tr>
            `;

        }

        return;
    }

    tableBody.innerHTML =
        filtered
            .map(
                (item, index) =>
                    createClassRow(
                        item,
                        index + 1
                    )
            )
            .join("");
}

function createClassRow(
    item,
    number
) {

    const status =
        String(
            item.status || ""
        )
            .trim()
            .toLowerCase();

    const statusClass =
        status === "active"
            ? "status-active"
            : "status-inactive";

    const statusText =
        status
            ? capitalize(status)
            : "Unknown";

    const teacher =
        item.teacher_name ||
        (
            item.class_teacher
                ? `Teacher #${item.class_teacher}`
                : "Not Assigned"
        );

    return `
        <tr>

            <td>
                ${number}
            </td>

            <td>
                <strong>
                    ${escapeHtml(
                        item.class_name ||
                        "N/A"
                    )}
                </strong>
            </td>

            <td>
                ${escapeHtml(
                    item.section ||
                    "N/A"
                )}
            </td>

            <td>
                ${escapeHtml(
                    item.room_number ||
                    "N/A"
                )}
            </td>

            <td>
                ${escapeHtml(
                    item.academic_year ||
                    "N/A"
                )}
            </td>

            <td>
                ${Number(
                    item.student_count || 0
                )}
            </td>

            <td>
                ${escapeHtml(
                    teacher
                )}
            </td>

            <td>
                <span
                    class="status-badge ${statusClass}"
                >
                    ${statusText}
                </span>
            </td>

            <td>

                <div class="table-actions">

                    <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        data-action="view"
                        data-id="${item.id}"
                    >
                        View
                    </button>

                    <button
                        type="button"
                        class="btn btn-primary btn-sm"
                        data-action="edit"
                        data-id="${item.id}"
                    >
                        Edit
                    </button>

                    <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        data-action="delete"
                        data-id="${item.id}"
                    >
                        Delete
                    </button>

                </div>

            </td>

        </tr>
    `;
}

async function handleTableAction(
    event
) {

    const button =
        event.target.closest(
            "button[data-action]"
        );

    if (!button) {
        return;
    }

    const action =
        button.dataset.action;

    const id =
        button.dataset.id;

    if (!id) {
        return;
    }

    if (action === "view") {

        window.location.href =
            `/classes/view.html?id=${encodeURIComponent(id)}`;

        return;
    }

    if (action === "edit") {

        window.location.href =
            `/classes/edit.html?id=${encodeURIComponent(id)}`;

        return;
    }

    if (action === "delete") {

        await deleteClass(
            id,
            button
        );
    }
}

async function deleteClass(
    id,
    button
) {

    const classItem =
        allClasses.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!classItem) {
        return;
    }

    const className =
        classItem.class_name ||
        "this class";

    const confirmed =
        window.confirm(
            `Delete "${className}"?`
        );

    if (!confirmed) {
        return;
    }

    button.disabled = true;
    button.textContent = "Deleting...";

    try {

        const {
            error
        } = await supabase
            .from("classes")
            .delete()
            .eq("id", id);

        if (error) {
            throw error;
        }

        showMessage(
            "Class deleted successfully.",
            "success"
        );

        await loadClasses();

    } catch (error) {

        console.error(
            "Delete class error:",
            error
        );

        showMessage(
            error.message ||
            "Failed to delete class.",
            "error"
        );

        button.disabled = false;
        button.textContent = "Delete";
    }
}

async function refreshClasses() {

    if (refreshButton) {

        refreshButton.disabled = true;
        refreshButton.textContent =
            "Refreshing...";
    }

    try {

        await loadClasses();

    } finally {

        if (refreshButton) {

            refreshButton.disabled = false;
            refreshButton.textContent =
                "↻ Refresh";
        }
    }
}

function clearAllFilters() {

    if (searchInput) {
        searchInput.value = "";
    }

    if (statusFilter) {
        statusFilter.value = "";
    }

    renderClasses();
}

function updateRecordInformation(
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

    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = `
        <tr>
            <td
                colspan="9"
                class="table-empty"
            >
                Loading class records...
            </td>
        </tr>
    `;
}

function showMessage(
    text,
    type
) {

    if (!messageBox) {
        return;
    }

    messageBox.textContent = text;

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
            } = await supabase.auth.signOut();

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