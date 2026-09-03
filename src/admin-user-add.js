import { supabase } from "./supabase.js";

const form = document.getElementById("userForm");
const message = document.getElementById("message");
const saveButton = document.getElementById("saveUserButton");
const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".admin-sidebar");

const roleSelect = document.getElementById("role");
const studentSelectGroup = document.getElementById("studentSelectGroup");
const studentSelect = document.getElementById("studentId");

let students = [];

function showMessage(text, type = "info") {
    if (!message) return;

    message.textContent = text;
    message.className = `message ${type}`;
    message.hidden = false;
}

function clearMessage() {
    if (!message) return;

    message.textContent = "";
    message.hidden = true;
}

function setupSidebar() {
    if (!sidebarToggle || !sidebar) return;

    sidebarToggle.addEventListener("click", () => {
        sidebar.classList.toggle("mobile-open");
    });
}

function setupLogout() {
    if (!logoutButton) return;

    logoutButton.addEventListener("click", async () => {
        const { error } = await supabase.auth.signOut();

        if (error) {
            showMessage(error.message, "error");
            return;
        }

        window.location.href = "/login.html";
    });
}

async function checkAdmin() {
    const {
        data: { user },
        error
    } = await supabase.auth.getUser();

    if (error || !user) {
        window.location.href = "/login.html";
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
            username,
            role,
            photo_url,
            status
        `)
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile) {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return false;
    }

    if (
        String(profile.role).toLowerCase() !== "admin" ||
        String(profile.status).toLowerCase() !== "active"
    ) {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return false;
    }

    updateAdminProfile(profile);

    return true;
}

function updateAdminProfile(profile) {
    const fullName =
        `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
        profile.username ||
        "Administrator";

    const adminName = document.querySelector(
        ".admin-profile-info strong"
    );

    const adminRole = document.querySelector(
        ".admin-profile-info span"
    );

    const adminAvatar = document.querySelector(
        ".admin-avatar"
    );

    if (adminName) {
        adminName.textContent = fullName;
    }

    if (adminRole) {
        adminRole.textContent = "Admin";
    }

    if (adminAvatar) {
        adminAvatar.textContent =
            fullName.charAt(0).toUpperCase();
    }
}

async function loadStudents() {
    if (!studentSelect) return;

    studentSelect.innerHTML = "";

    const loadingOption = document.createElement("option");
    loadingOption.value = "";
    loadingOption.textContent = "Loading students...";
    studentSelect.appendChild(loadingOption);

    const {
        data,
        error
    } = await supabase
        .from("students")
        .select(`
            id,
            student_id,
            first_name,
            last_name,
            email,
            phone,
            gender,
            date_of_birth,
            class,
            section,
            status
        `)
        .order("first_name", {
            ascending: true
        });

    if (error) {
        console.error("Load students error:", error);

        studentSelect.innerHTML = "";

        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Unable to load students";

        studentSelect.appendChild(option);

        showMessage(
            "Unable to load students: " + error.message,
            "error"
        );

        return;
    }

    students = data || [];

    studentSelect.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Select Student";
    studentSelect.appendChild(defaultOption);

    students.forEach(student => {
        const option = document.createElement("option");

        option.value = student.id;

        option.textContent =
            `${student.student_id || "No ID"} - ` +
            `${student.first_name || ""} ${student.last_name || ""}`.trim();

        studentSelect.appendChild(option);
    });

    if (students.length === 0) {
        studentSelect.innerHTML = "";

        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No students found";

        studentSelect.appendChild(option);
    }
}

function handleRoleChange() {
    if (!roleSelect || !studentSelectGroup) return;

    const role = roleSelect.value;

    if (role === "student") {
        studentSelectGroup.hidden = false;

        loadStudents();
    } else {
        studentSelectGroup.hidden = true;

        if (studentSelect) {
            studentSelect.value = "";
        }
    }
}

function handleStudentChange() {
    if (!studentSelect) return;

    const studentId = Number(studentSelect.value);

    if (!studentId) return;

    const student = students.find(
        item => Number(item.id) === studentId
    );

    if (!student) return;

    const firstName = document.getElementById("firstName");
    const lastName = document.getElementById("lastName");
    const email = document.getElementById("email");
    const phone = document.getElementById("phone");

    if (firstName) {
        firstName.value = student.first_name || "";
    }

    if (lastName) {
        lastName.value = student.last_name || "";
    }

    if (email) {
        email.value = student.email || "";
    }

    if (phone) {
        phone.value = student.phone || "";
    }
}

function getFormData() {
    return {
        first_name:
            document.getElementById("firstName").value.trim(),

        last_name:
            document.getElementById("lastName").value.trim(),

        email:
            document.getElementById("email").value.trim().toLowerCase(),

        username:
            document.getElementById("username").value.trim(),

        phone:
            document.getElementById("phone").value.trim(),

        role:
            document.getElementById("role").value,

        password:
            document.getElementById("password").value,

        confirmPassword:
            document.getElementById("confirmPassword").value,

        student_id:
            document.getElementById("studentId")?.value || ""
    };
}

function validateForm(data) {
    if (!data.first_name || !data.last_name) {
        return "First name and last name are required.";
    }

    if (!data.email) {
        return "Email is required.";
    }

    if (!data.role) {
        return "Please select a role.";
    }

    if (
        data.role === "student" &&
        !data.student_id
    ) {
        return "Please select a student.";
    }

    if (!data.password) {
        return "Password is required.";
    }

    if (data.password.length < 6) {
        return "Password must contain at least 6 characters.";
    }

    if (data.password !== data.confirmPassword) {
        return "Passwords do not match.";
    }

    return null;
}

async function createAccount(data) {
    const {
        data: sessionData,
        error: sessionError
    } = await supabase.auth.getSession();

    if (
        sessionError ||
        !sessionData.session
    ) {
        throw new Error(
            "Your admin session has expired. Please login again."
        );
    }

    const response = await fetch(
        `${supabase.supabaseUrl}/functions/v1/create-user`,
        {
            method: "POST",

            headers: {
                "Content-Type": "application/json",

                "Authorization":
                    `Bearer ${sessionData.session.access_token}`,

                "apikey":
                    supabase.supabaseKey
            },

            body: JSON.stringify({
                first_name: data.first_name,
                last_name: data.last_name,
                email: data.email,
                username: data.username || null,
                phone: data.phone || null,
                role: data.role,
                password: data.password,

                student_id:
                    data.role === "student"
                        ? Number(data.student_id)
                        : null
            })
        }
    );

    let result;

    try {
        result = await response.json();
    } catch {
        result = {};
    }

    if (!response.ok) {
        throw new Error(
            result.error ||
            "Failed to create account."
        );
    }

    return result;
}

if (roleSelect) {
    roleSelect.addEventListener(
        "change",
        handleRoleChange
    );
}

if (studentSelect) {
    studentSelect.addEventListener(
        "change",
        handleStudentChange
    );
}

form?.addEventListener(
    "submit",
    async event => {
        event.preventDefault();

        clearMessage();

        const data = getFormData();

        const validationError =
            validateForm(data);

        if (validationError) {
            showMessage(
                validationError,
                "error"
            );
            return;
        }

        if (saveButton) {
            saveButton.disabled = true;
            saveButton.textContent =
                "Creating Account...";
        }

        try {
            await createAccount(data);

            showMessage(
                "Account created successfully.",
                "success"
            );

            form.reset();

            if (studentSelectGroup) {
                studentSelectGroup.hidden = true;
            }

            setTimeout(() => {
                window.location.href =
                    "/admin/users.html";
            }, 1200);

        } catch (error) {
            console.error(
                "Create account error:",
                error
            );

            showMessage(
                error.message,
                "error"
            );

        } finally {
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent =
                    "Create Account";
            }
        }
    }
);

async function initialize() {
    setupSidebar();
    setupLogout();

    const isAdmin = await checkAdmin();

    if (!isAdmin) {
        return;
    }
}

initialize();