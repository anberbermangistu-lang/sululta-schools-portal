import { supabase, isSupabaseConfigured } from "./supabase.js";

// Clean any sensitive credentials accidentally present in URL parameters
if (typeof window !== "undefined" && window.location.search) {
    const params = new URLSearchParams(window.location.search);
    if (params.has("password") || params.has("email")) {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    }
}

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const passwordToggle = document.getElementById("passwordToggle");
const submitButton = document.getElementById("loginButton") || loginForm?.querySelector('button[type="submit"]');

function showMessage(message, type = "error") {
    if (!loginMessage) return;
    loginMessage.textContent = message;
    loginMessage.className = `login-message portal-login__message ${type}`;
    loginMessage.hidden = !message;
}

passwordToggle?.addEventListener("click", () => {
    if (!passwordInput) return;

    const isVisible = passwordInput.type === "text";
    passwordInput.type = isVisible ? "password" : "text";
    passwordToggle.setAttribute("aria-pressed", String(!isVisible));
    passwordToggle.setAttribute("aria-label", isVisible ? "Show password" : "Hide password");
});

function getDashboard(role) {
    const normalized = String(role || "").trim().toLowerCase();
    switch (normalized) {
        case "admin":
        case "administrator":
            return "/admin/dashboard.html";
        case "teacher":
            return "/teacher/dashboard.html";
        case "student":
            return "/student/dashboard.html";
        default:
            return null;
    }
}

function formatAuthErrorMessage(error) {
    if (!error) return "Login failed. Please try again.";

    const msg = String(error.message || "").toLowerCase();
    const code = String(error.code || error.error_code || error.status || "").toLowerCase();

    // 1. Invalid credentials
    if (
        code === "invalid_credentials" ||
        msg.includes("invalid login credentials") ||
        msg.includes("invalid email or password") ||
        (code === "400" && msg.includes("credentials"))
    ) {
        return "Invalid email address or password. Please check your credentials and try again.";
    }

    // 2. Unconfirmed accounts
    if (
        code === "email_not_confirmed" ||
        msg.includes("email not confirmed") ||
        msg.includes("unconfirmed")
    ) {
        return "Your email address has not been confirmed. Please check your inbox or contact the administrator.";
    }

    // 3. Rate limits / too many requests
    if (
        code === "over_request_rate_limit" ||
        code === "429" ||
        msg.includes("rate limit") ||
        msg.includes("too many requests")
    ) {
        return "Too many login attempts. Please wait a moment before trying again.";
    }

    // 4. Configuration issues
    if (
        msg.includes("configuration") ||
        msg.includes("supabaseurl") ||
        msg.includes("anon key") ||
        msg.includes("credentials missing")
    ) {
        return "Authentication service configuration issue. Please contact the administrator.";
    }

    // 5. School account custom business logic errors
    if (
        msg.includes("school account is not configured") ||
        msg.includes("account is inactive") ||
        msg.includes("role is not configured")
    ) {
        return error.message;
    }

    // 6. Network / offline issues
    if (
        (typeof navigator !== "undefined" && !navigator.onLine) ||
        error.name === "AbortError" ||
        msg.includes("failed to fetch") ||
        msg.includes("networkerror") ||
        msg.includes("network")
    ) {
        return "Network connection problem. Please check your internet connection and try again.";
    }

    return error.message || "Unable to log in. Please check your credentials or contact administrator.";
}

// Initial configuration check
if (!isSupabaseConfigured || !supabase) {
    showMessage("Portal authentication service is not properly configured. Please contact the administrator.", "error");
    if (submitButton) {
        submitButton.disabled = true;
    }
}

loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("");

    if (!isSupabaseConfigured || !supabase) {
        showMessage("Portal authentication service is not properly configured. Please contact the administrator.");
        return;
    }

    const email = emailInput?.value.trim() || "";
    const password = passwordInput?.value || "";

    if (!email || !password) {
        showMessage("Please enter your email and password.");
        return;
    }

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Logging in...";
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) throw error;
        if (!data?.user) throw new Error("Unable to identify the user.");

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id, role, status")
            .eq("id", data.user.id)
            .maybeSingle();

        if (profileError) throw profileError;

        if (!profile) {
            await supabase.auth.signOut();
            throw new Error("Your school account is not configured. Please contact the administrator.");
        }

        const role = String(profile.role || "").trim().toLowerCase();
        const status = String(profile.status || "").trim().toLowerCase();

        if (status !== "active") {
            await supabase.auth.signOut();
            throw new Error("Your account is inactive. Please contact the administrator.");
        }

        const dashboard = getDashboard(role);
        if (!dashboard) {
            await supabase.auth.signOut();
            throw new Error("Your account role is not configured.");
        }

        showMessage("Login successful. Redirecting...", "success");
        window.location.replace(dashboard);

    } catch (error) {
        console.error("[login] Auth error:", error?.message);
        showMessage(formatAuthErrorMessage(error));
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Login";
        }
    }
});
