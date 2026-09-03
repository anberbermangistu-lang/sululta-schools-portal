import { supabase } from "./supabase.js";

const messageBox = document.getElementById("messageBox");

const loadingState = document.getElementById("loadingState");
const errorState = document.getElementById("errorState");
const deleteContent = document.getElementById("deleteContent");

const errorMessage = document.getElementById("errorMessage");
const retryButton = document.getElementById("retryButton");
const deleteButton = document.getElementById("deleteBookButton");

const bookTitle = document.getElementById("bookTitle");
const bookCode = document.getElementById("bookCode");
const bookAuthor = document.getElementById("bookAuthor");

const sidebarToggle = document.getElementById("sidebarToggle");

let bookId = null;
let currentBook = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    setupSidebar();

    const params = new URLSearchParams(
        window.location.search
    );

    bookId = params.get("id");

    retryButton?.addEventListener(
        "click",
        loadBook
    );

    deleteButton?.addEventListener(
        "click",
        deleteBook
    );

    if (!bookId) {
        showError("No book ID was provided.");
        return;
    }

    await loadBook();
}

function setupSidebar() {
    const sidebar =
        document.querySelector(".admin-sidebar");

    sidebarToggle?.addEventListener(
        "click",
        event => {
            event.stopPropagation();

            sidebar?.classList.toggle("open");
        }
    );

    document.addEventListener(
        "click",
        event => {
            if (
                window.innerWidth <= 900 &&
                sidebar?.classList.contains("open") &&
                !sidebar.contains(event.target) &&
                !sidebarToggle?.contains(event.target)
            ) {
                sidebar.classList.remove("open");
            }
        }
    );
}

async function loadBook() {
    showLoading();

    const { data, error } = await supabase
        .from("books")
        .select(`
            id,
            book_code,
            title,
            author,
            publisher,
            category,
            available,
            book_file,
            created_at,
            updated_at
        `)
        .eq("id", bookId)
        .maybeSingle();

    if (error) {
        console.error(
            "Failed to load book:",
            error
        );

        showError(
            "Unable to load this book. Please check your database connection."
        );

        return;
    }

    if (!data) {
        showError(
            "The requested book could not be found."
        );

        return;
    }

    currentBook = data;

    renderBook(data);
}

function renderBook(book) {
    if (bookTitle) {
        bookTitle.textContent =
            book.title || "Untitled Book";
    }

    if (bookCode) {
        bookCode.textContent =
            `Book Code: ${book.book_code || "N/A"}`;
    }

    if (bookAuthor) {
        bookAuthor.textContent =
            `Author: ${book.author || "N/A"}`;
    }

    if (loadingState) {
        loadingState.hidden = true;
    }

    if (errorState) {
        errorState.hidden = true;
    }

    if (deleteContent) {
        deleteContent.hidden = false;
    }

    document.title =
        `Delete ${book.title || "Book"} | Sululta School Portal`;
}

async function deleteBook() {
    if (!currentBook) {
        showMessage(
            "Book information is not available.",
            "error"
        );

        return;
    }

    const confirmed = window.confirm(
        `Are you sure you want to permanently delete "${currentBook.title}"?`
    );

    if (!confirmed) {
        return;
    }

    setDeletingState(true);

    const { error } = await supabase
        .from("books")
        .delete()
        .eq("id", currentBook.id);

    if (error) {
        console.error(
            "Failed to delete book:",
            error
        );

        setDeletingState(false);

        showMessage(
            getDeleteError(error),
            "error"
        );

        return;
    }

    if (currentBook.book_file) {
        await removeBookFile(
            currentBook.book_file
        );
    }

    showMessage(
        "Book deleted successfully.",
        "success"
    );

    setTimeout(() => {
        window.location.href =
            "dashboard.html";
    }, 900);
}

async function removeBookFile(fileValue) {
    const path =
        getStoragePath(fileValue);

    if (!path) {
        return;
    }

    const { error } = await supabase.storage
        .from("books")
        .remove([path]);

    if (error) {
        console.warn(
            "Book record deleted, but the storage file could not be removed:",
            error
        );
    }
}

function getStoragePath(fileValue) {
    if (!fileValue) {
        return null;
    }

    const value =
        String(fileValue).trim();

    if (!value) {
        return null;
    }

    if (
        value.startsWith("http://") ||
        value.startsWith("https://")
    ) {
        try {
            const url = new URL(value);

            const marker =
                "/storage/v1/object/public/books/";

            const index =
                url.pathname.indexOf(marker);

            if (index === -1) {
                return null;
            }

            return decodeURIComponent(
                url.pathname.substring(
                    index + marker.length
                )
            );
        } catch {
            return null;
        }
    }

    let path =
        value.replace(/^\/+/, "");

    if (path.startsWith("books/")) {
        path = path.substring(6);
    }

    return path;
}

function getDeleteError(error) {
    if (!error) {
        return "Unable to delete the book.";
    }

    if (error.code === "42501") {
        return "You do not have permission to delete this book.";
    }

    return error.message ||
        "Unable to delete the book. Please try again.";
}

function setDeletingState(deleting) {
    if (!deleteButton) {
        return;
    }

    deleteButton.disabled = deleting;

    deleteButton.textContent =
        deleting
            ? "Deleting Book..."
            : "🗑 Delete Book";
}

function showLoading() {
    if (loadingState) {
        loadingState.hidden = false;
    }

    if (errorState) {
        errorState.hidden = true;
    }

    if (deleteContent) {
        deleteContent.hidden = true;
    }
}

function showError(message) {
    if (loadingState) {
        loadingState.hidden = true;
    }

    if (deleteContent) {
        deleteContent.hidden = true;
    }

    if (errorState) {
        errorState.hidden = false;
    }

    if (errorMessage) {
        errorMessage.textContent = message;
    }
}

function showMessage(
    message,
    type = "success"
) {
    if (!messageBox) {
        return;
    }

    messageBox.textContent = message;

    messageBox.className =
        `message ${type}`;

    setTimeout(() => {
        if (!messageBox) {
            return;
        }

        messageBox.textContent = "";

        messageBox.className =
            "message";
    }, 4000);
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