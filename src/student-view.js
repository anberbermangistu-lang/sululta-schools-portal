import { supabase } from "./supabase.js";

const params =
    new URLSearchParams(
        window.location.search
    );

const studentId =
    params.get("id");

const loadingState =
    document.getElementById(
        "loadingState"
    );

const errorState =
    document.getElementById(
        "errorState"
    );

const studentContent =
    document.getElementById(
        "studentContent"
    );

const errorMessage =
    document.getElementById(
        "errorMessage"
    );

const retryButton =
    document.getElementById(
        "retryButton"
    );

const messageBox =
    document.getElementById(
        "messageBox"
    );

const sidebarToggle =
    document.getElementById(
        "sidebarToggle"
    );

const sidebar =
    document.querySelector(
        ".admin-sidebar"
    );

const photoContainer =
    document.getElementById(
        "photoContainer"
    );

const editButton =
    document.getElementById(
        "editStudentButton"
    );

const deleteButton =
    document.getElementById(
        "deleteStudentButton"
    );

let student = null;

document.addEventListener(
    "DOMContentLoaded",
    initialize
);

async function initialize() {

    setupSidebar();

    if (retryButton) {

        retryButton.addEventListener(
            "click",
            loadStudent
        );
    }

    if (!studentId) {

        showError(
            "No student ID was provided."
        );

        return;
    }

    await loadStudent();
}

async function loadStudent() {

    showLoading();

    try {

        console.log("[student-view] Loading student with ID:", studentId);

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
                studentId
            )
            .maybeSingle();

        if (error) {
            console.error("[student-view] Database error:", error);
            throw error;
        }

        if (!data) {
            console.error("[student-view] No student found with ID:", studentId);
            showError(
                `Student not found. The student with ID ${studentId} does not exist in the database.`
            );

            return;
        }

        console.log("[student-view] Student loaded successfully:", data.first_name, data.last_name);

        student = data;

        await loadClassInformation();

        renderStudent();

        showContent();

    } catch (error) {

        console.error(
            "Student loading error:",
            error
        );

        showError(
            `Database error: ${error.message || "Failed to load student information."}`
        );
    }
}

async function loadClassInformation() {

    if (
        !student ||
        !student.class_id
    ) {
        return;
    }

    if (
        student.class &&
        student.section
    ) {
        return;
    }

    try {

        const {
            data,
            error
        } = await supabase
            .from("classes")
            .select(`
                id,
                class_name,
                section
            `)
            .eq(
                "id",
                student.class_id
            )
            .maybeSingle();

        if (error) {

            console.warn(
                "Class lookup warning:",
                error
            );

            return;
        }

        if (!data) {
            return;
        }

        if (!student.class) {

            student.class =
                data.class_name;
        }

        if (!student.section) {

            student.section =
                data.section;
        }

    } catch (error) {

        console.warn(
            "Class lookup failed:",
            error
        );
    }
}

function renderStudent() {

    if (!student) {
        return;
    }

    const firstName =
        String(
            student.first_name || ""
        ).trim();

    const lastName =
        String(
            student.last_name || ""
        ).trim();

    const fullName =
        `${firstName} ${lastName}`.trim() ||
        "Student";

    const formattedGender =
        formatGender(
            student.gender
        );

    const formattedStatus =
        formatStatus(
            student.status
        );

    setText(
        "studentName",
        fullName
    );

    setText(
        "studentId",
        student.student_id || "N/A"
    );

    setText(
        "studentStatus",
        formattedStatus
    );

    setText(
        "detailStudentId",
        student.student_id || "N/A"
    );

    setText(
        "detailFirstName",
        firstName || "N/A"
    );

    setText(
        "detailLastName",
        lastName || "N/A"
    );

    setText(
        "detailGender",
        formattedGender
    );

    setText(
        "detailClass",
        student.class || "N/A"
    );

    setText(
        "detailSection",
        student.section || "N/A"
    );

    setText(
        "detailPhone",
        student.phone || "N/A"
    );

    setText(
        "detailStatus",
        formattedStatus
    );

    renderPhoto(
        fullName,
        firstName,
        lastName
    );

    if (editButton) {

        editButton.href =
            `/students/edit.html?id=${encodeURIComponent(student.id)}`;
    }

    setupDelete();
}

