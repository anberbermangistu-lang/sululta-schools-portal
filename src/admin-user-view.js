import { supabase } from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const userId = params.get("id");

const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const userContent = document.getElementById("userContent");
const errorMessage = document.getElementById("errorMessage");
const retryButton = document.getElementById("retryButton");
const messageBox = document.getElementById("messageBox");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".admin-sidebar");
const photoContainer = document.getElementById("photoContainer");
const editButton = document.getElementById("editUserButton");
const deleteButton = document.getElementById("deleteUserButton");
const logoutButton = document.getElementById("logoutButton");

let user = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    setupSidebar();
    setupLogout();

    if (retryButton) {
        retryButton.addEventListener("click", loadUser);
    }

    if (!userId) {
        showError("No user ID was provided.");
        return;
    }

    await loadUser();
}

async function loadUser() {
    showLoading();

    try {
        const { data, error } = await supabase
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
                status,
                created_at,
                update_at,
                student_id
            `)
            .eq("id", userId)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            showError("The requested user could not be found.");
            return;
        }

        user = data;
        renderUser();
        showContent();
    } catch (error) {
        console.error("User loading error:", error);
        showError(error.message || "Failed to load user information.");
    }
}

function renderUser() {
    if (!user) return;

    const firstName = String(user.first_name || "").trim();
    const lastName = String(user.last_name || "").trim();
    const fullName = `${firstName} ${lastName}`.trim() || "User";
    const role = formatRole(user.role);
    const status = formatStatus(user.status);

    setText("userName", fullName);
    setText("userEmail", user.email || "N/A");
    setText("userStatus", status);

    setText("detailFirstName", firstName || "N/A");
    setText("detailLastName", lastName || "N/A");
    setText("detailEmail", user.email || "N/A");
    setText("detailUsername", user.username || "N/A");
    setText("detailPhone", user.phone || "N/A");
    setText("detailRole", role);
    setText("detailStatus", status);
    setText("detailCreated", formatDate(user.created_at));

    renderPhoto(fullName, firstName, lastName);

    if (editButton) {
        editButton.href = `/admin/user-edit.html?id=${encodeURIComponent(user.id)}`;
    }

    setupDelete();
}

function renderPhoto(fullName, firstName, lastName) {
    if (!photoContainer) return;

    const photoUrl = getPhotoUrl(user.photo_url);
    const initials = getInitials(firstName, lastName);

    photoContainer.innerHTML = "";

    if (!photoUrl) {
        showInitials(initials);
        return;
    }

    const image = document.createElement("img");
    image.src = photoUrl;
    image.alt = fullName;
    image.className = "student-photo";
    image.loading = "eager";

    image.onerror = () => {
        showInitials(initials);
    };

    photoContainer.appendChild(image);
}

function showInitials(initials) {
    if (!photoContainer) return;

    photoContainer.innerHTML = `
        <div class="student-avatar">
            ${escapeHtml(initials)}
        </div>
    `;
}

function getPhotoUrl(value) {
    if (!value) return null;

    const photo = String(value).trim();

    if (!photo) return null;

    if (photo.startsWith("http://") || photo.startsWith("https://")) {
        return photo;
    }

    const cleanPath = photo.replace(/^\/+/, "");

    const buckets = ["profiles", "student-photos", "students"];

    for (const bucket of buckets) {
        const { data } = supabase.storage
            .from(bucket)
            .getPublicUrl(cleanPath);

        if (data?.publicUrl) {
            return data.publicUrl;
        }
    }

    return null;
}

function setupDelete() {
    if (!deleteButton || !user) return;

    deleteButton.onclick = async () => {
        const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();

        const confirmed = window.confirm(
            `Are you sure you want to delete ${fullName || "this user"}?`
        );

        if (!confirmed) return;

        deleteButton.disabled = true;
        deleteButton.textContent = "Deleting...";

        try {
            const { error } = await supabase
                .from("profiles")
                .delete()
                .eq("id", user.id);

            if (error) throw error;

            window.location.href = "/admin/users.html";
        } catch (error) {
            console.error("User delete error:", error);
            showMessage(
                error.message || "Failed to delete user.",
                "error"
            );

            deleteButton.disabled = false;
            deleteButton.textContent = "🗑️ Delete User";
        }
    };
}

function setupSidebar() {
    if (!sidebarToggle || !sidebar) return;

    sidebarToggle.addEventListener("click", () => {
        sidebar.classList.toggle("mobile-open");
    });
}

function setupLogout() {
    if (!logoutButton) return;

    logoutButton.addEventListener("click", async () => {
        const { error } = await supabase.auth.signOut();

        if (error) {
            showMessage(error.message || "Failed to log out.", "error");
            return;
        }

        window.location.replace("/login.html");
    });
}

function showLoading() {
    if (loadingState) loadingState.hidden = false;
    if (errorState) errorState.hidden = true;
    if (userContent) userContent.hidden = true;
}

function showContent() {
    if (loadingState) loadingState.hidden = true;
    if (errorState) errorState.hidden = true;
    if (userContent) userContent.hidden = false;
}

function showError(message) {
    if (loadingState) loadingState.hidden = true;
    if (userContent) userContent.hidden = true;
    if (errorState) errorState.hidden = false;

    if (errorMessage) {
        errorMessage.textContent = message;
    }
}

function showMessage(text, type = "error") {
    if (!messageBox) return;

    messageBox.textContent = text;
    messageBox.className = `message ${type}`;
    messageBox.hidden = false;
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function formatRole(value) {
    const role = String(value || "").trim();

    if (!role) return "N/A";

    return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatStatus(value) {
    const status = String(value || "").trim();

    if (!status) return "N/A";

    return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value) {
    if (!value) return "N/A";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "N/A";
    }

    return date.toLocaleDateString();
}

function getInitials(firstName, lastName) {
    const first = String(firstName || "").trim();
    const last = String(lastName || "").trim();

    if (first && last) {
        return (first.charAt(0) + last.charAt(0)).toUpperCase();
    }

    if (first) {
        return first.charAt(0).toUpperCase();
    }

    if (last) {
        return last.charAt(0).toUpperCase();
    }

    return "U";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}