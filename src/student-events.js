import { supabase } from "./supabase.js";

const eventsTableBody = document.getElementById("eventsTableBody");
const eventsEmptyState = document.getElementById("eventsEmptyState");
const eventSearch = document.getElementById("eventSearch");
const eventTypeFilter = document.getElementById("eventTypeFilter");
const clearEventFilters = document.getElementById("clearEventFilters");
const refreshEvents = document.getElementById("refreshEvents");

const totalEvents = document.getElementById("totalEvents");
const upcomingEvents = document.getElementById("upcomingEvents");
const pastEvents = document.getElementById("pastEvents");
const totalLocations = document.getElementById("totalLocations");

const eventsBadge = document.getElementById("eventsBadge");
const eventsSummary = document.getElementById("eventsSummary");
const eventsMessage = document.getElementById("eventsMessage");

const studentAvatar = document.getElementById("studentAvatar");
const studentHeaderName = document.getElementById("studentHeaderName");
const sidebarToggle = document.getElementById("sidebarToggle");
const logoutButton = document.getElementById("logoutButton");

let allEvents = [];

document.addEventListener("DOMContentLoaded", initialize);

eventSearch?.addEventListener("input", renderEvents);

eventTypeFilter?.addEventListener(
    "change",
    renderEvents
);

clearEventFilters?.addEventListener(
    "click",
    clearFilters
);

refreshEvents?.addEventListener(
    "click",
    loadEvents
);

sidebarToggle?.addEventListener(
    "click",
    () => {
        if (window.matchMedia("(max-width: 900px)").matches) {
            document.querySelector(".admin-sidebar")?.classList.toggle("mobile-open");
        } else {
            document
                .querySelector(".admin-page")
                ?.classList.toggle("sidebar-collapsed");
        }
    }
);

logoutButton?.addEventListener(
    "click",
    logout
);

async function initialize() {
    const allowed = await checkStudent();

    if (!allowed) {
        return;
    }

    await loadEvents();
}

