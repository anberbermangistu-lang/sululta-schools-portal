import { supabase } from "./supabase.js";

const feesTableBody = document.getElementById("feesTableBody");
const feeSearch = document.getElementById("feeSearch");
const statusFilter = document.getElementById("statusFilter");
const paymentMethodFilter = document.getElementById("paymentMethodFilter");
const refreshFees = document.getElementById("refreshFees");
const clearFiltersToolbar = document.getElementById("clearFiltersToolbar");
const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");

const totalFees = document.getElementById("totalFees");
const totalAmount = document.getElementById("totalAmount");
const paidAmount = document.getElementById("paidAmount");
const remainingAmount = document.getElementById("remainingAmount");

const feeRecordBadge = document.getElementById("feeRecordBadge");
const feeRecordSummary = document.getElementById("feeRecordSummary");
const message = document.getElementById("message");

let fees = [];
let filteredFees = [];

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function numberValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function money(value) {
    return numberValue(value).toFixed(2);
}

function getStudentId(fee) {
    return (
        fee.student_id ??
        fee.studentId ??
        fee.student ??
        fee.student_code ??
        "-"
    );
}

function getAmount(fee) {
    return numberValue(
        fee.amount ??
        fee.total_amount ??
        fee.fee_amount ??
        0
    );
}

function getPaidAmount(fee) {
    return numberValue(
        fee.paid_amount ??
        fee.paid ??
        fee.amount_paid ??
        0
    );
}

function getRemaining(fee) {
    if (
        fee.remaining_amount !== undefined &&
        fee.remaining_amount !== null
    ) {
        return numberValue(fee.remaining_amount);
    }

    if (
        fee.remaining !== undefined &&
        fee.remaining !== null
    ) {
        return numberValue(fee.remaining);
    }

    return Math.max(getAmount(fee) - getPaidAmount(fee), 0);
}

function getPaymentDate(fee) {
    return (
        fee.payment_date ??
        fee.date ??
        fee.paid_date ??
        fee.created_at ??
        null
    );
}

function getPaymentMethod(fee) {
    return (
        fee.payment_method ??
        fee.method ??
        "-"
    );
}

function getStatus(fee) {
    const status = String(
        fee.status ??
        ""
    ).trim().toLowerCase();

    if (status) {
        return status;
    }

    const amount = getAmount(fee);
    const paid = getPaidAmount(fee);

    if (paid <= 0) {
        return "unpaid";
    }

    if (paid >= amount) {
        return "paid";
    }

    return "partial";
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeHTML(value);
    }

    return date.toLocaleDateString();
}

function showMessage(text, type = "error") {
    if (!message) {
        return;
    }

    message.textContent = text;
    message.hidden = false;
    message.className = `message ${type}`;

    window.clearTimeout(showMessage.timer);

    showMessage.timer = window.setTimeout(() => {
        message.hidden = true;
    }, 5000);
}

function clearMessage() {
    if (!message) {
        return;
    }

    message.hidden = true;
    message.textContent = "";
}

function statusClass(status) {
    if (status === "paid") {
        return "status-active";
    }

    if (status === "partial") {
        return "status-warning";
    }

    return "status-inactive";
}

function renderActions(id) {
    const safeId = encodeURIComponent(id);

    return `
        <div class="action-buttons">
            <a
                href="/fees/view.html?id=${safeId}"
                class="action-btn action-view"
                title="View fee"
            >
                View
            </a>

            <a
                href="/fees/edit.html?id=${safeId}"
                class="action-btn action-edit"
                title="Edit fee"
            >
                Edit
            </a>

            <button
                type="button"
                class="action-btn action-delete"
                data-action="delete"
                data-id="${escapeHTML(id)}"
                title="Delete fee"
            >
                Delete
            </button>
        </div>
    `;
}

function renderStats() {
    const amount = fees.reduce(
        (sum, fee) => sum + getAmount(fee),
        0
    );

    const paid = fees.reduce(
        (sum, fee) => sum + getPaidAmount(fee),
        0
    );

    const remaining = fees.reduce(
        (sum, fee) => sum + getRemaining(fee),
        0
    );

    totalFees.textContent = fees.length;
    totalAmount.textContent = money(amount);
    paidAmount.textContent = money(paid);
    remainingAmount.textContent = money(remaining);
}

