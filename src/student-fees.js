import { supabase } from "./supabase.js";

const studentName = document.getElementById("studentName");
const studentHeaderName = document.getElementById("studentHeaderName");
const studentAvatar = document.getElementById("studentAvatar");

const totalFees = document.getElementById("totalFees");
const totalPaid = document.getElementById("totalPaid");
const totalBalance = document.getElementById("totalBalance");

const feesBadge = document.getElementById("feesBadge");
const feesSummary = document.getElementById("feesSummary");
const feesTableBody = document.getElementById("feesTableBody");
const feesEmptyState = document.getElementById("feesEmptyState");

const feesSearch = document.getElementById("feesSearch");
const feesStatusFilter = document.getElementById("feesStatusFilter");
const clearFeesFilters = document.getElementById("clearFeesFilters");
const refreshFees = document.getElementById("refreshFees");

const feesMessage = document.getElementById("feesMessage");

const sidebarToggle = document.getElementById("sidebarToggle");
const logoutButton = document.getElementById("logoutButton");

let allFees = [];
let currentStudent = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    setupEvents();
    await loadStudentAndFees();
}

function setupEvents() {
    feesSearch?.addEventListener("input", populateTable);

    feesStatusFilter?.addEventListener(
        "change",
        populateTable
    );

    clearFeesFilters?.addEventListener(
        "click",
        clearFilters
    );

    refreshFees?.addEventListener(
        "click",
        refreshPage
    );

    sidebarToggle?.addEventListener(
        "click",
        () => {
            document
                .querySelector(".admin-page")
                ?.classList.toggle("sidebar-collapsed");
        }
    );

    logoutButton?.addEventListener(
        "click",
        logout
    );
}

