import { supabase } from "./supabase.js";

const form = document.getElementById("resetPasswordForm");
const message = document.getElementById("resetMessage");
const button = document.getElementById("updatePasswordButton");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");

function showMessage(text, type = "error") {
    if (!message) return;

    message.textContent = text;
    message.className = `login-message ${type}`;
    message.hidden = !text;
}

async function validateResetSession() {
    if (button) button.disabled = true;

    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;

        if (!user) {
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

    if (password.length < 8) {
        showMessage("Password must be at least 8 characters.");
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

    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) {
            throw new Error("This password reset link is invalid or has expired. Request a new link.");
        }

        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;

        showMessage("Password updated successfully. Redirecting to login...", "success");
        setTimeout(() => window.location.replace("/login.html"), 2000);
    } catch (error) {
        console.error("Update password error:", error);
        showMessage(error?.message || "Unable to update your password.");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Update Password";
        }
    }
});

void validateResetSession();
