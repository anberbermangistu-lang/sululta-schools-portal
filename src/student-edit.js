import { supabase } from "./supabase.js";

const form = document.getElementById("studentForm");
const messageBox = document.getElementById("messageBox");
const saveButton = document.getElementById("saveButton");

const photoInput = document.getElementById("photo");
const currentPhoto = document.getElementById("currentPhoto");
const photoPlaceholder = document.getElementById("photoPlaceholder");
const photoPreviewBox = document.getElementById("photoPreviewBox");
const photoPreview = document.getElementById("photoPreview");

let student = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {

    setupPhotoPreview();

    const params =
        new URLSearchParams(window.location.search);

    const id = params.get("id");

    if (!id) {
        showMessage(
            "No student ID was provided.",
            "error"
        );
        return;
    }

    await loadStudent(id);
}

async function loadStudent(id) {

    const { data, error } = await supabase
        .from("students")
        .select(`
            id,
            student_id,
            first_name,
            last_name,
            gender,
            class,
            section,
            phone,
            status,
            photo_url
        `)
        .eq("id", id)
        .maybeSingle();

    if (error) {

        console.error(
            "Failed to load student:",
            error
        );

        showMessage(
            "Unable to load student information.",
            "error"
        );

        return;
    }

    if (!data) {

        showMessage(
            "Student not found.",
            "error"
        );

        return;
    }

    student = data;

    fillForm(data);
}

function fillForm(data) {

    setValue(
        "studentId",
        data.student_id
    );

    setValue(
        "firstName",
        data.first_name
    );

    setValue(
        "lastName",
        data.last_name
    );

    setValue(
        "gender",
        normalizeGender(data.gender)
    );

    setValue(
        "class",
        data.class
    );

    setValue(
        "section",
        data.section
    );

    setValue(
        "phone",
        data.phone
    );

    setValue(
        "status",
        normalizeStatus(data.status)
    );

    showCurrentPhoto(data.photo);
}

function setValue(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.value =
            value ?? "";
    }
}

function showCurrentPhoto(photo) {

    const url =
        getPhotoUrl(photo);

    if (!url) {

        currentPhoto.hidden = true;
        photoPlaceholder.hidden = false;

        return;
    }

    currentPhoto.src = url;
    currentPhoto.hidden = false;

    photoPlaceholder.hidden = true;
}

function setupPhotoPreview() {

    photoInput?.addEventListener(
        "change",
        () => {

            const file =
                photoInput.files?.[0];

            if (!file) {

                photoPreviewBox.hidden = true;
                photoPreview.src = "";

                return;
            }

            if (file.size > 2 * 1024 * 1024) {

                showMessage(
                    "Photo must be smaller than 2MB.",
                    "error"
                );

                photoInput.value = "";
                photoPreviewBox.hidden = true;

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
                    "Please select a JPG, PNG or WebP image.",
                    "error"
                );

                photoInput.value = "";
                photoPreviewBox.hidden = true;

                return;
            }

            const reader =
                new FileReader();

            reader.onload = event => {

                photoPreview.src =
                    event.target.result;

                photoPreviewBox.hidden = false;
            };

            reader.readAsDataURL(file);
        }
    );
}

form?.addEventListener(
    "submit",
    saveStudent
);

async function saveStudent(event) {

    event.preventDefault();

    if (!student) {

        showMessage(
            "Student information is not loaded.",
            "error"
        );

        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {

        const studentId =
            document.getElementById("studentId")
                ?.value
                .trim();

        const firstName =
            document.getElementById("firstName")
                ?.value
                .trim();

        const lastName =
            document.getElementById("lastName")
                ?.value
                .trim();

        const gender =
            document.getElementById("gender")
                ?.value;

        const className =
            document.getElementById("class")
                ?.value
                .trim();

        const section =
            document.getElementById("section")
                ?.value
                .trim();

        const phone =
            document.getElementById("phone")
                ?.value
                .trim();

        const status =
            document.getElementById("status")
                ?.value;

        if (
            !studentId ||
            !firstName ||
            !lastName ||
            !gender ||
            !className
        ) {

            showMessage(
                "Please complete all required fields.",
                "error"
            );

            resetSaveButton();

            return;
        }

        let photoPath =
            student.photo || null;

        const newPhoto =
            photoInput?.files?.[0];

        if (newPhoto) {

            photoPath =
                await uploadPhoto(
                    newPhoto,
                    studentId
                );
        }

        const { error } =
            await supabase
                .from("students")
                .update({

                    student_id: studentId,

                    first_name: firstName,

                    last_name: lastName,

                    gender: gender,

                    class: className,

                    section: section || null,

                    phone: phone || null,

                    status: status,

                    photo_url: photoPath

                })
                .eq("id", student.id);

        if (error) {

            console.error(
                "Student update error:",
                error
            );

            throw new Error(
                error.message
            );
        }

        showMessage(
            "Student updated successfully.",
            "success"
        );

        setTimeout(() => {

            window.location.href =
                "dashboard.html";

        }, 900);

    } catch (error) {

        console.error(
            "Save student error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to update student.",
            "error"
        );

    } finally {

        resetSaveButton();
    }
}

async function uploadPhoto(file, studentId) {

    if (!file) {
        return student.photo || null;
    }

    const extension =
        getExtension(file.name);

    const fileName =
        `${studentId}-${Date.now()}.${extension}`;

    const filePath =
        `students/${fileName}`;

    const { error } =
        await supabase.storage
            .from("students")
            .upload(
                filePath,
                file,
                {
                    cacheControl: "3600",
                    upsert: false
                }
            );

    if (error) {

        console.error(
            "Photo upload error:",
            error
        );

        throw new Error(
            "Unable to upload the student photo. " +
            "Please check the students Storage bucket and policies."
        );
    }

    const { data } =
        supabase.storage
            .from("students")
            .getPublicUrl(filePath);

    return data?.publicUrl || filePath;
}

function getPhotoUrl(photo) {

    if (!photo) {
        return null;
    }

    const value =
        String(photo).trim();

    if (!value) {
        return null;
    }

    if (
        value.startsWith("http://") ||
        value.startsWith("https://") ||
        value.startsWith("data:")
    ) {
        return value;
    }

    const cleanPath =
        value.replace(/^\/+/, "");

    const { data } =
        supabase.storage
            .from("students")
            .getPublicUrl(cleanPath);

    return data?.publicUrl || null;
}

function getExtension(fileName) {

    const parts =
        String(fileName)
            .split(".");

    return (
        parts.length > 1
            ? parts.pop().toLowerCase()
            : "jpg"
    );
}

function normalizeGender(value) {

    const v =
        String(value || "")
            .trim()
            .toLowerCase();

    if (
        v === "male" ||
        v === "m"
    ) {
        return "Male";
    }

    if (
        v === "female" ||
        v === "f"
    ) {
        return "Female";
    }

    return value || "";
}

function normalizeStatus(value) {

    const v =
        String(value || "")
            .trim()
            .toLowerCase();

    if (
        v === "active" ||
        v === "1" ||
        v === "true"
    ) {
        return "active";
    }

    return "inactive";
}

function resetSaveButton() {

    if (!saveButton) {
        return;
    }

    saveButton.disabled = false;
    saveButton.textContent =
        "Save Changes";
}

function showMessage(
    message,
    type = "success"
) {

    if (!messageBox) {
        return;
    }

    messageBox.textContent =
        message;

    messageBox.className =
        `message ${type}`;

    setTimeout(() => {

        if (!messageBox) {
            return;
        }

        messageBox.textContent = "";
        messageBox.className = "message";

    }, 4000);
}