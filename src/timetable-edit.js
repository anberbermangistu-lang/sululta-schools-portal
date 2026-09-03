import { supabase } from "./supabase.js";

const form =
    document.getElementById("timetableForm");

const saveButton =
    document.getElementById("saveTimetable");

const message =
    document.getElementById("message");

const logoutButton =
    document.getElementById("logoutButton");

const sidebarToggle =
    document.getElementById("sidebarToggle");

const sidebar =
    document.querySelector(".admin-sidebar");

const adminAvatar =
    document.getElementById("adminAvatar");

const adminHeaderName =
    document.getElementById("adminHeaderName");


const classNameInput =
    document.getElementById("className");

const sectionInput =
    document.getElementById("section");

const subjectCodeInput =
    document.getElementById("subjectCode");

const subjectNameInput =
    document.getElementById("subjectName");

const dayInput =
    document.getElementById("day");

const academicYearInput =
    document.getElementById("academicYear");

const startTimeInput =
    document.getElementById("startTime");

const endTimeInput =
    document.getElementById("endTime");

const roomNumberInput =
    document.getElementById("roomNumber");


const params =
    new URLSearchParams(
        window.location.search
    );

const timetableId =
    params.get("id");


document.addEventListener(
    "DOMContentLoaded",
    initialize
);


