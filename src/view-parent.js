import { supabase } from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const parentRecordId = params.get("id");

const messageBox = document.getElementById("messageBox");

const editButton = document.getElementById("editButton");
const editButtonBottom = document.getElementById("editButtonBottom");

const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const studentContent = document.getElementById("parentContent");

const errorMessage = document.getElementById("errorMessage");
const retryButton = document.getElementById("retryButton");

const photoContainer = document.getElementById("photoContainer");

function showMessage(message, type = "error") {

    if (!messageBox) {
        return;
    }

    messageBox.textContent = message;
    messageBox.className = `message ${type}`;
    messageBox.hidden = false;

    setTimeout(() => {
        messageBox.hidden = true;
    }, 5000);
}


function setText(id, value) {

    const element = document.getElementById(id);

    if (!element) {
        return;
    }

    element.textContent =
        value === null ||
        value === undefined ||
        value === ""
            ? "-"
            : value;
}


function setInput(id, value) {

    const element = document.getElementById(id);

    if (!element) {
        return;
    }

    element.value =
        value === null ||
        value === undefined ||
        value === ""
            ? "-"
            : value;
}


function formatValue(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "-";
    }

    return String(value);
}


function capitalize(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "-";
    }

    const text = String(value);

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );
}


function formatDateTime(value) {

    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


function showPhoto(url) {

    if (!photoContainer) {
        return;
    }

    if (!url) {

        photoContainer.innerHTML = "👨‍👩‍👧";

        photoContainer.className =
            "student-photo-placeholder";

        return;
    }

    photoContainer.innerHTML = "";

    const image = document.createElement("img");

    image.src = url;

    image.alt = "Parent Photo";

    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = "cover";
    image.style.borderRadius = "inherit";

    image.onerror = () => {

        photoContainer.innerHTML =
            "👨‍👩‍👧";

        photoContainer.className =
            "student-photo-placeholder";
    };

    photoContainer.appendChild(image);
}


function updateStatus(status) {

    const statusElement =
        document.getElementById("parentStatus");

    if (!statusElement) {
        return;
    }

    const normalizedStatus =
        String(status || "").toLowerCase();

    statusElement.textContent =
        capitalize(status);

    statusElement.className =
        "status-badge";

    if (normalizedStatus === "active") {

        statusElement.classList.add("active");

    } else if (normalizedStatus === "inactive") {

        statusElement.classList.add("inactive");

    }

}


function showLoading() {

    if (loadingState) {
        loadingState.hidden = false;
    }

    if (errorState) {
        errorState.hidden = true;
    }

    if (studentContent) {
        studentContent.hidden = true;
    }

}


function showError(message) {

    if (loadingState) {
        loadingState.hidden = true;
    }

    if (studentContent) {
        studentContent.hidden = true;
    }

    if (errorState) {
        errorState.hidden = false;
    }

    if (errorMessage) {
        errorMessage.textContent =
            message || "Unable to load this parent.";
    }

}


function showContent() {

    if (loadingState) {
        loadingState.hidden = true;
    }

    if (errorState) {
        errorState.hidden = true;
    }

    if (studentContent) {
        studentContent.hidden = false;
    }

}


async function loadStudent(studentId) {

    if (!studentId) {

        setInput(
            "detailStudentId",
            "-"
        );

        setInput(
            "detailStudentName",
            "-"
        );

        setInput(
            "detailStudentClass",
            "-"
        );

        setInput(
            "detailStudentSection",
            "-"
        );

        return;
    }


    const numericStudentId =
        Number(studentId);


    if (!Number.isInteger(numericStudentId)) {

        setInput(
            "detailStudentId",
            studentId
        );

        setInput(
            "detailStudentName",
            "-"
        );

        setInput(
            "detailStudentClass",
            "-"
        );

        setInput(
            "detailStudentSection",
            "-"
        );

        return;
    }


    const {
        data,
        error
    } = await supabase
        .from("students")
        .select(`
            id,
            student_id,
            first_name,
            last_name,
            class,
            section
        `)
        .eq("id", numericStudentId)
        .maybeSingle();


    if (error) {

        console.error(
            "Error loading connected student:",
            error
        );

        setInput(
            "detailStudentId",
            studentId
        );

        setInput(
            "detailStudentName",
            "-"
        );

        setInput(
            "detailStudentClass",
            "-"
        );

        setInput(
            "detailStudentSection",
            "-"
        );

        return;
    }


    if (!data) {

        setInput(
            "detailStudentId",
            studentId
        );

        setInput(
            "detailStudentName",
            "-"
        );

        setInput(
            "detailStudentClass",
            "-"
        );

        setInput(
            "detailStudentSection",
            "-"
        );

        return;
    }


    const studentName =
        `${data.first_name || ""} ${data.last_name || ""}`
            .trim();


    setInput(
        "detailStudentId",
        formatValue(data.student_id)
    );

    setInput(
        "detailStudentName",
        studentName || "-"
    );

    setInput(
        "detailStudentClass",
        formatValue(data.class)
    );

    setInput(
        "detailStudentSection",
        formatValue(data.section)
    );

}


async function loadParent() {

    showLoading();


    if (!parentRecordId) {

        const message =
            "Parent ID is missing.";

        showMessage(message);
        showError(message);

        return;
    }


    const numericId =
        Number(parentRecordId);


    if (!Number.isInteger(numericId)) {

        const message =
            "Invalid parent ID.";

        showMessage(message);
        showError(message);

        return;
    }


    try {

        const {
            data,
            error
        } = await supabase
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
                occupation,
                student_id,
                address,
                status,
                photo_url,
                created_at,
                updated_at
            `)
            .eq("id", numericId)
            .maybeSingle();


        if (error) {

            console.error(
                "Supabase parent error:",
                error
            );

            const message =
                error.message ||
                "Unable to load parent information.";

            showMessage(message);
            showError(message);

            return;
        }


        if (!data) {

            const message =
                "Parent record was not found.";

            showMessage(message);
            showError(message);

            return;
        }


        const fullName =
            `${data.first_name || ""} ${data.last_name || ""}`
                .trim();


        /*
         * PROFILE
         */

        setText(
            "parentName",
            fullName || "Parent"
        );


        setText(
            "parentId",
            formatValue(data.parent_id)
        );


        updateStatus(data.status);


        /*
         * BASIC INFORMATION
         */

        setInput(
            "detailParentId",
            formatValue(data.parent_id)
        );


        setInput(
            "detailStatus",
            capitalize(data.status)
        );


        setInput(
            "detailFirstName",
            formatValue(data.first_name)
        );


        setInput(
            "detailLastName",
            formatValue(data.last_name)
        );


        setInput(
            "detailGender",
            capitalize(data.gender)
        );


        setInput(
            "detailRelationship",
            capitalize(data.relationship)
        );


        /*
         * CONTACT INFORMATION
         */

        setInput(
            "detailPhone",
            formatValue(data.phone)
        );


        setInput(
            "detailEmail",
            formatValue(data.email)
        );


        setInput(
            "detailOccupation",
            formatValue(data.occupation)
        );


        setInput(
            "detailAddress",
            formatValue(data.address)
        );


        /*
         * RECORD INFORMATION
         */

        setInput(
            "detailCreatedAt",
            formatDateTime(data.created_at)
        );


        setInput(
            "detailUpdatedAt",
            formatDateTime(data.updated_at)
        );


        /*
         * PHOTO
         */

        showPhoto(data.photo_url);


        /*
         * EDIT BUTTONS
         */

        const editUrl =
            `/parents/edit.html?id=${encodeURIComponent(data.id)}`;


        if (editButton) {
            editButton.href = editUrl;
        }


        if (editButtonBottom) {
            editButtonBottom.href = editUrl;
        }


        /*
         * CONNECTED STUDENT
         */

        await loadStudent(data.student_id);


        /*
         * SHOW PAGE
         */

        showContent();


    } catch (error) {

        console.error(
            "Unexpected error while loading parent:",
            error
        );

        const message =
            error?.message ||
            "An unexpected error occurred while loading the parent.";

        showMessage(message);
        showError(message);

    }

}


function setupSidebar() {

    const sidebarToggle =
        document.getElementById(
            "sidebarToggle"
        );

    const sidebar =
        document.querySelector(
            ".admin-sidebar"
        );


    if (
        !sidebarToggle ||
        !sidebar
    ) {
        return;
    }


    sidebarToggle.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "open"
            );

        }
    );

}


function setupLogout() {

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );


    if (!logoutButton) {
        return;
    }


    logoutButton.addEventListener(
        "click",
        async () => {

            try {

                const {
                    error
                } =
                    await supabase.auth.signOut();


                if (error) {

                    console.error(
                        "Logout error:",
                        error
                    );

                    window.location.href =
                        "/login.html";

                    return;
                }


                window.location.href =
                    "/login.html";


            } catch (error) {

                console.error(
                    "Logout error:",
                    error
                );

                window.location.href =
                    "/login.html";

            }

        }
    );

}
if (retryButton) {

    retryButton.addEventListener(
        "click",
        () => {
            loadParent();
        }
    );

}
setupSidebar();
setupLogout();
loadParent();