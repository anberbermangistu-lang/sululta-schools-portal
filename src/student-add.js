import { supabase } from "./supabase.js";

const form =
    document.getElementById("studentForm");

const classSelect =
    document.getElementById("classId");

const messageBox =
    document.getElementById("messageBox");

const saveButton =
    document.getElementById("saveButton");

document.addEventListener(
    "DOMContentLoaded",
    init
);

async function init() {

    setupSidebar();

    setupLogout();

    setupPhotoPreview();

    await loadClasses();

    if (form) {

        form.addEventListener(
            "submit",
            saveStudent
        );
    }
}

function showMessage(
    message,
    type = "error"
) {

    if (!messageBox) {
        return;
    }

    messageBox.textContent =
        message;

    messageBox.className =
        `message ${type}`;

    messageBox.hidden =
        false;
}

function hideMessage() {

    if (!messageBox) {
        return;
    }

    messageBox.hidden =
        true;

    messageBox.textContent =
        "";

    messageBox.className =
        "message";
}

async function loadClasses() {

    if (!classSelect) {
        return;
    }

    classSelect.innerHTML =
        `<option value="">Loading classes...</option>`;

    try {

        const {
            data,
            error
        } = await supabase
            .from("classes")
            .select(`
                id,
                class_name,
                section,
                room_number,
                academic_year,
                status
            `)
            .eq(
                "status",
                "active"
            )
            .order(
                "class_name",
                {
                    ascending: true
                }
            )
            .order(
                "section",
                {
                    ascending: true
                }
            );

        if (error) {
            throw error;
        }

        classSelect.innerHTML =
            `<option value="">Select Class</option>`;

        if (
            !data ||
            data.length === 0
        ) {

            classSelect.innerHTML =
                `<option value="">No classes available</option>`;

            return;
        }

        data.forEach(
            classItem => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    classItem.id;

                let text =
                    classItem.class_name ||
                    "Class";

                if (
                    classItem.section
                ) {

                    text +=
                        ` - Section ${classItem.section}`;
                }

                if (
                    classItem.room_number
                ) {

                    text +=
                        ` - Room ${classItem.room_number}`;
                }

                option.textContent =
                    text;

                option.dataset.className =
                    classItem.class_name ||
                    "";

                option.dataset.section =
                    classItem.section ||
                    "";

                classSelect.appendChild(
                    option
                );
            }
        );

    } catch (error) {

        console.error(
            "Class loading error:",
            error
        );

        classSelect.innerHTML =
            `<option value="">Unable to load classes</option>`;

        showMessage(
            `Failed to load classes: ${error.message}`,
            "error"
        );
    }
}

