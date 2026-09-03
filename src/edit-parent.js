import { supabase } from "./supabase.js";

const form = document.getElementById("editParentForm");
const message = document.getElementById("message");
const saveButton = document.getElementById("saveButton");

const parentIdInput = document.getElementById("parent_id");
const statusInput = document.getElementById("status");
const firstNameInput = document.getElementById("first_name");
const lastNameInput = document.getElementById("last_name");
const genderInput = document.getElementById("gender");
const relationshipInput = document.getElementById("relationship");
const phoneInput = document.getElementById("phone");
const emailInput = document.getElementById("email");
const occupationInput = document.getElementById("occupation");
const studentInput = document.getElementById("student_id");
const addressInput = document.getElementById("address");

const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photoPreview");
const photoPlaceholder = document.getElementById("photoPlaceholder");
const removePhotoButton = document.getElementById("removePhoto");

const urlParams = new URLSearchParams(window.location.search);
const recordId = urlParams.get("id");

let currentParent = null;
let currentPhotoUrl = "";
let selectedPhotoFile = null;
let removeExistingPhoto = false;

function showMessage(text, type = "error") {
    if (!message) return;

    message.textContent = text;
    message.className = `message ${type}`;
    message.style.display = "block";

    setTimeout(() => {
        message.style.display = "none";
    }, 5000);
}

function setLoading(isLoading) {
    if (!saveButton) return;

    saveButton.disabled = isLoading;
    saveButton.textContent = isLoading
        ? "Updating..."
        : "Update Parent";
}

function setPhotoPreview(url) {
    if (!photoPreview || !photoPlaceholder) return;

    if (url) {
        photoPreview.src = url;
        photoPreview.style.display = "block";
        photoPlaceholder.style.display = "none";
    } else {
        photoPreview.removeAttribute("src");
        photoPreview.style.display = "none";
        photoPlaceholder.style.display = "flex";
    }
}

