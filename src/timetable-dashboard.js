import { supabase } from "./supabase.js";

const tableBody = document.getElementById("timetableTableBody");
const searchInput = document.getElementById("timetableSearch");
const dayFilter = document.getElementById("dayFilter");
const clearFilters = document.getElementById("clearFilters");
const refreshButton = document.getElementById("refreshTimetable");
const message = document.getElementById("message");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".admin-sidebar");
const logoutButton = document.getElementById("logoutButton");

let timetable = [];

document.addEventListener("DOMContentLoaded", () => {
    setupSidebar();
    setupLogout();
    setupFilters();
    loadTimetable();
});

function setupSidebar() {
    if (!sidebarToggle || !sidebar) {
        return;
    }

    sidebarToggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });
}

function setupLogout() {
    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener("click", () => {
        window.location.href = "../login.html";
    });
}

function setupFilters() {
    if (searchInput) {
        searchInput.addEventListener("input", renderTimetable);
    }

    if (dayFilter) {
        dayFilter.addEventListener("change", renderTimetable);
    }

    if (clearFilters) {
        clearFilters.addEventListener("click", () => {
            if (searchInput) {
                searchInput.value = "";
            }

            if (dayFilter) {
                dayFilter.value = "";
            }

            renderTimetable();
        });
    }

    if (refreshButton) {
        refreshButton.addEventListener("click", loadTimetable);
    }
}

async function loadTimetable() {
    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = `
        <tr>
            <td colspan="9" class="table-empty">
                Loading timetable...
            </td>
        </tr>
    `;

    hideMessage();

    try {
        const { data, error } = await supabase
            .from("timetable")
            .select(`
                id,
                class_name,
                section,
                subject_code,
                subject_name,
                day,
                start_time,
                end_time,
                room_number,
                academic_year,
                created_at,
                updated_at
            `)
            .order("day", { ascending: true })
            .order("start_time", { ascending: true });

        if (error) {
            console.error("Error loading timetable:", error);
            showMessage(error.message, "error");
            showEmpty("Failed to load timetable.");
            return;
        }

        timetable = data || [];

        updateStatistics();
        renderTimetable();

    } catch (error) {
        console.error("Error loading timetable:", error);
        showMessage("Failed to load timetable.", "error");
        showEmpty("Failed to load timetable.");
    }
}

function renderTimetable() {
    if (!tableBody) {
        return;
    }

    const search =
        searchInput?.value?.trim().toLowerCase() || "";

    const selectedDay =
        dayFilter?.value?.trim().toLowerCase() || "";

    const filtered = timetable.filter(item => {
        const className =
            String(item.class_name || "").toLowerCase();

        const section =
            String(item.section || "").toLowerCase();

        const subjectCode =
            String(item.subject_code || "").toLowerCase();

        const subjectName =
            String(item.subject_name || "").toLowerCase();

        const day =
            String(item.day || "").toLowerCase();

        const room =
            String(item.room_number || "").toLowerCase();

        const academicYear =
            String(item.academic_year || "").toLowerCase();

        const matchesSearch =
            !search ||
            className.includes(search) ||
            section.includes(search) ||
            subjectCode.includes(search) ||
            subjectName.includes(search) ||
            day.includes(search) ||
            room.includes(search) ||
            academicYear.includes(search);

        const matchesDay =
            !selectedDay ||
            day === selectedDay;

        return matchesSearch && matchesDay;
    });

    if (filtered.length === 0) {
        showEmpty("No timetable records found.");
        return;
    }

    tableBody.innerHTML = filtered
        .map((item, index) => createRow(item, index))
        .join("");
}

