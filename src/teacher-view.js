import { supabase } from "./supabase.js";

const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const errorMessage = document.getElementById("errorMessage");
const teacherContent = document.getElementById("teacherContent");

const teacherPhoto = document.getElementById("teacherPhoto");
const photoPlaceholder = document.getElementById("photoPlaceholder");

const teacherName = document.getElementById("teacherName");
const teacherId = document.getElementById("teacherId");
const teacherStatus = document.getElementById("teacherStatus");

const detailTeacherId = document.getElementById("detailTeacherId");
const detailFirstName = document.getElementById("detailFirstName");
const detailLastName = document.getElementById("detailLastName");
const detailGender = document.getElementById("detailGender");
const detailPhone = document.getElementById("detailPhone");
const detailEmail = document.getElementById("detailEmail");
const detailQualification = document.getElementById("detailQualification");
const detailSubject = document.getElementById("detailSubject");
const detailStatus = document.getElementById("detailStatus");
const detailCreatedAt = document.getElementById("detailCreatedAt");
const detailUpdatedAt = document.getElementById("detailUpdatedAt");

const editTeacherButton = document.getElementById("editTeacherButton");
const editTeacherButtonBottom = document.getElementById(
    "editTeacherButtonBottom"
);

const retryButton = document.getElementById("retryButton");
const deleteTeacherButton = document.getElementById(
    "deleteTeacherButton"
);

document.addEventListener(
    "DOMContentLoaded",
    loadTeacher
);

async function loadTeacher() {

    showLoading();

    const params = new URLSearchParams(
        window.location.search
    );

    const id = params.get("id");

    if (!id) {

        showError(
            "No teacher ID was provided."
        );

        return;
    }

    try {

        const { data, error } = await supabase
            .from("teachers")
            .select(`
                id,
                teacher_id,
                first_name,
                last_name,
                gender,
                phone,
                email,
                qualification,
                status,
                photo_url,
                created_at,
                updated_at
            `)
            .eq("id", id)
            .single();

        if (error) {
            throw error;
        }

        if (!data) {

            throw new Error(
                "Teacher not found."
            );

        }

        const { data: assignments, error: assignmentsError } = await supabase
            .from("teacher_subject_assignments")
            .select("subject_code")
            .eq("teacher_id", data.id);

        const subjectCodes = [...new Set((assignments || []).map(item => item.subject_code).filter(Boolean))];
        let assignedSubjects = [];
        if (assignmentsError) {
            console.warn("Teacher subject assignments could not be loaded:", assignmentsError);
        } else if (subjectCodes.length) {
            const { data: subjects, error: subjectsError } = await supabase
                .from("subjects")
                .select("subject_code, subject_name")
                .in("subject_code", subjectCodes);

            if (subjectsError) {
                console.warn("Teacher subjects could not be loaded:", subjectsError);
            } else {
                assignedSubjects = (subjects || []).map(subject => subject.subject_name || subject.subject_code);
            }
        }

        data.assigned_subjects = assignedSubjects;
        displayTeacher(data);

    } catch (error) {

        console.error(
            "Teacher view error:",
            error
        );

        showError(
            error?.message ||
            "Unable to load teacher information."
        );

    }

}

function displayTeacher(teacher) {

    const firstNameValue =
        String(
            teacher.first_name || ""
        ).trim();

    const lastNameValue =
        String(
            teacher.last_name || ""
        ).trim();

    const fullName =
        `${firstNameValue} ${lastNameValue}`.trim() ||
        "Unknown Teacher";

    const teacherIdValue =
        String(
            teacher.teacher_id || "N/A"
        );

    const status =
        normalizeStatus(
            teacher.status
        );

    teacherName.textContent =
        fullName;

    teacherId.textContent =
        `Teacher ID: ${teacherIdValue}`;

    detailTeacherId.textContent =
        teacherIdValue;

    detailFirstName.textContent =
        firstNameValue || "N/A";

    detailLastName.textContent =
        lastNameValue || "N/A";

    detailGender.textContent =
        formatGender(
            teacher.gender
        );

    detailPhone.textContent =
        teacher.phone || "N/A";

    detailEmail.textContent =
        teacher.email || "N/A";

    detailQualification.textContent =
        teacher.qualification || "N/A";

    if (detailSubject) {
        detailSubject.textContent =
            teacher.assigned_subjects?.join(", ") ||
            "N/A";
    }

    detailStatus.textContent =
        capitalize(status);

    teacherStatus.textContent =
        capitalize(status);

    teacherStatus.className =
        status === "active"
            ? "status-active"
            : "status-inactive";

    detailCreatedAt.textContent =
        formatDate(
            teacher.created_at
        );

    detailUpdatedAt.textContent =
        formatDate(
            teacher.updated_at
        );

    displayPhoto(
        teacher.photo_url,
        firstNameValue,
        lastNameValue
    );

    const editUrl =
        `edit.html?id=${encodeURIComponent(
            teacher.id
        )}`;

    editTeacherButton.href =
        editUrl;

    editTeacherButtonBottom.href =
        editUrl;

    loadingState.hidden = true;
    errorState.hidden = true;
    teacherContent.hidden = false;

}

