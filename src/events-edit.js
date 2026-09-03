import { supabase } from "./supabase.js";

const eventForm = document.getElementById("eventForm");

const eventName = document.getElementById("eventName");
const eventType = document.getElementById("eventType");
const eventDate = document.getElementById("eventDate");
const locationInput = document.getElementById("location");
const description = document.getElementById("description");

const saveButton = document.getElementById("saveButton");
const messageBox = document.getElementById("messageBox");
const sidebarToggle = document.getElementById("sidebarToggle");

const params = new URLSearchParams(window.location.search);
const eventId = params.get("id");

let originalEvent = null;

document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

async function initialize() {
    setupSidebar();
    setupForm();

    if (!eventId) {
        showMessage(
            "No event ID was provided.",
            "error"
        );

        disableForm();
        return;
    }

    await loadEvent();
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
    eventForm?.addEventListener("submit", handleSubmit);
}

async function loadEvent() {
    setLoadingState(true);

    const { data, error } = await supabase
        .from("events")
        .select(`
            id,
            event_name,
            event_type,
            event_date,
            location,
            description,
            created_at,
            updated_at
        `)
        .eq("id", eventId)
        .maybeSingle();

    setLoadingState(false);

    if (error) {
        console.error("Failed to load event:", error);

        showMessage(
            "Unable to load this event. Please check your database connection.",
            "error"
        );

        disableForm();

        return;
    }

    if (!data) {
        showMessage(
            "The requested event was not found.",
            "error"
        );

        disableForm();

        return;
    }

    originalEvent = data;

    populateForm(data);
}

function populateForm(event) {
    if (eventName) {
        eventName.value = event.event_name || "";
    }

    if (eventType) {
        eventType.value = event.event_type || "";
    }

    if (eventDate) {
        eventDate.value = formatDateForInput(event.event_date);
    }

    if (locationInput) {
        locationInput.value = event.location || "";
    }

    if (description) {
        description.value = event.description || "";
    }
}

async function handleSubmit(event) {
    event.preventDefault();

    if (!eventId) {
        showMessage(
            "Invalid event ID.",
            "error"
        );

        return;
    }

    const name = String(eventName?.value || "").trim();
    const type = String(eventType?.value || "").trim();
    const date = String(eventDate?.value || "").trim();
    const location = String(locationInput?.value || "").trim();
    const details = String(description?.value || "").trim();

    if (!name) {
        showMessage(
            "Please enter the event name.",
            "error"
        );

        eventName?.focus();

        return;
    }

    if (!type) {
        showMessage(
            "Please select the event type.",
            "error"
        );

        eventType?.focus();

        return;
    }

    if (!date) {
        showMessage(
            "Please select the event date.",
            "error"
        );

        eventDate?.focus();

        return;
    }

    setSavingState(true);

    const updateData = {
        event_name: name,
        event_type: type,
        event_date: date,
        location: location || null,
        description: details || null,
        updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
        .from("events")
        .update(updateData)
        .eq("id", eventId);

    if (updateError) {
        console.error("Failed to update event:", updateError);

        setSavingState(false);

        showMessage(
            getDatabaseErrorMessage(updateError),
            "error"
        );

        return;
    }

    setSavingState(false);

    showMessage(
        "Event updated successfully.",
        "success"
    );

    setTimeout(() => {
        window.location.href = "dashboard.html";
    }, 1000);
}

function formatDateForInput(value) {
    if (!value) {
        return "";
    }

    const date = String(value).split("T")[0];

    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return "";
    }

    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function setSavingState(isSaving) {
    if (!saveButton) {
        return;
    }

    saveButton.disabled = isSaving;

    if (isSaving) {
        saveButton.innerHTML = "Saving...";
    } else {
        saveButton.innerHTML = "Save Changes";
    }
}

function setLoadingState(isLoading) {
    if (!saveButton) {
        return;
    }

    saveButton.disabled = isLoading;

    if (isLoading) {
        saveButton.innerHTML = "Loading...";
    } else {
        saveButton.innerHTML = "Save Changes";
    }
}

function disableForm() {
    const controls = eventForm?.querySelectorAll(
        "input, select, textarea, button"
    );

    controls?.forEach(control => {
        control.disabled = true;
    });
}

function showMessage(message, type = "success") {
    if (!messageBox) {
        return;
    }

    messageBox.textContent = message;
    messageBox.className = `message ${type}`;

    messageBox.style.display = "block";

    if (type === "success") {
        setTimeout(() => {
            if (messageBox) {
                messageBox.textContent = "";
                messageBox.className = "message";
                messageBox.style.display = "";
            }
        }, 4000);
    }
}

function getDatabaseErrorMessage(error) {
    if (!error) {
        return "Unable to update the event.";
    }

    if (error.code === "42501") {
        return "You do not have permission to update events.";
    }

    if (error.code === "23505") {
        return "An event with the same information already exists.";
    }

    if (error.code === "42703") {
        return "One of the event columns does not exist in the database. Please check the events table structure.";
    }

    if (error.message) {
        return error.message;
    }

    return "Unable to update the event. Please try again.";
}

const logoutButton = document.querySelector(".logout-button");

logoutButton?.addEventListener("click", async event => {
    event.preventDefault();

    const { error } = await supabase.auth.signOut();

    if (error) {
        showMessage(
            "Unable to logout. Please try again.",
            "error"
        );

        return;
    }

    window.location.href = "../login.html";
});