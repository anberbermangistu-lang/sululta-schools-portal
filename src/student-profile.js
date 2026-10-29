import { supabase } from "./supabase.js";

const studentHeaderName = document.getElementById("studentHeaderName");
const studentAvatar = document.getElementById("studentAvatar");
const profileAvatar = document.getElementById("profileAvatar");
const profileStudentName = document.getElementById("profileStudentName");
const profileStudentId = document.getElementById("profileStudentId");

const firstName = document.getElementById("firstName");
const lastName = document.getElementById("lastName");
const studentId = document.getElementById("studentId");
const gender = document.getElementById("gender");
const dateOfBirth = document.getElementById("dateOfBirth");
const studentClass = document.getElementById("studentClass");
const section = document.getElementById("section");
const phone = document.getElementById("phone");
const email = document.getElementById("email");
const address = document.getElementById("address");
const status = document.getElementById("status");

const profileMessage = document.getElementById("profileMessage");
const refreshProfile = document.getElementById("refreshProfile");
const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");

let currentStudent = null;

document.addEventListener("DOMContentLoaded", initialize);

refreshProfile?.addEventListener("click", loadProfile);

sidebarToggle?.addEventListener("click", () => {
    document
        .querySelector(".admin-page")
        ?.classList.toggle("sidebar-collapsed");
});

logoutButton?.addEventListener("click", logout);

async function initialize() {
    await loadProfile();
}

async function loadProfile() {
    showLoading();

    try {
        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser();

        if (authError || !user) {
            window.location.href = "/login.html";
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
                username,
                role,
                photo_url,
                status
            `)
            .eq("id", user.id)
            .maybeSingle();

        if (profileError) {
            console.error("Profile error:", profileError);
            showMessage(
                "Unable to load your account profile.",
                "error"
            );
            return;
        }

        if (!profile) {
            showMessage(
                "Your account profile could not be found.",
                "error"
            );
            return;
        }

        const role = String(profile.role || "")
            .trim()
            .toLowerCase();

        if (role !== "student") {
            showMessage(
                "This page is only available for student accounts.",
                "error"
            );
            return;
        }

        const emailAddress = String(
            profile.email || user.email || ""
        )
            .trim()
            .toLowerCase();

        if (!emailAddress) {
            showMessage(
                "Your account does not have an email address.",
                "error"
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
                photo_url,
                status
            `)
            .ilike("email", emailAddress)
            .maybeSingle();

        if (studentError) {
            console.error(
                "Student lookup error:",
                studentError
            );

            showMessage(
                "Unable to load your student information.",
                "error"
            );

            return;
        }

        if (!student) {
            showMessage(
                "No student record is linked to this account.",
                "error"
            );

            return;
        }

        currentStudent = student;

        updateProfile(student);

        hideMessage();

    } catch (error) {
        console.error(
            "Profile loading error:",
            error
        );

        showMessage(
            "Unable to load your profile.",
            "error"
        );

    } finally {
        if (refreshProfile) {
            refreshProfile.disabled = false;
            refreshProfile.textContent = "↻ Refresh";
        }
    }
}

function updateProfile(student) {
    const fullName = `${student.first_name || ""} ${student.last_name || ""}`
        .trim() || "Student";

    const studentNumber =
        student.student_id || "-";

    const studentStatus =
        String(student.status || "")
            .trim();

    if (studentHeaderName) {
        studentHeaderName.textContent = fullName;
    }

    if (profileStudentName) {
        profileStudentName.textContent = fullName;
    }

    if (profileStudentId) {
        profileStudentId.textContent = studentNumber;
    }

    if (firstName) {
        firstName.textContent =
            student.first_name || "-";
    }

    if (lastName) {
        lastName.textContent =
            student.last_name || "-";
    }

    if (studentId) {
        studentId.textContent =
            studentNumber;
    }

    if (gender) {
        gender.textContent =
            formatText(student.gender);
    }

    if (dateOfBirth) {
        dateOfBirth.textContent =
            formatDate(student.date_of_birth);
    }

    if (studentClass) {
        studentClass.textContent =
            student.class || "-";
    }

    if (section) {
        section.textContent =
            student.section || "-";
    }

    if (phone) {
        phone.textContent =
            student.phone || "-";
    }

    if (email) {
        email.textContent =
            student.email || "-";
    }

    if (address) {
        address.textContent =
            student.address || "-";
    }

    if (status) {
        status.textContent =
            studentStatus
                ? formatStatus(studentStatus)
                : "-";
    }

    updateAvatar(
        studentAvatar,
        fullName,
        student.photo_url || student.photo
    );

    updateAvatar(
        profileAvatar,
        fullName,
        student.photo_url || student.photo
    );
}