function escapeHtml(value) {
    if (value === null || value === undefined) return "";

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function loadStudents(selectedStudentId = null) {
    if (!studentInput) return;

    studentInput.innerHTML = `
        <option value="">
            Select Student
        </option>
    `;

    const { data, error } = await supabase
        .from("students")
        .select("id, student_id, first_name, last_name")
        .order("first_name", { ascending: true });

    if (error) {
        console.error("Error loading students:", error);
        showMessage("Unable to load students.");
        return;
    }

    if (!data || data.length === 0) {
        return;
    }

    data.forEach(student => {
        const option = document.createElement("option");

        option.value = student.id;

        const studentCode = student.student_id || "";
        const name = `${student.first_name || ""} ${student.last_name || ""}`.trim();

        option.textContent = `${studentCode} - ${name}`;

        if (
            selectedStudentId !== null &&
            String(student.id) === String(selectedStudentId)
        ) {
            option.selected = true;
        }

        studentInput.appendChild(option);
    });
}

async function loadParent() {
    if (!recordId) {
        showMessage("Parent ID is missing.");
        return;
    }

    setLoading(true);

    const { data, error } = await supabase
        .from("parents")
        .select("*")
        .eq("id", recordId)
        .single();

    if (error) {
        console.error("Error loading parent:", error);
        showMessage(`Unable to load parent: ${error.message}`);
        setLoading(false);
        return;
    }

    if (!data) {
        showMessage("Parent record was not found.");
        setLoading(false);
        return;
    }

    currentParent = data;

    if (parentIdInput) {
        parentIdInput.value = data.parent_id || "";
    }

    if (statusInput) {
        statusInput.value = data.status || "active";
    }

    if (firstNameInput) {
        firstNameInput.value = data.first_name || "";
    }

    if (lastNameInput) {
        lastNameInput.value = data.last_name || "";
    }

    if (genderInput) {
        genderInput.value = data.gender || "";
    }

    if (relationshipInput) {
        relationshipInput.value = data.relationship || "";
    }

    if (phoneInput) {
        phoneInput.value = data.phone || "";
    }

    if (emailInput) {
        emailInput.value = data.email || "";
    }

    if (occupationInput) {
        occupationInput.value = data.occupation || "";
    }

    if (addressInput) {
        addressInput.value = data.address || "";
    }

    const selectedStudent =
        data.student_id ??
        data.student ??
        null;

    await loadStudents(selectedStudent);

    currentPhotoUrl =
        data.photo_url ||
        data.photo ||
        "";

    setPhotoPreview(currentPhotoUrl);

    setLoading(false);
}

function validateForm() {
    const parentId = parentIdInput?.value.trim();
    const firstName = firstNameInput?.value.trim();
    const lastName = lastNameInput?.value.trim();
    const status = statusInput?.value;
    const studentId = studentInput?.value;

    if (!parentId) {
        showMessage("Parent ID is required.");
        parentIdInput?.focus();
        return false;
    }

    if (!firstName) {
        showMessage("First name is required.");
        firstNameInput?.focus();
        return false;
    }

    if (!lastName) {
        showMessage("Last name is required.");
        lastNameInput?.focus();
        return false;
    }

    if (!status) {
        showMessage("Please select a status.");
        statusInput?.focus();
        return false;
    }

    if (!studentId) {
        showMessage("Please select a student.");
        studentInput?.focus();
        return false;
    }

    return true;
}

async function uploadPhoto(file) {
    if (!file) {
        return currentPhotoUrl || null;
    }

    if (file.size > 5 * 1024 * 1024) {
        throw new Error("Photo must be less than 5 MB.");
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        throw new Error("Only JPG, JPEG, PNG and WEBP photos are allowed.");
    }

    const extension = file.name.split(".").pop().toLowerCase();

    const filePath =
        `parents/parent-${recordId}-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
        .from("parent-photos")
        .upload(filePath, file, {
            cacheControl: "3600",
            upsert: true,
            contentType: file.type
        });

    if (uploadError) {
        console.error("Photo upload error:", uploadError);
        throw new Error(uploadError.message);
    }

    const { data } = supabase.storage
        .from("parent-photos")
        .getPublicUrl(filePath);

    return data.publicUrl;
}

async function deleteOldPhoto() {
    if (!currentPhotoUrl) return;

    try {
        const marker = "/parent-photos/";

        const index = currentPhotoUrl.indexOf(marker);

        if (index === -1) return;

        const filePath = decodeURIComponent(
            currentPhotoUrl.substring(index + marker.length)
        );

        if (!filePath) return;

        const { error } = await supabase.storage
            .from("parent-photos")
            .remove([filePath]);

        if (error) {
            console.warn("Could not remove old photo:", error);
        }

    } catch (error) {
        console.warn("Old photo deletion failed:", error);
    }
}

async function updateParent(event) {
    event.preventDefault();

    if (!validateForm()) {
        return;
    }

    if (!recordId) {
        showMessage("Parent ID is missing.");
        return;
    }

    setLoading(true);

    try {
        let newPhotoUrl = currentPhotoUrl || null;

        if (selectedPhotoFile) {
            newPhotoUrl = await uploadPhoto(selectedPhotoFile);

            if (currentPhotoUrl) {
                await deleteOldPhoto();
            }
        } else if (removeExistingPhoto) {
            await deleteOldPhoto();
            newPhotoUrl = null;
        }

        const updateData = {
            parent_id: parentIdInput.value.trim(),
            first_name: firstNameInput.value.trim(),
            last_name: lastNameInput.value.trim(),
            gender: genderInput.value || null,
            relationship: relationshipInput.value || null,
            phone: phoneInput.value.trim() || null,
            email: emailInput.value.trim() || null,
            occupation: occupationInput.value.trim() || null,
            student_id: studentInput.value || null,
            address: addressInput.value.trim() || null,
            status: statusInput.value,
            photo_url: newPhotoUrl,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from("parents")
            .update(updateData)
            .eq("id", recordId);

        if (error) {
            console.error("Error updating parent:", error);
            throw new Error(error.message);
        }

        showMessage(
            "Parent updated successfully.",
            "success"
        );

        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 1000);

    } catch (error) {
        console.error("Error updating parent:", error);

        showMessage(
            error.message || "Failed to update parent."
        );

        setLoading(false);
    }
}

if (photoInput) {
    photoInput.addEventListener("change", event => {

        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showMessage("Photo must be less than 5 MB.");
            photoInput.value = "";
            return;
        }

        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.type)) {
            showMessage(
                "Only JPG, JPEG, PNG and WEBP photos are allowed."
            );

            photoInput.value = "";
            return;
        }

        selectedPhotoFile = file;
        removeExistingPhoto = false;

        const previewUrl = URL.createObjectURL(file);

        setPhotoPreview(previewUrl);
    });
}

if (removePhotoButton) {
    removePhotoButton.addEventListener("click", () => {

        selectedPhotoFile = null;
        removeExistingPhoto = true;

        if (photoInput) {
            photoInput.value = "";
        }

        setPhotoPreview("");
    });
}

if (form) {
    form.addEventListener("submit", updateParent);
}

const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".admin-sidebar");

if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });
}

loadParent();