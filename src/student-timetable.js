import { supabase } from "./supabase.js";

const tableBody = document.getElementById("timetableTableBody");
const emptyState = document.getElementById("timetableEmptyState");
const message = document.getElementById("timetableMessage");

const refreshButton = document.getElementById("refreshTimetable");
const clearButton = document.getElementById("clearTimetableFilters");

const dayFilter = document.getElementById("dayFilter");
const searchInput = document.getElementById("timetableSearch");

const studentName = document.getElementById("studentName");
const studentClass = document.getElementById("studentClass");
const studentSection = document.getElementById("studentSection");
const totalLessons = document.getElementById("totalLessons");

const studentHeaderName = document.getElementById("studentHeaderName");
const studentAvatar = document.getElementById("studentAvatar");

const timetableBadge = document.getElementById("timetableBadge");
const timetableSummary = document.getElementById("timetableSummary");

const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".admin-sidebar");

let currentStudent = null;
let timetable = [];

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    setupSidebar();
    setupLogout();
    setupFilters();

    const student = await getCurrentStudent();

    if (!student) {
        return;
    }

    currentStudent = student;

    updateStudentProfile(student);

    await loadTimetable(student);
}

async function getCurrentStudent() {
    const {
        data: { user },
        error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
        window.location.href = "/login.html";
        return null;
    }

    const {
        data: profile,
        error: profileError
    } = await supabase
        .from("profiles")
        .select(`
            id,
            first_name,
            last_name,
            email,
            username,
            role,
            phone,
            photo_url,
            status
        `)
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile) {
        console.error("Profile error:", profileError);

        await supabase.auth.signOut();

        window.location.href = "/login.html";

        return null;
    }

    const role = String(profile.role || "")
        .trim()
        .toLowerCase();

    const status = String(profile.status || "")
        .trim()
        .toLowerCase();

    if (role !== "student") {
        await supabase.auth.signOut();

        window.location.href = "/login.html";

        return null;
    }

    if (status !== "active") {
        await supabase.auth.signOut();

        window.location.href = "/login.html";

        return null;
    }

    if (!profile.email) {
        showMessage(
            "Your student account does not have an email address.",
            "error"
        );

        return null;
    }

    const {
        data: student,
        error: studentError
    } = await supabase
        .from("students")
        .select(`
            id,
            student_id,
            first_name,
            last_name,
            gender,
            date_of_birth,
            class,
            section,
            phone,
            email,
            address,
            photo_url,
            photo,
            status
        `)
        .ilike("email", profile.email)
        .maybeSingle();

    if (studentError) {
        console.error(
            "Student lookup error:",
            studentError
        );

        showMessage(
            studentError.message,
            "error"
        );

        return null;
    }

    if (!student) {
        showMessage(
            "Your student record was not found.",
            "error"
        );

        return null;
    }

    return student;
}

function updateStudentProfile(student) {
    const fullName =
        `${student.first_name || ""} ${student.last_name || ""}`
            .trim() || "Student";

    if (studentName) {
        studentName.textContent = fullName;
    }

    if (studentHeaderName) {
        studentHeaderName.textContent = fullName;
    }

    if (studentClass) {
        studentClass.textContent =
            student.class || "-";
    }

    if (studentSection) {
        studentSection.textContent =
            student.section || "-";
    }

    if (studentAvatar) {
        const photo = getPhotoUrl(
            student.photo_url ||
            student.photo
        );

        if (photo) {
            studentAvatar.innerHTML = "";

            const image =
                document.createElement("img");

            image.src = photo;
            image.alt = fullName;

            image.onerror = () => {
                studentAvatar.textContent =
                    getInitials(
                        student.first_name,
                        student.last_name
                    );
            };

            studentAvatar.appendChild(image);
        } else {
            studentAvatar.textContent =
                getInitials(
                    student.first_name,
                    student.last_name
                );
        }
    }
}

