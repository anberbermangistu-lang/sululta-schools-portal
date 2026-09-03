import { supabase } from "./supabase.js";

let teacher = null;

async function getTeacher() {

    const {
        data: {
            user
        },
        error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
        window.location.href = "/login.html";
        return null;
    }

    const {
        data: profile,
        error: profileError
    } = await supabase
        .from("profiles")
        .select(`
            id,
            role,
            status
        `)
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {

        console.error(
            "Profile error:",
            profileError
        );

        showMessage(
            profileError.message
        );

        return null;
    }

    if (!profile) {

        await supabase.auth.signOut();

        window.location.href =
            "/login.html";

        return null;
    }

    const role =
        String(profile.role || "")
            .trim()
            .toLowerCase();

    const status =
        String(profile.status || "")
            .trim()
            .toLowerCase();

    if (
        role !== "teacher" ||
        status !== "active"
    ) {

        await supabase.auth.signOut();

        window.location.href =
            "/login.html";

        return null;
    }

    const {
        data: teacherRecord,
        error: teacherError
    } = await supabase
        .from("teachers")
        .select(`
            id,
            teacher_id,
            first_name,
            last_name,
            photo_url,
            user_id,
            status
        `)
        .eq(
            "user_id",
            user.id
        )
        .maybeSingle();

    if (teacherError) {

        console.error(
            "Teacher error:",
            teacherError
        );

        showMessage(
            teacherError.message
        );

        return null;
    }

    if (!teacherRecord) {

        showMessage(
            "Your teacher record is not connected to your account."
        );

        return null;
    }

    return {
        ...teacherRecord,
        email: user.email || ""
    };
}

function setupHeader() {

    const fullName =
        `${teacher.first_name || ""} ${teacher.last_name || ""}`
            .trim() ||
        "Teacher";

    const nameElement =
        document.getElementById(
            "teacherHeaderName"
        );

    const avatarElement =
        document.getElementById(
            "teacherAvatar"
        );

    if (nameElement) {

        nameElement.textContent =
            fullName;
    }

    if (!avatarElement) {
        return;
    }

    if (teacher.photo_url) {

        avatarElement.innerHTML = "";

        const image =
            document.createElement(
                "img"
            );

        image.src =
            teacher.photo_url;

        image.alt =
            fullName;

        image.loading =
            "lazy";

        avatarElement.appendChild(
            image
        );

    } else {

        avatarElement.textContent =
            fullName
                .charAt(0)
                .toUpperCase();
    }
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

    if (
        toggle &&
        sidebar
    ) {

        toggle.addEventListener(
            "click",
            () => {

                sidebar.classList.toggle(
                    "mobile-open"
                );

            }
        );
    }
}

function setupLogout() {

    const button =
        document.getElementById(
            "logoutButton"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        async () => {

            button.disabled = true;

            const {
                error
            } =
                await supabase.auth.signOut();

            if (error) {

                console.error(
                    "Logout error:",
                    error
                );

                showMessage(
                    error.message
                );

                button.disabled = false;

                return;
            }

            window.location.href =
                "/login.html";
        }
    );
}

function setupPasswordForm() {

    const form =
        document.getElementById(
            "passwordForm"
        );

    const newPasswordInput =
        document.getElementById(
            "newPassword"
        );

    const confirmPasswordInput =
        document.getElementById(
            "confirmPassword"
        );

    const changeButton =
        document.getElementById(
            "changePasswordButton"
        );

    if (
        !form ||
        !newPasswordInput ||
        !confirmPasswordInput
    ) {
        return;
    }

    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const newPassword =
                newPasswordInput.value;

            const confirmPassword =
                confirmPasswordInput.value;

            clearMessage();

            if (newPassword.length < 6) {

                showMessage(
                    "Password must be at least 6 characters long."
                );

                newPasswordInput.focus();

                return;
            }

            if (
                newPassword !==
                confirmPassword
            ) {

                showMessage(
                    "New password and confirmation password do not match."
                );

                confirmPasswordInput.focus();

                return;
            }

            if (changeButton) {

                changeButton.disabled =
                    true;

                changeButton.textContent =
                    "Changing...";
            }

            try {

                const {
                    error
                } =
                    await supabase.auth.updateUser({
                        password:
                            newPassword
                    });

                if (error) {
                    throw error;
                }

                showMessage(
                    "Password changed successfully.",
                    "success"
                );

                form.reset();

            } catch (error) {

                console.error(
                    "Password update error:",
                    error
                );

                showMessage(
                    error.message ||
                    "Unable to change password."
                );

            } finally {

                if (changeButton) {

                    changeButton.disabled =
                        false;

                    changeButton.textContent =
                        "🔐 Change Password";
                }
            }
        }
    );
}

function showMessage(
    message,
    type = "error"
) {

    const element =
        document.getElementById(
            "passwordMessage"
        );

    if (!element) {
        return;
    }

    element.textContent =
        message;

    element.hidden =
        false;

    element.className =
        `message ${type}`;
}

function clearMessage() {

    const element =
        document.getElementById(
            "passwordMessage"
        );

    if (!element) {
        return;
    }

    element.textContent =
        "";

    element.hidden =
        true;
}

async function initialize() {

    teacher =
        await getTeacher();

    if (!teacher) {
        return;
    }

    setupHeader();

    setupSidebar();

    setupLogout();

    setupPasswordForm();
}

initialize();