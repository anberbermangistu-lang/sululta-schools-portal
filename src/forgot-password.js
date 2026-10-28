import { supabase } from "./supabase.js";

const form =
document.getElementById("forgotPasswordForm");

const message =
document.getElementById("forgotMessage");

const button =
document.getElementById("resetButton");

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

const email =
    document.getElementById("email")?.value
        .trim()
        .toLowerCase();

if (!email) {

    showMessage(
        "Please enter your email address."
    );

    return;
}

if (button) {

    button.disabled = true;
    button.textContent = "Sending...";
}

try {

    const { error } =
        await supabase.auth.resetPasswordForEmail(
            email,
            {
                redirectTo:
                    `${window.location.origin}/reset-password.html`
            }
        );

    if (error) {
        throw error;
    }

    showMessage(
        "If an account exists for that email address, a password reset link has been sent.",
        "success"
    );

    form.reset();

} catch (error) {

    console.error(
        "Password reset error:",
        error
    );

    showMessage(
        error?.message ||
        "Unable to send password reset email."
    );

} finally {

    if (button) {

        button.disabled = false;
        button.textContent = "Send Reset Link";
    }
}
});