function displayPhoto(
    photoUrl,
    firstNameValue,
    lastNameValue
) {

    const url =
        String(
            photoUrl || ""
        ).trim();

    if (!url) {

        teacherPhoto.hidden = true;
        photoPlaceholder.hidden = false;

        photoPlaceholder.textContent =
            getInitials(
                firstNameValue,
                lastNameValue
            );

        return;
    }

    teacherPhoto.src = url;

    teacherPhoto.alt =
        `${firstNameValue} ${lastNameValue}`.trim() ||
        "Teacher photo";

    teacherPhoto.hidden = false;
    photoPlaceholder.hidden = true;

    teacherPhoto.onerror = () => {

        teacherPhoto.hidden = true;
        photoPlaceholder.hidden = false;

        photoPlaceholder.textContent =
            getInitials(
                firstNameValue,
                lastNameValue
            );

    };

}

function showLoading() {

    loadingState.hidden = false;
    errorState.hidden = true;
    teacherContent.hidden = true;

}

function showError(message) {

    loadingState.hidden = true;
    teacherContent.hidden = true;
    errorState.hidden = false;

    errorMessage.textContent =
        message;

}

function normalizeStatus(value) {

    const status =
        String(
            value || ""
        )
        .trim()
        .toLowerCase();

    if (
        status === "active" ||
        status === "1" ||
        status === "true"
    ) {
        return "active";
    }

    return "inactive";

}

function formatGender(value) {

    const valueLower =
        String(
            value || ""
        )
        .trim()
        .toLowerCase();

    if (
        valueLower === "male" ||
        valueLower === "m"
    ) {
        return "Male";
    }

    if (
        valueLower === "female" ||
        valueLower === "f"
    ) {
        return "Female";
    }

    return value || "N/A";

}

function getInitials(
    firstNameValue,
    lastNameValue
) {

    if (
        firstNameValue &&
        lastNameValue
    ) {

        return (
            firstNameValue.charAt(0) +
            lastNameValue.charAt(0)
        ).toUpperCase();

    }

    if (firstNameValue) {

        return firstNameValue
            .charAt(0)
            .toUpperCase();

    }

    if (lastNameValue) {

        return lastNameValue
            .charAt(0)
            .toUpperCase();

    }

    return "T";

}

function capitalize(value) {

    const text =
        String(
            value || ""
        );

    if (!text) {
        return "N/A";
    }

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );

}

function formatDate(value) {

    if (!value) {
        return "N/A";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "N/A";
    }

    return date.toLocaleString(
        "en-US",
        {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }
    );

}

retryButton?.addEventListener(
    "click",
    loadTeacher
);

deleteTeacherButton?.addEventListener(
    "click",
    async () => {

        const params =
            new URLSearchParams(
                window.location.search
            );

        const id =
            params.get("id");

        if (!id) {
            return;
        }

        const confirmed =
            window.confirm(
                "Delete this teacher? Their class-teacher assignment will also be removed."
            );

        if (!confirmed) {
            return;
        }

        try {

            const { error: classUpdateError } = await supabase
                .from("classes")
                .update({ class_teacher: null })
                .eq("class_teacher", id);

            if (classUpdateError) {
                throw classUpdateError;
            }

            const { data, error } =
                await supabase
                    .from("teachers")
                    .delete()
                    .eq("id", id)
                    .select("id")
                    .maybeSingle();

            if (error) {
                throw error;
            }
            if (!data) {
                throw new Error("Teacher was not deleted. Check that the record exists and your admin permissions allow deletion.");
            }

            window.location.href =
                "dashboard.html";

        } catch (error) {

            console.error(
                "Delete teacher error:",
                error
            );

            showError(
                error?.message ||
                "Unable to delete teacher."
            );

        }

    }
);

document
    .getElementById("sidebarToggle")
    ?.addEventListener(
        "click",
        () => {

            document
                .getElementById("sidebar")
                ?.classList.toggle("collapsed");

        }
    );

document
    .getElementById("logoutBtn")
    ?.addEventListener(
        "click",
        async event => {
            event.preventDefault();
            const { error } = await supabase.auth.signOut();
            if (error) {
                showError(`Unable to sign out: ${error.message}`);
                return;
            }
            window.location.href = "../login.html";
        }
    );