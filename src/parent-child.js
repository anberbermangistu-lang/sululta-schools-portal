import { supabase } from "./supabase.js";

const message =
    document.getElementById("message");

const refreshButton =
    document.getElementById("refreshChild");

const logoutButton =
    document.getElementById("logoutButton");

const sidebarToggle =
    document.getElementById("sidebarToggle");

const sidebar =
    document.querySelector(".admin-sidebar");

let currentParent = null;

document.addEventListener(
    "DOMContentLoaded",
    initialize
);

async function initialize() {

    setupSidebar();

    setupLogout();

    const allowed =
        await checkParent();

    if (!allowed) {
        return;
    }

    await loadChild();

    refreshButton?.addEventListener(
        "click",
        async () => {
            await loadChild();
        }
    );
}

async function checkParent() {

    const {
        data: { user },
        error: authError
    } =
        await supabase.auth.getUser();

    if (authError || !user) {

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
                email,
                username,
                role,
                status,
                photo_url
            `)
            .eq(
                "id",
                user.id
            )
            .maybeSingle();

    if (profileError || !profile) {

        await supabase.auth.signOut();

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

        return false;
    }

    if (status !== "active") {

        await supabase.auth.signOut();

        window.location.href =
            "/login.html";

        return false;
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

        return false;
    }

    if (!parent) {

        showMessage(
            "Parent record was not found.",
            "error"
        );

        return false;
    }

    currentParent =
        parent;

    displayParent(
        profile,
        parent
    );

    return true;
}

async function loadChild() {

    if (!currentParent) {
        return;
    }

    if (!currentParent.student_id) {

        setChildError();

        showMessage(
            "No child is linked to this parent account.",
            "error"
        );

        return;
    }

    setChildLoading();

    const {
        data: student,
        error
    } =
        await supabase
            .from("students")
            .select(`
                id,
                student_id,
                first_name,
                last_name,
                gender,
                date_of_birth,
                class_id,
                class,
                section,
                phone,
                email,
                address,
                status,
                photo_url
            `)
            .eq(
                "id",
                currentParent.student_id
            )
            .maybeSingle();

    if (error) {

        console.error(
            "Student error:",
            error
        );

        showMessage(
            error.message,
            "error"
        );

        setChildError();

        return;
    }

    if (!student) {

        showMessage(
            "The student linked to this parent account was not found.",
            "error"
        );

        setChildError();

        return;
    }

    displayChild(
        student
    );

    displayLinkedParent(
        currentParent
    );
}

function displayParent(
    profile,
    parent
) {

    const fullName =
        `${parent.first_name || profile.first_name || ""} ${parent.last_name || profile.last_name || ""}`
            .trim() ||
        profile.username ||
        "Parent";

    setText(
        "parentHeaderName",
        fullName
    );

    const avatar =
        document.getElementById(
            "parentAvatar"
        );

    const photo =
        parent.photo_url ||
        profile.photo_url;

    if (!avatar) {
        return;
    }

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

function displayLinkedParent(
    parent
) {

    const fullName =
        `${parent.first_name || ""} ${parent.last_name || ""}`
            .trim() ||
        "Parent";

    setText(
        "linkedParentName",
        fullName
    );

    setText(
        "linkedParentRelationship",
        parent.relationship
            ? capitalize(
                parent.relationship
            )
            : "Not provided"
    );

    setText(
        "linkedParentPhone",
        parent.phone ||
        "Not provided"
    );

    setText(
        "linkedParentEmail",
        parent.email ||
        "Not provided"
    );
}

function displayChild(
    student
) {

    const fullName =
        `${student.first_name || ""} ${student.last_name || ""}`
            .trim() ||
        "—";

    const studentId =
        student.student_id ||
        "—";

    const className =
        student.class ||
        "—";

    const section =
        student.section ||
        "—";

    const status =
        String(
            student.status || ""
        )
            .trim()
            .toLowerCase();

    const statusText =
        status === "active"
            ? "Active"
            : status
                ? capitalize(status)
                : "—";

    const gender =
        student.gender
            ? capitalize(
                student.gender
            )
            : "—";

    const dateOfBirth =
        formatDate(
            student.date_of_birth
        );

    setText(
        "childWelcome",
        fullName
    );

    setText(
        "childDescription",
        `View ${fullName}'s personal and school information.`
    );

    setText(
        "childNameStat",
        fullName
    );

    setText(
        "childIdStat",
        studentId
    );

    setText(
        "childClassStat",
        className
    );

    setText(
        "childStatusStat",
        statusText
    );

    setText(
        "childName",
        fullName
    );

    setText(
        "childId",
        studentId
    );

    setText(
        "childGender",
        gender
    );

    setText(
        "childDateOfBirth",
        dateOfBirth
    );

    setText(
        "childClass",
        className
    );

    setText(
        "childSection",
        section
    );

    setText(
        "childPhone",
        student.phone ||
        "Not provided"
    );

    setText(
        "childEmail",
        student.email ||
        "Not provided"
    );

    setText(
        "childAddress",
        student.address ||
        "Not provided"
    );

    setText(
        "childStatus",
        statusText
    );
}

function setChildLoading() {

    setText(
        "childWelcome",
        "Loading..."
    );

    setText(
        "childDescription",
        "Loading your child's information..."
    );

    setText(
        "childNameStat",
        "Loading..."
    );

    setText(
        "childIdStat",
        "Loading..."
    );

    setText(
        "childClassStat",
        "Loading..."
    );

    setText(
        "childStatusStat",
        "Loading..."
    );

    setText(
        "childName",
        "Loading..."
    );

    setText(
        "childId",
        "Loading..."
    );

    setText(
        "childGender",
        "Loading..."
    );

    setText(
        "childDateOfBirth",
        "Loading..."
    );

    setText(
        "childClass",
        "Loading..."
    );

    setText(
        "childSection",
        "Loading..."
    );

    setText(
        "childPhone",
        "Loading..."
    );

    setText(
        "childEmail",
        "Loading..."
    );

    setText(
        "childAddress",
        "Loading..."
    );

    setText(
        "childStatus",
        "Loading..."
    );

    setText(
        "linkedParentName",
        "Loading..."
    );

    setText(
        "linkedParentRelationship",
        "Loading..."
    );

    setText(
        "linkedParentPhone",
        "Loading..."
    );

    setText(
        "linkedParentEmail",
        "Loading..."
    );
}

function setChildError() {

    setText(
        "childWelcome",
        "My Child"
    );

    setText(
        "childDescription",
        "The linked child could not be found."
    );

    setText(
        "childNameStat",
        "—"
    );

    setText(
        "childIdStat",
        "—"
    );

    setText(
        "childClassStat",
        "—"
    );

    setText(
        "childStatusStat",
        "—"
    );

    setText(
        "childName",
        "Not found"
    );

    setText(
        "childId",
        "—"
    );

    setText(
        "childGender",
        "—"
    );

    setText(
        "childDateOfBirth",
        "—"
    );

    setText(
        "childClass",
        "—"
    );

    setText(
        "childSection",
        "—"
    );

    setText(
        "childPhone",
        "Not provided"
    );

    setText(
        "childEmail",
        "Not provided"
    );

    setText(
        "childAddress",
        "Not provided"
    );

    setText(
        "childStatus",
        "—"
    );
}

function formatDate(
    value
) {

    if (!value) {
        return "Not provided";
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

    return date.toLocaleDateString(
        "en-US",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}

function capitalize(
    value
) {

    const text =
        String(value);

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
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

                console.error(
                    "Logout error:",
                    error
                );

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