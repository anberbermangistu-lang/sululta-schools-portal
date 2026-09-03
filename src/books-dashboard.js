import { supabase } from "./supabase.js";

const message = document.getElementById("message");

const totalBooks = document.getElementById("totalBooks");
const availableBooks = document.getElementById("availableBooks");
const borrowedBooks = document.getElementById("borrowedBooks");
const unavailableBooks = document.getElementById("unavailableBooks");

const bookSearch = document.getElementById("bookSearch");
const categoryFilter = document.getElementById("categoryFilter");
const statusFilter = document.getElementById("statusFilter");

const booksTableBody = document.getElementById("booksTableBody");
const bookRecordBadge = document.getElementById("bookRecordBadge");
const bookRecordSummary = document.getElementById("bookRecordSummary");

const refreshBooks = document.getElementById("refreshBooks");
const addBookButton = document.getElementById("addBookButton");

let books = [];

document.addEventListener("DOMContentLoaded", () => {
    setupEvents();
    setupSidebar();
    loadBooks();
});

function setupEvents() {
    bookSearch?.addEventListener("input", renderBooks);
    categoryFilter?.addEventListener("change", renderBooks);
    statusFilter?.addEventListener("change", renderBooks);

    refreshBooks?.addEventListener("click", loadBooks);

    addBookButton?.addEventListener("click", () => {
        window.location.href = "add.html";
    });

    booksTableBody?.addEventListener("click", handleTableAction);
}

async function loadBooks() {
    showMessage("", false);
    showLoading();

    try {
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
            .order("created_at", {
                ascending: false
            });

        if (error) {
            throw error;
        }

        books = data || [];

        updateStatistics();
        renderBooks();

    } catch (error) {
        console.error("Books loading error:", error);

        books = [];

        updateStatistics();

        booksTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="table-empty">
                    Unable to load book records.
                </td>
            </tr>
        `;

        updateRecordInfo(0);

        showMessage(
            error.message || "Unable to load books.",
            true
        );
    }
}

function updateStatistics() {
    const total = books.length;

    const available = books.filter(
        book => Number(book.available) > 0
    ).length;

    const borrowed = books.filter(
        book => Number(book.available) <= 0
    ).length;

    totalBooks.textContent = total;
    availableBooks.textContent = available;
    borrowedBooks.textContent = borrowed;
    unavailableBooks.textContent = 0;
}

function renderBooks() {
    const search = String(
        bookSearch?.value || ""
    )
        .trim()
        .toLowerCase();

    const category = String(
        categoryFilter?.value || ""
    )
        .trim()
        .toLowerCase();

    const status = String(
        statusFilter?.value || ""
    )
        .trim()
        .toLowerCase();

    const filteredBooks = books.filter(book => {
        const title = String(
            book.title || ""
        ).toLowerCase();

        const author = String(
            book.author || ""
        ).toLowerCase();

        const bookCode = String(
            book.book_code || ""
        ).toLowerCase();

        const publisher = String(
            book.publisher || ""
        ).toLowerCase();

        const bookCategory = String(
            book.category || ""
        ).toLowerCase();

        const bookStatus =
            Number(book.available) > 0
                ? "available"
                : "borrowed";

        const matchesSearch =
            !search ||
            title.includes(search) ||
            author.includes(search) ||
            bookCode.includes(search) ||
            publisher.includes(search);

        const matchesCategory =
            !category ||
            bookCategory === category;

        const matchesStatus =
            !status ||
            bookStatus === status;

        return (
            matchesSearch &&
            matchesCategory &&
            matchesStatus
        );
    });

    if (!filteredBooks.length) {
        booksTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="table-empty">
                    No books found.
                </td>
            </tr>
        `;

        updateRecordInfo(0);
        return;
    }

    booksTableBody.innerHTML = filteredBooks
        .map((book, index) =>
            createBookRow(book, index + 1)
        )
        .join("");

    updateRecordInfo(filteredBooks.length);
}

