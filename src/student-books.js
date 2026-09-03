import { supabase } from "./supabase.js";

const tableBody = document.getElementById("booksTableBody");
const emptyState = document.getElementById("booksEmptyState");
const message = document.getElementById("bookMessage");

const searchInput = document.getElementById("bookSearch");
const categoryFilter = document.getElementById("categoryFilter");
const availabilityFilter = document.getElementById("availabilityFilter");

const refreshButton = document.getElementById("refreshBooks");
const clearButton = document.getElementById("clearBookFilters");

const totalBooks = document.getElementById("totalBooks");
const availableBooks = document.getElementById("availableBooks");
const totalCategories = document.getElementById("totalCategories");

const bookBadge = document.getElementById("bookBadge");
const bookSummary = document.getElementById("bookSummary");

const studentName = document.getElementById("studentName");
const studentHeaderName = document.getElementById("studentHeaderName");
const studentAvatar = document.getElementById("studentAvatar");

const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".admin-sidebar");

let books = [];
let currentStudent = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {

    setupSidebar();
    setupLogout();
    setupFilters();

    const student = await getCurrentStudent();

    if (!student) {
        return;
    }

    currentStudent = student;

    updateStudentProfile(student);

    await loadBooks();
}

async function getCurrentStudent() {

    const {
        data: {
            user
        },
        error
    } = await supabase.auth.getUser();

    if (error || !user) {

        window.location.href = "/login.html";

        return null;
    }

    const {
        data: profile,
        error: profileError
    } = await supabase
        .from("profiles")
        .select(`
            id,
            first_name,
            last_name,
            email,
            role,
            status
        `)
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile) {

        await supabase.auth.signOut();

        window.location.href = "/login.html";

        return null;
    }

    const role =
        String(profile.role || "")
            .trim()
            .toLowerCase();

    const status =
        String(profile.status || "")
            .trim()
            .toLowerCase();

    if (role !== "student" || status !== "active") {

        await supabase.auth.signOut();

        window.location.href = "/login.html";

        return null;
    }

    if (!profile.email) {

        showMessage(
            "Your student account does not have an email address.",
            "error"
        );

        return null;
    }

    const {
        data: student,
        error: studentError
    } = await supabase
        .from("students")
        .select(`
            id,
            student_id,
            first_name,
            last_name,
            email,
            photo_url,
            photo,
            status
        `)
        .ilike("email", profile.email)
        .maybeSingle();

    if (studentError) {

        console.error(
            "Student lookup error:",
            studentError
        );

        showMessage(
            studentError.message,
            "error"
        );

        return null;
    }

    if (!student) {

        showMessage(
            "Your student record was not found.",
            "error"
        );

        return null;
    }

    return student;
}

function updateStudentProfile(student) {

    const fullName =
        `${student.first_name || ""} ${student.last_name || ""}`
            .trim() || "Student";

    if (studentName) {
        studentName.textContent = fullName;
    }

    if (studentHeaderName) {
        studentHeaderName.textContent = fullName;
    }

    if (!studentAvatar) {
        return;
    }

    const photo =
        getPhotoUrl(
            student.photo_url ||
            student.photo
        );

    if (!photo) {

        studentAvatar.textContent =
            getInitials(
                student.first_name,
                student.last_name
            );

        return;
    }

    studentAvatar.innerHTML = "";

    const image =
        document.createElement("img");

    image.src = photo;
    image.alt = fullName;

    image.onerror = () => {

        studentAvatar.textContent =
            getInitials(
                student.first_name,
                student.last_name
            );
    };

    studentAvatar.appendChild(image);
}

