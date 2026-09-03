import { supabase } from "./supabase.js";

const form = document.getElementById("bookForm");

const bookCodeInput = document.getElementById("bookCode");
const titleInput = document.getElementById("title");
const authorInput = document.getElementById("author");
const publisherInput = document.getElementById("publisher");
const categoryInput = document.getElementById("category");
const availableInput = document.getElementById("available");
const bookFileInput = document.getElementById("bookFile");

const messageBox = document.getElementById("message");
const submitButton = form?.querySelector('button[type="submit"]');

const params = new URLSearchParams(window.location.search);
const bookId = params.get("id");

let currentBook = null;

document.addEventListener("DOMContentLoaded", () => {
    setupSidebar();
    setupLogout();
    loadBook();
});

async function loadBook() {
    if (!bookId) {
        showMessage("Book ID is missing.", "error");
        return;
    }

    try {
        const {
            data: book,
            error
        } = await supabase
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
            .single();

        if (error) {
            throw error;
        }

        if (!book) {
            throw new Error("Book not found.");
        }

        currentBook = book;

        fillForm(book);

    } catch (error) {
        console.error("Failed to load book:", error);

        showMessage(
            error.message || "Failed to load book.",
            "error"
        );
    }
}

function fillForm(book) {
    if (bookCodeInput) {
        bookCodeInput.value = book.book_code ?? "";
    }

    if (titleInput) {
        titleInput.value = book.title ?? "";
    }

    if (authorInput) {
        authorInput.value = book.author ?? "";
    }

    if (publisherInput) {
        publisherInput.value = book.publisher ?? "";
    }

    if (categoryInput) {
        categoryInput.value = book.category ?? "";
    }

    if (availableInput) {
        const available =
            Number(book.available) === 1 ? 1 : 0;

        if (availableInput.type === "checkbox") {
            availableInput.checked = available === 1;
        } else {
            availableInput.value = String(available);
        }
    }
}

form?.addEventListener(
    "submit",
    handleSubmit
);

async function handleSubmit(event) {
    event.preventDefault();

    if (!bookId) {
        showMessage(
            "Book ID is missing.",
            "error"
        );

        return;
    }

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

    const available =
        getAvailableValue();

    const updateData = {
        book_code: bookCode,
        title: title,
        author: author,
        publisher: publisher,
        category: category,
        available: available,
        updated_at: new Date().toISOString()
    };

    const newFile =
        bookFileInput?.files?.[0];

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Updating...";
    }

    try {

        if (newFile) {

            const fileName =
                `${Date.now()}-${crypto.randomUUID()}-${newFile.name}`;

            const filePath =
                `library/${fileName}`;

            const {
                error: uploadError
            } = await supabase
                .storage
                .from("books")
                .upload(
                    filePath,
                    newFile,
                    {
                        upsert: false
                    }
                );

            if (uploadError) {
                throw uploadError;
            }

            const {
                data: publicUrlData
            } = supabase
                .storage
                .from("books")
                .getPublicUrl(filePath);

            if (!publicUrlData?.publicUrl) {
                throw new Error(
                    "Failed to create the book file URL."
                );
            }

            updateData.book_file =
                publicUrlData.publicUrl;
        }

        const {
            error: updateError
        } = await supabase
            .from("books")
            .update(updateData)
            .eq("id", bookId);

        if (updateError) {
            throw updateError;
        }

        showMessage(
            "Book updated successfully.",
            "success"
        );

        setTimeout(() => {
            window.location.href =
                "/library/dashboard.html";
        }, 1000);

    } catch (error) {

        console.error(
            "Failed to update book:",
            error
        );

        showMessage(
            error.message ||
            "Failed to update book.",
            "error"
        );

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent =
                "Update Book";
        }
    }
}

function getAvailableValue() {
    if (!availableInput) {
        return 0;
    }

    if (availableInput.type === "checkbox") {
        return availableInput.checked ? 1 : 0;
    }

    const value =
        String(
            availableInput.value ?? ""
        )
            .trim()
            .toLowerCase();

    if (
        value === "1" ||
        value === "true" ||
        value === "yes" ||
        value === "available"
    ) {
        return 1;
    }

    return 0;
}

function showMessage(text, type) {
    if (!messageBox) {
        return;
    }

    messageBox.textContent = text;

    messageBox.className =
        `message ${type}`;

    messageBox.hidden = false;

    setTimeout(() => {
        messageBox.hidden = true;
    }, 4000);
}

function setupSidebar() {
    const toggle =
        document.getElementById(
            "sidebarToggle"
        );

    const sidebar =
        document.querySelector(
            ".admin-sidebar"
        );

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
        document.getElementById(
            "logoutButton"
        );

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
        "click",
        async () => {

            const {
                error
            } =
                await supabase.auth.signOut();

            if (error) {

                console.error(
                    "Logout error:",
                    error
                );

                showMessage(
                    "Unable to sign out.",
                    "error"
                );

                return;
            }

            window.location.href =
                "/login.html";
        }
    );
}