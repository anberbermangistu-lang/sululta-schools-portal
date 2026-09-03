import { supabase } from "./supabase.js";

const tableBody = document.getElementById("historyTableBody");
const emptyState = document.getElementById("historyEmptyState");
const message = document.getElementById("historyMessage");

const searchInput = document.getElementById("historySearch");
const statusFilter = document.getElementById("historyStatusFilter");

const refreshButton = document.getElementById("refreshHistory");
const clearButton = document.getElementById("clearHistoryFilters");

const totalHistory = document.getElementById("totalHistory");
const borrowedCount = document.getElementById("borrowedCount");
const returnedCount = document.getElementById("returnedCount");

const studentName = document.getElementById("studentName");
const studentHeaderName = document.getElementById("studentHeaderName");
const studentAvatar = document.getElementById("studentAvatar");

const historyBadge = document.getElementById("historyBadge");
const historySummary = document.getElementById("historySummary");

const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".admin-sidebar");

let historyRecords = [];
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

    await loadHistory();
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

async function loadHistory() {

    showLoading();

    const {
        data,
        error
    } = await supabase
        .from("book_loans")
        .select(`
            id,
            student_id,
            book_id,
            borrow_date,
            return_date,
            status,
            books (
                id,
                book_code,
                title,
                author
            )
        `)
        .eq("student_id", currentStudent.id)
        .order("borrow_date", {
            ascending: false
        });

    if (error) {

        console.error(
            "Book history loading error:",
            error
        );

        historyRecords = [];

        updateStatistics();

        showError(error.message);

        return;
    }

    historyRecords = data || [];

    updateStatistics();
    renderHistory();
}

function renderHistory() {

    const search =
        String(
            searchInput?.value || ""
        )
            .trim()
            .toLowerCase();

    const status =
        String(
            statusFilter?.value || "all"
        )
            .trim()
            .toLowerCase();

    const filtered =
        historyRecords.filter(record => {

            const book =
                record.books || {};

            const title =
                String(book.title || "")
                    .toLowerCase();

            const author =
                String(book.author || "")
                    .toLowerCase();

            const bookCode =
                String(book.book_code || "")
                    .toLowerCase();

            const recordStatus =
                normalizeStatus(record.status);

            const matchesSearch =
                !search ||
                title.includes(search) ||
                author.includes(search) ||
                bookCode.includes(search) ||
                recordStatus.includes(search);

            const matchesStatus =
                status === "all" ||
                recordStatus === status;

            return (
                matchesSearch &&
                matchesStatus
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
                (record, index) =>
                    createHistoryRow(
                        record,
                        index
                    )
            )
            .join("");
}

function createHistoryRow(record, index) {

    const book =
        record.books || {};

    const status =
        normalizeStatus(record.status);

    const statusText =
        status === "returned"
            ? "Returned"
            : "Borrowed";

    const statusClass =
        status === "returned"
            ? "status-active"
            : "status-inactive";

    return `
        <tr>

            <td>
                ${index + 1}
            </td>

            <td>
                <strong>
                    ${escapeHtml(
                        book.title || "Unknown Book"
                    )}
                </strong>
            </td>

            <td>
                ${escapeHtml(
                    book.author || "N/A"
                )}
            </td>

            <td>
                ${formatDate(
                    record.borrow_date
                )}
            </td>

            <td>
                ${record.return_date
                    ? formatDate(record.return_date)
                    : "—"
                }
            </td>

            <td>

                <span class="student-status ${statusClass}">

                    <span class="status-dot"></span>

                    ${statusText}

                </span>

            </td>

        </tr>
    `;
}

function updateStatistics() {

    const total =
        historyRecords.length;

    const borrowed =
        historyRecords.filter(
            record =>
                normalizeStatus(
                    record.status
                ) === "borrowed"
        ).length;

    const returned =
        historyRecords.filter(
            record =>
                normalizeStatus(
                    record.status
                ) === "returned"
        ).length;

    if (totalHistory) {
        totalHistory.textContent = total;
    }

    if (borrowedCount) {
        borrowedCount.textContent = borrowed;
    }

    if (returnedCount) {
        returnedCount.textContent = returned;
    }

    if (historyBadge) {

        historyBadge.textContent =
            `${total} ${
                total === 1
                    ? "Record"
                    : "Records"
            }`;
    }
}

function updateRecordCount(count) {

    if (historyBadge) {

        historyBadge.textContent =
            `${count} ${
                count === 1
                    ? "Record"
                    : "Records"
            }`;
    }

    if (historySummary) {

        historySummary.textContent =
            `Showing ${count} ${
                count === 1
                    ? "record"
                    : "records"
            }`;
    }
}

function normalizeStatus(value) {

    const status =
        String(value ?? "")
            .trim()
            .toLowerCase();

    return status === "returned"
        ? "returned"
        : "borrowed";
}

function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}

function setupFilters() {

    searchInput?.addEventListener(
        "input",
        renderHistory
    );

    statusFilter?.addEventListener(
        "change",
        renderHistory
    );

    clearButton?.addEventListener(
        "click",
        () => {

            if (searchInput) {
                searchInput.value = "";
            }

            if (statusFilter) {
                statusFilter.value = "all";
            }

            renderHistory();
        }
    );

    refreshButton?.addEventListener(
        "click",
        loadHistory
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
                colspan="6"
                class="loading-cell">

                Loading history...

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
                colspan="6"
                class="loading-cell">

                <div class="empty-state">

                    <div class="empty-icon">
                        ⚠️
                    </div>

                    <h3>
                        Unable to Load History
                    </h3>

                    <p>
                        ${escapeHtml(errorText)}
                    </p>

                    <button
                        type="button"
                        class="btn btn-primary"
                        id="retryHistory">

                        ↻ Try Again

                    </button>

                </div>

            </td>

        </tr>
    `;

    document
        .getElementById("retryHistory")
        ?.addEventListener(
            "click",
            loadHistory
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

function escapeHtml(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}