async function saveStudent(event) {

    event.preventDefault();

    hideMessage();

    if (!form) {
        return;
    }

    const formData =
        new FormData(form);

    const studentId =
        String(
            formData.get("student_id") || ""
        ).trim();

    const firstName =
        String(
            formData.get("first_name") || ""
        ).trim();

    const lastName =
        String(
            formData.get("last_name") || ""
        ).trim();

    const gender =
        String(
            formData.get("gender") || ""
        ).trim();

    const dateOfBirth =
        formData.get("date_of_birth") ||
        null;

    const phone =
        String(
            formData.get("phone") || ""
        ).trim() ||
        null;

    const email =
        String(
            formData.get("email") || ""
        ).trim() ||
        null;

    const classId =
        formData.get("class_id");

    const sectionInput =
        String(
            formData.get("section") || ""
        ).trim() ||
        null;

    const status =
        String(
            formData.get("status") || ""
        ).trim();

    if (
        !studentId ||
        !firstName ||
        !lastName ||
        !gender ||
        !classId
    ) {

        showMessage(
            "Please fill in all required fields.",
            "error"
        );

        return;
    }

    const selectedOption =
        classSelect?.options[
            classSelect.selectedIndex
        ];

    const className =
        selectedOption?.dataset?.className ||
        null;

    const classSection =
        selectedOption?.dataset?.section ||
        null;

    const finalSection =
        sectionInput ||
        classSection ||
        null;

    if (saveButton) {

        saveButton.disabled =
            true;

        saveButton.textContent =
            "Saving...";
    }

    let uploadedFilePath =
        null;

    try {

        const studentData = {

            student_id:
                studentId,

            first_name:
                firstName,

            last_name:
                lastName,

            gender:
                gender,

            date_of_birth:
                dateOfBirth,

            phone:
                phone,

            email:
                email,

            class_id:
                classId,

            class:
                className,

            section:
                finalSection,

            status:
                status || "active"
        };

        const photoInput =
            document.getElementById(
                "photo"
            );

        if (
            photoInput &&
            photoInput.files &&
            photoInput.files.length > 0
        ) {

            const file =
                photoInput.files[0];

            if (
                file.size >
                5 * 1024 * 1024
            ) {

                throw new Error(
                    "Student photo must be smaller than 5 MB."
                );
            }

            const allowedTypes = [
                "image/jpeg",
                "image/png",
                "image/webp"
            ];

            if (
                !allowedTypes.includes(
                    file.type
                )
            ) {

                throw new Error(
                    "Only JPG, PNG and WEBP images are allowed."
                );
            }

            if (saveButton) {
                saveButton.textContent =
                    "Uploading Photo...";
            }

            const extension =
                file.name
                    .split(".")
                    .pop()
                    .toLowerCase();

            const fileName =
                `${studentId}-${Date.now()}.${extension}`;

            uploadedFilePath =
                `students/${fileName}`;

            const {
                error: uploadError
            } = await supabase
                .storage
                .from("student-photos")
                .upload(
                    uploadedFilePath,
                    file,
                    {
                        cacheControl:
                            "3600",

                        upsert:
                            false,

                        contentType:
                            file.type
                    }
                );

            if (uploadError) {
                throw new Error(
                    `Photo upload failed: ${uploadError.message}`
                );
            }

            const {
                data: publicUrlData
            } =
                supabase
                    .storage
                    .from(
                        "student-photos"
                    )
                    .getPublicUrl(
                        uploadedFilePath
                    );

            if (
                publicUrlData?.publicUrl
            ) {

                studentData.photo_url =
                    publicUrlData.publicUrl;
            }
        }

        if (saveButton) {
            saveButton.textContent =
                "Saving Student...";
        }

        const {
            data,
            error
        } = await supabase
            .from("students")
            .insert(
                [studentData]
            )
            .select()
            .single();

        if (error) {
            throw error;
        }

        if (!data) {

            throw new Error(
                "Student was not created."
            );
        }

        showMessage(
            "Student registered successfully.",
            "success"
        );

        form.reset();

        resetPhotoPreview();

        setTimeout(
            () => {
                window.location.href =
                    "/students/dashboard.html";
            },
            1000
        );

    } catch (error) {

        console.error(
            "Student save error:",
            error
        );

        if (
            uploadedFilePath
        ) {

            await supabase
                .storage
                .from("student-photos")
                .remove([
                    uploadedFilePath
                ]);
        }

        let message =
            error?.message ||
            "Failed to save student.";

        if (
            message
                .toLowerCase()
                .includes(
                    "duplicate"
                )
        ) {

            message =
                "This Student ID already exists. Please use a different Student ID.";
        }

        showMessage(
            message,
            "error"
        );

    } finally {

        if (saveButton) {

            saveButton.disabled =
                false;

            saveButton.textContent =
                "Save Student";
        }
    }
}

function setupPhotoPreview() {

    const photoInput =
        document.getElementById(
            "photo"
        );

    const preview =
        document.getElementById(
            "photoPreview"
        );

    const previewImage =
        document.getElementById(
            "previewImage"
        );

    if (
        !photoInput ||
        !preview ||
        !previewImage
    ) {
        return;
    }

    photoInput.addEventListener(
        "change",
        () => {

            const file =
                photoInput.files[0];

            if (!file) {

                resetPhotoPreview();

                return;
            }

            if (
                !file.type.startsWith(
                    "image/"
                )
            ) {

                showMessage(
                    "Please select a valid image.",
                    "error"
                );

                photoInput.value =
                    "";

                resetPhotoPreview();

                return;
            }

            if (
                file.size >
                5 * 1024 * 1024
            ) {

                showMessage(
                    "Student photo must be smaller than 5 MB.",
                    "error"
                );

                photoInput.value =
                    "";

                resetPhotoPreview();

                return;
            }

            const imageUrl =
                URL.createObjectURL(
                    file
                );

            previewImage.src =
                imageUrl;

            preview.style.display =
                "block";
        }
    );
}

function resetPhotoPreview() {

    const preview =
        document.getElementById(
            "photoPreview"
        );

    const previewImage =
        document.getElementById(
            "previewImage"
        );

    if (preview) {

        preview.style.display =
            "none";
    }

    if (previewImage) {

        previewImage.src =
            "";
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
                "mobile-open"
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

            await supabase
                .auth
                .signOut();

            window.location.href =
                "/login.html";
        }
    );
}