async function checkStudent() {
    const {
        data: {
            user
        },
        error
    } = await supabase.auth.getUser();

    if (error || !user) {
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
            role,
            photo_url,
            status
        `)
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile) {
        console.error(
            "Profile error:",
            profileError
        );

        showMessage(
            "Your account profile could not be found.",
            "error"
        );

        return false;
    }

    const role = String(
        profile.role || ""
    )
        .trim()
        .toLowerCase();

    const status = String(
        profile.status || ""
    )
        .trim()
        .toLowerCase();

    if (role !== "student") {
        showMessage(
            "This page is only available for student accounts.",
            "error"
        );

        return false;
    }

    if (
        status &&
        status !== "active"
    ) {
        showMessage(
            "Your student account is not active.",
            "error"
        );

        return false;
    }

    const name =
        `${profile.first_name || ""} ${profile.last_name || ""}`.trim();

    const displayName =
        name || "Student";

    if (studentHeaderName) {
        studentHeaderName.textContent =
            displayName;
    }

    if (studentAvatar) {
        studentAvatar.textContent =
            getInitials(
                profile.first_name,
                profile.last_name
            );
    }

    return true;
}

async function loadEvents() {
    try {
        hideMessage();
        showLoading();

        if (refreshEvents) {
            refreshEvents.disabled = true;
            refreshEvents.textContent = "↻ Loading...";
        }

        const {
            data,
            error
        } = await supabase
            .from("events")
            .select(`
                id,
                event_name,
                event_type,
                event_date,
                event_time,
                description,
                created_at,
                updated_at,
                location,
                start_time,
                end_time
            `)
            .order(
                "event_date",
                {
                    ascending: true
                }
            )
            .order(
                "start_time",
                {
                    ascending: true
                }
            );

        if (error) {
            throw error;
        }

        allEvents =
            Array.isArray(data)
                ? data
                : [];

        populateTypeFilter();
        updateStatistics();
        renderEvents();

    } catch (error) {

        console.error(
            "Events loading error:",
            error
        );

        allEvents = [];

        updateStatistics();

        showTableError(
            error?.message ||
            "Unable to load school events."
        );

        showMessage(
            error?.message ||
            "Unable to load school events.",
            "error"
        );

    } finally {

        if (refreshEvents) {
            refreshEvents.disabled = false;
            refreshEvents.textContent = "↻ Refresh";
        }
    }
}

function updateStatistics() {
    const today =
        getTodayDate();

    const upcoming =
        allEvents.filter(
            event =>
                getEventDate(event) >= today
        ).length;

    const past =
        allEvents.length - upcoming;

    const locations =
        new Set(
            allEvents
                .map(
                    event =>
                        String(
                            event.location || ""
                        )
                            .trim()
                            .toLowerCase()
                )
                .filter(Boolean)
        ).size;

    if (totalEvents) {
        totalEvents.textContent =
            allEvents.length;
    }

    if (upcomingEvents) {
        upcomingEvents.textContent =
            upcoming;
    }

    if (pastEvents) {
        pastEvents.textContent =
            past;
    }

    if (totalLocations) {
        totalLocations.textContent =
            locations;
    }

    if (eventsBadge) {
        eventsBadge.textContent =
            `${allEvents.length} ${
                allEvents.length === 1
                    ? "Event"
                    : "Events"
            }`;
    }
}

function renderEvents() {
    if (!eventsTableBody) {
        return;
    }

    const searchTerm =
        String(
            eventSearch?.value || ""
        )
            .trim()
            .toLowerCase();

    const selectedType =
        String(
            eventTypeFilter?.value || "all"
        )
            .trim()
            .toLowerCase();

    const filteredEvents =
        allEvents.filter(event => {

            const eventName =
                String(
                    event.event_name || ""
                ).toLowerCase();

            const eventType =
                String(
                    event.event_type || ""
                ).toLowerCase();

            const location =
                String(
                    event.location || ""
                ).toLowerCase();

            const description =
                String(
                    event.description || ""
                ).toLowerCase();

            const matchesSearch =
                !searchTerm ||
                eventName.includes(searchTerm) ||
                eventType.includes(searchTerm) ||
                location.includes(searchTerm) ||
                description.includes(searchTerm);

            const matchesType =
                selectedType === "all" ||
                eventType === selectedType;

            return (
                matchesSearch &&
                matchesType
            );
        });

    updateRecordCount(
        filteredEvents.length
    );

    if (
        filteredEvents.length === 0
    ) {
        showEmptyState();
        return;
    }

    if (eventsEmptyState) {
        eventsEmptyState.hidden = true;
    }

    eventsTableBody.innerHTML =
        filteredEvents
            .map(
                (event, index) =>
                    createEventRow(
                        event,
                        index
                    )
            )
            .join("");
}

function createEventRow(
    event,
    index
) {
    const eventName =
        event.event_name || "N/A";

    const eventType =
        event.event_type || "N/A";

    const date =
        formatDate(
            event.event_date
        );

    const time =
        formatEventTime(event);

    const location =
        event.location || "-";

    const description =
        event.description || "-";

    return `
        <tr>
            <td>
                ${index + 1}
            </td>

            <td>
                <strong>
                    ${escapeHtml(eventName)}
                </strong>
            </td>

            <td>
                <span class="status-badge status-active">
                    ${escapeHtml(eventType)}
                </span>
            </td>

            <td>
                ${escapeHtml(date)}
            </td>

            <td>
                ${escapeHtml(time)}
            </td>

            <td>
                ${escapeHtml(location)}
            </td>

            <td>
                ${escapeHtml(description)}
            </td>
        </tr>
    `;
}

function populateTypeFilter() {
    if (!eventTypeFilter) {
        return;
    }

    const currentValue =
        eventTypeFilter.value || "all";

    const types = [
        ...new Set(
            allEvents
                .map(
                    event =>
                        String(
                            event.event_type || ""
                        ).trim()
                )
                .filter(Boolean)
        )
    ].sort(
        (a, b) =>
            a.localeCompare(b)
    );

    eventTypeFilter.innerHTML = `
        <option value="all">
            All Types
        </option>
    `;

    types.forEach(type => {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            type.toLowerCase();

        option.textContent =
            type;

        eventTypeFilter.appendChild(
            option
        );
    });

    if (
        types.some(
            type =>
                type.toLowerCase() ===
                currentValue
        )
    ) {
        eventTypeFilter.value =
            currentValue;
    }
}

function clearFilters() {
    if (eventSearch) {
        eventSearch.value = "";
    }

    if (eventTypeFilter) {
        eventTypeFilter.value =
            "all";
    }

    renderEvents();
}

function updateRecordCount(count) {
    if (eventsBadge) {
        eventsBadge.textContent =
            `${count} ${
                count === 1
                    ? "Event"
                    : "Events"
            }`;
    }

    if (eventsSummary) {
        eventsSummary.textContent =
            `Showing ${count} ${
                count === 1
                    ? "event"
                    : "events"
            }`;
    }
}

function showLoading() {
    if (!eventsTableBody) {
        return;
    }

    eventsTableBody.innerHTML = `
        <tr>
            <td
                colspan="7"
                class="table-empty"
            >
                Loading school events...
            </td>
        </tr>
    `;
}

function showEmptyState() {
    if (eventsTableBody) {
        eventsTableBody.innerHTML = "";
    }

    if (eventsEmptyState) {
        eventsEmptyState.hidden = false;
    }
}

function showTableError(message) {
    if (!eventsTableBody) {
        return;
    }

    eventsTableBody.innerHTML = "";

    const row =
        document.createElement("tr");

    const cell =
        document.createElement("td");

    cell.colSpan = 7;
    cell.className =
        "table-empty";

    cell.textContent =
        message;

    row.appendChild(cell);

    eventsTableBody.appendChild(row);

    if (eventsEmptyState) {
        eventsEmptyState.hidden = true;
    }
}

function showMessage(
    message,
    type = "info"
) {
    if (!eventsMessage) {
        return;
    }

    eventsMessage.textContent =
        message;

    eventsMessage.className =
        `message ${type}`;

    eventsMessage.hidden = false;
}

function hideMessage() {
    if (!eventsMessage) {
        return;
    }

    eventsMessage.textContent = "";
    eventsMessage.hidden = true;
}

function getEventDate(event) {
    if (!event?.event_date) {
        return "";
    }

    return String(
        event.event_date
    ).slice(0, 10);
}

function getTodayDate() {
    const now =
        new Date();

    const year =
        now.getFullYear();

    const month =
        String(
            now.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            now.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatDate(value) {
    if (!value) {
        return "-";
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

function formatEventTime(event) {
    const start =
        event.start_time ||
        event.event_time;

    const end =
        event.end_time;

    if (!start && !end) {
        return "-";
    }

    if (start && end) {
        return `${formatTime(start)} - ${formatTime(end)}`;
    }

    return formatTime(
        start || end
    );
}

function formatTime(value) {
    if (!value) {
        return "-";
    }

    const text =
        String(value);

    const parts =
        text.split(":");

    if (parts.length < 2) {
        return text;
    }

    const hours =
        Number(parts[0]);

    const minutes =
        Number(parts[1]);

    if (
        !Number.isFinite(hours) ||
        !Number.isFinite(minutes)
    ) {
        return text;
    }

    const date =
        new Date();

    date.setHours(
        hours,
        minutes,
        0,
        0
    );

    return date.toLocaleTimeString(
        "en-US",
        {
            hour: "numeric",
            minute: "2-digit"
        }
    );
}

function getInitials(
    firstName,
    lastName
) {
    const first =
        String(
            firstName || ""
        ).trim();

    const last =
        String(
            lastName || ""
        ).trim();

    if (
        first &&
        last
    ) {
        return (
            first[0] +
            last[0]
        ).toUpperCase();
    }

    if (first) {
        return first[0].toUpperCase();
    }

    if (last) {
        return last[0].toUpperCase();
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

async function logout() {
    try {

        if (logoutButton) {
            logoutButton.disabled = true;
        }

        const {
            error
        } = await supabase.auth.signOut();

        if (error) {
            throw error;
        }

        window.location.href =
            "/login.html";

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        showMessage(
            "Unable to logout. Please try again.",
            "error"
        );

        if (logoutButton) {
            logoutButton.disabled = false;
        }
    }
}