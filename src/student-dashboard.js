import { supabase } from "./supabase.js";

const studentAvatar = document.getElementById("studentAvatar");
const profileAvatar = document.getElementById("profileAvatar");

const studentHeaderName = document.getElementById("studentHeaderName");
const welcomeName = document.getElementById("welcomeName");
const profileName = document.getElementById("profileName");

const studentIdElement = document.getElementById("studentId");
const studentClass = document.getElementById("studentClass");
const studentSection = document.getElementById("studentSection");
const studentStatus = document.getElementById("studentStatus");

const profileStudentId = document.getElementById("profileStudentId");
const profileStudentIdDetails = document.getElementById("profileStudentIdDetails");
const profileStatus = document.getElementById("profileStatus");

const firstName = document.getElementById("firstName");
const lastName = document.getElementById("lastName");
const gender = document.getElementById("gender");
const dateOfBirth = document.getElementById("dateOfBirth");
const email = document.getElementById("email");
const phone = document.getElementById("phone");
const className = document.getElementById("className");
const section = document.getElementById("section");
const address = document.getElementById("address");
const accountStatus = document.getElementById("accountStatus");

const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");
const studentMessage = document.getElementById("studentMessage");

function showMessage(message, type = "error") {
    if (!studentMessage) return;

    studentMessage.textContent = message;
    studentMessage.hidden = false;
    studentMessage.className = `message ${type}`;
}

function setText(element, value) {
    if (element) {
        element.textContent = value ?? "-";
    }
}

function formatDate(value) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString();
}

function capitalize(value) {
    if (!value) return "-";

    return value.charAt(0).toUpperCase() + value.slice(1);
}

function setAvatar(element, name, photoUrl) {
    if (!element) return;

    if (photoUrl) {
        element.innerHTML = "";
        element.style.backgroundImage = `url("${photoUrl}")`;
        element.style.backgroundSize = "cover";
        element.style.backgroundPosition = "center";
        element.style.backgroundRepeat = "no-repeat";
        return;
    }

    element.style.backgroundImage = "";
    element.textContent = name
        ? name.trim().charAt(0).toUpperCase()
        : "S";
}

async function loadStudentDashboard() {
    try {
        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser();

        if (authError) {
            throw authError;
        }

        if (!user) {
            window.location.replace("/login.html");
            return;
        }

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, email, role, phone, photo_url, status, student_id")
            .eq("id", user.id)
            .single();

        if (profileError) {
            throw profileError;
        }

        if (!profile) {
            throw new Error("Student profile was not found.");
        }

        if (profile.role !== "student") {
            window.location.replace("/login.html");
            return;
        }

        if (profile.status && profile.status.toLowerCase() !== "active") {
            await supabase.auth.signOut();
            showMessage("Your account is inactive.");
            setTimeout(() => {
                window.location.replace("/login.html");
            }, 1500);
            return;
        }

        if (!profile.student_id) {
            throw new Error("This student account is not linked to a student record.");
        }

        const { data: student, error: studentError } = await supabase
            .from("students")
            .select(`
                id,
                student_id,
                first_name,
                last_name,
                gender,
                date_of_birth,
                class,
                section,
                phone,
                email,
                address,
                photo_url,
                status
            `)
            .eq("id", profile.student_id)
            .single();

        if (studentError) {
            throw studentError;
        }

        if (!student) {
            throw new Error("Student record was not found.");
        }

        const fullName = `${student.first_name || profile.first_name || ""} ${student.last_name || profile.last_name || ""}`.trim();

        setText(studentHeaderName, fullName || "Student");
        setText(welcomeName, student.first_name || profile.first_name || "Student");
        setText(profileName, fullName || "Student");

        setText(studentIdElement, student.student_id);
        setText(studentClass, student.class);
        setText(studentSection, student.section);
        setText(studentStatus, capitalize(student.status));

        setText(profileStudentId, student.student_id);
        setText(profileStudentIdDetails, student.student_id);
        setText(profileStatus, capitalize(student.status));

        setText(firstName, student.first_name);
        setText(lastName, student.last_name);
        setText(gender, capitalize(student.gender));
        setText(dateOfBirth, formatDate(student.date_of_birth));
        setText(email, student.email || profile.email);
        setText(phone, student.phone || profile.phone);
        setText(className, student.class);
        setText(section, student.section);
        setText(address, student.address);
        setText(accountStatus, capitalize(student.status));

        const photoUrl = student.photo_url || profile.photo_url || "";
        setAvatar(studentAvatar, fullName, photoUrl);
        setAvatar(profileAvatar, fullName, photoUrl);

        if (studentMessage) {
            studentMessage.hidden = true;
        }
    } catch (error) {
        console.error("Student dashboard error:", error);
        showMessage(error.message || "Unable to load student information.");
    }
}

async function logout() {
    logoutButton.disabled = true;

    try {
        const { error } = await supabase.auth.signOut();

        if (error) {
            throw error;
        }

        window.location.replace("/login.html");
    } catch (error) {
        console.error("Logout error:", error);
        logoutButton.disabled = false;
        showMessage("Unable to logout. Please try again.");
    }
}

if (logoutButton) {
    logoutButton.addEventListener("click", logout);
}

if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
        document.body.classList.toggle("sidebar-collapsed");
    });
}

window.addEventListener("pageshow", async event => {
    if (event.persisted) {
        const {
            data: { session }
        } = await supabase.auth.getSession();

        if (!session) {
            window.location.replace("/login.html");
        }
    }
});

loadStudentDashboard();