function createBookRow(book, number) {
    const title = escapeHtml(
        book.title || "Untitled"
    );

    const author = escapeHtml(
        book.author || "N/A"
    );

    const publisher = escapeHtml(
        book.publisher || "N/A"
    );

    const bookCode = escapeHtml(
        book.book_code || "N/A"
    );

    const category = escapeHtml(
        book.category || "Other"
    );

    const available =
        Number(book.available) > 0;

    const status =
        available
            ? "available"
            : "borrowed";

    const openButton =
        book.book_file
            ? `
                <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    data-action="open"
                    data-id="${book.id}"
                >
                    📖 Open
                </button>
            `
            : `
                <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    disabled
                >
                    No File
                </button>
            `;

    return `
        <tr>

            <td>
                ${number}
            </td>

            <td>
                <strong>
                    ${title}
                </strong>
            </td>

            <td>
                ${author}
            </td>

            <td>
                ${bookCode}
            </td>

            <td>
                ${category}
            </td>

            <td>
                ${available ? "Available" : "Borrowed"}
            </td>

            <td>
                <span class="status-badge ${getStatusClass(status)}">
                    ${capitalize(status)}
                </span>
            </td>

            <td>

                <div class="table-actions">

                    ${openButton}

                    <button
                        type="button"
                        class="btn btn-primary btn-sm"
                        data-action="edit"
                        data-id="${book.id}"
                    >
                        ✏️ Edit
                    </button>

                    <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        data-action="delete"
                        data-id="${book.id}"
                    >
                        🗑 Delete
                    </button>

                </div>

            </td>

        </tr>
    `;
}

function handleTableAction(event) {
    const button = event.target.closest(
        "button[data-action]"
    );

    if (!button) {
        return;
    }

    const id = button.dataset.id;
    const action = button.dataset.action;

    if (!id) {
        return;
    }

    const book = books.find(
        item => String(item.id) === String(id)
    );

    if (!book) {
        return;
    }

    if (action === "open") {
        openBook(book);
        return;
    }

    if (action === "edit") {
        window.location.href =
            `edit.html?id=${encodeURIComponent(id)}`;
        return;
    }

    if (action === "delete") {
        deleteBook(id);
    }
}

function openBook(book) {
    const fileUrl = String(
        book.book_file || ""
    ).trim();

    if (!fileUrl) {
        showMessage(
            "This book does not have a file.",
            true
        );
        return;
    }

    window.open(
        fileUrl,
        "_blank",
        "noopener,noreferrer"
    );
}

async function deleteBook(id) {
    const book = books.find(
        item => String(item.id) === String(id)
    );

    if (!book) {
        return;
    }

    const confirmed = window.confirm(
        `Delete "${book.title || "this book"}"?`
    );

    if (!confirmed) {
        return;
    }

    try {
        const { error } = await supabase
            .from("books")
            .delete()
            .eq("id", id);

        if (error) {
            throw error;
        }

        showMessage(
            "Book deleted successfully.",
            false
        );

        await loadBooks();

    } catch (error) {
        console.error(
            "Book deletion error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to delete book.",
            true
        );
    }
}

function showLoading() {
    if (!booksTableBody) {
        return;
    }

    booksTableBody.innerHTML = `
        <tr>
            <td colspan="8" class="table-empty">
                Loading book records...
            </td>
        </tr>
    `;
}

function updateRecordInfo(count) {
    if (bookRecordBadge) {
        bookRecordBadge.textContent =
            `${count} ${
                count === 1
                    ? "Record"
                    : "Records"
            }`;
    }

    if (bookRecordSummary) {
        bookRecordSummary.textContent =
            `Showing ${count} ${
                count === 1
                    ? "record"
                    : "records"
            }`;
    }
}

function getStatusClass(status) {
    if (status === "available") {
        return "status-active";
    }

    if (status === "borrowed") {
        return "status-warning";
    }

    return "status-inactive";
}

function capitalize(value) {
    const text = String(value || "");

    if (!text) {
        return "";
    }

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function showMessage(text, isError) {
    if (!message) {
        return;
    }

    if (!text) {
        message.hidden = true;
        message.textContent = "";
        return;
    }

    message.hidden = false;
    message.textContent = text;

    message.classList.toggle(
        "message-error",
        Boolean(isError)
    );

    message.classList.toggle(
        "message-success",
        !isError
    );
}

function setupSidebar() {
    document
        .getElementById("sidebarToggle")
        ?.addEventListener("click", () => {
            document
                .querySelector(".admin-sidebar")
                ?.classList.toggle("open");
        });
}

document
    .getElementById("logoutButton")
    ?.addEventListener("click", () => {
        window.location.href =
            "../login.html";
    });