function renderPhoto(
    fullName,
    firstName,
    lastName
) {

    if (!photoContainer) {
        return;
    }

    const initials =
        getInitials(
            firstName,
            lastName
        );

    const photoValue =
        student.photo_url ||
        student.photo ||
        "";

    const photoUrl =
        getPhotoUrl(
            photoValue
        );

    photoContainer.innerHTML =
        "";

    if (!photoUrl) {

        showInitials(
            initials
        );

        return;
    }

    const image =
        document.createElement(
            "img"
        );

    image.src =
        photoUrl;

    image.alt =
        fullName;

    image.className =
        "student-photo";

    image.loading =
        "eager";

    image.onerror =
        () => {

            console.warn(
                "Student photo failed to load:",
                photoUrl
            );

            showInitials(
                initials
            );
        };

    photoContainer.appendChild(
        image
    );
}

function showInitials(
    initials
) {

    if (!photoContainer) {
        return;
    }

    photoContainer.innerHTML = `
        <div class="student-avatar">
            ${escapeHtml(initials)}
        </div>
    `;
}

function getPhotoUrl(
    value
) {

    if (!value) {
        return null;
    }

    const photo =
        String(value).trim();

    if (!photo) {
        return null;
    }

    if (
        photo.startsWith(
            "http://"
        ) ||
        photo.startsWith(
            "https://"
        )
    ) {

        return photo;
    }

    const cleanPath =
        photo.replace(
            /^\/+/,
            ""
        );

    const buckets = [
        "student-photos",
        "students"
    ];

    for (
        const bucket of buckets
    ) {

        const {
            data
        } =
            supabase
                .storage
                .from(bucket)
                .getPublicUrl(
                    cleanPath
                );

        if (
            data?.publicUrl
        ) {

            return data.publicUrl;
        }
    }

    return null;
}

function setupDelete() {

    if (!deleteButton || !student) {
        return;
    }

    deleteButton.onclick =
        async () => {

            const fullName =
                `${student.first_name || ""} ${student.last_name || ""}`
                    .trim();

            const confirmed =
                window.confirm(
                    `Are you sure you want to delete ${fullName || "this student"}?`
                );

            if (!confirmed) {
                return;
            }

            deleteButton.disabled =
                true;

            deleteButton.textContent =
                "Deleting...";

            try {

                const {
                    error
                } = await supabase
                    .from("students")
                    .delete()
                    .eq(
                        "id",
                        student.id
                    );

                if (error) {
                    throw error;
                }

                window.location.href =
                    "/students/dashboard.html";

            } catch (error) {

                console.error(
                    "Student delete error:",
                    error
                );

                showMessage(
                    error.message ||
                    "Failed to delete student.",
                    "error"
                );

                deleteButton.disabled =
                    false;

                deleteButton.textContent =
                    "🗑 Delete Student";
            }
        };
}

function setupSidebar() {

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
                "mobile-open"
            );
        }
    );
}

function showLoading() {

    if (loadingState) {

        loadingState.hidden =
            false;
    }

    if (errorState) {

        errorState.hidden =
            true;
    }

    if (studentContent) {

        studentContent.hidden =
            true;
    }
}

function showContent() {

    if (loadingState) {

        loadingState.hidden =
            true;
    }

    if (errorState) {

        errorState.hidden =
            true;
    }

    if (studentContent) {

        studentContent.hidden =
            false;
    }
}

function showError(
    message
) {

    if (loadingState) {

        loadingState.hidden =
            true;
    }

    if (studentContent) {

        studentContent.hidden =
            true;
    }

    if (errorState) {

        errorState.hidden =
            false;
    }

    if (errorMessage) {

        errorMessage.textContent =
            message;
    }
}

function showMessage(
    text,
    type = "error"
) {

    if (!messageBox) {
        return;
    }

    messageBox.textContent =
        text;

    messageBox.className =
        `message ${type}`;

    messageBox.hidden =
        false;
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

function formatGender(
    value
) {

    const gender =
        String(
            value || ""
        )
            .trim()
            .toLowerCase();

    if (
        gender === "male" ||
        gender === "m"
    ) {

        return "Male";
    }

    if (
        gender === "female" ||
        gender === "f"
    ) {

        return "Female";
    }

    return value || "N/A";
}

function formatStatus(
    value
) {

    const status =
        String(
            value || ""
        )
            .trim()
            .toLowerCase();

    if (!status) {
        return "N/A";
    }

    return (
        status.charAt(0).toUpperCase() +
        status.slice(1)
    );
}

function getInitials(
    firstName,
    lastName
) {

    const first =
        String(
            firstName || ""
        ).trim();

    const last =
        String(
            lastName || ""
        ).trim();

    if (
        first &&
        last
    ) {

        return (
            first.charAt(0) +
            last.charAt(0)
        ).toUpperCase();
    }

    if (first) {

        return first
            .charAt(0)
            .toUpperCase();
    }

    if (last) {

        return last
            .charAt(0)
            .toUpperCase();
    }

    return "ST";
}

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}
