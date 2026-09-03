import { supabase } from "./supabase.js";

const form = document.getElementById("editSubjectForm");

const subjectName = document.getElementById("subjectName");
const subjectCode = document.getElementById("subjectCode");
const gradeLevel = document.getElementById("gradeLevel");
const credit = document.getElementById("credit");
const description = document.getElementById("description");

const message = document.getElementById("message");
const saveButton = document.getElementById("saveButton");

const params = new URLSearchParams(window.location.search);
const subjectId = params.get("id");


function showMessage(text, type = "error") {

    if (!message) {
        return;
    }

    message.textContent = text;
    message.hidden = false;

    message.className = `message ${type}`;
}


function setValue(element, value) {

    if (!element) {
        return;
    }

    element.value =
        value === null ||
        value === undefined
            ? ""
            : value;
}


async function loadSubject() {

    if (!subjectId) {

        showMessage(
            "Subject ID is missing."
        );

        return;
    }


    try {

        const { data, error } =
            await supabase
                .from("subjects")
                .select("*")
                .eq("id", subjectId)
                .limit(1);


        if (error) {

            console.error(
                "Error loading subject:",
                error
            );

            showMessage(
                error.message
            );

            return;
        }


        if (!data || data.length === 0) {

            showMessage(
                "Subject not found."
            );

            return;
        }


        const subject = data[0];


        console.log(
            "Loaded subject:",
            subject
        );


        setValue(
            subjectName,
            subject.subject_name ??
            subject.name
        );


        setValue(
            subjectCode,
            subject.subject_code ??
            subject.code
        );


        setValue(
            gradeLevel,
            subject.grade_level ??
            subject.grade
        );


        setValue(
            credit,
            subject.credit ??
            subject.credits
        );


        setValue(
            description,
            subject.description
        );


    } catch (error) {

        console.error(
            "Unexpected loading error:",
            error
        );

        showMessage(
            error.message ||
            "Failed to load subject."
        );
    }
}


async function updateSubject(event) {

    event.preventDefault();


    console.log(
        "SAVE CHANGES CLICKED"
    );


    if (!subjectId) {

        showMessage(
            "Subject ID is missing."
        );

        return;
    }


    const name =
        subjectName.value.trim();

    const code =
        subjectCode.value.trim();

    const grade =
        gradeLevel.value.trim();

    const creditValue =
        credit.value.trim();

    const descriptionValue =
        description.value.trim();


    if (!name) {

        showMessage(
            "Subject name is required."
        );

        subjectName.focus();

        return;
    }


    if (!code) {

        showMessage(
            "Subject code is required."
        );

        subjectCode.focus();

        return;
    }


    if (!grade) {

        showMessage(
            "Grade level is required."
        );

        gradeLevel.focus();

        return;
    }


    saveButton.disabled = true;

    saveButton.textContent =
        "Saving...";


    const updateData = {

        subject_name: name,

        subject_code: code,

        grade_level: grade,

        description:
            descriptionValue || null
    };


    if (creditValue === "") {

        updateData.credit = null;

    } else {

        updateData.credit =
            Number(creditValue);
    }


    console.log(
        "Subject ID:",
        subjectId
    );

    console.log(
        "Update data:",
        updateData
    );


    try {

        const { data, error } =
            await supabase
                .from("subjects")
                .update(updateData)
                .eq("id", subjectId)
                .select();


        if (error) {

            console.error(
                "Supabase update error:",
                error
            );

            showMessage(
                error.message
            );

            saveButton.disabled = false;

            saveButton.textContent =
                "Save Changes";

            return;
        }


        console.log(
            "Update result:",
            data
        );


        if (!data || data.length === 0) {

            showMessage(
                "No subject was updated. Check the Subject ID or Supabase permissions."
            );

            saveButton.disabled = false;

            saveButton.textContent =
                "Save Changes";

            return;
        }


        showMessage(
            "Subject updated successfully.",
            "success"
        );


        saveButton.textContent =
            "Saved";


        setTimeout(() => {

            window.location.href =
                `/subjects/view.html?id=${subjectId}`;

        }, 1000);


    } catch (error) {

        console.error(
            "Unexpected update error:",
            error
        );

        showMessage(
            error.message ||
            "Failed to update subject."
        );


        saveButton.disabled = false;

        saveButton.textContent =
            "Save Changes";
    }
}


if (form) {

    form.addEventListener(
        "submit",
        updateSubject
    );
}


const sidebarToggle =
    document.getElementById(
        "sidebarToggle"
    );


const adminSidebar =
    document.querySelector(
        ".admin-sidebar"
    );


if (
    sidebarToggle &&
    adminSidebar
) {

    sidebarToggle.addEventListener(
        "click",
        () => {

            adminSidebar.classList.toggle(
                "open"
            );

        }
    );
}


const logoutButton =
    document.getElementById(
        "logoutButton"
    );


if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        () => {

            window.location.href =
                "/login.html";

        }
    );
}


loadSubject();