import { supabase } from "./supabase.js";

const message = document.getElementById("message");
const refreshEvents = document.getElementById("refreshEvents");
const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");

const eventSearch = document.getElementById("eventSearch");
const eventTypeFilter = document.getElementById("eventTypeFilter");
const eventStatusFilter = document.getElementById("eventStatusFilter");

const eventsTableBody = document.getElementById("eventsTableBody");
const eventRecordBadge = document.getElementById("eventRecordBadge");
const eventRecordSummary = document.getElementById("eventRecordSummary");

const totalEvents = document.getElementById("totalEvents");
const upcomingEvents = document.getElementById("upcomingEvents");
const thisMonth = document.getElementById("thisMonth");
const totalEventTypes = document.getElementById("totalEventTypes");

let events = [];

function showMessage(text, type = "error") {
    if (!message) return;

    message.textContent = text;
    message.className = `message ${type}`;
    message.hidden = false;

    clearTimeout(showMessage.timer);

    showMessage.timer = setTimeout(() => {
        message.hidden = true;
    }, 5000);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return escapeHtml(value);
    }

    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function formatTime(value) {
    if (!value) {
        return "";
    }

    const parts = String(value).split(":");

    if (parts.length < 2) {
        return escapeHtml(value);
    }

    const hours = Number(parts[0]);
    const minutes = parts[1];

    if (Number.isNaN(hours)) {
        return escapeHtml(value);
    }

    const suffix = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;

    return `${displayHour}:${minutes} ${suffix}`;
}

function getEventName(event) {
    return event.event_name || "Untitled Event";
}

function getEventType(event) {
    return event.event_type || "General";
}

function getEventDate(event) {
    return event.event_date || null;
}

function getEventLocation(event) {
    return event.location || "—";
}

function getEventDescription(event) {
    return event.description || "—";
}

function getEventTime(event) {
    if (event.event_time) {
        return formatTime(event.event_time);
    }

    if (event.start_time && event.end_time) {
        return `${formatTime(event.start_time)} - ${formatTime(event.end_time)}`;
    }

    if (event.start_time) {
        return formatTime(event.start_time);
    }

    return "";
}

function isUpcoming(event) {
    if (!event.event_date) {
        return false;
    }

    const eventDate = new Date(
        `${event.event_date}T00:00:00`
    );

    if (Number.isNaN(eventDate.getTime())) {
        return false;
    }

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    return eventDate >= today;
}

function isThisMonth(event) {
    if (!event.event_date) {
        return false;
    }

    const eventDate = new Date(
        `${event.event_date}T00:00:00`
    );

    if (Number.isNaN(eventDate.getTime())) {
        return false;
    }

    const today = new Date();

    return (
        eventDate.getFullYear() === today.getFullYear() &&
        eventDate.getMonth() === today.getMonth()
    );
}

function updateStats() {
    const upcomingCount = events.filter(
        event => isUpcoming(event)
    ).length;

    const monthCount = events.filter(
        event => isThisMonth(event)
    ).length;

    const types = new Set(
        events
            .map(event => getEventType(event).trim().toLowerCase())
            .filter(Boolean)
    );

    totalEvents.textContent = events.length;
    upcomingEvents.textContent = upcomingCount;
    thisMonth.textContent = monthCount;
    totalEventTypes.textContent = types.size;
}

function populateEventTypes() {
    const selectedValue = eventTypeFilter.value;

    const types = [
        ...new Set(
            events
                .map(event => getEventType(event).trim())
                .filter(Boolean)
        )
    ].sort((a, b) => a.localeCompare(b));

    eventTypeFilter.innerHTML = `
        <option value="">
            All Event Types
        </option>
    `;

    types.forEach(type => {
        const option = document.createElement("option");

        option.value = type.toLowerCase();
        option.textContent = type;

        eventTypeFilter.appendChild(option);
    });

    eventTypeFilter.value = selectedValue;
}

function getFilteredEvents() {
    const searchValue = eventSearch.value
        .trim()
        .toLowerCase();

    const typeValue = eventTypeFilter.value
        .trim()
        .toLowerCase();

    const statusValue = eventStatusFilter.value;

    return events.filter(event => {

        const name = getEventName(event).toLowerCase();
        const type = getEventType(event).toLowerCase();
        const location = getEventLocation(event).toLowerCase();
        const description = getEventDescription(event).toLowerCase();

        const matchesSearch =
            !searchValue ||
            name.includes(searchValue) ||
            type.includes(searchValue) ||
            location.includes(searchValue) ||
            description.includes(searchValue);

        const matchesType =
            !typeValue ||
            type === typeValue;

        const matchesStatus =
            !statusValue ||
            (
                statusValue === "upcoming" &&
                isUpcoming(event)
            ) ||
            (
                statusValue === "past" &&
                !isUpcoming(event)
            );

        return (
            matchesSearch &&
            matchesType &&
            matchesStatus
        );
    });
}