async function initialize() {

    setupSidebar();

    setupLogout();


    if (!timetableId) {

        showMessage(
            "Timetable record ID is missing.",
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


    await loadTimetable();


    form?.addEventListener(
        "submit",
        handleSubmit
    );
}


async function checkAdmin() {

    const {
        data: {
            user
        },
        error
    } =
        await supabase
            .auth
            .getUser();


    if (error || !user) {

        window.location.href =
            "/login.html";

        return false;
    }


    const {
        data: profile,
        error: profileError
    } =
        await supabase
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
            .eq(
                "id",
                user.id
            )
            .maybeSingle();


    if (
        profileError ||
        !profile
    ) {

        await supabase
            .auth
            .signOut();

        window.location.href =
            "/login.html";

        return false;
    }


    const role =
        String(
            profile.role || ""
        )
            .trim()
            .toLowerCase();


    const status =
        String(
            profile.status || ""
        )
            .trim()
            .toLowerCase();


    if (role !== "admin") {

        if (role === "teacher") {

            window.location.href =
                "/teachers/dashboard.html";

        } else if (role === "parent") {

            window.location.href =
                "/parent/dashboard.html";

        } else {

            window.location.href =
                "/login.html";
        }

        return false;
    }


    if (status !== "active") {

        await supabase
            .auth
            .signOut();

        window.location.href =
            "/login.html";

        return false;
    }


    updateAdminProfile(
        profile
    );


    return true;
}


async function loadTimetable() {

    showMessage(
        "Loading timetable information...",
        "info"
    );


    const {
        data,
        error
    } =
        await supabase
            .from("timetable")
            .select(`
                id,
                class_name,
                section,
                subject_code,
                subject_name,
                day,
                start_time,
                end_time,
                room_number,
                academic_year,
                created_at,
                updated_at
            `)
            .eq(
                "id",
                timetableId
            )
            .maybeSingle();


    if (error) {

        console.error(
            "Timetable load error:",
            error
        );


        showMessage(
            error.message ||
            "Failed to load timetable.",
            "error"
        );


        disableForm();

        return;
    }


    if (!data) {

        showMessage(
            "Timetable record was not found.",
            "error"
        );


        disableForm();

        return;
    }


    fillForm(
        data
    );


    hideMessage();
}


function fillForm(
    timetable
) {

    setValue(
        classNameInput,
        timetable.class_name
    );


    setValue(
        sectionInput,
        timetable.section
    );


    setValue(
        subjectCodeInput,
        timetable.subject_code
    );


    setValue(
        subjectNameInput,
        timetable.subject_name
    );


    setValue(
        dayInput,
        timetable.day
    );


    setValue(
        academicYearInput,
        timetable.academic_year
    );


    setValue(
        startTimeInput,
        formatTimeForInput(
            timetable.start_time
        )
    );


    setValue(
        endTimeInput,
        formatTimeForInput(
            timetable.end_time
        )
    );


    setValue(
        roomNumberInput,
        timetable.room_number
    );
}


async function handleSubmit(
    event
) {

    event.preventDefault();


    const className =
        classNameInput.value.trim();

    const section =
        sectionInput.value.trim();

    const subjectCode =
        subjectCodeInput.value.trim();

    const subjectName =
        subjectNameInput.value.trim();

    const day =
        dayInput.value.trim();

    const academicYear =
        academicYearInput.value.trim();

    const startTime =
        startTimeInput.value.trim();

    const endTime =
        endTimeInput.value.trim();

    const roomNumber =
        roomNumberInput.value.trim();


    if (
        !className ||
        !section ||
        !subjectCode ||
        !subjectName ||
        !day ||
        !academicYear ||
        !startTime ||
        !endTime
    ) {

        showMessage(
            "Please fill in all required fields.",
            "error"
        );

        return;
    }


    if (
        startTime >= endTime
    ) {

        showMessage(
            "End time must be later than start time.",
            "error"
        );

        return;
    }


    setSavingState(
        true
    );


    const {
        error
    } =
        await supabase
            .from("timetable")
            .update({
                class_name:
                    className,

                section:
                    section,

                subject_code:
                    subjectCode,

                subject_name:
                    subjectName,

                day:
                    day,

                start_time:
                    startTime,

                end_time:
                    endTime,

                room_number:
                    roomNumber || null,

                academic_year:
                    academicYear,

                updated_at:
                    new Date().toISOString()
            })
            .eq(
                "id",
                timetableId
            );


    if (error) {

        console.error(
            "Timetable update error:",
            error
        );


        setSavingState(
            false
        );


        showMessage(
            error.message ||
            "Failed to update timetable.",
            "error"
        );


        return;
    }


    showMessage(
        "Timetable updated successfully.",
        "success"
    );


    window.setTimeout(
        () => {

            window.location.href =
                `/timetable/view.html?id=${encodeURIComponent(timetableId)}`;

        },
        800
    );
}


function setSavingState(
    saving
) {

    if (!saveButton) {
        return;
    }


    saveButton.disabled =
        saving;


    saveButton.textContent =
        saving
            ? "Saving Changes..."
            : "💾 Save Changes";
}


function disableForm() {

    if (!form) {
        return;
    }


    const fields =
        form.querySelectorAll(
            "input, select, button"
        );


    fields.forEach(
        field => {

            field.disabled =
                true;

        }
    );
}


function setupSidebar() {

    sidebarToggle?.addEventListener(
        "click",
        () => {

            sidebar?.classList.toggle(
                "mobile-open"
            );

        }
    );
}


function setupLogout() {

    logoutButton?.addEventListener(
        "click",
        async () => {

            const {
                error
            } =
                await supabase
                    .auth
                    .signOut();


            if (error) {

                showMessage(
                    error.message ||
                    "Failed to sign out.",
                    "error"
                );

                return;
            }


            window.location.href =
                "/login.html";
        }
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


    if (adminHeaderName) {

        adminHeaderName.textContent =
            fullName;
    }


    if (!adminAvatar) {
        return;
    }


    adminAvatar.classList.remove(
        "has-photo"
    );


    if (profile.photo_url) {

        adminAvatar.classList.add(
            "has-photo"
        );


        adminAvatar.innerHTML =
            "";


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


        adminAvatar.appendChild(
            image
        );

    } else {

        adminAvatar.textContent =
            fullName
                .charAt(0)
                .toUpperCase();
    }
}


function setValue(
    element,
    value
) {

    if (element) {

        element.value =
            value ?? "";
    }
}


function formatTimeForInput(
    value
) {

    if (!value) {
        return "";
    }


    return String(
        value
    ).slice(
        0,
        5
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

    if (message) {

        message.hidden =
            true;
    }
}