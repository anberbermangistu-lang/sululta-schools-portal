import { supabase } from "./supabase.js";

const noticesContainer = document.getElementById("noticesContainer");
const emptyState = document.getElementById("noticeEmptyState");
const message = document.getElementById("noticeMessage");

const refreshButton = document.getElementById("refreshNotices");
const searchInput = document.getElementById("noticeSearch");
const clearButton = document.getElementById("clearNoticeSearch");

const totalNotices = document.getElementById("totalNotices");
const publishedNotices = document.getElementById("publishedNotices");
const activeNotices = document.getElementById("activeNotices");

const studentName = document.getElementById("studentName");
const studentHeaderName = document.getElementById("studentHeaderName");
const studentAvatar = document.getElementById("studentAvatar");

const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".admin-sidebar");

const noticeBadge = document.getElementById("noticeBadge");
const noticeSummary = document.getElementById("noticeSummary");

let notices = [];
let currentStudent = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    setupSidebar();
    setupLogout();
    setupEvents();

    const student = await getCurrentStudent();

    if (!student) {
        return;
    }

    currentStudent = student;

    updateStudentProfile(student);

    await loadNotices();
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
        console.error("Student lookup error:", studentError);

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

    if (studentAvatar) {
        const photo = getPhotoUrl(
            student.photo_url || student.photo
        );

        if (photo) {
            studentAvatar.innerHTML = "";

            const image = document.createElement("img");

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

async function loadNotices() {
    showLoading();

    const today = new Date()
        .toISOString()
        .split("T")[0];

    const {
        data,
        error
    } = await supabase
        .from("notices")
        .select(`
            id,
            title,
            message,
            audience,
            publish_date,
            expiry_date,
            created_at,
            updated_at
        `)
        .in("audience", [
            "All",
            "Student",
            "Students",
            "student",
            "students"
        ])
        .lte("publish_date", today)
        .or(
            `expiry_date.is.null,expiry_date.gte.${today}`
        )
        .order("publish_date", {
            ascending: false
        });

    if (error) {
        console.error(
            "Notice loading error:",
            error
        );

        notices = [];

        updateStatistics();

        updateNoticeCount(0);

        showError(error.message);

        return;
    }

    notices = data || [];

    updateStatistics();

    renderNotices();
}

function renderNotices() {
    const search =
        String(searchInput?.value || "")
            .trim()
            .toLowerCase();

    const filtered = notices.filter(notice => {
        const title =
            String(notice.title || "")
                .toLowerCase();

        const noticeMessage =
            String(notice.message || "")
                .toLowerCase();

        const audience =
            String(notice.audience || "")
                .toLowerCase();

        const publishDate =
            String(notice.publish_date || "")
                .toLowerCase();

        return (
            !search ||
            title.includes(search) ||
            noticeMessage.includes(search) ||
            audience.includes(search) ||
            publishDate.includes(search)
        );
    });

    updateNoticeCount(filtered.length);

    if (!filtered.length) {
        showEmptyState();
        return;
    }

    if (emptyState) {
        emptyState.hidden = true;
        emptyState.style.display = "none";
    }

    if (!noticesContainer) {
        return;
    }

    noticesContainer.innerHTML =
        filtered
            .map(notice => createNoticeCard(notice))
            .join("");
}

function createNoticeCard(notice) {
    const title =
        notice.title || "School Notice";

    const noticeMessage =
        notice.message || "No message available.";

    const audience =
        notice.audience || "All";

    const publishDate =
        formatDate(notice.publish_date);

    const expiryDate =
        notice.expiry_date
            ? formatDate(notice.expiry_date)
            : "";

    const expiryText =
        expiryDate
            ? `Expires: ${expiryDate}`
            : "No expiry date";

    return `
        <article class="notice-card">

            <div class="notice-card-header">

                <div class="notice-icon">
                    📢
                </div>

                <div class="notice-card-title">

                    <h3>
                        ${escapeHtml(title)}
                    </h3>

                    <span>
                        ${escapeHtml(audience)}
                    </span>

                </div>

            </div>

            <div class="notice-card-body">

                <p>
                    ${escapeHtml(noticeMessage)}
                </p>

            </div>

            <div class="notice-card-footer">

                <span>
                    📅 Published: ${escapeHtml(publishDate)}
                </span>

                <span>
                    ${escapeHtml(expiryText)}
                </span>

            </div>

        </article>
    `;
}

function updateStatistics() {
    const total = notices.length;

    const today = new Date()
        .toISOString()
        .split("T")[0];

    const published =
        notices.filter(notice => {
            return (
                notice.publish_date &&
                notice.publish_date <= today
            );
        }).length;

    const active =
        notices.filter(notice => {
            if (!notice.expiry_date) {
                return true;
            }

            return notice.expiry_date >= today;
        }).length;

    if (totalNotices) {
        totalNotices.textContent = total;
    }

    if (publishedNotices) {
        publishedNotices.textContent = published;
    }

    if (activeNotices) {
        activeNotices.textContent = active;
    }
}

function updateNoticeCount(count) {
    if (noticeBadge) {
        noticeBadge.textContent =
            `${count} ${count === 1 ? "Notice" : "Notices"}`;
    }

    if (noticeSummary) {
        noticeSummary.textContent =
            `Showing ${count} ${count === 1 ? "notice" : "notices"}`;
    }
}

function setupEvents() {
    searchInput?.addEventListener(
        "input",
        renderNotices
    );

    clearButton?.addEventListener(
        "click",
        () => {
            if (searchInput) {
                searchInput.value = "";
            }

            renderNotices();
        }
    );

    refreshButton?.addEventListener(
        "click",
        loadNotices
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
            const { error } =
                await supabase.auth.signOut();

            if (error) {
                showMessage(
                    error.message,
                    "error"
                );

                return;
            }

            window.location.href = "/login.html";
        }
    );
}

function showLoading() {
    if (noticesContainer) {
        noticesContainer.innerHTML = `
            <div class="loading-cell">
                Loading notices...
            </div>
        `;
    }

    if (emptyState) {
        emptyState.hidden = true;
        emptyState.style.display = "none";
    }
}

function showEmptyState() {
    if (noticesContainer) {
        noticesContainer.innerHTML = "";
    }

    if (emptyState) {
        emptyState.hidden = false;
        emptyState.style.display = "flex";
    }
}

function showError(errorText) {
    if (!noticesContainer) {
        return;
    }

    noticesContainer.innerHTML = `
        <div class="empty-state">

            <div class="empty-icon">
                ⚠️
            </div>

            <h3>
                Unable to Load Notices
            </h3>

            <p>
                ${escapeHtml(errorText)}
            </p>

            <button
                type="button"
                class="btn btn-primary"
                id="retryNotices">
                ↻ Try Again
            </button>

        </div>
    `;

    document
        .getElementById("retryNotices")
        ?.addEventListener(
            "click",
            loadNotices
        );
}

function showMessage(text, type = "info") {
    if (!message) {
        return;
    }

    message.textContent = text;
    message.className = `message ${type}`;
    message.hidden = false;
}

function formatDate(value) {
    if (!value) {
        return "N/A";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
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
        value.startsWith("https://") ||
        value.startsWith("data:")
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

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