function renderTable() {
    if (!filteredFees.length) {
        feesTableBody.innerHTML = `
            <tr>
                <td
                    colspan="9"
                    class="table-empty"
                >
                    No fee records found.
                </td>
            </tr>
        `;

        feeRecordBadge.textContent = "0 Records";
        feeRecordSummary.textContent = "Showing 0 records";

        return;
    }

    feesTableBody.innerHTML = filteredFees.map(
        (fee, index) => {

            const id = fee.id;
            const status = getStatus(fee);
            const amount = getAmount(fee);
            const paid = getPaidAmount(fee);
            const remaining = getRemaining(fee);
            const paymentMethod = getPaymentMethod(fee);
            const studentId = getStudentId(fee);

            return `
                <tr>

                    <td>
                        ${index + 1}
                    </td>

                    <td>
                        ${escapeHTML(studentId)}
                    </td>

                    <td>
                        ${money(amount)}
                    </td>

                    <td>
                        ${money(paid)}
                    </td>

                    <td>
                        ${money(remaining)}
                    </td>

                    <td>
                        ${formatDate(getPaymentDate(fee))}
                    </td>

                    <td>
                        ${escapeHTML(paymentMethod)}
                    </td>

                    <td>
                        <span class="${statusClass(status)}">
                            ${escapeHTML(
                                status.charAt(0).toUpperCase() +
                                status.slice(1)
                            )}
                        </span>
                    </td>

                    <td>
                        ${renderActions(id)}
                    </td>

                </tr>
            `;
        }
    ).join("");

    feeRecordBadge.textContent =
        `${filteredFees.length} ${filteredFees.length === 1 ? "Record" : "Records"}`;

    feeRecordSummary.textContent =
        `Showing ${filteredFees.length} of ${fees.length} records`;
}

function applyFilters() {
    const search = feeSearch.value
        .trim()
        .toLowerCase();

    const status = statusFilter.value
        .trim()
        .toLowerCase();

    const paymentMethod = paymentMethodFilter.value
        .trim()
        .toLowerCase();

    filteredFees = fees.filter(fee => {

        const studentId = String(
            getStudentId(fee)
        ).toLowerCase();

        const method = String(
            getPaymentMethod(fee)
        ).toLowerCase();

        const feeStatus = getStatus(fee).toLowerCase();

        const matchesSearch =
            !search ||
            studentId.includes(search) ||
            method.includes(search);

        const matchesStatus =
            !status ||
            feeStatus === status;

        const matchesMethod =
            !paymentMethod ||
            method === paymentMethod;

        return (
            matchesSearch &&
            matchesStatus &&
            matchesMethod
        );
    });

    renderTable();
}

async function loadFees() {
    clearMessage();

    feesTableBody.innerHTML = `
        <tr>
            <td
                colspan="9"
                class="table-empty"
            >
                Loading fee records...
            </td>
        </tr>
    `;

    try {

        const { data, error } = await supabase
            .from("fees")
            .select("*")
            .order("id", {
                ascending: false
            });

        if (error) {
            throw error;
        }

        fees = Array.isArray(data)
            ? data
            : [];

        renderStats();
        applyFilters();

    } catch (error) {

        fees = [];
        filteredFees = [];

        renderStats();

        feesTableBody.innerHTML = `
            <tr>
                <td
                    colspan="9"
                    class="table-empty"
                >
                    Unable to load fee records.
                </td>
            </tr>
        `;

        feeRecordBadge.textContent = "0 Records";
        feeRecordSummary.textContent = "Showing 0 records";

        showMessage(
            error?.message ||
            "Unable to load fee records."
        );
    }
}

async function deleteFee(id) {
    const confirmed = window.confirm(
        "Are you sure you want to delete this fee record?"
    );

    if (!confirmed) {
        return;
    }

    try {

        const { error } = await supabase
            .from("fees")
            .delete()
            .eq("id", id);

        if (error) {
            throw error;
        }

        showMessage(
            "Fee record deleted successfully.",
            "success"
        );

        await loadFees();

    } catch (error) {

        showMessage(
            error?.message ||
            "Unable to delete fee record."
        );
    }
}

feesTableBody.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                '[data-action="delete"]'
            );

        if (!button) {
            return;
        }

        const id = button.dataset.id;

        if (!id) {
            return;
        }

        deleteFee(id);
    }
);

feeSearch.addEventListener(
    "input",
    applyFilters
);

statusFilter.addEventListener(
    "change",
    applyFilters
);

paymentMethodFilter.addEventListener(
    "change",
    applyFilters
);

clearFiltersToolbar?.addEventListener(
    "click",
    () => {

        feeSearch.value = "";
        statusFilter.value = "";
        paymentMethodFilter.value = "";

        applyFilters();
    }
);

refreshFees?.addEventListener(
    "click",
    loadFees
);

logoutButton?.addEventListener(
    "click",
    () => {

        window.location.href =
            "/login.html";
    }
);

sidebarToggle?.addEventListener(
    "click",
    () => {

        document.body.classList.toggle(
            "sidebar-collapsed"
        );
    }
);

loadFees();