import { supabase } from "./supabase.js";

const message = document.getElementById("message");
const refreshButton = document.getElementById("refreshNotices");
const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".admin-sidebar");
const noticesContainer = document.getElementById("noticesContainer");

let notices = [];

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    setupSidebar();
    setupLogout();

    const allowed = await checkParent();

    if (!allowed) {
        return;
    }

    await loadNotices();

    refreshButton?.addEventListener(
        "click",
        async () => {
            await loadNotices();
        }
    );
}

async function checkParent() {
    const {
        data: { user },
        error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
        window.location.href = "/login.html";
        return false;
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
            status,
            photo_url
        `)
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile) {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return false;
    }

    const role =
        String(profile.role || "")
            .trim()
            .toLowerCase();

    const status =
        String(profile.status || "")
            .trim()
            .toLowerCase();

    if (role !== "parent") {
        if (role === "admin") {
            window.location.href = "/admin/dashboard.html";
        } else if (role === "teacher") {
            window.location.href = "/teachers/dashboard.html";
        } else {
            window.location.href = "/login.html";
        }

        return false;
    }

    if (status !== "active") {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return false;
    }

    updateParentProfile(profile);

    return true;
}

async function loadNotices() {
    setLoading();

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
            created_at,
            updated_at,
            expiry_date
        `)
        .order(
            "publish_date",
            {
                ascending: false
            }
        );

    if (error) {
        console.error(
            "Notices error:",
            error
        );

        showMessage(
            error.message,
            "error"
        );

        setEmpty(
            "Unable to load school notices."
        );

        updateStatistics([]);

        return;
    }

    notices = data || [];

    const visibleNotices =
        filterVisibleNotices(notices);

    updateStatistics(visibleNotices);
    renderNotices(visibleNotices);
}

function filterVisibleNotices(records) {
    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );

    return records.filter(
        notice => {

            if (!notice.expiry_date) {
                return true;
            }

            const expiry =
                parseDate(
                    notice.expiry_date
                );

            if (!expiry) {
                return true;
            }

            return expiry >= today;
        }
    );
}

function updateStatistics(records) {
    const total =
        records.length;

    const published =
        records.filter(
            notice => {

                const date =
                    parseDate(
                        notice.publish_date
                    );

                return date && date <= new Date();
            }
        ).length;

    const latest =
        records.length
            ? records[0]
            : null;

    setText(
        "totalNotices",
        total
    );

    setText(
        "publishedNotices",
        published
    );

    setText(
        "latestNotice",
        latest
            ? latest.title || "—"
            : "—"
    );
}

function renderNotices(records) {
    if (!noticesContainer) {
        return;
    }

    if (!records.length) {
        setEmpty(
            "No school notices found."
        );

        return;
    }

    const sorted =
        [...records].sort(
            (a, b) => {

                const dateA =
                    parseDate(
                        a.publish_date
                    );

                const dateB =
                    parseDate(
                        b.publish_date
                    );

                if (!dateA && !dateB) {
                    return 0;
                }

                if (!dateA) {
                    return 1;
                }

                if (!dateB) {
                    return -1;
                }

                return dateB - dateA;
            }
        );

    noticesContainer.innerHTML =
        sorted
            .map(
                (notice, index) =>
                    createNoticeCard(
                        notice,
                        index
                    )
            )
            .join("");
}