async function loadBooks() {

    showLoading();

    const {
        data,
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
            book_file
        `)
        .order("title", {
            ascending: true
        });

    if (error) {

        console.error(
            "Book loading error:",
            error
        );

        books = [];

        updateStatistics();

        showError(error.message);

        return;
    }

    books = data || [];

    updateStatistics();

    populateCategoryFilter();

    renderBooks();
}

function renderBooks() {

    const search =
        String(
            searchInput?.value || ""
        )
            .trim()
            .toLowerCase();

    const category =
        String(
            categoryFilter?.value || "all"
        )
            .trim()
            .toLowerCase();

    const availability =
        String(
            availabilityFilter?.value || "all"
        )
            .trim()
            .toLowerCase();

    const filtered =
        books.filter(book => {

            const title =
                String(book.title || "")
                    .toLowerCase();

            const author =
                String(book.author || "")
                    .toLowerCase();

            const publisher =
                String(book.publisher || "")
                    .toLowerCase();

            const bookCode =
                String(book.book_code || "")
                    .toLowerCase();

            const bookCategory =
                String(book.category || "")
                    .toLowerCase();

            const matchesSearch =
                !search ||
                title.includes(search) ||
                author.includes(search) ||
                publisher.includes(search) ||
                bookCode.includes(search) ||
                bookCategory.includes(search);

            const matchesCategory =
                category === "all" ||
                bookCategory === category;

            const isAvailable =
                normalizeAvailability(book.available);

            const matchesAvailability =
                availability === "all" ||
                isAvailable === availability;

            return (
                matchesSearch &&
                matchesCategory &&
                matchesAvailability
            );
        });

    updateRecordCount(filtered.length);

    if (!filtered.length) {

        showEmptyState();

        return;
    }

    if (emptyState) {

        emptyState.hidden = true;
        emptyState.style.display = "none";
    }

    if (!tableBody) {
        return;
    }

    tableBody.innerHTML =
        filtered
            .map(
                (book, index) =>
                    createBookRow(book, index)
            )
            .join("");
}

function createBookRow(book, index) {

    const available =
        normalizeAvailability(
            book.available
        );

    const statusText =
        available === "available"
            ? "Available"
            : "Unavailable";

    const statusClass =
        available === "available"
            ? "status-active"
            : "status-inactive";

    const bookFile =
        getBookFile(book.book_file);

    const action =
        bookFile
            ? `
                <a
                    href="${escapeHtml(bookFile)}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="action-btn action-view">
                    📖 Open
                </a>
            `
            : `
                <span class="action-btn action-disabled">
                    No File
                </span>
            `;

    return `
        <tr>

            <td>
                ${index + 1}
            </td>

            <td>
                ${escapeHtml(
                    book.book_code || "N/A"
                )}
            </td>

            <td>
                <strong>
                    ${escapeHtml(
                        book.title || "Untitled"
                    )}
                </strong>
            </td>

            <td>
                ${escapeHtml(
                    book.author || "N/A"
                )}
            </td>

            <td>
                ${escapeHtml(
                    book.publisher || "N/A"
                )}
            </td>

            <td>
                ${escapeHtml(
                    book.category || "N/A"
                )}
            </td>

            <td>

                <span
                    class="student-status ${statusClass}">

                    <span class="status-dot"></span>

                    ${statusText}

                </span>

            </td>

            <td>

                <div class="action-buttons">

                    ${action}

                </div>

            </td>

        </tr>
    `;
}

function populateCategoryFilter() {

    if (!categoryFilter) {
        return;
    }

    const currentValue =
        categoryFilter.value || "all";

    const categories =
        [
            ...new Set(
                books
                    .map(book =>
                        String(
                            book.category || ""
                        ).trim()
                    )
                    .filter(Boolean)
            )
        ]
        .sort();

    categoryFilter.innerHTML = `
        <option value="all">
            All Categories
        </option>
    `;

    categories.forEach(category => {

        const option =
            document.createElement("option");

        option.value =
            category.toLowerCase();

        option.textContent =
            category;

        categoryFilter.appendChild(option);
    });

    const exists =
        [...categoryFilter.options]
            .some(
                option =>
                    option.value === currentValue
            );

    categoryFilter.value =
        exists
            ? currentValue
            : "all";
}

function updateStatistics() {

    const total =
        books.length;

    const available =
        books.filter(
            book =>
                normalizeAvailability(
                    book.available
                ) === "available"
        ).length;

    const categories =
        new Set(
            books
                .map(book =>
                    String(
                        book.category || ""
                    )
                        .trim()
                        .toLowerCase()
                )
                .filter(Boolean)
        ).size;

    if (totalBooks) {
        totalBooks.textContent = total;
    }

    if (availableBooks) {
        availableBooks.textContent = available;
    }

    if (totalCategories) {
        totalCategories.textContent = categories;
    }

    if (bookBadge) {

        bookBadge.textContent =
            `${total} ${
                total === 1
                    ? "Book"
                    : "Books"
            }`;
    }
}

function updateRecordCount(count) {

    if (bookBadge) {

        bookBadge.textContent =
            `${count} ${
                count === 1
                    ? "Book"
                    : "Books"
            }`;
    }

    if (bookSummary) {

        bookSummary.textContent =
            `Showing ${count} ${
                count === 1
                    ? "book"
                    : "books"
            }`;
    }
}

function normalizeAvailability(value) {

    const text =
        String(value ?? "")
            .trim()
            .toLowerCase();

    if (
        text === "1" ||
        text === "true" ||
        text === "available" ||
        text === "yes"
    ) {
        return "available";
    }

    return "unavailable";
}

function getBookFile(value) {

    if (!value) {
        return null;
    }

    const file =
        String(value).trim();

    if (!file) {
        return null;
    }

    if (
        file.startsWith("http://") ||
        file.startsWith("https://")
    ) {
        return file;
    }

    const path =
        file.replace(/^\/+/, "");

    const {
        data
    } =
        supabase.storage
            .from("books")
            .getPublicUrl(path);

    return data?.publicUrl || null;
}

function getPhotoUrl(value) {

    if (!value) {
        return null;
    }

    const photo =
        String(value).trim();

    if (!photo) {
        return null;
    }

    if (
        photo.startsWith("http://") ||
        photo.startsWith("https://")
    ) {
        return photo;
    }

    const path =
        photo.replace(/^\/+/, "");

    const {
        data
    } =
        supabase.storage
            .from("students")
            .getPublicUrl(path);

    return data?.publicUrl || null;
}

function getInitials(first, last) {

    const firstName =
        String(first || "").trim();

    const lastName =
        String(last || "").trim();

    if (firstName && lastName) {

        return (
            firstName[0] +
            lastName[0]
        ).toUpperCase();
    }

    if (firstName) {
        return firstName[0].toUpperCase();
    }

    if (lastName) {
        return lastName[0].toUpperCase();
    }

    return "S";
}

function setupFilters() {

    searchInput?.addEventListener(
        "input",
        renderBooks
    );

    categoryFilter?.addEventListener(
        "change",
        renderBooks
    );

    availabilityFilter?.addEventListener(
        "change",
        renderBooks
    );

    clearButton?.addEventListener(
        "click",
        () => {

            if (searchInput) {
                searchInput.value = "";
            }

            if (categoryFilter) {
                categoryFilter.value = "all";
            }

            if (availabilityFilter) {
                availabilityFilter.value = "all";
            }

            renderBooks();
        }
    );

    refreshButton?.addEventListener(
        "click",
        loadBooks
    );
}

function setupSidebar() {

    sidebarToggle?.addEventListener(
        "click",
        () => {

            sidebar?.classList.toggle(
                "mobile-open"
            );
        }
    );
}

function setupLogout() {

    logoutButton?.addEventListener(
        "click",
        async () => {

            const {
                error
            } =
                await supabase.auth.signOut();

            if (error) {

                showMessage(
                    error.message,
                    "error"
                );

                return;
            }

            window.location.href =
                "/login.html";
        }
    );
}

function showLoading() {

    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = `
        <tr>

            <td
                colspan="8"
                class="loading-cell">

                Loading books...

            </td>

        </tr>
    `;

    if (emptyState) {

        emptyState.hidden = true;
        emptyState.style.display = "none";
    }
}

function showEmptyState() {

    if (tableBody) {
        tableBody.innerHTML = "";
    }

    if (emptyState) {

        emptyState.hidden = false;
        emptyState.style.display = "flex";
    }
}

function showError(errorText) {

    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = `
        <tr>

            <td
                colspan="8"
                class="loading-cell">

                <div class="empty-state">

                    <div class="empty-icon">
                        ⚠️
                    </div>

                    <h3>
                        Unable to Load Library
                    </h3>

                    <p>
                        ${escapeHtml(errorText)}
                    </p>

                    <button
                        type="button"
                        class="btn btn-primary"
                        id="retryBooks">

                        ↻ Try Again

                    </button>

                </div>

            </td>

        </tr>
    `;

    document
        .getElementById("retryBooks")
        ?.addEventListener(
            "click",
            loadBooks
        );
}

function showMessage(
    text,
    type = "info"
) {

    if (!message) {
        return;
    }

    message.textContent = text;
    message.className =
        `message ${type}`;

    message.hidden = false;
}

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}