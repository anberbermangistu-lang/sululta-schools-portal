import { supabase } from "./supabase.js";

const passwordForm = document.getElementById("passwordForm");
const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");
const changePasswordButton = document.getElementById("changePasswordButton");
const resetPasswordButton = document.getElementById("resetPasswordButton");
const passwordMessage = document.getElementById("passwordMessage");
const studentHeaderName = document.getElementById("studentHeaderName");
const studentAvatar = document.getElementById("studentAvatar");
const sidebarToggle = document.getElementById("sidebarToggle");
const logoutButton = document.getElementById("logoutButton");

document.addEventListener("DOMContentLoaded", initialize);

passwordForm?.addEventListener("submit", changePassword);

resetPasswordButton?.addEventListener("click", () => {
    hideMessage();
});

sidebarToggle?.addEventListener("click", () => {
    document
        .querySelector(".admin-page")
        ?.classList.toggle("sidebar-collapsed");
});

logoutButton?.addEventListener("click", logout);

async function initialize() {
    const {
        data: { user },
        error
    } = await supabase.auth.getUser();

    if (error || !user) {
        window.location.href = "/login.html";
        return;
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
            role,
            status,
            photo_url
        `)
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile) {
        console.error("Profile error:", profileError);

        showMessage(
            "Your account profile could not be found.",
            "error"
        );

        return;
    }

    const role = String(profile.role || "")
        .trim()
        .toLowerCase();

    const status = String(profile.status || "")
        .trim()
        .toLowerCase();

    if (role !== "student") {
        showMessage(
            "This page is only available for student accounts.",
            "error"
        );

        return;
    }

    if (status && status !== "active") {
        showMessage(
            "Your student account is not active.",
            "error"
        );

        return;
    }

    updateStudentHeader(profile);
}

function updateStudentHeader(profile) {
    const firstName = String(profile.first_name || "").trim();
    const lastName = String(profile.last_name || "").trim();

    const fullName =
        `${firstName} ${lastName}`.trim() || "Student";

    if (studentHeaderName) {
        studentHeaderName.textContent = fullName;
    }

    if (!studentAvatar) {
        return;
    }

    const photo = getPhotoUrl(profile.photo_url);

    if (!photo) {
        studentAvatar.textContent = getInitials(
            firstName,
            lastName
        );

        return;
    }

    studentAvatar.innerHTML = "";

    const image = document.createElement("img");

    image.src = photo;
    image.alt = fullName;

    image.onerror = () => {
        studentAvatar.textContent = getInitials(
            firstName,
            lastName
        );
    };

    studentAvatar.appendChild(image);
}

async function changePassword(event) {
    event.preventDefault();

    hideMessage();

    const password = String(
        newPassword?.value || ""
    );

    const confirmation = String(
        confirmPassword?.value || ""
    );

    if (password.length < 6) {
        showMessage(
            "Password must contain at least 6 characters.",
            "error"
        );

        return;
    }

    if (password !== confirmation) {
        showMessage(
            "Passwords do not match.",
            "error"
        );

        return;
    }

    if (changePasswordButton) {
        changePasswordButton.disabled = true;
        changePasswordButton.textContent = "🔐 Updating...";
    }

    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {
            throw new Error(
                "Your session has expired. Please login again."
            );
        }

        const { error } =
            await supabase.auth.updateUser({
                password: password
            });

        if (error) {
            throw error;
        }

        passwordForm?.reset();

        showMessage(
            "Your password has been changed successfully.",
            "success"
        );
    } catch (error) {
        console.error(
            "Password update error:",
            error
        );

        showMessage(
            error?.message ||
            "Unable to change your password.",
            "error"
        );
    } finally {
        if (changePasswordButton) {
            changePasswordButton.disabled = false;
            changePasswordButton.textContent =
                "🔐 Change Password";
        }
    }
}

async function logout() {
    if (logoutButton) {
        logoutButton.disabled = true;
    }

    try {
        const { error } =
            await supabase.auth.signOut();

        if (error) {
            throw error;
        }

        window.location.href = "/login.html";
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

function showMessage(message, type = "error") {
    if (!passwordMessage) {
        return;
    }

    passwordMessage.textContent = message;

    passwordMessage.className =
        `message ${type}`;

    passwordMessage.hidden = false;
}

function hideMessage() {
    if (!passwordMessage) {
        return;
    }

    passwordMessage.textContent = "";
    passwordMessage.className = "message";
    passwordMessage.hidden = true;
}

function getPhotoUrl(photo) {
    if (!photo) {
        return null;
    }

    const value = String(photo).trim();

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

    const path = value.replace(/^\/+/, "");

    const { data } =
        supabase.storage
            .from("students")
            .getPublicUrl(path);

    return data?.publicUrl || null;
}

function getInitials(first, last) {
    const firstName = String(first || "").trim();
    const lastName = String(last || "").trim();

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