function createNoticeCard(
    notice,
    index
) {
    const title =
        notice.title ||
        "School Notice";

    const noticeMessage =
        notice.message ||
        "No message provided.";

    const audience =
        notice.audience ||
        "All";

    const publishDate =
        formatDate(
            notice.publish_date
        );

    const expiryDate =
        notice.expiry_date
            ? formatDate(
                notice.expiry_date
            )
            : "No expiry";

    const status =
        getNoticeStatus(
            notice
        );

    const statusClass =
        status === "Published"
            ? "status-active"
            : status === "Expired"
                ? "status-inactive"
                : "";

    return `
        <article class="notice-card">

            <div class="notice-card-header">

                <div class="notice-number">
                    ${index + 1}
                </div>

                <div class="notice-card-title">

                    <h3>
                        ${escapeHtml(title)}
                    </h3>

                    <span
                        class="status-badge ${statusClass}"
                    >
                        ${escapeHtml(status)}
                    </span>

                </div>

            </div>

            <div class="notice-card-content">

                <p>
                    ${escapeHtml(noticeMessage)}
                </p>

            </div>

            <div class="notice-card-details">

                <div class="notice-detail">

                    <span>
                        📅
                    </span>

                    <div>

                        <strong>
                            Published
                        </strong>

                        <small>
                            ${escapeHtml(publishDate)}
                        </small>

                    </div>

                </div>

                <div class="notice-detail">

                    <span>
                        👥
                    </span>

                    <div>

                        <strong>
                            Audience
                        </strong>

                        <small>
                            ${escapeHtml(audience)}
                        </small>

                    </div>

                </div>

                <div class="notice-detail">

                    <span>
                        ⏳
                    </span>

                    <div>

                        <strong>
                            Expiry
                        </strong>

                        <small>
                            ${escapeHtml(expiryDate)}
                        </small>

                    </div>

                </div>

            </div>

        </article>
    `;
}

function getNoticeStatus(notice) {
    const today =
        new Date();

    today.setHours(
        0,
        0,
        0,
        0
    );

    if (notice.expiry_date) {
        const expiry =
            parseDate(
                notice.expiry_date
            );

        if (expiry && expiry < today) {
            return "Expired";
        }
    }

    if (notice.publish_date) {
        const publishDate =
            parseDate(
                notice.publish_date
            );

        if (
            publishDate &&
            publishDate <= today
        ) {
            return "Published";
        }

        if (
            publishDate &&
            publishDate > today
        ) {
            return "Scheduled";
        }
    }

    return "Published";
}

function parseDate(value) {
    if (!value) {
        return null;
    }

    const date =
        new Date(
            `${value}T00:00:00`
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return null;
    }

    return date;
}

function formatDate(value) {
    const date =
        parseDate(value);

    if (!date) {
        return "Not provided";
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

function updateParentProfile(profile) {
    const fullName =
        `${profile.first_name || ""} ${profile.last_name || ""}`
            .trim() ||
        profile.username ||
        "Parent";

    setText(
        "parentHeaderName",
        fullName
    );

    const avatar =
        document.getElementById(
            "parentAvatar"
        );

    if (!avatar) {
        return;
    }

    if (profile.photo_url) {
        avatar.innerHTML = "";

        const image =
            document.createElement(
                "img"
            );

        image.src =
            profile.photo_url;

        image.alt =
            fullName;

        avatar.appendChild(
            image
        );
    } else {
        avatar.textContent =
            fullName
                .charAt(0)
                .toUpperCase();
    }
}

function setLoading() {
    if (!noticesContainer) {
        return;
    }

    noticesContainer.innerHTML = `
        <div class="table-empty">
            Loading notices...
        </div>
    `;
}

function setEmpty(text) {
    if (!noticesContainer) {
        return;
    }

    noticesContainer.innerHTML = `
        <div class="table-empty">
            ${escapeHtml(text)}
        </div>
    `;
}

function showMessage(
    text,
    type = "info"
) {
    if (!message) {
        return;
    }

    message.textContent =
        text;

    message.className =
        `message ${type}`;

    message.hidden =
        false;
}

function setText(
    id,
    value
) {
    const element =
        document.getElementById(
            id
        );

    if (element) {
        element.textContent =
            value;
    }
}

function setupSidebar() {
    sidebarToggle?.addEventListener(
        "click",
        () => {
            sidebar?.classList.toggle(
                "mobile-open"
            );
        }
    );
}

function setupLogout() {
    logoutButton?.addEventListener(
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