import { supabase } from "./supabase.js";

const params = new URLSearchParams(
    window.location.search
);

const teacherId = params.get("id");

const form = document.getElementById("teacherForm");
const loading = document.getElementById("teacherLoading");
const errorBox = document.getElementById("teacherError");
const errorMessage = document.getElementById("teacherErrorMessage");

const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("teacherPhotoPreview");
const photoInitials = document.getElementById("teacherPhotoInitials");
const removePhotoButton = document.getElementById("removePhoto");

const message = document.getElementById("formMessage");
const saveButton = document.getElementById("saveTeacher");

let currentTeacher = null;
let removeCurrentPhoto = false;

document.addEventListener(
    "DOMContentLoaded",
    initialize
);

async function initialize() {

    setupEvents();

    if (!teacherId) {
        showError("No teacher ID was provided.");
        return;
    }

    await loadTeacher();
}

function setupEvents() {

    form?.addEventListener(
        "submit",
        saveTeacher
    );

    photoInput?.addEventListener(
        "change",
        previewPhoto
    );

    removePhotoButton?.addEventListener(
        "click",
        removePhoto
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
        ?.addEventListener("click", async event => {
            event.preventDefault();
            const { error } = await supabase.auth.signOut();
            if (error) {
                showMessage(`Unable to sign out: ${error.message}`, "error");
                return;
            }
            window.location.href = "../login.html";
        });
}

async function loadTeacher() {

    try {

        const { data, error } =
            await supabase
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
                    photo_url
                `)
                .eq("id", teacherId)
                .single();

        if (error) {
            throw error;
        }

        if (!data) {
            throw new Error(
                "Teacher not found."
            );
        }

        currentTeacher = data;

        fillForm(data);

        loading.hidden = true;
        errorBox.hidden = true;
        form.hidden = false;

    } catch (error) {

        console.error(
            "Teacher load error:",
            error
        );

        showError(
            error.message ||
            "Unable to load teacher."
        );
    }
}

function fillForm(teacher) {

    document.getElementById(
        "teacherId"
    ).value =
        teacher.teacher_id || "";

    document.getElementById(
        "firstName"
    ).value =
        teacher.first_name || "";

    document.getElementById(
        "lastName"
    ).value =
        teacher.last_name || "";

    document.getElementById(
        "gender"
    ).value =
        normalizeGender(
            teacher.gender
        );

    document.getElementById(
        "phone"
    ).value =
        teacher.phone || "";

    document.getElementById(
        "email"
    ).value =
        teacher.email || "";

    document.getElementById(
        "qualification"
    ).value =
        teacher.qualification || "";

    document.getElementById(
        "status"
    ).value =
        normalizeStatus(
            teacher.status
        );

    showCurrentPhoto(
        teacher.photo_url
    );
}

function showCurrentPhoto(url) {

    if (!url) {

        photoPreview.hidden = true;
        photoInitials.hidden = false;

        return;
    }

    photoPreview.src = url;
    photoPreview.hidden = false;
    photoInitials.hidden = true;

    photoPreview.onerror = () => {

        photoPreview.hidden = true;
        photoInitials.hidden = false;
    };
}

function previewPhoto(event) {

    const file =
        event.target.files?.[0];

    if (!file) {
        return;
    }

    if (file.size > 5 * 1024 * 1024) {

        showMessage(
            "Photo must be smaller than 5MB.",
            "error"
        );

        photoInput.value = "";

        return;
    }

    if (
        ![
            "image/jpeg",
            "image/png",
            "image/webp"
        ].includes(file.type)
    ) {

        showMessage(
            "Please select a JPG, PNG or WEBP image.",
            "error"
        );

        photoInput.value = "";

        return;
    }

    const url =
        URL.createObjectURL(file);

    photoPreview.src = url;
    photoPreview.hidden = false;
    photoInitials.hidden = true;

    removeCurrentPhoto = false;
}

function removePhoto() {

    photoInput.value = "";

    photoPreview.hidden = true;
    photoInitials.hidden = false;

    removeCurrentPhoto = true;
}

async function saveTeacher(event) {

    event.preventDefault();

    if (!currentTeacher) {
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    hideMessage();

    try {

        const firstName =
            document.getElementById(
                "firstName"
            ).value.trim();

        const lastName =
            document.getElementById(
                "lastName"
            ).value.trim();

        const gender =
            document.getElementById(
                "gender"
            ).value;

        if (!firstName || !lastName || !gender) {

            throw new Error(
                "Please complete all required fields."
            );
        }

        let photoUrl =
            currentTeacher.photo_url || null;

        if (removeCurrentPhoto) {

            await deleteOldPhoto(
                photoUrl
            );

            photoUrl = null;
        }

        const newPhoto =
            photoInput.files?.[0];

        if (newPhoto) {

            if (photoUrl) {
                await deleteOldPhoto(
                    photoUrl
                );
            }

            photoUrl =
                await uploadPhoto(
                    newPhoto
                );
        }

        const updateData = {

            teacher_id:
                document.getElementById(
                    "teacherId"
                ).value.trim(),

            first_name:
                firstName,

            last_name:
                lastName,

            gender:
                gender,

            phone:
                document.getElementById(
                    "phone"
                ).value.trim() || null,

            email:
                document.getElementById(
                    "email"
                ).value.trim() || null,

            qualification:
                document.getElementById(
                    "qualification"
                ).value.trim() || null,

            status:
                document.getElementById(
                    "status"
                ).value,

            photo_url:
                photoUrl
        };

        const { data: updatedTeacher, error } =
            await supabase
                .from("teachers")
                .update(updateData)
                .eq("id", currentTeacher.id)
                .select("id")
                .maybeSingle();

        if (error) {
            throw error;
        }
        if (!updatedTeacher) {
            throw new Error("Teacher was not updated. Check that the record exists and your admin permissions allow editing.");
        }

        showMessage(
            "Teacher updated successfully.",
            "success"
        );

        setTimeout(() => {

            window.location.href =
                `view.html?id=${encodeURIComponent(
                    currentTeacher.id
                )}`;

        }, 700);

    } catch (error) {

        console.error(
            "Teacher update error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to update teacher.",
            "error"
        );

        saveButton.disabled = false;
        saveButton.textContent =
            "💾 Save Changes";
    }
}

async function uploadPhoto(file) {

    const extension =
        file.name
            .split(".")
            .pop()
            .toLowerCase();

    const path =
        `${currentTeacher.teacher_id}-${Date.now()}.${extension}`;

    const { error } =
        await supabase.storage
            .from("teacher-photos")
            .upload(
                path,
                file,
                {
                    cacheControl: "3600",
                    upsert: true,
                    contentType: file.type
                }
            );

    if (error) {
        throw new Error(
            "Unable to upload teacher photo. Check the teacher-photos bucket and Storage policies."
        );
    }

    const { data } =
        supabase.storage
            .from("teacher-photos")
            .getPublicUrl(path);

    return data.publicUrl;
}

async function deleteOldPhoto(url) {

    if (!url) {
        return;
    }

    try {

        const marker =
            "/storage/v1/object/public/teacher-photos/";

        const index =
            url.indexOf(marker);

        if (index === -1) {
            return;
        }

        const path =
            url.substring(
                index + marker.length
            );

        if (!path) {
            return;
        }

        await supabase.storage
            .from("teacher-photos")
            .remove([path]);

    } catch (error) {

        console.warn(
            "Old photo delete warning:",
            error
        );
    }
}

function normalizeGender(value) {

    const gender =
        String(value || "")
            .trim()
            .toLowerCase();

    if (
        gender === "male" ||
        gender === "m"
    ) {
        return "male";
    }

    if (
        gender === "female" ||
        gender === "f"
    ) {
        return "female";
    }

    return "";
}

function normalizeStatus(value) {

    const status =
        String(value || "")
            .trim()
            .toLowerCase();

    return (
        status === "active" ||
        status === "1" ||
        status === "true"
    )
        ? "active"
        : "inactive";
}

function showError(text) {

    loading.hidden = true;
    form.hidden = true;
    errorBox.hidden = false;

    errorMessage.textContent = text;
}

function showMessage(text, type) {

    message.hidden = false;
    message.textContent = text;

    message.className =
        `form-message ${type}`;
}

function hideMessage() {

    message.hidden = true;
    message.textContent = "";
}

window.addEventListener(
    "beforeunload",
    () => {

        if (
            photoPreview.src.startsWith(
                "blob:"
            )
        ) {
            URL.revokeObjectURL(
                photoPreview.src
            );
        }

    }
);
