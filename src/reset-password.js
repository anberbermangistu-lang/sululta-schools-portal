import { supabase } from "./supabase.js";

const form = document.getElementById("resetPasswordForm");
const message = document.getElementById("resetMessage");
const button = document.getElementById("updatePasswordButton");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const inviteParams = new URLSearchParams(window.location.hash.slice(1));
const queryParams = new URLSearchParams(window.location.search);
let hasRecoverySession = false;
const isInvitation =
    inviteParams.get("type") === "invite" ||
    queryParams.get("type") === "invite";

if (isInvitation) {
    const title = document.getElementById("passwordPageTitle");
    const description = document.getElementById("passwordPageDescription");
    if (title) title.textContent = "Set Your Password";
    if (description) description.textContent = "Choose a password to activate your school portal account.";
}

function showMessage(text, type = "error") {
    if (!message) return;

    message.textContent = text;
    message.className = `login-message ${type}`;
    message.hidden = !text;
}

if (supabase) {
    supabase.auth.onAuthStateChange(event => {
        if (event === "PASSWORD_RECOVERY") {
            hasRecoverySession = true;
        }
    });
}

async function validateResetSession() {
    if (button) button.disabled = true;

    try {
        if (!supabase) {
            throw new Error("Authentication is not configured. Contact the administrator.");
        }

        if (
            queryParams.has("error") ||
            queryParams.has("error_description") ||
            queryParams.has("error_code")
        ) {
            throw new Error("This password reset link is invalid or has expired. Request a new link.");
        }

        const { data: { session }, error: sessionError } =
            await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;

        if (!hasRecoverySession && !isInvitation) {
            showMessage("Open the password reset link from your email to continue.");
            return;
        }

        if (!session || !user) {
            showMessage("This password reset link is invalid or has expired. Request a new link.");
            return;
        }

        if (button) button.disabled = false;
    } catch (error) {
        console.error("Password reset session validation failed:", error);
        showMessage(error?.message || "Unable to validate this password reset link.");
    }
}

form?.addEventListener("submit", async event => {
    event.preventDefault();
    showMessage("");

    const password = passwordInput?.value || "";
    const confirmPassword = confirmPasswordInput?.value || "";

    if (!password || !confirmPassword) {
        showMessage("Please enter and confirm your new password.");
        return;
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        showMessage("Use at least 8 characters, including a letter and a number.");
        return;
    }

    if (password !== confirmPassword) {
        showMessage("Passwords do not match.");
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Updating...";
    }

    let passwordUpdated = false;

    try {
        if (!supabase) {
            throw new Error("Authentication is not configured. Contact the administrator.");
        }

        if (!hasRecoverySession && !isInvitation) {
            throw new Error("Open the password reset link from your email to continue.");
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) {
            throw new Error("This password reset link is invalid or has expired. Request a new link.");
        }

        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;

        passwordUpdated = true;
        showMessage("Password saved successfully. Redirecting to login...", "success");

        try {
            const { error: signOutError } =
                await supabase.auth.signOut({ scope: "local" });
            if (signOutError) throw signOutError;
        } catch (signOutError) {
            console.error("Could not close the password recovery session:", signOutError);
            showMessage(
                "Your password was updated. Please sign in again; your recovery session could not be closed automatically.",
                "success"
            );
        }

        setTimeout(() => window.location.replace("/login.html"), 1800);
    } catch (error) {
        console.error("Update password error:", error);
        showMessage(error?.message || "Unable to update your password.");
    } finally {
        if (button && !passwordUpdated) {
            button.disabled = false;
            button.textContent = "Update Password";
        }
    }
});

void validateResetSession();
