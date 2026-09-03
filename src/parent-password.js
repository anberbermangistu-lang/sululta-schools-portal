import { supabase } from "./supabase.js";

const message = document.getElementById("message");
const form = document.getElementById("changePasswordForm");
const changePasswordButton = document.getElementById("changePasswordButton");
const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".admin-sidebar");

document.addEventListener(
    "DOMContentLoaded",
    initialize
);

async function initialize() {

    setupSidebar();
    setupLogout();

    const allowed =
        await checkParent();

    if (!allowed) {
        return;
    }

    form?.addEventListener(
        "submit",
        handlePasswordChange
    );
}

async function checkParent() {

    const {
        data: { user },
        error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {

        window.location.href =
            "/login.html";

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

        window.location.href =
            "/login.html";

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

            window.location.href =
                "/admin/dashboard.html";

        } else if (role === "teacher") {

            window.location.href =
                "/teachers/dashboard.html";

        } else {

            window.location.href =
                "/login.html";
        }

        return false;
    }

    if (status !== "active") {

        await supabase.auth.signOut();

        window.location.href =
            "/login.html";

        return false;
    }

    updateParentProfile(profile);

    return true;
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

async function handlePasswordChange(event) {

    event.preventDefault();

    clearMessage();

    const currentPassword =
        document.getElementById(
            "currentPassword"
        )?.value || "";

    const newPassword =
        document.getElementById(
            "newPassword"
        )?.value || "";

    const confirmPassword =
        document.getElementById(
            "confirmPassword"
        )?.value || "";

    if (
        !currentPassword ||
        !newPassword ||
        !confirmPassword
    ) {

        showMessage(
            "Please fill in all password fields.",
            "error"
        );

        return;
    }

    if (newPassword.length < 6) {

        showMessage(
            "New password must be at least 6 characters.",
            "error"
        );

        return;
    }

    if (newPassword !== confirmPassword) {

        showMessage(
            "New password and confirmation password do not match.",
            "error"
        );

        return;
    }

    if (currentPassword === newPassword) {

        showMessage(
            "Your new password must be different from your current password.",
            "error"
        );

        return;
    }

    setLoading(true);

    try {

        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {

            throw new Error(
                "Your session has expired. Please log in again."
            );
        }

        if (!user.email) {

            throw new Error(
                "No email address is associated with this account."
            );
        }

        const {
            error: verifyError
        } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: currentPassword
        });

        if (verifyError) {

            showMessage(
                "Current password is incorrect.",
                "error"
            );

            setLoading(false);

            return;
        }

        const {
            error: updateError
        } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (updateError) {

            throw updateError;
        }

        form.reset();

        showMessage(
            "Your password has been changed successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "Password change error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to change password.",
            "error"
        );

    } finally {

        setLoading(false);
    }
}

function setLoading(loading) {

    if (!changePasswordButton) {
        return;
    }

    changePasswordButton.disabled =
        loading;

    changePasswordButton.textContent =
        loading
            ? "Changing..."
            : "🔐 Change Password";
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

function clearMessage() {

    if (!message) {
        return;
    }

    message.textContent =
        "";

    message.hidden =
        true;

    message.className =
        "message";
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