function createRow(item, index) {
    const id = item.id;

    const day = escapeHtml(item.day || "-");
    const startTime = formatTime(item.start_time);
    const endTime = formatTime(item.end_time);
    const className = escapeHtml(item.class_name || "-");
    const section = escapeHtml(item.section || "-");
    const subjectCode = escapeHtml(item.subject_code || "-");
    const subjectName = escapeHtml(item.subject_name || "-");
    const room = escapeHtml(item.room_number || "-");
    const academicYear = escapeHtml(item.academic_year || "-");

    return `
        <tr>

            <td>${index + 1}</td>

            <td>
                <strong>${day}</strong>
            </td>

            <td>
                ${startTime} - ${endTime}
            </td>

            <td>
                ${className}
            </td>

            <td>
                ${section}
            </td>

            <td>
                <strong>${subjectName}</strong>
                <small>${subjectCode}</small>
            </td>

            <td>
                ${room}
            </td>

            <td>
                ${academicYear}
            </td>

            <td>

                <div class="table-actions">

                    <a
                        href="view.html?id=${encodeURIComponent(id)}"
                        class="btn btn-sm btn-secondary"
                    >
                        View
                    </a>

                    <a
                        href="edit.html?id=${encodeURIComponent(id)}"
                        class="btn btn-sm btn-primary"
                    >
                        Edit
                    </a>

                    <button
                        type="button"
                        class="btn btn-sm btn-danger"
                        data-delete-id="${id}"
                    >
                        Delete
                    </button>

                </div>

            </td>

        </tr>
    `;
}

function updateStatistics() {
    const totalTimetable =
        document.getElementById("totalTimetable");

    const totalClasses =
        document.getElementById("totalClasses");

    const totalSubjects =
        document.getElementById("totalSubjects");

    const totalDays =
        document.getElementById("totalDays");

    const uniqueClasses = new Set(
        timetable
            .map(item =>
                `${item.class_name || ""}|${item.section || ""}`
            )
            .filter(value => value !== "|")
    );

    const uniqueSubjects = new Set(
        timetable
            .map(item =>
                item.subject_code ||
                item.subject_name ||
                ""
            )
            .filter(Boolean)
    );

    const uniqueDays = new Set(
        timetable
            .map(item => item.day)
            .filter(Boolean)
    );

    if (totalTimetable) {
        totalTimetable.textContent = timetable.length;
    }

    if (totalClasses) {
        totalClasses.textContent = uniqueClasses.size;
    }

    if (totalSubjects) {
        totalSubjects.textContent = uniqueSubjects.size;
    }

    if (totalDays) {
        totalDays.textContent = uniqueDays.size;
    }
}

if (tableBody) {
    tableBody.addEventListener("click", async event => {
        const button =
            event.target.closest("[data-delete-id]");

        if (!button) {
            return;
        }

        await deleteTimetable(button.dataset.deleteId);
    });
}

async function deleteTimetable(id) {
    const item = timetable.find(
        record => String(record.id) === String(id)
    );

    if (!item) {
        return;
    }

    const confirmed = window.confirm(
        `Delete ${item.subject_name || "this timetable entry"} for ${item.class_name || "this class"}?`
    );

    if (!confirmed) {
        return;
    }

    try {
        const { error } = await supabase
            .from("timetable")
            .delete()
            .eq("id", id);

        if (error) {
            console.error(
                "Error deleting timetable:",
                error
            );

            showMessage(
                error.message || "Unable to delete timetable.",
                "error"
            );

            return;
        }

        showMessage(
            "Timetable deleted successfully.",
            "success"
        );

        await loadTimetable();

    } catch (error) {
        console.error(
            "Error deleting timetable:",
            error
        );

        showMessage(
            "Unable to delete timetable.",
            "error"
        );
    }
}

function formatTime(value) {
    if (!value) {
        return "-";
    }

    const parts = String(value).split(":");

    if (parts.length < 2) {
        return value;
    }

    return `${parts[0]}:${parts[1]}`;
}

function showEmpty(text) {
    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = `
        <tr>
            <td colspan="9" class="table-empty">
                ${escapeHtml(text)}
            </td>
        </tr>
    `;
}

function showMessage(text, type) {
    if (!message) {
        return;
    }

    message.textContent = text;
    message.className = type
        ? `message ${type}`
        : "message";

    message.hidden = !text;
}

function hideMessage() {
    if (!message) {
        return;
    }

    message.textContent = "";
    message.className = "message";
    message.hidden = true;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}