async function loadTimetable(student) {
    showLoading();
    hideMessage();

    const studentClassName =
        String(student.class || "")
            .trim();

    const studentSectionName =
        String(student.section || "")
            .trim();

    if (!studentClassName || !studentSectionName) {
        timetable = [];

        showMessage(
            "Your class or section information is not available.",
            "error"
        );

        updateLessonCount(0);
        showEmptyState();

        return;
    }

    const {
        data,
        error
    } = await supabase
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
        .ilike(
            "class_name",
            studentClassName
        )
        .ilike(
            "section",
            studentSectionName
        )
        .order("day", {
            ascending: true
        })
        .order("start_time", {
            ascending: true
        });

    if (error) {
        console.error(
            "Timetable loading error:",
            error
        );

        timetable = [];

        updateLessonCount(0);

        showError(error.message);

        return;
    }

    timetable = data || [];

    populateDayFilter();

    updateLessonCount(
        timetable.length
    );

    renderTimetable();
}

function renderTimetable() {
    const search =
        String(searchInput?.value || "")
            .trim()
            .toLowerCase();

    const selectedDay =
        String(dayFilter?.value || "all")
            .trim()
            .toLowerCase();

    const filtered =
        timetable.filter(item => {
            const day =
                String(item.day || "")
                    .trim()
                    .toLowerCase();

            const subject =
                String(item.subject_name || "")
                    .trim()
                    .toLowerCase();

            const subjectCode =
                String(item.subject_code || "")
                    .trim()
                    .toLowerCase();

            const room =
                String(item.room_number || "")
                    .trim()
                    .toLowerCase();

            const matchesDay =
                selectedDay === "all" ||
                day === selectedDay;

            const matchesSearch =
                !search ||
                day.includes(search) ||
                subject.includes(search) ||
                subjectCode.includes(search) ||
                room.includes(search);

            return (
                matchesDay &&
                matchesSearch
            );
        });

    updateFilteredCount(
        filtered.length
    );

    if (!filtered.length) {
        showEmptyState();
        return;
    }

    if (emptyState) {
        emptyState.hidden = true;
        emptyState.style.display = "none";
    }

    if (!tableBody) {
        return;
    }

    tableBody.innerHTML =
        filtered
            .map(
                (item, index) =>
                    createTimetableRow(
                        item,
                        index
                    )
            )
            .join("");
}

function createTimetableRow(item, index) {
    const day =
        item.day || "N/A";

    const subject =
        item.subject_name || "N/A";

    const subjectCode =
        item.subject_code || "N/A";

    const startTime =
        item.start_time || "";

    const endTime =
        item.end_time || "";

    const period =
        startTime && endTime
            ? `${formatTime(startTime)} - ${formatTime(endTime)}`
            : "N/A";

    const room =
        item.room_number || "N/A";

    return `
        <tr>

            <td>
                ${index + 1}
            </td>

            <td>
                ${escapeHtml(day)}
            </td>

            <td>
                ${escapeHtml(period)}
            </td>

            <td>
                <strong>
                    ${escapeHtml(subject)}
                </strong>
            </td>

            <td>
                ${escapeHtml(subjectCode)}
            </td>

            <td>
                N/A
            </td>

            <td>
                ${escapeHtml(room)}
            </td>

        </tr>
    `;
}

function populateDayFilter() {
    if (!dayFilter) {
        return;
    }

    const currentValue =
        dayFilter.value || "all";

    const days = [
        ...new Set(
            timetable
                .map(item => item.day)
                .filter(Boolean)
        )
    ];

    dayFilter.innerHTML = `
        <option value="all">
            All Days
        </option>
    `;

    days.forEach(day => {
        const option =
            document.createElement("option");

        option.value =
            String(day).toLowerCase();

        option.textContent =
            day;

        dayFilter.appendChild(option);
    });

    const exists =
        [...dayFilter.options]
            .some(
                option =>
                    option.value ===
                    currentValue
            );

    dayFilter.value =
        exists
            ? currentValue
            : "all";
}

function setupFilters() {
    searchInput?.addEventListener(
        "input",
        renderTimetable
    );

    dayFilter?.addEventListener(
        "change",
        renderTimetable
    );

    clearButton?.addEventListener(
        "click",
        () => {
            if (searchInput) {
                searchInput.value = "";
            }

            if (dayFilter) {
                dayFilter.value = "all";
            }

            renderTimetable();
        }
    );

    refreshButton?.addEventListener(
        "click",
        async () => {
            if (currentStudent) {
                await loadTimetable(
                    currentStudent
                );
            }
        }
    );
}

