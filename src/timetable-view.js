import { supabase } from "./supabase.js";

const message =
    document.getElementById("message");

const loadingCard =
    document.getElementById("loadingCard");

const viewCard =
    document.getElementById("viewCard");

const editButton =
    document.getElementById("editButton");

const editButtonBottom =
    document.getElementById("editButtonBottom");

const sidebarToggle =
    document.getElementById("sidebarToggle");

const sidebar =
    document.querySelector(".admin-sidebar");

const logoutButton =
    document.getElementById("logoutButton");

const adminAvatar =
    document.getElementById("adminAvatar");

const adminHeaderName =
    document.getElementById("adminHeaderName");


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

        showError(
            "Timetable record ID is missing."
        );

        return;
    }


    const allowed =
        await checkAdmin();


    if (!allowed) {
        return;
    }


    await loadTimetable();
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
            "Timetable view error:",
            error
        );


        showError(
            error.message ||
            "Failed to load timetable information."
        );


        return;
    }


    if (!data) {

        showError(
            "Timetable record was not found."
        );


        return;
    }


    renderTimetable(
        data
    );
}


function renderTimetable(
    timetable
) {

    setText(
        "className",
        timetable.class_name
    );


    setText(
        "section",
        timetable.section
    );


    setText(
        "subjectCode",
        timetable.subject_code
    );


    setText(
        "subjectName",
        timetable.subject_name
    );


    setText(
        "day",
        timetable.day
    );


    setText(
        "academicYear",
        timetable.academic_year
    );


    setText(
        "startTime",
        formatTime(
            timetable.start_time
        )
    );


    setText(
        "endTime",
        formatTime(
            timetable.end_time
        )
    );


    setText(
        "roomNumber",
        timetable.room_number ||
        "—"
    );


    setText(
        "createdAt",
        formatDateTime(
            timetable.created_at
        )
    );


    setText(
        "updatedAt",
        formatDateTime(
            timetable.updated_at
        )
    );


    const editUrl =
        `/timetable/edit.html?id=${encodeURIComponent(timetable.id)}`;


    if (editButton) {

        editButton.href =
            editUrl;
    }


    if (editButtonBottom) {

        editButtonBottom.href =
            editUrl;
    }


    if (loadingCard) {

        loadingCard.hidden =
            true;
    }


    if (viewCard) {

        viewCard.hidden =
            false;
    }


    hideMessage();
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


function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value ||
            "—";
    }
}


function formatTime(
    value
) {

    if (!value) {
        return "—";
    }


    const parts =
        String(value)
            .split(":");


    if (parts.length < 2) {

        return String(value);
    }


    let hour =
        Number(
            parts[0]
        );


    const minute =
        parts[1];


    if (
        Number.isNaN(hour)
    ) {

        return String(value);
    }


    const suffix =
        hour >= 12
            ? "PM"
            : "AM";


    hour =
        hour % 12 || 12;


    return `${hour}:${minute} ${suffix}`;
}


function formatDateTime(
    value
) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(value);
    }


    return date.toLocaleString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


function showError(
    text
) {

    if (loadingCard) {

        loadingCard.innerHTML = `
            <div class="table-empty">
                ${escapeHtml(text)}
            </div>
        `;
    }


    showMessage(
        text,
        "error"
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


function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}