async function loadStudentAndFees() {
    try {
        showLoading();

        hideMessage();

        const {
            data: {
                user
            },
            error: authError
        } = await supabase.auth.getUser();

        if (authError) {
            throw authError;
        }

        if (!user) {
            window.location.href = "/login.html";
            return;
        }

        const email = String(
            user.email || ""
        )
            .trim()
            .toLowerCase();

        if (!email) {
            throw new Error(
                "Your account email could not be found."
            );
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
                gender,
                date_of_birth,
                class,
                section,
                phone,
                email,
                address,
                photo,
                photo_url,
                status
            `)
            .ilike("email", email)
            .maybeSingle();

        if (studentError) {
            console.error(
                "Student lookup error:",
                studentError
            );

            throw new Error(
                studentError.message
            );
        }

        if (!student) {
            throw new Error(
                "No student record is linked to this account."
            );
        }

        currentStudent = student;

        updateStudentProfile(student);

        await loadFees();

    } catch (error) {
        console.error(
            "Fees page error:",
            error
        );

        showMessage(
            error?.message ||
            "Unable to load your fee records.",
            "error"
        );

        showTableError(
            error?.message ||
            "Unable to load fee records."
        );
    }
}

async function loadFees() {
    if (!currentStudent) {
        return;
    }

    const databaseStudentId = Number(
        currentStudent.id
    );

    if (!Number.isInteger(databaseStudentId)) {
        throw new Error(
            "Invalid student database ID."
        );
    }

    console.log(
        "Loading fees for students.id:",
        databaseStudentId
    );

    const {
        data,
        error
    } = await supabase
        .from("fees")
        .select(`
            id,
            student_id,
            amount,
            paid_amount,
            payment_date,
            payment_method,
            status,
            created_at,
            updated_at
        `)
        .eq(
            "student_id",
            databaseStudentId
        )
        .order(
            "payment_date",
            {
                ascending: false
            }
        )
        .order(
            "created_at",
            {
                ascending: false
            }
        );

    if (error) {
        console.error(
            "Fees query error:",
            error
        );

        throw new Error(
            error.message
        );
    }

    allFees = Array.isArray(data)
        ? data
        : [];

    console.log(
        "Fees loaded:",
        allFees
    );

    updateStatistics();

    populateTable();
}

function updateStudentProfile(student) {
    const fullName =
        `${student.first_name || ""} ${student.last_name || ""}`
            .trim() ||
        "Student";

    if (studentName) {
        studentName.textContent =
            fullName;
    }

    if (studentHeaderName) {
        studentHeaderName.textContent =
            fullName;
    }

    if (studentAvatar) {
        const initials =
            getInitials(
                student.first_name,
                student.last_name
            );

        studentAvatar.textContent =
            initials;

        const photo =
            getPhotoUrl(
                student.photo_url ||
                student.photo
            );

        if (photo) {
            const image =
                document.createElement("img");

            image.src = photo;

            image.alt = fullName;

            image.onerror = () => {
                studentAvatar.innerHTML = "";

                studentAvatar.textContent =
                    initials;
            };

            studentAvatar.innerHTML = "";

            studentAvatar.appendChild(
                image
            );
        }
    }
}

function updateStatistics() {
    const total =
        allFees.reduce(
            (sum, fee) =>
                sum +
                Number(
                    fee.amount || 0
                ),
            0
        );

    const paid =
        allFees.reduce(
            (sum, fee) =>
                sum +
                Number(
                    fee.paid_amount || 0
                ),
            0
        );

    const balance =
        Math.max(
            total - paid,
            0
        );

    if (totalFees) {
        totalFees.textContent =
            formatMoney(total);
    }

    if (totalPaid) {
        totalPaid.textContent =
            formatMoney(paid);
    }

    if (totalBalance) {
        totalBalance.textContent =
            formatMoney(balance);
    }

    if (feesBadge) {
        feesBadge.textContent =
            `${allFees.length} ${
                allFees.length === 1
                    ? "Record"
                    : "Records"
            }`;
    }
}

function getFilteredFees() {
    const searchTerm =
        String(
            feesSearch?.value || ""
        )
            .trim()
            .toLowerCase();

    const selectedStatus =
        String(
            feesStatusFilter?.value ||
            "all"
        )
            .trim()
            .toLowerCase();

    return allFees.filter(
        fee => {

            const status =
                normalizeStatus(
                    fee.status
                );

            if (
                selectedStatus !== "all" &&
                status !== selectedStatus
            ) {
                return false;
            }

            if (!searchTerm) {
                return true;
            }

            const searchableText = [
                fee.amount,
                fee.paid_amount,
                fee.payment_date,
                fee.payment_method,
                fee.status
            ]
                .map(
                    value =>
                        String(
                            value ?? ""
                        )
                )
                .join(" ")
                .toLowerCase();

            return searchableText.includes(
                searchTerm
            );
        }
    );
}

function populateTable() {
    if (!feesTableBody) {
        return;
    }

    const filteredFees =
        getFilteredFees();

    feesTableBody.innerHTML = "";

    if (feesSummary) {
        feesSummary.textContent =
            `Showing ${filteredFees.length} ${
                filteredFees.length === 1
                    ? "record"
                    : "records"
            }`;
    }

    if (filteredFees.length === 0) {

        if (feesEmptyState) {
            feesEmptyState.hidden =
                false;
        }

        const row =
            document.createElement("tr");

        const cell =
            document.createElement("td");

        cell.colSpan = 7;

        cell.className =
            "table-empty";

        cell.textContent =
            allFees.length === 0
                ? "No fee records available."
                : "No fee records match your search or filter.";

        row.appendChild(cell);

        feesTableBody.appendChild(
            row
        );

        return;
    }

    if (feesEmptyState) {
        feesEmptyState.hidden =
            true;
    }

    filteredFees.forEach(
        (fee, index) => {

            const amount =
                Number(
                    fee.amount || 0
                );

            const paid =
                Number(
                    fee.paid_amount || 0
                );

            const balance =
                Math.max(
                    amount - paid,
                    0
                );

            const row =
                document.createElement("tr");

            const numberCell =
                document.createElement("td");

            numberCell.textContent =
                index + 1;

            const amountCell =
                document.createElement("td");

            amountCell.textContent =
                formatMoney(amount);

            const paidCell =
                document.createElement("td");

            paidCell.textContent =
                formatMoney(paid);

            const balanceCell =
                document.createElement("td");

            balanceCell.textContent =
                formatMoney(balance);

            const dateCell =
                document.createElement("td");

            dateCell.textContent =
                formatDate(
                    fee.payment_date
                );

            const methodCell =
                document.createElement("td");

            methodCell.textContent =
                fee.payment_method ||
                "-";

            const statusCell =
                document.createElement("td");

            const badge =
                document.createElement("span");

            badge.className =
                getStatusClass(
                    fee.status
                );

            badge.textContent =
                fee.status ||
                "Unknown";

            statusCell.appendChild(
                badge
            );

            row.appendChild(
                numberCell
            );

            row.appendChild(
                amountCell
            );

            row.appendChild(
                paidCell
            );

            row.appendChild(
                balanceCell
            );

            row.appendChild(
                dateCell
            );

            row.appendChild(
                methodCell
            );

            row.appendChild(
                statusCell
            );

            feesTableBody.appendChild(
                row
            );
        }
    );
}

function clearFilters() {
    if (feesSearch) {
        feesSearch.value = "";
    }

    if (feesStatusFilter) {
        feesStatusFilter.value =
            "all";
    }

    populateTable();
}

async function refreshPage() {
    try {
        if (refreshFees) {
            refreshFees.disabled =
                true;

            refreshFees.textContent =
                "↻ Loading...";
        }

        hideMessage();

        await loadStudentAndFees();

    } catch (error) {
        console.error(
            "Refresh error:",
            error
        );

        showMessage(
            error?.message ||
            "Unable to refresh fees.",
            "error"
        );

    } finally {
        if (refreshFees) {
            refreshFees.disabled =
                false;

            refreshFees.textContent =
                "↻ Refresh";
        }
    }
}

function showLoading() {
    if (!feesTableBody) {
        return;
    }

    feesTableBody.innerHTML = `
        <tr>
            <td
                colspan="7"
                class="table-empty"
            >
                Loading your fee records...
            </td>
        </tr>
    `;

    if (feesEmptyState) {
        feesEmptyState.hidden =
            true;
    }
}

function showTableError(message) {
    if (!feesTableBody) {
        return;
    }

    feesTableBody.innerHTML = "";

    const row =
        document.createElement("tr");

    const cell =
        document.createElement("td");

    cell.colSpan = 7;

    cell.className =
        "table-empty";

    cell.textContent =
        message;

    row.appendChild(cell);

    feesTableBody.appendChild(
        row
    );

    if (feesEmptyState) {
        feesEmptyState.hidden =
            true;
    }
}

function showMessage(
    message,
    type = "error"
) {
    if (!feesMessage) {
        return;
    }

    feesMessage.textContent =
        message;

    feesMessage.className =
        `message ${type}`;

    feesMessage.hidden =
        false;
}

function hideMessage() {
    if (!feesMessage) {
        return;
    }

    feesMessage.textContent =
        "";

    feesMessage.hidden =
        true;
}

async function logout() {
    try {
        if (logoutButton) {
            logoutButton.disabled =
                true;
        }

        const {
            error
        } =
            await supabase.auth.signOut();

        if (error) {
            throw error;
        }

        window.location.href =
            "/login.html";

    } catch (error) {
        console.error(
            "Logout error:",
            error
        );

        showMessage(
            "Unable to logout. Please try again.",
            "error"
        );

        if (logoutButton) {
            logoutButton.disabled =
                false;
        }
    }
}

function formatMoney(value) {
    const number =
        Number(value || 0);

    return number.toLocaleString(
        "en-US",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    );
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    const date =
        new Date(
            `${value}T00:00:00`
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return value;
    }

    return date.toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}

function normalizeStatus(status) {
    return String(
        status || ""
    )
        .trim()
        .toLowerCase();
}

function getStatusClass(status) {
    const normalized =
        normalizeStatus(status);

    if (normalized === "paid") {
        return "status-badge status-active";
    }

    if (normalized === "partial") {
        return "status-badge status-pending";
    }

    if (
        normalized === "unpaid" ||
        normalized === "pending"
    ) {
        return "status-badge status-inactive";
    }

    return "status-badge";
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

    const path =
        value.replace(/^\/+/, "");

    const {
        data
    } =
        supabase.storage
            .from("students")
            .getPublicUrl(path);

    return data?.publicUrl ||
        null;
}

function getInitials(
    first,
    last
) {
    const firstName =
        String(
            first || ""
        ).trim();

    const lastName =
        String(
            last || ""
        ).trim();

    if (
        firstName &&
        lastName
    ) {
        return (
            firstName[0] +
            lastName[0]
        ).toUpperCase();
    }

    if (firstName) {
        return firstName[0]
            .toUpperCase();
    }

    if (lastName) {
        return lastName[0]
            .toUpperCase();
    }

    return "S";
}