function setupSidebar() {
    if (!sidebarToggle || !sidebar) {
        return;
    }

    sidebarToggle.addEventListener(
        "click",
        () => {
            sidebar.classList.toggle(
                "mobile-open"
            );
        }
    );
}

function setupLogout() {
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
                showMessage(
                    error.message,
                    "error"
                );

                return;
            }

            window.location.href =
                "/login.html";
        }
    );
}

function updateLessonCount(count) {
    if (totalLessons) {
        totalLessons.textContent =
            count;
    }

    if (timetableBadge) {
        timetableBadge.textContent =
            `${count} ${
                count === 1
                    ? "Lesson"
                    : "Lessons"
            }`;
    }

    if (timetableSummary) {
        timetableSummary.textContent =
            `Showing ${count} ${
                count === 1
                    ? "lesson"
                    : "lessons"
            }`;
    }
}

function updateFilteredCount(count) {
    if (timetableSummary) {
        timetableSummary.textContent =
            `Showing ${count} ${
                count === 1
                    ? "lesson"
                    : "lessons"
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
                colspan="7"
                class="loading-cell">

                Loading timetable...

            </td>

        </tr>
    `;

    if (emptyState) {
        emptyState.hidden = true;
        emptyState.style.display = "none";
    }
}

function showEmptyState() {
    if (tableBody) {
        tableBody.innerHTML = "";
    }

    if (emptyState) {
        emptyState.hidden = false;
        emptyState.style.display = "flex";
    }
}

function showError(errorText) {
    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = `
        <tr>

            <td
                colspan="7"
                class="loading-cell">

                <div class="empty-state">

                    <div class="empty-icon">
                        ⚠️
                    </div>

                    <h3>
                        Unable to Load Timetable
                    </h3>

                    <p>
                        ${escapeHtml(errorText)}
                    </p>

                    <button
                        type="button"
                        class="btn btn-primary"
                        id="retryTimetable">

                        ↻ Try Again

                    </button>

                </div>

            </td>

        </tr>
    `;

    document
        .getElementById(
            "retryTimetable"
        )
        ?.addEventListener(
            "click",
            async () => {
                if (currentStudent) {
                    await loadTimetable(
                        currentStudent
                    );
                }
            }
        );
}

function showMessage(
    text,
    type = "info"
) {
    if (!message) {
        return;
    }

    message.textContent = text;

    message.className =
        `message ${type}`;

    message.hidden = false;
}

function hideMessage() {
    if (!message) {
        return;
    }

    message.hidden = true;
    message.textContent = "";
}

function getPhotoUrl(photo) {
    if (!photo) {
        return null;
    }

    const value =
        String(photo).trim();

    if (!value) {
        return null;
    }

    if (
        value.startsWith("http://") ||
        value.startsWith("https://")
    ) {
        return value;
    }

    const path =
        value.replace(/^\/+/, "");

    const { data } =
        supabase.storage
            .from("students")
            .getPublicUrl(path);

    return data?.publicUrl || null;
}

function getInitials(first, last) {
    const firstName =
        String(first || "").trim();

    const lastName =
        String(last || "").trim();

    if (firstName && lastName) {
        return (
            firstName[0] +
            lastName[0]
        ).toUpperCase();
    }

    if (firstName) {
        return firstName[0].toUpperCase();
    }

    if (lastName) {
        return lastName[0].toUpperCase();
    }

    return "S";
}

function formatTime(value) {
    if (!value) {
        return "";
    }

    const parts =
        String(value).split(":");

    if (parts.length < 2) {
        return value;
    }

    let hour =
        Number(parts[0]);

    const minute =
        parts[1];

    if (Number.isNaN(hour)) {
        return value;
    }

    const period =
        hour >= 12
            ? "PM"
            : "AM";

    hour =
        hour % 12 || 12;

    return `${hour}:${minute} ${period}`;
}

function escapeHtml(value) {
    return String(value ?? "")
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