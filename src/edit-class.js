import { supabase } from "./supabase.js";

const form =
    document.getElementById("editClassForm");

const message =
    document.getElementById("message");

const saveButton =
    document.getElementById("saveButton");

const classNameInput =
    document.getElementById("class_name");

const sectionInput =
    document.getElementById("section");

const roomNumberInput =
    document.getElementById("room_number");

const academicYearInput =
    document.getElementById("academic_year");

const classTeacherSelect =
    document.getElementById("class_teacher");

const statusSelect =
    document.getElementById("status");

const params =
    new URLSearchParams(window.location.search);

const classId =
    params.get("id");

document.addEventListener(
    "DOMContentLoaded",
    initialize
);

async function initialize() {

    setupSidebar();

    if (!classId) {

        showMessage(
            "Class ID is missing.",
            "error"
        );

        disableForm();

        return;
    }

    const allowed =
        await checkAdmin();

    if (!allowed) {
        return;
    }

    await loadTeachers();

    await loadClass();

    form?.addEventListener(
        "submit",
        handleSubmit
    );
}

async function checkAdmin() {

    const {
        data: { user },
        error
    } = await supabase.auth.getUser();

    if (error || !user) {

        window.location.href =
            "/login.html";

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
            status,
            photo_url
        `)
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile) {

        await supabase.auth.signOut();

        window.location.href =
            "/login.html";

        return false;
    }

    const role =
        String(profile.role || "")
            .trim()
            .toLowerCase();

    const status =
        String(profile.status || "")
            .trim()
            .toLowerCase();

    if (role !== "admin") {

        if (role === "teacher") {

            window.location.href =
                "/teachers/dashboard.html";

        } else if (role === "parent") {

            window.location.href =
                "/parent/dashboard.html";

        } else if (role === "student") {

            window.location.href =
                "/students/dashboard.html";

        } else {

            window.location.href =
                "/login.html";
        }

        return false;
    }

    if (status !== "active") {

        await supabase.auth.signOut();

        window.location.href =
            "/login.html";

        return false;
    }

    updateAdminProfile(profile);

    return true;
}

async function loadTeachers() {

    classTeacherSelect.innerHTML = `
        <option value="">
            Select Teacher
        </option>
    `;

    const {
        data,
        error
    } = await supabase
        .from("teachers")
        .select(`
            id,
            teacher_id,
            first_name,
            last_name,
            status
        `)
        .order(
            "first_name",
            {
                ascending: true
            }
        );

    if (error) {

        console.error(
            "Teacher error:",
            error
        );

        showMessage(
            error.message ||
            "Failed to load teachers.",
            "error"
        );

        return;
    }

    const teachers =
        (data || [])
            .filter(
                teacher =>
                    String(
                        teacher.status || ""
                    )
                        .trim()
                        .toLowerCase() ===
                    "active"
            );

    teachers.forEach(
        teacher => {

            const option =
                document.createElement(
                    "option"
                );

            const fullName =
                `${teacher.first_name || ""} ${teacher.last_name || ""}`
                    .trim() ||
                "Teacher";

            option.value =
                teacher.id;

            option.textContent =
                teacher.teacher_id
                    ? `${fullName} (${teacher.teacher_id})`
                    : fullName;

            classTeacherSelect.appendChild(
                option
            );
        }
    );
}

async function loadClass() {

    const {
        data,
        error
    } = await supabase
        .from("classes")
        .select(`
            id,
            class_name,
            section,
            room_number,
            class_teacher,
            academic_year,
            status
        `)
        .eq(
            "id",
            classId
        )
        .maybeSingle();

    if (error) {

        console.error(
            "Class error:",
            error
        );

        showMessage(
            error.message ||
            "Failed to load class.",
            "error"
        );

        disableForm();

        return;
    }

    if (!data) {

        showMessage(
            "Class was not found.",
            "error"
        );

        disableForm();

        return;
    }

    classNameInput.value =
        data.class_name || "";

    sectionInput.value =
        data.section || "";

    roomNumberInput.value =
        data.room_number || "";

    academicYearInput.value =
        data.academic_year || "";

    classTeacherSelect.value =
        data.class_teacher
            ? String(data.class_teacher)
            : "";

    statusSelect.value =
        String(
            data.status || "active"
        )
            .trim()
            .toLowerCase();

    hideMessage();
}

async function handleSubmit(
    event
) {

    event.preventDefault();

    clearFieldErrors();

    const className =
        classNameInput.value
            .trim();

    const section =
        sectionInput.value
            .trim();

    const roomNumber =
        roomNumberInput.value
            .trim();

    const academicYear =
        academicYearInput.value
            .trim();

    const classTeacher =
        classTeacherSelect.value
            ? Number(
                classTeacherSelect.value
            )
            : null;

    const status =
        statusSelect.value
            .trim()
            .toLowerCase();

    if (!className) {

        showMessage(
            "Class name is required.",
            "error"
        );

        classNameInput.focus();

        return;
    }

    if (!section) {

        showMessage(
            "Section is required.",
            "error"
        );

        sectionInput.focus();

        return;
    }

    if (!status) {

        showMessage(
            "Status is required.",
            "error"
        );

        statusSelect.focus();

        return;
    }

    saveButton.disabled =
        true;

    saveButton.textContent =
        "Saving...";

    hideMessage();

    const {
        error
    } = await supabase
        .from("classes")
        .update({
            class_name:
                className,

            section:
                section,

            room_number:
                roomNumber || null,

            academic_year:
                academicYear || null,

            class_teacher:
                classTeacher,

            status:
                status,

            updated_at:
                new Date().toISOString()
        })
        .eq(
            "id",
            classId
        );

    if (error) {

        console.error(
            "Update class error:",
            error
        );

        showMessage(
            error.message ||
            "Failed to update class.",
            "error"
        );

        saveButton.disabled =
            false;

        saveButton.textContent =
            "Save Changes";

        return;
    }

    showMessage(
        "Class updated successfully.",
        "success"
    );

    saveButton.textContent =
        "Saved";

    setTimeout(
        () => {

            window.location.href =
                `/classes/view.html?id=${encodeURIComponent(classId)}`;

        },
        700
    );
}

function updateAdminProfile(
    profile
) {

    const fullName =
        `${profile.first_name || ""} ${profile.last_name || ""}`
            .trim() ||
        profile.username ||
        "Administrator";

    const nameElement =
        document.getElementById(
            "adminHeaderName"
        );

    if (nameElement) {
        nameElement.textContent =
            fullName;
    }

    const avatar =
        document.getElementById(
            "adminAvatar"
        );

    if (!avatar) {
        return;
    }

    if (profile.photo_url) {

        avatar.innerHTML = "";

        const image =
            document.createElement(
                "img"
            );

        image.src =
            profile.photo_url;

        image.alt =
            fullName;

        image.className =
            "admin-profile-image";

        avatar.appendChild(
            image
        );

    } else {

        avatar.textContent =
            fullName
                .charAt(0)
                .toUpperCase();
    }
}

function setupSidebar() {

    const toggle =
        document.querySelector(
            ".sidebar-toggle"
        );

    const sidebar =
        document.querySelector(
            ".admin-sidebar"
        );

    toggle?.addEventListener(
        "click",
        () => {

            sidebar?.classList.toggle(
                "mobile-open"
            );

            sidebar?.classList.toggle(
                "open"
            );
        }
    );
}

function showMessage(
    text,
    type = "info"
) {

    if (!message) {
        return;
    }

    message.textContent =
        text;

    message.className =
        `message ${type}`;

    message.hidden =
        false;
}

function hideMessage() {

    if (!message) {
        return;
    }

    message.hidden =
        true;

    message.textContent =
        "";

    message.className =
        "message";
}

function clearFieldErrors() {

    document
        .querySelectorAll(
            ".form-group.error"
        )
        .forEach(
            element =>
                element.classList.remove(
                    "error"
                )
        );
}

function disableForm() {

    if (!form) {
        return;
    }

    form
        .querySelectorAll(
            "input, select, button"
        )
        .forEach(
            element => {

                element.disabled =
                    true;
            }
        );
}