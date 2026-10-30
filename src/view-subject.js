import { supabase } from "./supabase.js";

const subjectTitle = document.getElementById("subjectTitle");
const subjectSubtitle = document.getElementById("subjectSubtitle");

const subjectName = document.getElementById("subjectName");
const subjectCode = document.getElementById("subjectCode");
const gradeLevel = document.getElementById("gradeLevel");
const credit = document.getElementById("credit");
const status = document.getElementById("status");
const createdAt = document.getElementById("createdAt");
const description = document.getElementById("description");

const editSubjectButton =
    document.getElementById("editSubjectButton");

const message =
    document.getElementById("message");

const sidebarToggle =
    document.getElementById("sidebarToggle");

const adminSidebar =
    document.getElementById("sidebar");


function getSubjectId() {

    const params =
        new URLSearchParams(window.location.search);

    return params.get("id");
}


function showMessage(text, type = "error") {

    if (!message) {
        return;
    }

    message.textContent = text;

    message.hidden = false;

    message.className = `message ${type}`;

}


function setField(element, value) {

    if (!element) {
        return;
    }

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        element.value = "-";

    } else {

        element.value = value;

    }

}


function formatDate(value) {

    if (!value) {
        return "-";
    }

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
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


function renderSubject(subject) {

    const name =
        subject.subject_name ??
        subject.name ??
        "";

    const code =
        subject.subject_code ??
        subject.code ??
        "";

    const grade =
        subject.grade_level ??
        subject.grade ??
        "";

    const credits =
        subject.credit ??
        subject.credits ??
        "";

    const subjectStatus =
        subject.status ??
        "active";

    const subjectDescription =
        subject.description ??
        "";

    const created =
        subject.created_at ??
        subject.createdAt ??
        null;


    subjectTitle.textContent =
        name || "Subject Details";


    subjectSubtitle.textContent =
        code
            ? `Subject Code: ${code}`
            : "View complete subject information";


    setField(
        subjectName,
        name
    );


    setField(
        subjectCode,
        code
    );


    setField(
        gradeLevel,
        grade
    );


    setField(
        credit,
        credits
    );


    setField(
        status,
        subjectStatus
    );


    setField(
        createdAt,
        formatDate(created)
    );


    setField(
        description,
        subjectDescription
    );


    if (editSubjectButton) {

        editSubjectButton.href =
            `edit.html?id=${encodeURIComponent(subject.id)}`;

    }

}


async function loadSubject() {

    const subjectId =
        getSubjectId();


    if (!subjectId) {

        subjectTitle.textContent =
            "Subject Not Found";

        subjectSubtitle.textContent =
            "Subject ID is missing.";

        showMessage(
            "Subject ID is missing."
        );

        return;

    }


    try {

        console.log(
            "Loading subject ID:",
            subjectId
        );


        const {
            data,
            error
        } = await supabase

            .from("subjects")

            .select("*")

            .eq("id", subjectId)

            .maybeSingle();


        if (error) {

            console.error(
                "Error loading subject:",
                error
            );

            subjectTitle.textContent =
                "Unable to Load Subject";

            subjectSubtitle.textContent =
                error.message;

            showMessage(
                error.message
            );

            return;

        }


        if (!data) {

            console.error(
                "No subject found for ID:",
                subjectId
            );

            subjectTitle.textContent =
                "Subject Not Found";

            subjectSubtitle.textContent =
                `No subject was found with ID ${subjectId}.`;

            showMessage(
                "Subject not found."
            );

            return;

        }


        console.log(
            "Subject loaded:",
            data
        );


        renderSubject(data);


    } catch (error) {

        console.error(
            "Unexpected error:",
            error
        );

        subjectTitle.textContent =
            "Unable to Load Subject";

        subjectSubtitle.textContent =
            "An unexpected error occurred.";

        showMessage(
            "An unexpected error occurred while loading the subject."
        );

    }

}


if (
    sidebarToggle &&
    adminSidebar
) {

    sidebarToggle.addEventListener(
        "click",
        () => {

            if (window.matchMedia("(max-width: 768px)").matches) {
                adminSidebar.classList.toggle("mobile-open");
            } else {
                adminSidebar.classList.toggle("collapsed");
            }

        }
    );

}


const logoutButton =
    document.getElementById("logoutBtn");

if (logoutButton) {
    logoutButton.addEventListener("click", async event => {
        event.preventDefault();
        const { error } = await supabase.auth.signOut();
        if (error) {
            showMessage(`Unable to sign out: ${error.message}`);
            return;
        }
        window.location.href = "../login.html";
    });
}


document.addEventListener(
    "DOMContentLoaded",
    loadSubject
);