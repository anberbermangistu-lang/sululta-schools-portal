import { supabase } from "./supabase.js";

const feeId = new URLSearchParams(window.location.search).get("id");

const message = document.getElementById("message");

const feeIdElement = document.getElementById("feeId");
const studentIdElement = document.getElementById("studentId");
const amountElement = document.getElementById("amount");
const paidAmountElement = document.getElementById("paidAmount");
const remainingAmountElement = document.getElementById("remainingAmount");
const paymentDateElement = document.getElementById("paymentDate");
const paymentMethodElement = document.getElementById("paymentMethod");
const statusElement = document.getElementById("status");
const createdAtElement = document.getElementById("createdAt");
const updatedAtElement = document.getElementById("updatedAt");

const feeStatusBadge = document.getElementById("feeStatusBadge");
const editFeeButton = document.getElementById("editFeeButton");
const printFeeButton = document.getElementById("printFeeButton");

const summaryAmount = document.getElementById("summaryAmount");
const summaryPaid = document.getElementById("summaryPaid");
const summaryRemaining = document.getElementById("summaryRemaining");

const sidebarToggle = document.getElementById("sidebarToggle");
const adminSidebar = document.querySelector(".admin-sidebar");
const logoutButton = document.getElementById("logoutButton");

function showMessage(text, type = "error") {
    if (!message) return;

    message.textContent = text;
    message.className = `message ${type} no-print`;
    message.hidden = false;
}

function hideMessage() {
    if (!message) return;

    message.hidden = true;
    message.textContent = "";
}

function formatMoney(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "0.00";
    }

    return number.toFixed(2);
}

function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString();
}

function formatDateTime(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString();
}

function formatText(value) {
    if (value === null || value === undefined || value === "") {
        return "—";
    }

    return String(value);
}

function normalizeStatus(status) {
    return String(status || "")
        .trim()
        .toLowerCase();
}

function setStatus(status) {
    const normalized = normalizeStatus(status);

    const label = normalized
        ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
        : "Unknown";

    statusElement.textContent = label;
    feeStatusBadge.textContent = label;

    feeStatusBadge.className = "record-badge";

    if (normalized === "paid") {
        feeStatusBadge.classList.add("status-paid");
    } else if (normalized === "partial") {
        feeStatusBadge.classList.add("status-partial");
    } else if (normalized === "unpaid") {
        feeStatusBadge.classList.add("status-unpaid");
    }
}

function displayFee(fee) {
    const amount = Number(fee.amount) || 0;
    const paidAmount = Number(fee.paid_amount) || 0;

    let remainingAmount;

    if (
        fee.remaining_amount !== null &&
        fee.remaining_amount !== undefined &&
        fee.remaining_amount !== ""
    ) {
        remainingAmount = Number(fee.remaining_amount);
    } else {
        remainingAmount = amount - paidAmount;
    }

    if (!Number.isFinite(remainingAmount)) {
        remainingAmount = amount - paidAmount;
    }

    feeIdElement.textContent = formatText(fee.id);
    studentIdElement.textContent = formatText(fee.student_id);

    amountElement.textContent = formatMoney(amount);
    paidAmountElement.textContent = formatMoney(paidAmount);
    remainingAmountElement.textContent = formatMoney(remainingAmount);

    paymentDateElement.textContent = formatDate(fee.payment_date);
    paymentMethodElement.textContent = formatText(fee.payment_method);

    setStatus(fee.status);

    createdAtElement.textContent = formatDateTime(fee.created_at);
    updatedAtElement.textContent = formatDateTime(fee.updated_at);

    summaryAmount.textContent = formatMoney(amount);
    summaryPaid.textContent = formatMoney(paidAmount);
    summaryRemaining.textContent = formatMoney(remainingAmount);

    if (editFeeButton && fee.id !== undefined && fee.id !== null) {
        editFeeButton.href =
            `/fees/edit.html?id=${encodeURIComponent(fee.id)}`;
    }

    document.title =
        `Fee #${fee.id} | Sululta Secondary School`;
}

async function loadFee() {
    hideMessage();

    if (!feeId) {
        feeStatusBadge.textContent = "Invalid";
        showMessage("Fee ID is missing.");
        return;
    }

    feeStatusBadge.textContent = "Loading...";

    const { data, error } = await supabase
        .from("fees")
        .select("*")
        .eq("id", feeId)
        .single();

    if (error) {
        console.error("Error loading fee:", error);

        feeStatusBadge.textContent = "Error";
        showMessage(
            error.message || "Unable to load fee record."
        );

        return;
    }

    if (!data) {
        feeStatusBadge.textContent = "Not Found";
        showMessage("Fee record not found.");
        return;
    }

    displayFee(data);
}

function setupPrint() {
    if (!printFeeButton) {
        return;
    }

    printFeeButton.addEventListener("click", () => {
        window.print();
    });
}

function setupSidebar() {
    if (!sidebarToggle || !adminSidebar) {
        return;
    }

    sidebarToggle.addEventListener("click", () => {
        adminSidebar.classList.toggle("collapsed");
        document.body.classList.toggle("sidebar-collapsed");
    });
}

function setupLogout() {
    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener("click", async () => {
        const { error } = await supabase.auth.signOut();

        if (error) {
            console.error("Logout error:", error);
            showMessage("Unable to sign out. Please try again.");
            return;
        }

        window.location.href = "/login.html";
    });
}

setupPrint();
setupSidebar();
setupLogout();
loadFee();