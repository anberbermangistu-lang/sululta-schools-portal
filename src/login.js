import { supabase } from "./supabase.js";

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

function showMessage(message, type = "error") {
    if (!loginMessage) {
        return;
    }

    loginMessage.textContent = message;
    loginMessage.className = `login-message ${type}`;
    loginMessage.hidden = !message;
}

function getDashboard(role) {
    switch (String(role || "").trim().toLowerCase()) {
        case "admin":
            return "/admin/dashboard.html";
        case "teacher":
            return "/teacher/dashboard.html";
        case "student":
            return "/student/dashboard.html";
        case "parent":
            return "/parent/dashboard.html";
        default:
            return null;
    }
}

loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    showMessage("");

    const email = document.getElementById("email")?.value.trim();
    const password = document.getElementById("password")?.value;

    if (!email || !password) {
        showMessage("Please enter your email and password.");
        return;
    }

    const submitButton = loginForm.querySelector('button[type="submit"]');

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Logging in...";
    }

    try {
        const {
            data,
            error
        } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        if (!data?.user) {
            throw new Error("Unable to identify the user.");
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
                phone,
                photo_url,
                status
            `)
            .eq("id", data.user.id)
            .maybeSingle();

        if (profileError) {
            throw profileError;
        }

        if (!profile) {
            await supabase.auth.signOut();
            throw new Error("User profile was not found.");
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
        console.error("Login error:", error);

        showMessage(
            error?.message || "Login failed."
        );
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = "Login";
        }
    }
});                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  
