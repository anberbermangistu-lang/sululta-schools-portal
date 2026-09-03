import { supabase } from "./supabase.js";

document.addEventListener("DOMContentLoaded", () => {

    setupSidebar();
    setupLogout();
    loadDashboard();

});


async function loadDashboard() {

    showMessage("", "");

    try {

        const {
            data: {
                user
            },
            error: authError
        } = await supabase.auth.getUser();

        if (authError) {
            throw authError;
        }

        if (!user) {

            window.location.href =
                "/login.html";

            return;

        }

        const {
            data: parent,
            error: parentError
        } = await supabase
            .from("parents")
            .select(`
                id,
                parent_id,
                first_name,
                last_name,
                gender,
                relationship,
                phone,
                email,
                address,
                occupation,
                user_id,
                student_id,
                status,
                photo_url
            `)
            .eq("user_id", user.id)
            .maybeSingle();

        if (parentError) {
            throw parentError;
        }

        if (!parent) {

            showMessage(
                "Parent account information could not be found.",
                "error"
            );

            return;

        }

        displayParent(parent);

        if (parent.student_id) {

            await loadChild(
                parent.student_id
            );

        } else {

            displayNoChild();

        }

    } catch (error) {

        console.error(
            "Dashboard loading error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to load your dashboard.",
            "error"
        );

    }

}


async function loadChild(studentId) {

    const {
        data: student,
        error
    } = await supabase
        .from("students")
        .select(`
            id,
            student_id,
            first_name,
            last_name,
            gender,
            date_of_birth,
            email,
            phone,
            class,
            section,
            status,
            address,
            photo_url
        `)
        .eq("id", studentId)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!student) {

        displayNoChild();

        return;

    }

    displayChild(student);

}
function displayParent(parent) {

    const fullName =
        `${parent.first_name || ""} ${parent.last_name || ""}`
            .trim() ||
        "Parent";

    const firstName =
        parent.first_name ||
        "Parent";

    setText(
        "parentHeaderName",
        fullName
    );

    setText(
        "parentWelcome",
        `Hello, ${firstName}`
    );

    setText(
        "parentName",
        fullName
    );

    setText(
        "parentEmail",
        parent.email ||
        "Not provided"
    );

    setText(
        "parentPhone",
        parent.phone ||
        "Not provided"
    );

    setText(
        "parentStatus",
        formatText(
            parent.status ||
            "active"
        )
    );

    const avatar =
        document.getElementById(
            "parentAvatar"
        );

    if (avatar) {

        if (parent.photo_url) {

            avatar.innerHTML = `
                <img
                    src="${escapeAttribute(parent.photo_url)}"
                    alt="${escapeAttribute(fullName)}"
                >
            `;

        } else {

            avatar.textContent =
                fullName
                    .charAt(0)
                    .toUpperCase();

        }

    }

}


function displayChild(student) {

    const fullName =
        `${student.first_name || ""} ${student.last_name || ""}`
            .trim() ||
        "Student";

    setText(
        "childName",
        fullName
    );

    setText(
        "childStudentId",
        student.student_id ||
        "-"
    );

    setText(
        "childClass",
        student.class ||
        "-"
    );

    setText(
        "childStatus",
        formatText(
            student.status ||
            "-"
        )
    );

}


function displayNoChild() {

    setText(
        "childName",
        "No child assigned"
    );

    setText(
        "childStudentId",
        "-"
    );

    setText(
        "childClass",
        "-"
    );

    setText(
        "childStatus",
        "-"
    );

}


function setupLogout() {

    const button =
        document.getElementById(
            "logoutButton"
        );

    button?.addEventListener(
        "click",
        async () => {

            button.disabled =
                true;

            const {
                error
            } = await supabase
                .auth
                .signOut();

            if (error) {

                console.error(
                    "Logout error:",
                    error
                );

                button.disabled =
                    false;

                showMessage(
                    error.message ||
                    "Unable to sign out.",
                    "error"
                );

                return;

            }

            window.location.href =
                "/login.html";

        }
    );

}


function setupSidebar() {

    const toggle =
        document.getElementById(
            "sidebarToggle"
        );

    const sidebar =
        document.querySelector(
            ".admin-sidebar"
        );

    toggle?.addEventListener(
        "click",
        () => {

            sidebar?.classList.toggle(
                "open"
            );

        }
    );

}


function showMessage(
    message,
    type
) {

    const box =
        document.getElementById(
            "parentMessage"
        );

    if (!box) {
        return;
    }

    if (!message) {

        box.textContent =
            "";

        box.hidden =
            true;

        box.className =
            "message";

        return;

    }

    box.textContent =
        message;

    box.className =
        `message ${type}`;

    box.hidden =
        false;

}


function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {

        element.textContent =
            value ?? "-";

    }

}


function formatText(value) {

    if (!value) {
        return "—";
    }

    return String(value)
        .replace(/_/g, " ")
        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );

}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function escapeAttribute(value) {

    return escapeHtml(value);

}