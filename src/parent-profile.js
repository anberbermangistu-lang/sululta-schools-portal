import { supabase } from "./supabase.js";

const message =
    document.getElementById("message");

const logoutButton =
    document.getElementById("logoutButton");

const sidebarToggle =
    document.getElementById("sidebarToggle");

const sidebar =
    document.querySelector(".admin-sidebar");

document.addEventListener(
    "DOMContentLoaded",
    initialize
);

async function initialize() {

    setupSidebar();

    setupLogout();

    await loadParentProfile();
}

async function loadParentProfile() {

    const {
        data: { user },
        error: authError
    } =
        await supabase.auth.getUser();

    if (authError || !user) {

        window.location.href =
            "/login.html";

        return;
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
                email,
                role,
                status,
                photo_url
            `)
            .eq(
                "id",
                user.id
            )
            .maybeSingle();

    if (profileError) {

        showMessage(
            profileError.message,
            "error"
        );

        return;
    }

    if (!profile) {

        await supabase.auth.signOut();

        window.location.href =
            "/login.html";

        return;
    }

    const role =
        String(
            profile.role || ""
        )
            .trim()
            .toLowerCase();

    if (role !== "parent") {

        if (role === "admin") {

            window.location.href =
                "/admin/dashboard.html";

        } else if (role === "teacher") {

            window.location.href =
                "/teachers/dashboard.html";

        } else {

            window.location.href =
                "/login.html";
        }

        return;
    }

    const profileStatus =
        String(
            profile.status || ""
        )
            .trim()
            .toLowerCase();

    if (profileStatus !== "active") {

        await supabase.auth.signOut();

        window.location.href =
            "/login.html";

        return;
    }

    const {
        data: parent,
        error: parentError
    } =
        await supabase
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
            .eq(
                "user_id",
                user.id
            )
            .maybeSingle();

    if (parentError) {

        console.error(
            "Parent error:",
            parentError
        );

        showMessage(
            parentError.message,
            "error"
        );

        return;
    }

    if (!parent) {

        showMessage(
            "Parent record was not found.",
            "error"
        );

        return;
    }

    displayParent(
        profile,
        parent
    );
}

function displayParent(
    profile,
    parent
) {

    const firstName =
        parent.first_name ||
        profile.first_name ||
        "—";

    const lastName =
        parent.last_name ||
        profile.last_name ||
        "—";

    const fullName =
        `${firstName} ${lastName}`
            .trim();

    setText(
        "firstName",
        firstName
    );

    setText(
        "lastName",
        lastName
    );

    setText(
        "parentId",
        parent.parent_id ||
        "Not assigned"
    );

    setText(
        "email",
        parent.email ||
        profile.email ||
        "Not provided"
    );

    setText(
        "phone",
        parent.phone ||
        "Not provided"
    );

    setText(
        "relationship",
        parent.relationship
            ? formatText(
                parent.relationship
            )
            : "Not provided"
    );

    setText(
        "occupation",
        parent.occupation ||
        "Not provided"
    );

    setText(
        "address",
        parent.address ||
        "Not provided"
    );

    setText(
        "studentId",
        parent.student_id ||
        "Not assigned"
    );

    const status =
        String(
            parent.status ||
            profile.status ||
            ""
        )
            .trim()
            .toLowerCase();

    setText(
        "status",
        status
            ? formatText(status)
            : "—"
    );

    setText(
        "parentHeaderName",
        fullName
    );

    displayAvatar(
        profile,
        parent,
        fullName
    );
}

function displayAvatar(
    profile,
    parent,
    fullName
) {

    const avatar =
        document.getElementById(
            "parentAvatar"
        );

    if (!avatar) {
        return;
    }

    const photo =
        parent.photo_url ||
        profile.photo_url;

    if (photo) {

        avatar.innerHTML =
            "";

        const image =
            document.createElement(
                "img"
            );

        image.src =
            photo;

        image.alt =
            fullName;

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
                await supabase.auth.signOut();

            if (error) {

                showMessage(
                    error.message,
                    "error"
                );

                return;
            }

            window.location.href =
                "/login.html";
        }
    );
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
            value;
    }
}

function formatText(
    value
) {

    return String(value)
        .replace(
            /_/g,
            " "
        )
        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
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