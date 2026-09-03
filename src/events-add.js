import { supabase } from "./supabase.js";

const form = document.getElementById("eventForm");
const saveButton = document.getElementById("saveEventButton");
const messageBox = document.getElementById("eventMessage");
const sidebarToggle = document.getElementById("sidebarToggle");

document.addEventListener("DOMContentLoaded", initialize);

function initialize() {
    setupSidebar();
    setupForm();
}

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

function setupForm() {
    form?.addEventListener("submit", handleSubmit);
}

async function handleSubmit(event) {
    event.preventDefault();

    clearMessage();

    const eventName = getValue("eventName");
    const eventType = getValue("eventType");
    const eventDate = getValue("eventDate");
    const location = getValue("eventLocation");
    const description = getValue("eventDescription");

    if (!eventName) {
        showMessage("Please enter the event name.", "error");
        focusField("eventName");
        return;
    }

    if (!eventType) {
        showMessage("Please select an event type.", "error");
        focusField("eventType");
        return;
    }

    if (!eventDate) {
        showMessage("Please select the event date.", "error");
        focusField("eventDate");
        return;
    }

    if (!isValidDate(eventDate)) {
        showMessage("Please enter a valid event date.", "error");
        focusField("eventDate");
        return;
    }

    setSavingState(true);

    const eventData = {
        event_name: eventName,
        event_type: eventType,
        event_date: eventDate,
        location: location || null,
        description: description || null
    };

    const { data, error } = await supabase
        .from("events")
        .insert([eventData])
        .select()
        .single();

    if (error) {
        console.error("Failed to create event:", error);

        setSavingState(false);

        showMessage(
            getDatabaseErrorMessage(error),
            "error"
        );

        return;
    }

    console.log("Event created:", data);

    showMessage(
        "Event created successfully.",
        "success"
    );

    form.reset();

    setSavingState(false);

    setTimeout(() => {
        window.location.href = "dashboard.html";
    }, 900);
}

function setSavingState(isSaving) {
    if (!saveButton) {
        return;
    }

    saveButton.disabled = isSaving;

    saveButton.textContent =
        isSaving
            ? "Saving..."
            : "Save Event";
}

function showMessage(message, type = "success") {
    if (!messageBox) {
        return;
    }

    messageBox.textContent = message;

    messageBox.className =
        `message ${type}`;

    messageBox.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

function clearMessage() {
    if (!messageBox) {
        return;
    }

    messageBox.textContent = "";
    messageBox.className = "message";
}

function getValue(id) {
    const element = document.getElementById(id);

    return String(element?.value || "")
        .trim();
}

function focusField(id) {
    document.getElementById(id)?.focus();
}

function isValidDate(value) {
    const date = new Date(`${value}T00:00:00`);

    return !Number.isNaN(date.getTime());
}

function getDatabaseErrorMessage(error) {
    if (!error) {
        return "Unable to create the event.";
    }

    if (error.code === "23505") {
        return "An event with the same information already exists.";
    }

    if (error.code === "23503") {
        return "The event contains invalid related information.";
    }

    if (error.code === "42501") {
        return "You do not have permission to create events.";
    }

    if (
        error.message &&
        error.message.toLowerCase().includes("row-level security")
    ) {
        return "Permission denied by Supabase Row Level Security.";
    }

    return (
        error.message ||
        "Unable to create the event. Please try again."
    );
}

const logoutButton =
    document.querySelector(".logout-button");

logoutButton?.addEventListener("click", async event => {
    event.preventDefault();

    const { error } =
        await supabase.auth.signOut();

    if (error) {
        console.error("Logout failed:", error);

        showMessage(
            "Unable to logout. Please try again.",
            "error"
        );

        return;
    }

    window.location.href = "../login.html";
});