function renderEvents() {
    const filteredEvents = getFilteredEvents();

    eventRecordBadge.textContent =
        `${filteredEvents.length} Records`;

    eventRecordSummary.textContent =
        `Showing ${filteredEvents.length} of ${events.length} records`;

    if (!filteredEvents.length) {

        eventsTableBody.innerHTML = `
            <tr>

                <td
                    colspan="7"
                    class="table-empty"
                >
                    No event records found.
                </td>

            </tr>
        `;

        return;
    }

    eventsTableBody.innerHTML = filteredEvents
        .map((event, index) => {

            const id = event.id;

            const name = escapeHtml(
                getEventName(event)
            );

            const type = escapeHtml(
                getEventType(event)
            );

            const date = formatDate(
                getEventDate(event)
            );

            const time = getEventTime(event);

            const location = escapeHtml(
                getEventLocation(event)
            );

            const description = escapeHtml(
                getEventDescription(event)
            );

            const dateDisplay = time
                ? `${date}<br><small>${escapeHtml(time)}</small>`
                : date;

            return `
                <tr>

                    <td>
                        ${index + 1}
                    </td>

                    <td>

                        <div class="student-table-name">

                            <div class="student-table-placeholder">
                                🎉
                            </div>

                            <div>

                                <strong>
                                    ${name}
                                </strong>

                                <small>
                                    Event ID: ${escapeHtml(id)}
                                </small>

                            </div>

                        </div>

                    </td>

                    <td>
                        <span class="gender-text">
                            ${type}
                        </span>
                    </td>

                    <td>
                        ${dateDisplay}
                    </td>

                    <td>
                        ${location}
                    </td>

                    <td>
                        <span title="${description}">
                            ${description}
                        </span>
                    </td>

                    <td>

                        <div class="student-actions">

                            <a
                                href="/events/view.html?id=${encodeURIComponent(id)}"
                                class="student-action-view"
                            >
                                View
                            </a>

                            <a
                                href="/events/edit.html?id=${encodeURIComponent(id)}"
                                class="student-action-edit"
                            >
                                Edit
                            </a>

                            <button
                                type="button"
                                class="student-action-delete"
                                data-action="delete"
                                data-id="${escapeHtml(id)}"
                            >
                                Delete
                            </button>

                        </div>

                    </td>

                </tr>
            `;
        })
        .join("");
}

async function loadEvents() {
    eventsTableBody.innerHTML = `
        <tr>

            <td
                colspan="7"
                class="table-empty"
            >
                Loading event records...
            </td>

        </tr>
    `;

    try {

        const { data, error } = await supabase
            .from("events")
            .select(`
                id,
                event_name,
                event_type,
                event_date,
                event_time,
                description,
                location,
                start_time,
                end_time,
                created_at,
                updated_at
            `)
            .order("event_date", {
                ascending: true
            });

        if (error) {
            throw error;
        }

        events = data || [];

        updateStats();
        populateEventTypes();
        renderEvents();

    } catch (error) {

        console.error("Error loading events:", error);

        events = [];

        updateStats();

        eventRecordBadge.textContent = "0 Records";
        eventRecordSummary.textContent = "Showing 0 records";

        eventsTableBody.innerHTML = `
            <tr>

                <td
                    colspan="7"
                    class="table-empty"
                >
                    Unable to load event records.
                </td>

            </tr>
        `;

        showMessage(
            error.message || "Failed to load events."
        );
    }
}

async function deleteEvent(id) {
    if (!id) {
        return;
    }

    const event = events.find(
        item => String(item.id) === String(id)
    );

    const eventName = event
        ? getEventName(event)
        : "this event";

    const confirmed = window.confirm(
        `Are you sure you want to delete "${eventName}"?`
    );

    if (!confirmed) {
        return;
    }

    try {

        const { error } = await supabase
            .from("events")
            .delete()
            .eq("id", id);

        if (error) {
            throw error;
        }

        showMessage(
            "Event deleted successfully.",
            "success"
        );

        await loadEvents();

    } catch (error) {

        console.error("Error deleting event:", error);

        showMessage(
            error.message || "Failed to delete event."
        );
    }
}

eventsTableBody.addEventListener(
    "click",
    event => {

        const deleteButton = event.target.closest(
            '[data-action="delete"]'
        );

        if (!deleteButton) {
            return;
        }

        deleteEvent(
            deleteButton.dataset.id
        );
    }
);

eventSearch.addEventListener(
    "input",
    renderEvents
);

eventTypeFilter.addEventListener(
    "change",
    renderEvents
);

eventStatusFilter.addEventListener(
    "change",
    renderEvents
);

refreshEvents.addEventListener(
    "click",
    loadEvents
);

sidebarToggle?.addEventListener(
    "click",
    () => {
        document.body.classList.toggle(
            "sidebar-collapsed"
        );
    }
);

logoutButton?.addEventListener(
    "click",
    async () => {

        try {
            await supabase.auth.signOut();
        } finally {
            window.location.href = "/login.html";
        }
    }
);

loadEvents();