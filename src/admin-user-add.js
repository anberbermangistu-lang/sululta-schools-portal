import { supabase } from "./supabase.js";

const form = document.getElementById("userForm");
const message = document.getElementById("message");
const saveButton = document.getElementById("saveUserButton");
const btnText = document.getElementById("btnText");
const roleSelect = document.getElementById("role");
const recordSelect = document.getElementById("schoolRecordId");
const recordGroup = document.getElementById("schoolRecordGroup");
const recordRequired = document.getElementById("schoolRecordRequired");
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
    const referenceColumn = role === "teacher" ? "teacher_id" : "student_id";
    const { data, error } = await supabase
        .from(table)
        .select(`id, ${referenceColumn}, first_name, last_name${role === "teacher" ? ", user_id" : ""}`)
        .eq("status", "active")
        .order("first_name");

    if (error) {
        recordSelect.innerHTML = '<option value="">Unable to load records</option>';
        showMessage(`Unable to load ${role} records: ${error.message}`);
        return;
    }

    let availableRecords = data || [];
    if (role === "teacher") {
        availableRecords = availableRecords.filter(record => !record.user_id);
    } else if (availableRecords.length) {
        const { data: linkedProfiles, error: profileError } = await supabase
            .from("profiles")
            .select("student_id")
            .not("student_id", "is", null);

        if (profileError) {
            recordSelect.innerHTML = '<option value="">Unable to load records</option>';
            showMessage(`Unable to check linked student accounts: ${profileError.message}`);
            return;
        }

        const linkedStudentIds = new Set(
            (linkedProfiles || []).map(profile => String(profile.student_id))
        );
        availableRecords = availableRecords.filter(
            record => !linkedStudentIds.has(String(record.id))
        );
    }

    recordSelect.innerHTML = '<option value="">Select a school record</option>';
    for (const record of availableRecords) {
        const option = document.createElement("option");
        option.value = String(record.id);
        const reference = record[referenceColumn];
        option.textContent = `${record.first_name} ${record.last_name} (${reference})`;
        recordSelect.appendChild(option);
    }

    recordSelect.disabled = false;
    if (!availableRecords.length) {
        showMessage(`No unlinked active ${role} records are available.`);
    }
}

function getFormData() {
    return {
        first_name: document.getElementById("firstName")?.value.trim() || "",
        last_name: document.getElementById("lastName")?.value.trim() || "",
        email: document.getElementById("email")?.value.trim().toLowerCase() || "",
        username: document.getElementById("username")?.value.trim() || "",
        phone: document.getElementById("phone")?.value.trim() || "",
        password: document.getElementById("password")?.value || "",
        role: roleSelect?.value || "",
        record_id: roleSelect?.value === "admin" ? null : Number(recordSelect?.value)
    };
}

function validateForm(data) {
    if (!data.first_name || !data.last_name) return "First name and last name are required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return "Enter a valid email address.";
    if (data.password.length < 8) return "Temporary password must be at least 8 characters.";
    if (!["admin", "teacher", "student"].includes(data.role)) return "Choose Admin, Teacher, or Student.";
    if (data.role !== "admin" && (!Number.isSafeInteger(data.record_id) || data.record_id < 1)) {
        return "Select the matching school record.";
    }
    return null;
}

async function createAccount(data) {
    const { data: result, error } = await supabase.functions.invoke("admin-create-school-account", {
        body: {
            mode: "link-existing",
            first_name: data.first_name,
            last_name: data.last_name,
            email: data.email,
            username: data.username,
            phone: data.phone,
            password: data.password,
            role: data.role,
            record_id: data.record_id
        }
    });

    if (error) {
        const response = error.context;
        if (response?.status === 404) {
            throw new Error(
                "The account service is not deployed. Run `supabase functions deploy admin-create-school-account` from the project directory."
            );
        }
        if (response && typeof response.json === "function") {
            const details = await response.json().catch(() => null);
            if (
                data.role === "admin" &&
                /only teacher and student accounts can be created here/i.test(details?.error || "")
            ) {
                throw new Error(
                    "The live account service is outdated and does not support Admin accounts yet. Deploy the updated function with `supabase functions deploy admin-create-school-account`, then try again."
                );
            }
            throw new Error(details?.error || error.message);
        }
        if (error.name === "FunctionsFetchError") {
            throw new Error(
                `Could not connect to the account service from ${window.location.origin}. Confirm admin-create-school-account is deployed and this origin is included in ALLOWED_ORIGINS.`
            );
        }
        throw error;
    }

    if (!result?.success) throw new Error("The account could not be created.");
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
    updateRoleFields();

    if (roleSelect.value === "teacher" || roleSelect.value === "student") {
        void loadSchoolRecords(roleSelect.value);
    } else if (recordSelect) {
        recordSelect.disabled = true;
        recordSelect.innerHTML = '<option value="">Choose a role first</option>';
    }
});

function updateRoleFields() {
    const needsSchoolRecord = roleSelect?.value !== "admin";
    if (recordGroup) recordGroup.hidden = !needsSchoolRecord;
    if (recordRequired) recordRequired.hidden = !needsSchoolRecord;
    if (recordSelect) recordSelect.required = needsSchoolRecord;
}

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
    if (btnText) btnText.textContent = "Submitting...";
    try {
        await createAccount(data);
        showMessage("Account created. Share the temporary password securely and ask the user to change it after signing in.", "success");
        form.reset();
        if (recordSelect) {
            recordSelect.disabled = true;
            recordSelect.innerHTML = '<option value="">Choose a role first</option>';
        }
        updateRoleFields();
    } catch (error) {
        console.error("Create account error:", error);
        showMessage(error?.message || "Unable to create this account.");
    } finally {
        if (saveButton) saveButton.disabled = false;
        if (btnText) btnText.textContent = "Submit";
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
