import { supabase } from "./supabase.js";

const form = document.getElementById("bookForm");
const saveButton = document.getElementById("saveButton");
const messageBox = document.getElementById("messageBox");
const sidebarToggle = document.getElementById("sidebarToggle");

const bookCodeInput = document.getElementById("bookCode");
const titleInput = document.getElementById("title");
const authorInput = document.getElementById("author");
const publisherInput = document.getElementById("publisher");
const categoryInput = document.getElementById("category");
const availableInput = document.getElementById("available");
const bookFileInput = document.getElementById("bookFile");

const STORAGE_BUCKET = "books";

document.addEventListener("DOMContentLoaded", initialize);

function initialize() {
    setupSidebar();
    setupForm();

    if (availableInput) {
        availableInput.value = "1";
    }
}

function setupSidebar() {
    const sidebar = document.querySelector(".admin-sidebar");

    sidebarToggle?.addEventListener("click", event => {
        event.stopPropagation();

        sidebar?.classList.toggle("open");
    });

    document.addEventListener("click", event => {
        if (
            window.innerWidth <= 900 &&
            sidebar?.classList.contains("open") &&
            !sidebar.contains(event.target) &&
            !sidebarToggle?.contains(event.target)
        ) {
            sidebar.classList.remove("open");
        }
    });
}

function setupForm() {
    form?.addEventListener("submit", handleSubmit);
}

async function handleSubmit(event) {
    event.preventDefault();

    clearMessage();

    const bookCode =
        bookCodeInput?.value.trim() || "";

    const title =
        titleInput?.value.trim() || "";

    const author =
        authorInput?.value.trim() || "";

    const publisher =
        publisherInput?.value.trim() || "";

    const category =
        categoryInput?.value.trim() || "";

    const available =
        Number(availableInput?.value || 1);

    const selectedFile =
        bookFileInput?.files?.[0] || null;

    if (!bookCode) {
        showMessage(
            "Please enter the book code.",
            "error"
        );

        bookCodeInput?.focus();

        return;
    }

    if (!title) {
        showMessage(
            "Please enter the book title.",
            "error"
        );

        titleInput?.focus();

        return;
    }

    if (available !== 0 && available !== 1) {
        showMessage(
            "Invalid availability value.",
            "error"
        );

        return;
    }

    if (selectedFile) {
        const validationError =
            validateFile(selectedFile);

        if (validationError) {
            showMessage(
                validationError,
                "error"
            );

            return;
        }
    }

    setSavingState(true);

    let uploadedFileUrl = null;

    try {

        const duplicate =
            await checkDuplicateBookCode(bookCode);

        if (duplicate) {

            showMessage(
                "A book with this book code already exists.",
                "error"
            );

            setSavingState(false);

            bookCodeInput?.focus();

            return;
        }

        if (selectedFile) {
            uploadedFileUrl =
                await uploadBookFile(selectedFile);
        }

        const bookData = {
            book_code: bookCode,
            title: title,
            author: author || null,
            publisher: publisher || null,
            category: category || null,
            available: available,
            book_file: uploadedFileUrl
        };

        const { error } =
            await supabase
                .from("books")
                .insert(bookData);

        if (error) {

            console.error(
                "Failed to create book:",
                error
            );

            if (uploadedFileUrl) {
                await removeUploadedFile(
                    uploadedFileUrl
                );
            }

            throw new Error(
                error.message ||
                "Unable to create the book."
            );
        }

        showMessage(
            "Book added successfully.",
            "success"
        );

        form.reset();

        if (availableInput) {
            availableInput.value = "1";
        }

        setTimeout(() => {
            window.location.href =
                "dashboard.html";
        }, 900);

    } catch (error) {

        console.error(
            "Add book error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to add the book. Please try again.",
            "error"
        );

        setSavingState(false);
    }
}

async function checkDuplicateBookCode(bookCode) {

    const { data, error } =
        await supabase
            .from("books")
            .select("id")
            .eq("book_code", bookCode)
            .limit(1);

    if (error) {

        console.error(
            "Duplicate check failed:",
            error
        );

        throw new Error(
            "Unable to verify the book code."
        );
    }

    return Array.isArray(data) &&
        data.length > 0;
}

async function uploadBookFile(file) {

    const safeName =
        sanitizeFileName(file.name);

    const uniqueName =
        `${Date.now()}-${crypto.randomUUID()}-${safeName}`;

    const filePath =
        `library/${uniqueName}`;

    const { error } =
        await supabase
            .storage
            .from(STORAGE_BUCKET)
            .upload(
                filePath,
                file,
                {
                    cacheControl: "3600",
                    upsert: false,
                    contentType:
                        file.type || undefined
                }
            );

    if (error) {

        console.error(
            "Book file upload failed:",
            error
        );

        throw new Error(
            error.message ||
            "Unable to upload the book file."
        );
    }

    const { data } =
        supabase
            .storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filePath);

    if (!data?.publicUrl) {

        throw new Error(
            "Unable to create the book file URL."
        );
    }

    return data.publicUrl;
}

async function removeUploadedFile(fileUrl) {

    try {

        const marker =
            `/storage/v1/object/public/${STORAGE_BUCKET}/`;

        const index =
            fileUrl.indexOf(marker);

        if (index === -1) {
            return;
        }

        const filePath =
            fileUrl.substring(
                index + marker.length
            );

        await supabase
            .storage
            .from(STORAGE_BUCKET)
            .remove([filePath]);

    } catch (error) {

        console.error(
            "Unable to remove uploaded file:",
            error
        );
    }
}

function validateFile(file) {

    const allowedExtensions = [
        "pdf",
        "doc",
        "docx",
        "txt"
    ];

    const extension =
        getFileExtension(file.name);

    if (!allowedExtensions.includes(extension)) {

        return (
            "Invalid file type. " +
            "Please upload PDF, DOC, DOCX, or TXT."
        );
    }

    const maxSize =
        20 * 1024 * 1024;

    if (file.size > maxSize) {

        return (
            "The selected file is too large. " +
            "Maximum file size is 20 MB."
        );
    }

    return null;
}

function getFileExtension(fileName) {

    const parts =
        String(fileName || "")
            .toLowerCase()
            .split(".");

    return parts.length > 1
        ? parts.pop()
        : "";
}

function sanitizeFileName(fileName) {

    return String(fileName || "book")
        .replace(/\s+/g, "-")
        .replace(
            /[^a-zA-Z0-9._-]/g,
            ""
        )
        .replace(
            /-+/g,
            "-"
        );
}

function setSavingState(saving) {

    if (!saveButton) {
        return;
    }

    saveButton.disabled = saving;

    saveButton.textContent =
        saving
            ? "Saving..."
            : "Save Book";
}

function showMessage(message, type) {

    if (!messageBox) {
        return;
    }

    messageBox.textContent =
        message;

    messageBox.className =
        `message ${type}`;

    messageBox.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

function clearMessage() {

    if (!messageBox) {
        return;
    }

    messageBox.textContent = "";

    messageBox.className =
        "message";
}

const logoutButton =
    document.querySelector(".logout-button");

logoutButton?.addEventListener(
    "click",
    async event => {

        event.preventDefault();

        const { error } =
            await supabase.auth.signOut();

        if (error) {

            showMessage(
                "Unable to logout. Please try again.",
                "error"
            );

            return;
        }

        window.location.href =
            "../login.html";
    }
);