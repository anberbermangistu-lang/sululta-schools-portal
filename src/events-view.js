import { supabase } from "./supabase.js";

const loadingState = document.getElementById("eventLoading");
const errorState = document.getElementById("eventError");
const errorMessage = document.getElementById("eventErrorMessage");
const detailsState = document.getElementById("eventDetails");

const eventName = document.getElementById("eventName");
const eventType = document.getElementById("eventType");
const eventDate = document.getElementById("eventDate");
const eventStartTime = document.getElementById("eventStartTime");
const eventEndTime = document.getElementById("eventEndTime");
const eventLocation = document.getElementById("eventLocation");
const eventDescription = document.getElementById("eventDescription");
const eventCreatedAt = document.getElementById("eventCreatedAt");
const eventUpdatedAt = document.getElementById("eventUpdatedAt");

const editEventButton = document.getElementById("editEventButton");
const sidebarToggle = document.getElementById("sidebarToggle");

const params = new URLSearchParams(window.location.search);
const eventId = params.get("id");

document.addEventListener("DOMContentLoaded", () => {
    setupSidebar();
    loadEvent();
});

function setupSidebar() {
    const sidebar = document.querySelector(".admin-sidebar");

    sidebarToggle?.addEventListener("click", event => {
        event.stopPropagation();

        sidebar?.classList.toggle("open");
    });

    document.addEventListener("click", event => {

        if (
            window.innerWidth <= 900 &&
            sidebar?.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            !sidebarToggle?.contains(event.target)
        ) {
            sidebar.classList.remove("open");
        }

    });
}

async function loadEvent() {

    if (!eventId) {
        showError("No event ID was provided.");

        return;
    }

    showLoading();

    const { data, error } = await supabase
        .from("events")
        .select(`
            id,
            event_name,
            event_type,
            event_date,
            start_time,
            end_time,
            location,
            description,
            created_at,
            updated_at
        `)
        .eq("id", eventId)
        .maybeSingle();

    if (error) {
        console.error("Failed to load event:", error);

        showError(
            "Unable to load this event. Please check your database connection."
        );

        return;
    }

    if (!data) {
        showError("The requested event was not found.");

        return;
    }

    displayEvent(data);
}

function displayEvent(event) {

    if (eventName) {
        eventName.textContent =
            event.event_name || "Untitled Event";
    }

    if (eventType) {
        eventType.textContent =
            formatEventType(event.event_type);

        eventType.className =
            `event-type-badge ${getEventTypeClass(event.event_type)}`;
    }

    if (eventDate) {
        eventDate.textContent =
            formatDate(event.event_date);
    }

    if (eventStartTime) {
        eventStartTime.textContent =
            formatTime(event.start_time);
    }

    if (eventEndTime) {
        eventEndTime.textContent =
            formatTime(event.end_time);
    }

    if (eventLocation) {
        eventLocation.textContent =
            event.location || "Not specified";
    }

    if (eventDescription) {
        eventDescription.textContent =
            event.description || "No description provided.";
    }

    if (eventCreatedAt) {
        eventCreatedAt.textContent =
            formatDateTime(event.created_at);
    }

    if (eventUpdatedAt) {
        eventUpdatedAt.textContent =
            formatDateTime(event.updated_at);
    }

    if (editEventButton) {
        editEventButton.href =
            `edit.html?id=${encodeURIComponent(event.id)}`;
    }

    if (loadingState) {
        loadingState.hidden = true;
    }

    if (errorState) {
        errorState.hidden = true;
    }

    if (detailsState) {
        detailsState.hidden = false;
    }
}

function showLoading() {

    if (loadingState) {
        loadingState.hidden = false;
    }

    if (errorState) {
        errorState.hidden = true;
    }

    if (detailsState) {
        detailsState.hidden = true;
    }
}

function showError(message) {

    if (loadingState) {
        loadingState.hidden = true;
    }

    if (detailsState) {
        detailsState.hidden = true;
    }

    if (errorMessage) {
        errorMessage.textContent = message;
    }

    if (errorState) {
        errorState.hidden = false;
    }
}

function formatEventType(value) {

    if (!value) {
        return "Event";
    }

    return String(value)
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\b\w/g, character =>
            character.toUpperCase()
        );
}

function getEventTypeClass(value) {

    const type = String(value || "")
        .trim()
        .toLowerCase();

    if (
        type.includes("meeting") ||
        type.includes("conference")
    ) {
        return "event-type-meeting";
    }

    if (
        type.includes("sport") ||
        type.includes("competition")
    ) {
        return "event-type-sport";
    }

    if (
        type.includes("holiday") ||
        type.includes("celebration")
    ) {
        return "event-type-celebration";
    }

    if (
        type.includes("academic") ||
        type.includes("exam")
    ) {
        return "event-type-academic";
    }

    return "event-type-default";
}

function formatDate(value) {

    if (!value) {
        return "Not specified";
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

function formatTime(value) {

    if (!value) {
        return "Not specified";
    }

    const parts = String(value).split(":");

    if (parts.length < 2) {
        return value;
    }

    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    if (
        !Number.isInteger(hours) ||
        !Number.isInteger(minutes)
    ) {
        return value;
    }

    const date = new Date();

    date.setHours(hours, minutes, 0, 0);

    return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
    });
}

function formatDateTime(value) {

    if (!value) {
        return "Not available";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Not available";
    }

    return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

const logoutButton =
    document.querySelector(".logout-button");

logoutButton?.addEventListener("click", async event => {

    event.preventDefault();

    const { error } =
        await supabase.auth.signOut();

    if (error) {

        alert(
            "Unable to logout. Please try again."
        );

        return;
    }

    window.location.href =
        "../login.html";
});