function updateAvatar(element, fullName, photo) {
    if (!element) {
        return;
    }

    const photoUrl = getPhotoUrl(photo);

    if (!photoUrl) {
        element.textContent =
            getInitials(
                currentStudent?.first_name,
                currentStudent?.last_name
            );

        return;
    }

    element.innerHTML = "";

    const image = document.createElement("img");

    image.src = photoUrl;
    image.alt = fullName;

    image.onerror = () => {
        element.textContent =
            getInitials(
                currentStudent?.first_name,
                currentStudent?.last_name
            );
    };

    element.appendChild(image);
}

function formatStatus(value) {
    const text = String(value || "")
        .trim()
        .toLowerCase();

    if (!text) {
        return "-";
    }

    return text.charAt(0).toUpperCase() +
        text.slice(1);
}

function formatText(value) {
    const text = String(value || "")
        .trim();

    if (!text) {
        return "-";
    }

    return text.charAt(0).toUpperCase() +
        text.slice(1);
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
        value.startsWith("https://") ||
        value.startsWith("data:")
    ) {
        return value;
    }

    const path = value.replace(/^\/+/, "");

    const { data } =
        supabase.storage
            .from("students")
            .getPublicUrl(path);

    return data?.publicUrl || null;
}

function getInitials(first, last) {
    const firstName =
        String(first || "").trim();

    const lastName =
        String(last || "").trim();

    if (firstName && lastName) {
        return (
            firstName[0] +
            lastName[0]
        ).toUpperCase();
    }

    if (firstName) {
        return firstName[0].toUpperCase();
    }

    if (lastName) {
        return lastName[0].toUpperCase();
    }

    return "S";
}

function showLoading() {
    if (firstName) firstName.textContent = "Loading...";
    if (lastName) lastName.textContent = "Loading...";
    if (studentId) studentId.textContent = "Loading...";
    if (gender) gender.textContent = "Loading...";
    if (dateOfBirth) dateOfBirth.textContent = "Loading...";
    if (studentClass) studentClass.textContent = "Loading...";
    if (section) section.textContent = "Loading...";
    if (phone) phone.textContent = "Loading...";
    if (email) email.textContent = "Loading...";
    if (address) address.textContent = "Loading...";
    if (status) status.textContent = "Loading...";

    if (profileStudentName) {
        profileStudentName.textContent = "Loading...";
    }

    if (profileStudentId) {
        profileStudentId.textContent = "Student ID";
    }
}

function showMessage(message, type = "error") {
    if (!profileMessage) {
        return;
    }

    profileMessage.textContent = message;
    profileMessage.className = `message ${type}`;
    profileMessage.hidden = false;
}

function hideMessage() {
    if (!profileMessage) {
        return;
    }

    profileMessage.textContent = "";
    profileMessage.hidden = true;
}

async function logout() {
    try {
        if (logoutButton) {
            logoutButton.disabled = true;
        }

        const { error } =
            await supabase.auth.signOut();

        if (error) {
            throw error;
        }

        window.location.href =
            "/login.html";

    } catch (error) {
        console.error(
            "Logout error:",
            error
        );

        showMessage(
            "Unable to logout. Please try again.",
            "error"
        );

        if (logoutButton) {
            logoutButton.disabled = false;
        }
    }
}
