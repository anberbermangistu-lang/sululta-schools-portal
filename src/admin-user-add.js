import { supabase } from "./supabase.js";

const form = document.getElementById("userForm");
const message = document.getElementById("message");
const saveButton = document.getElementById("saveUserButton");
const btnText = document.getElementById("btnText");
const roleSelect = document.getElementById("role");
const recordSelect = document.getElementById("schoolRecordId");
const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".admin-sidebar");

function showMessage(text, type = "error") {
    if (!message) return;
    message.textContent = text;
    message.className = `ua-message ${type}`;
    message.hidden = false;
    message.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearMessage() {
    if (!message) return;
    message.textContent = "";
    message.hidden = true;
}

async function checkAdmin() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        window.location.replace("/login.html");
        return false;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username, role, status")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) throw profileError;
    if (!profile || profile.role !== "admin" || profile.status !== "active") {
        window.location.replace("/login.html");
        return false;
    }

    const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
        || profile.username
        || "Administrator";
    const nameElement = document.querySelector(".admin-profile-info-name");
    if (nameElement) nameElement.textContent = fullName;
    return true;
}

async function loadSchoolRecords(role) {
    if (!recordSelect) return;
    recordSelect.disabled = true;
    recordSelect.innerHTML = '<option value="">Loading records...</option>';

    const table = role === "teacher" ? "teachers" : "students";
    const { data, error } = await supabase
        .from(table)
        .select("id, teacher_id, student_id, first_name, last_name, user_id")
        .is("user_id", null)
        .eq("status", "active")
        .order("first_name");

    if (error) {
        recordSelect.innerHTML = '<option value="">Unable to load records</option>';
        showMessage(`Unable to load ${role} records: ${error.message}`);
        return;
    }

    recordSelect.innerHTML = '<option value="">Select a school record</option>';
    for (const record of data || []) {
        const option = document.createElement("option");
        option.value = String(record.id);
        const reference = role === "teacher" ? record.teacher_id : record.student_id;
        option.textContent = `${record.first_name} ${record.last_name} (${reference})`;
        recordSelect.appendChild(option);
    }

    recordSelect.disabled = false;
    if (!data?.length) {
        showMessage(`Create an active ${role} record before inviting its account.`);
    }
}

function getFormData() {
    return {
        first_name: document.getElementById("firstName")?.value.trim() || "",
        last_name: document.getElementById("lastName")?.value.trim() || "",
        email: document.getElementById("email")?.value.trim().toLowerCase() || "",
        username: document.getElementById("username")?.value.trim() || "",
        phone: document.getElementById("phone")?.value.trim() || "",
        role: roleSelect?.value || "",
        record_id: Number(recordSelect?.value)
    };
}

function validateForm(data) {
    if (!data.first_name || !data.last_name) return "First name and last name are required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return "Enter a valid email address.";
    if (!["teacher", "student"].includes(data.role)) return "Choose Teacher or Student.";
    if (!Number.isSafeInteger(data.record_id) || data.record_id < 1) return "Select the matching school record.";
    return null;
}

async function inviteAccount(data) {
    const { data: result, error } = await supabase.functions.invoke("admin-invite-user", {
        body: data
    });

    if (error) {
        const response = error.context;
        if (response && typeof response.json === "function") {
            const details = await response.json().catch(() => null);
            throw new Error(details?.error || error.message);
        }
        throw error;
    }

    if (!result?.success) throw new Error("The invitation could not be completed.");
}

function setupSidebar() {
    if (!sidebarToggle || !sidebar) return;
    sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("mobile-open"));
    document.addEventListener("click", event => {
        if (
            window.innerWidth <= 900 &&
            sidebar.classList.contains("mobile-open") &&
            !sidebar.contains(event.target) &&
            !sidebarToggle.contains(event.target)
        ) {
            sidebar.classList.remove("mobile-open");
        }
    });
}

function setupLogout() {
    logoutButton?.addEventListener("click", async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            showMessage(`Unable to sign out: ${error.message}`);
            return;
        }
        window.location.replace("/login.html");
    });
}

roleSelect?.addEventListener("change", () => {
    clearMessage();
    if (roleSelect.value) void loadSchoolRecords(roleSelect.value);
    else if (recordSelect) {
        recordSelect.disabled = true;
        recordSelect.innerHTML = '<option value="">Choose a role first</option>';
    }
});

form?.addEventListener("submit", async event => {
    event.preventDefault();
    clearMessage();
    const data = getFormData();
    const validationError = validateForm(data);
    if (validationError) {
        showMessage(validationError);
        return;
    }

    if (saveButton) saveButton.disabled = true;
    if (btnText) btnText.textContent = "Sending Invitation...";
    try {
        await inviteAccount(data);
        showMessage("Invitation sent. The user must use the email link to set their password.", "success");
        form.reset();
        if (recordSelect) {
            recordSelect.disabled = true;
            recordSelect.innerHTML = '<option value="">Choose a role first</option>';
        }
    } catch (error) {
        console.error("Create account error:", error);
        showMessage(error?.message || "Unable to invite this account.");
    } finally {
        if (saveButton) saveButton.disabled = false;
        if (btnText) btnText.textContent = "Send Invitation";
    }
});

async function initialize() {
    setupSidebar();
    setupLogout();
    try {
        await checkAdmin();
    } catch (error) {
        console.error("Administrator authorization failed:", error);
        showMessage(error.message || "Unable to verify administrator access.");
    }
}

void initialize();
