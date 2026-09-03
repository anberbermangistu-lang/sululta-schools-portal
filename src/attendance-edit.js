import { supabase } from "./supabase.js";

const params =
    new URLSearchParams(
        window.location.search
    );

const attendanceId =
    params.get("id");

const loading =
    document.getElementById("loading");

const formCard =
    document.getElementById("formCard");

const errorCard =
    document.getElementById("errorCard");

const form =
    document.getElementById("attendanceForm");

const studentInput =
    document.getElementById("student_id");

const dateInput =
    document.getElementById("attendance_date");

const statusInput =
    document.getElementById("status");

const remarkInput =
    document.getElementById("remark");

const message =
    document.getElementById("formMessage");

const saveButton =
    document.getElementById("saveButton");

const logoutButton =
    document.getElementById("logoutButton");

const sidebarToggle =
    document.getElementById("sidebarToggle");

const sidebar =
    document.querySelector(".admin-sidebar");

let attendance = null;


document.addEventListener(
    "DOMContentLoaded",
    initialize
);


async function initialize() {

    setupSidebar();

    setupLogout();

    const allowed =
        await checkAdmin();

    if (!allowed) {
        return;
    }

    await loadAttendance();
}


async function checkAdmin() {

    const {
        data: { user },
        error
    } =
        await supabase.auth.getUser();

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


async function loadAttendance() {

    if (!attendanceId) {

        showError(
            "Attendance ID is missing."
        );

        return;
    }


    const {
        data,
        error
    } =
        await supabase
            .from("attendance")
            .select(`
                id,
                student_id,
                attendance_date,
                status,
                remark,
                students (
                    id,
                    student_id,
                    first_name,
                    last_name,
                    class,
                    section
                )
            `)
            .eq(
                "id",
                attendanceId
            )
            .maybeSingle();


    if (error) {

        console.error(
            "Failed to load attendance:",
            error
        );

        showError(
            `Failed to load attendance: ${error.message}`
        );

        return;
    }


    if (!data) {

        showError(
            "Attendance record not found."
        );

        return;
    }


    attendance =
        data;


    studentInput.innerHTML =
        "";


    const option =
        document.createElement(
            "option"
        );


    option.value =
        attendance.student_id;


    option.textContent =
        formatStudent(
            attendance.students
        );


    option.selected =
        true;


    studentInput.appendChild(
        option
    );


    studentInput.disabled =
        true;


    dateInput.value =
        attendance.attendance_date ||
        "";


    statusInput.value =
        normalizeStatus(
            attendance.status
        );


    remarkInput.value =
        attendance.remark ||
        "";


    if (loading) {

        loading.hidden =
            true;
    }


    if (formCard) {

        formCard.hidden =
            false;
    }
}


async function updateAttendance(
    event
) {

    event.preventDefault();

    hideMessage();


    if (!attendance) {

        showMessage(
            "Attendance record is not available.",
            "error"
        );

        return;
    }


    const attendanceDate =
        dateInput.value;


    const status =
        statusInput.value;


    const remark =
        remarkInput.value.trim();


    if (!attendanceDate) {

        showMessage(
            "Please select an attendance date.",
            "error"
        );

        dateInput.focus();

        return;
    }


    if (!status) {

        showMessage(
            "Please select an attendance status.",
            "error"
        );

        statusInput.focus();

        return;
    }


    const validStatuses = [
        "Present",
        "Absent",
        "Late",
        "Excused"
    ];


    if (
        !validStatuses.includes(
            status
        )
    ) {

        showMessage(
            "Please select a valid attendance status.",
            "error"
        );

        statusInput.focus();

        return;
    }


    const {
        data: duplicate,
        error: duplicateError
    } =
        await supabase
            .from("attendance")
            .select("id")
            .eq(
                "student_id",
                attendance.student_id
            )
            .eq(
                "attendance_date",
                attendanceDate
            )
            .neq(
                "id",
                attendance.id
            )
            .maybeSingle();


    if (duplicateError) {

        console.error(
            "Duplicate check error:",
            duplicateError
        );

        showMessage(
            `Failed to check existing attendance: ${duplicateError.message}`,
            "error"
        );

        return;
    }


    if (duplicate) {

        showMessage(
            "Attendance already exists for this student on this date.",
            "error"
        );

        return;
    }


    saveButton.disabled =
        true;


    saveButton.textContent =
        "Updating...";


    const updateData = {
        attendance_date:
            attendanceDate,

        status:
            status,

        remark:
            remark || null
    };


    const {
        error
    } =
        await supabase
            .from("attendance")
            .update(
                updateData
            )
            .eq(
                "id",
                attendance.id
            );


    if (error) {

        console.error(
            "Failed to update attendance:",
            error
        );

        showMessage(
            `Failed to update attendance: ${error.message}`,
            "error"
        );

        saveButton.disabled =
            false;


        saveButton.textContent =
            "💾 Update Attendance";

        return;
    }


    showMessage(
        "Attendance updated successfully.",
        "success"
    );


    saveButton.textContent =
        "✓ Updated";


    setTimeout(
        () => {

            window.location.href =
                `dashboard.html?refresh=${Date.now()}`;

        },
        800
    );
}


function formatStudent(
    student
) {

    if (!student) {

        return "Unknown Student";
    }


    const name =
        `${student.first_name || ""} ${student.last_name || ""}`
            .trim() ||
        "Unknown Student";


    const id =
        student.student_id ||
        "-";


    const className =
        student.class ||
        "-";


    const section =
        student.section ||
        "-";


    return `${id} - ${name} - ${className} ${section}`;
}


function normalizeStatus(
    value
) {

    const status =
        String(value || "")
            .trim()
            .toLowerCase();


    const statuses = {
        present: "Present",
        absent: "Absent",
        late: "Late",
        excused: "Excused"
    };


    return statuses[status] || "";
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

        avatar.innerHTML =
            "";


        avatar.classList.add(
            "has-photo"
        );


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

        avatar.classList.remove(
            "has-photo"
        );


        avatar.textContent =
            fullName
                .charAt(0)
                .toUpperCase();
    }
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

            logoutButton.disabled =
                true;


            const {
                error
            } =
                await supabase
                    .auth
                    .signOut();


            if (error) {

                logoutButton.disabled =
                    false;


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
        `form-message ${type}`;


    message.hidden =
        false;


    message.style.display =
        "block";
}


function hideMessage() {

    if (!message) {
        return;
    }


    message.textContent =
        "";


    message.className =
        "form-message";


    message.hidden =
        true;


    message.style.display =
        "none";
}


function showError(
    text
) {

    if (loading) {

        loading.hidden =
            true;
    }


    if (formCard) {

        formCard.hidden =
            true;
    }


    if (errorCard) {

        errorCard.hidden =
            false;


        const errorText =
            errorCard.querySelector(
                ".table-empty"
            );


        if (errorText) {

            errorText.textContent =
                text;
        }
    }
}


form?.addEventListener(
    "submit",
    updateAttendance
);