import { supabase } from "./supabase.js";

const form = document.getElementById("teacherForm");
const saveButton = document.getElementById("saveButton");
const messageBox = document.getElementById("messageBox");

const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photoPreview");
const previewImage = document.getElementById("previewImage");

const BUCKET = "teacher-photos";

document.addEventListener("DOMContentLoaded", () => {

    photoInput?.addEventListener("change", previewPhoto);

    form?.addEventListener("submit", saveTeacher);

    setupSidebar();

    setupLogout();

});

function previewPhoto() {

    const file = photoInput?.files?.[0];

    if (!file) {

        photoPreview.style.display = "none";
        previewImage.src = "";

        return;
    }

    if (!file.type.startsWith("image/")) {

        showMessage(
            "Please select a valid image file.",
            "error"
        );

        photoInput.value = "";

        return;
    }

    if (file.size > 2 * 1024 * 1024) {

        showMessage(
            "Photo must be smaller than 2 MB.",
            "error"
        );

        photoInput.value = "";

        return;
    }

    const url = URL.createObjectURL(file);

    previewImage.src = url;

    photoPreview.style.display = "block";
}

async function saveTeacher(event) {

    event.preventDefault();

    const teacherId =
        document.getElementById("teacherId")?.value.trim();

    const firstName =
        document.getElementById("firstName")?.value.trim();

    const lastName =
        document.getElementById("lastName")?.value.trim();

    const gender =
        document.getElementById("gender")?.value;

    const phone =
        document.getElementById("phone")?.value.trim();

    const email =
        document.getElementById("email")?.value.trim();

    const qualification =
        document.getElementById("qualification")?.value.trim();

    const status =
        document.getElementById("status")?.value || "active";

    const photo =
        photoInput?.files?.[0] || null;

    if (
        !teacherId ||
        !firstName ||
        !lastName ||
        !gender ||
        !qualification
    ) {

        showMessage(
            "Please complete all required fields.",
            "error"
        );

        return;
    }

    if (photo) {

        if (!photo.type.startsWith("image/")) {

            showMessage(
                "Please select a valid image.",
                "error"
            );

            return;
        }

        if (photo.size > 2 * 1024 * 1024) {

            showMessage(
                "Photo must be smaller than 2 MB.",
                "error"
            );

            return;
        }
    }

    setSaving(true);

    let uploadedPhotoPath = null;

    try {

        const {
            data: existing,
            error: checkError
        } = await supabase
            .from("teachers")
            .select("id")
            .eq("teacher_id", teacherId)
            .maybeSingle();

        if (checkError) {
            throw checkError;
        }

        if (existing) {

            throw new Error(
                "This Teacher ID already exists."
            );
        }

        let photoUrl = null;

        if (photo) {

            const result =
                await uploadPhoto(
                    photo,
                    teacherId
                );

            photoUrl = result.publicUrl;
            uploadedPhotoPath = result.path;
        }

        const {
            error: insertError
        } = await supabase
            .from("teachers")
            .insert({

                teacher_id: teacherId,

                first_name: firstName,

                last_name: lastName,

                gender: gender,

                phone: phone || null,

                email: email || null,

                qualification: qualification,

                status: status,

                photo_url: photoUrl

            });

        if (insertError) {

            if (uploadedPhotoPath) {

                await supabase
                    .storage
                    .from(BUCKET)
                    .remove([
                        uploadedPhotoPath
                    ]);
            }

            throw insertError;
        }

        showMessage(
            "Teacher added successfully. Redirecting...",
            "success"
        );

        form.reset();

        photoPreview.style.display = "none";
        previewImage.src = "";

        setTimeout(() => {

            window.location.assign(
                "/teachers/dashboard.html"
            );

        }, 800);

    } catch (error) {

        console.error(
            "Teacher save error:",
            error
        );

        showMessage(
            error.message ||
            "Failed to save teacher.",
            "error"
        );

    } finally {

        setSaving(false);

    }
}

async function uploadPhoto(file, teacherId) {

    const extension =
        getExtension(file.name);

    const filePath =
        `${teacherId}-${Date.now()}.${extension}`;

    const {
        error
    } = await supabase
        .storage
        .from(BUCKET)
        .upload(
            filePath,
            file,
            {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type
            }
        );

    if (error) {

        console.error(
            "Photo upload error:",
            error
        );

        throw new Error(
            "Unable to upload teacher photo. Check the teacher-photos bucket and its policies."
        );
    }

    const {
        data
    } = supabase
        .storage
        .from(BUCKET)
        .getPublicUrl(filePath);

    return {
        publicUrl: data.publicUrl,
        path: filePath
    };
}

function getExtension(fileName) {

    const parts =
        String(fileName).split(".");

    const extension =
        parts.length > 1
            ? parts.pop()
            : "jpg";

    return extension
        .toLowerCase()
        .replace(
            /[^a-z0-9]/g,
            ""
        ) || "jpg";
}

function setSaving(saving) {

    if (!saveButton) {
        return;
    }

    saveButton.disabled = saving;

    saveButton.textContent =
        saving
            ? "Saving..."
            : "Save Teacher";
}

function showMessage(message, type) {

    if (!messageBox) {
        return;
    }

    messageBox.textContent = message;

    messageBox.className =
        `message ${type}`;

    messageBox.hidden = false;

    messageBox.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

function setupSidebar() {

    const toggle =
        document.getElementById("sidebarToggle");

    const sidebar =
        document.querySelector(".admin-sidebar");

    if (!toggle || !sidebar) {
        return;
    }

    toggle.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "mobile-open"
            );

        }
    );
}

function setupLogout() {

    const logoutButton =
        document.getElementById("logoutButton");

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
        "click",
        async () => {

            const {
                error
            } = await supabase.auth.signOut();

            if (error) {

                console.error(
                    "Logout error:",
                    error
                );

                return;
            }

            window.location.assign(
                "/login.html"
            );

        }
    );
}