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
        console.error("Profile error:", profileError);
        showMessage(profileError.message);
        return null;
    }

    if (!profile) {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
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
        window.location.href = "/login.html";
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
            gender,
            phone,
            email,
            address,
            qualification,
            photo_url,
            user_id,
            status,
            created_at,
            updated_at
        `)
        .eq("user_id", user.id)
        .maybeSingle();

    if (teacherError) {
        console.error("Teacher error:", teacherError);
        showMessage(teacherError.message);
        return null;
    }

    if (!teacherRecord) {
        showMessage(
            "Your teacher record is not connected to your account."
        );
        return null;
    }

    return teacherRecord;
}

function setText(id, value, fallback = "Not provided") {

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    const text =
        value === null ||
        value === undefined ||
        String(value).trim() === ""
            ? fallback
            : String(value);

    element.textContent = text;
}

function getFullName() {

    const firstName =
        String(teacher?.first_name || "").trim();

    const lastName =
        String(teacher?.last_name || "").trim();

    return `${firstName} ${lastName}`.trim() || "Teacher";
}

function formatDate(value) {

    if (!value) {
        return "Not provided";
    }

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return String(value);
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

function setupHeader() {

    const fullName =
        getFullName();

    setText(
        "teacherHeaderName",
        fullName,
        "Teacher"
    );

    const avatar =
        document.getElementById(
            "teacherAvatar"
        );

    if (!avatar) {
        return;
    }

    avatar.innerHTML = "";

    if (teacher.photo_url) {

        const image =
            document.createElement("img");

        image.src =
            teacher.photo_url;

        image.alt =
            fullName;

        image.onerror = () => {

            avatar.textContent =
                fullName
                    .charAt(0)
                    .toUpperCase();

        };

        avatar.appendChild(image);

    } else {

        avatar.textContent =
            fullName
                .charAt(0)
                .toUpperCase();

    }
}

function loadProfile() {

    const fullName =
        getFullName();

    setText(
        "profileTeacherName",
        fullName,
        "Teacher"
    );

    setText(
        "profileTeacherId",
        teacher.teacher_id,
        "Teacher ID"
    );

    setText(
        "firstName",
        teacher.first_name
    );

    setText(
        "lastName",
        teacher.last_name
    );

    setText(
        "teacherId",
        teacher.teacher_id
    );

    setText(
        "gender",
        teacher.gender
            ? String(teacher.gender)
                .charAt(0)
                .toUpperCase() +
              String(teacher.gender)
                .slice(1)
                .toLowerCase()
            : null
    );

    setText(
        "phone",
        teacher.phone
    );

    setText(
        "email",
        teacher.email
    );

    setText(
        "qualification",
        teacher.qualification
    );

    setText(
        "address",
        teacher.address
    );

    setText(
        "status",
        teacher.status
            ? String(teacher.status)
                .charAt(0)
                .toUpperCase() +
              String(teacher.status)
                .slice(1)
                .toLowerCase()
            : null
    );

    setText(
        "createdAt",
        formatDate(
            teacher.created_at
        )
    );

    const profileAvatar =
        document.getElementById(
            "profileAvatar"
        );

    if (!profileAvatar) {
        return;
    }

    profileAvatar.innerHTML = "";

    if (teacher.photo_url) {

        const image =
            document.createElement("img");

        image.src =
            teacher.photo_url;

        image.alt =
            fullName;

        image.onerror = () => {

            profileAvatar.textContent =
                fullName
                    .charAt(0)
                    .toUpperCase();

        };

        profileAvatar.appendChild(
            image
        );

    } else {

        profileAvatar.textContent =
            fullName
                .charAt(0)
                .toUpperCase();

    }
}

function showMessage(
    message,
    type = "error"
) {

    const element =
        document.getElementById(
            "profileMessage"
        );

    if (!element) {
        return;
    }

    element.textContent =
        message;

    element.className =
        `message ${type}`;

    element.hidden = false;
}

function clearMessage() {

    const element =
        document.getElementById(
            "profileMessage"
        );

    if (!element) {
        return;
    }

    element.textContent = "";
    element.hidden = true;
}

function setupRefresh() {

    const button =
        document.getElementById(
            "refreshProfile"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        async () => {

            button.disabled = true;

            button.textContent =
                "↻ Loading...";

            clearMessage();

            const freshTeacher =
                await getTeacher();

            if (freshTeacher) {

                teacher =
                    freshTeacher;

                setupHeader();
                loadProfile();

                showMessage(
                    "Profile refreshed successfully.",
                    "success"
                );
            }

            button.disabled = false;

            button.textContent =
                "↻ Refresh";
        }
    );
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

async function initialize() {

    teacher =
        await getTeacher();

    if (!teacher) {
        return;
    }

    setupHeader();

    loadProfile();

    setupRefresh();

    setupLogout();

    setupSidebar();
}

initialize();