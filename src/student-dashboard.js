import { supabase } from "./supabase.js";

const studentAvatar = document.getElementById("studentAvatar");
const profileAvatar = document.getElementById("profileAvatar");

const studentHeaderName = document.getElementById("studentHeaderName");
const welcomeName = document.getElementById("welcomeName");

const studentIdElement = document.getElementById("studentId");
const studentClass = document.getElementById("studentClass");
const studentSection = document.getElementById("studentSection");
const studentStatusElement = document.getElementById("studentStatus");

const profileName = document.getElementById("profileName");
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

const studentMessage = document.getElementById("studentMessage");
const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");

let currentStudent = null;

document.addEventListener("DOMContentLoaded", initialize);

window.addEventListener("pageshow", async () => {
    await checkAuthentication();
});

sidebarToggle?.addEventListener("click", () => {
    document
        .querySelector(".admin-page")
        ?.classList.toggle("sidebar-collapsed");
});

logoutButton?.addEventListener("click", logout);

async function checkAuthentication() {
    try {
        const {
            data: { user },
            error
        } = await supabase.auth.getUser();

        if (error || !user) {
            window.location.replace("/login.html");
            return;
        }
    } catch (error) {
        console.error("Authentication check error:", error);
        window.location.replace("/login.html");
    }
}

async function initialize() {
    await loadStudent();
}

async function loadStudent() {
    hideMessage();

    try {
        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser();

        if (authError) {
            console.error("Auth error:", authError);
            window.location.replace("/login.html");
            return;
        }

        if (!user) {
            window.location.replace("/login.html");
            return;
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
                role,
                status
            `)
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            console.error("Profile error:", profileError);
            showMessage("Unable to load your account information.");
            return;
        }

        if (!profile) {
            showMessage("Your account profile could not be found.");
            return;
        }

        const role = String(profile.role || "")
            .trim()
            .toLowerCase();

        if (role !== "student") {
            showMessage("This page is only available for student accounts.");
            return;
        }

        const emailAddress = String(
            profile.email || user.email || ""
        )
            .trim()
            .toLowerCase();

        if (!emailAddress) {
            showMessage(
                "Your student account does not have an email address."
            );
            return;
        }

        const {
            data: student,
            error: studentError
        } = await supabase
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
                photo,
                photo_url,
                status
            `)
            .ilike("email", emailAddress)
            .maybeSingle();

        if (studentError) {
            console.error("Student error:", studentError);
            showMessage("Unable to load your student information.");
            return;
        }

        if (!student) {
            showMessage("No student record is linked to this account.");
            return;
        }

        currentStudent = student;

        updateDashboard(student);
    } catch (error) {
        console.error("Dashboard error:", error);
        showMessage("Unable to load your dashboard.");
    }
}

function updateDashboard(student) {
    const first = String(student.first_name || "").trim();
    const last = String(student.last_name || "").trim();

    const fullName = `${first} ${last}`.trim() || "Student";
    const firstNameOnly = first || "Student";
    const studentNumber = student.student_id || "-";
    const formattedStatus = formatStatus(student.status);

    if (studentHeaderName) {
        studentHeaderName.textContent = fullName;
    }

    if (welcomeName) {
        welcomeName.textContent = firstNameOnly;
    }

    if (studentIdElement) {
        studentIdElement.textContent = studentNumber;
    }

    if (studentClass) {
        studentClass.textContent = student.class || "-";
    }

    if (studentSection) {
        studentSection.textContent = student.section || "-";
    }

    if (studentStatusElement) {
        studentStatusElement.textContent = formattedStatus;
    }

    if (profileName) {
        profileName.textContent = fullName;
    }

    if (profileStudentId) {
        profileStudentId.textContent = studentNumber;
    }

    if (profileStudentIdDetails) {
        profileStudentIdDetails.textContent = studentNumber;
    }

    if (profileStatus) {
        profileStatus.textContent = formattedStatus;
    }

    if (firstName) {
        firstName.textContent = first || "-";
    }

    if (lastName) {
        lastName.textContent = last || "-";
    }

    if (gender) {
        gender.textContent = formatText(student.gender);
    }

    if (dateOfBirth) {
        dateOfBirth.textContent = formatDate(student.date_of_birth);
    }

    if (email) {
        email.textContent = student.email || "-";
    }

    if (phone) {
        phone.textContent = student.phone || "-";
    }

    if (className) {
        className.textContent = student.class || "-";
    }

    if (section) {
        section.textContent = student.section || "-";
    }

    if (address) {
        address.textContent = student.address || "-";
    }

    if (accountStatus) {
        accountStatus.textContent = formattedStatus;
    }

    const photo =
        student.photo_url ||
        student.photo ||
        null;

    updateAvatar(
        studentAvatar,
        fullName,
        photo
    );

    updateAvatar(
        profileAvatar,
        fullName,
        photo
    );
}

function updateAvatar(element, fullName, photo) {
    if (!element) {
        return;
    }

    const photoUrl = getPhotoUrl(photo);

    if (!photoUrl) {
        showInitials(
            element,
            currentStudent?.first_name,
            currentStudent?.last_name
        );
        return;
    }

    element.innerHTML = "";

    const image = document.createElement("img");

    image.src = photoUrl;
    image.alt = fullName;
    image.loading = "lazy";
    image.decoding = "async";

    image.onerror = () => {
        showInitials(
            element,
            currentStudent?.first_name,
            currentStudent?.last_name
        );
    };

    element.appendChild(image);
}

function getPhotoUrl(photo) {
    if (!photo) {
        return null;
    }

    const value = String(photo).trim();

    if (!value) {
        return null;
    }

    if (
        value.startsWith("http://") ||
        value.startsWith("https://")
    ) {
        return value;
    }

    const path = value.replace(/^\/+/, "");

    const { data } = supabase.storage
        .from("students")
        .getPublicUrl(path);

    return data?.publicUrl || null;
}

function showInitials(element, first, last) {
    element.innerHTML = "";
    element.textContent = getInitials(first, last);
}

function getInitials(first, last) {
    const firstValue = String(first || "").trim();
    const lastValue = String(last || "").trim();

    if (firstValue && lastValue) {
        return (
            firstValue[0] +
            lastValue[0]
        ).toUpperCase();
    }

    if (firstValue) {
        return firstValue[0].toUpperCase();
    }

    if (lastValue) {
        return lastValue[0].toUpperCase();
    }

    return "S";
}

function formatText(value) {
    const text = String(value || "").trim();

    if (!text) {
        return "-";
    }

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );
}

function formatStatus(value) {
    const text = String(value || "").trim();

    if (!text) {
        return "-";
    }

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}

function showMessage(message) {
    if (!studentMessage) {
        return;
    }

    studentMessage.textContent = message;
    studentMessage.className = "message error";
    studentMessage.hidden = false;
}

function hideMessage() {
    if (!studentMessage) {
        return;
    }

    studentMessage.textContent = "";
    studentMessage.hidden = true;
}

async function logout() {
    try {
        if (logoutButton) {
            logoutButton.disabled = true;
        }

        const { error } = await supabase.auth.signOut();

        if (error) {
            throw error;
        }

        window.location.replace("/login.html");

    } catch (error) {
        console.error("Logout error:", error);

        showMessage(
            "Unable to logout. Please try again."
        );

        if (logoutButton) {
            logoutButton.disabled = false;
        }
    }
}