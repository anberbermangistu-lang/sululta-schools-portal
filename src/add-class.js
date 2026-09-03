import { supabase } from "./supabase.js";

const form = document.getElementById("classForm");
const saveButton = document.getElementById("saveButton");
const messageBox = document.getElementById("message");

const classTeacherSelect =
    document.getElementById("classTeacher");

document.addEventListener("DOMContentLoaded", () => {

    loadTeachers();

    form?.addEventListener(
        "submit",
        saveClass
    );

    setupSidebar();
    setupLogout();

});


async function loadTeachers() {

    if (!classTeacherSelect) {
        return;
    }

    classTeacherSelect.innerHTML = `
        <option value="">
            Loading teachers...
        </option>
    `;

    const {
        data: teachers,
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
        .order("first_name", {
            ascending: true
        });

    if (error) {

        console.error(
            "Teacher loading error:",
            error
        );

        classTeacherSelect.innerHTML = `
            <option value="">
                Unable to load teachers
            </option>
        `;

        showMessage(
            "Unable to load teachers. Please check your Supabase connection.",
            "error"
        );

        return;
    }

    classTeacherSelect.innerHTML = `
        <option value="">
            Select Class Teacher
        </option>
    `;

    const activeTeachers =
        (teachers || []).filter(
            teacher =>
                String(teacher.status || "")
                    .toLowerCase() === "active"
        );

    activeTeachers.forEach(teacher => {

        const option =
            document.createElement("option");

        option.value = teacher.id;

        const fullName =
            `${teacher.first_name || ""} ${teacher.last_name || ""}`
                .trim();

        option.textContent =
            `${fullName || "Unnamed Teacher"} (${teacher.teacher_id || "No ID"})`;

        classTeacherSelect.appendChild(option);

    });

    if (activeTeachers.length === 0) {

        classTeacherSelect.innerHTML = `
            <option value="">
                No active teachers available
            </option>
        `;

    }

}


async function saveClass(event) {

    event.preventDefault();

    const className =
        document.getElementById("className")
            ?.value
            .trim();

    const section =
        document.getElementById("section")
            ?.value
            .trim();

    const roomNumber =
        document.getElementById("roomNumber")
            ?.value
            .trim();

    const academicYear =
        document.getElementById("academicYear")
            ?.value
            .trim();

    const classTeacher =
        document.getElementById("classTeacher")
            ?.value;

    const status =
        document.getElementById("status")
            ?.value;

    if (!className || !academicYear) {

        showMessage(
            "Please complete all required fields.",
            "error"
        );

        return;
    }

    setSaving(true);

    try {

        const {
            data: existing,
            error: checkError
        } = await supabase
            .from("classes")
            .select("id")
            .eq("class_name", className)
            .eq("section", section || "")
            .eq("academic_year", academicYear)
            .maybeSingle();

        if (checkError) {
            throw checkError;
        }

        if (existing) {

            throw new Error(
                "This class already exists for the selected section and academic year."
            );

        }


        const {
            error
        } = await supabase
            .from("classes")
            .insert({
                class_name: className,
                section: section || null,
                room_number: roomNumber || null,
                class_teacher:
                    classTeacher
                        ? Number(classTeacher)
                        : null,
                academic_year: academicYear,
                status: status || "active"
            });

        if (error) {
            throw error;
        }


        showMessage(
            "Class added successfully. Redirecting...",
            "success"
        );


        form.reset();


        setTimeout(() => {

            window.location.href =
                "/classes/dashboard.html";

        }, 1000);


    } catch (error) {

        console.error(
            "Class save error:",
            error
        );

        showMessage(
            error.message ||
            "Failed to save class.",
            "error"
        );

    } finally {

        setSaving(false);

    }

}


function setSaving(saving) {

    if (!saveButton) {
        return;
    }

    saveButton.disabled = saving;

    saveButton.textContent =
        saving
            ? "Saving..."
            : "Save Class";

}


function showMessage(message, type) {

    if (!messageBox) {
        return;
    }

    messageBox.textContent = message;

    messageBox.className =
        `message ${type}`;

    messageBox.hidden = false;

    messageBox.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

}


function setupSidebar() {

    const toggle =
        document.getElementById("sidebarToggle");

    const sidebar =
        document.querySelector(".admin-sidebar");

    if (!toggle || !sidebar) {
        return;
    }

    toggle.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "mobile-open"
            );

        }
    );

}


function setupLogout() {

    const logoutButton =
        document.getElementById("logoutButton");

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
        "click",
        async () => {

            const {
                error
            } = await supabase.auth.signOut();

            if (error) {

                console.error(
                    "Logout error:",
                    error
                );

                showMessage(
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