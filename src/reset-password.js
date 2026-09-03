import { supabase } from "./supabase.js";

const form =
document.getElementById("resetPasswordForm");

const message =
document.getElementById("resetMessage");

const button =
document.getElementById("updatePasswordButton");

function showMessage(text, type = "error") {

if (!message) {
    return;
}

message.textContent = text;
message.className = `login-message ${type}`;
message.hidden = !text;
}

form?.addEventListener("submit", async (event) => {
event.preventDefault();

showMessage("");

const password =
    document.getElementById("password")?.value;

const confirmPassword =
    document.getElementById("confirmPassword")?.value;

if (!password || !confirmPassword) {

    showMessage(
        "Please enter and confirm your new password."
    );

    return;
}

if (password.length < 6) {

    showMessage(
        "Password must be at least 6 characters."
    );

    return;
}

if (password !== confirmPassword) {

    showMessage(
        "Passwords do not match."
    );

    return;
}

if (button) {

    button.disabled = true;
    button.textContent = "Updating...";
}

try {

    const { error } =
        await supabase.auth.updateUser({
            password
        });

    if (error) {
        throw error;
    }

    showMessage(
        "Password updated successfully. Redirecting to login...",
        "success"
    );

    setTimeout(() => {

        window.location.replace(
            "/login.html"
        );

    }, 2000);

} catch (error) {

    console.error(
        "Update password error:",
        error
    );

    showMessage(
        error?.message ||
        "Unable to update your password."
    );

} finally {

    if (button) {

        button.disabled = false;
        button.textContent = "Update Password";
    }
}
});
