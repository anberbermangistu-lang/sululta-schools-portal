import { supabase } from "./supabase.js";

const loadingCard = document.getElementById("loadingCard");
const deleteContent = document.getElementById("deleteContent");
const errorCard = document.getElementById("errorCard");

const errorMessage = document.getElementById("errorMessage");
const formMessage = document.getElementById("formMessage");
const deleteButton = document.getElementById("deleteButton");

const studentName = document.getElementById("studentName");
const studentId = document.getElementById("studentId");
const amount = document.getElementById("amount");
const paidAmount = document.getElementById("paidAmount");
const balance = document.getElementById("balance");
const paymentDate = document.getElementById("paymentDate");
const paymentMethod = document.getElementById("paymentMethod");
const paymentStatus = document.getElementById("paymentStatus");

const params = new URLSearchParams(window.location.search);
const feeId = params.get("id");

let feeRecord = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    if (!feeId) {
        showError("No fee record ID was provided.");
        return;
    }

    await loadFee();
}

async function loadFee() {
    try {
        const { data, error } = await supabase
            .from("fees")
            .select(`
                id,
                student_id,
                amount,
                paid_amount,
                payment_date,
                payment_method,
                status,
                students (
                    id,
                    student_id,
                    first_name,
                    last_name,
                    class,
                    section
                )
            `)
            .eq("id", feeId)
            .single();

        if (error) {
            console.error("Failed to load fee:", error);
            showError(error.message);
            return;
        }

        if (!data) {
            showError("The requested fee record was not found.");
            return;
        }

        feeRecord = data;
        displayFee(data);

    } catch (error) {
        console.error("Unexpected error:", error);
        showError(error.message);
    }
}

function displayFee(fee) {
    const student = fee.students || {};

    const total = Number(fee.amount || 0);
    const paid = Number(fee.paid_amount || 0);
    const remaining = Math.max(total - paid, 0);

    const name =
        `${student.first_name || ""} ${student.last_name || ""}`.trim();

    studentName.textContent = name || "Unknown Student";
    studentId.textContent = student.student_id || "-";

    amount.textContent = `ETB ${formatMoney(total)}`;
    paidAmount.textContent = `ETB ${formatMoney(paid)}`;
    balance.textContent = `ETB ${formatMoney(remaining)}`;

    paymentDate.textContent = formatDate(fee.payment_date);
    paymentMethod.textContent = fee.payment_method || "-";
    paymentStatus.textContent = fee.status || "-";

    loadingCard.style.display = "none";
    errorCard.style.display = "none";
    deleteContent.style.display = "block";
}

async function deleteFee() {
    if (!feeRecord) {
        showMessage(
            "Fee information is not available.",
            "error"
        );
        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to permanently delete this fee record?"
    );

    if (!confirmed) {
        return;
    }

    deleteButton.disabled = true;
    deleteButton.textContent = "Deleting...";
    hideMessage();

    try {
        const { error } = await supabase
            .from("fees")
            .delete()
            .eq("id", feeRecord.id);

        if (error) {
            console.error("Failed to delete fee:", error);

            showMessage(
                `Failed to delete fee: ${error.message}`,
                "error"
            );

            deleteButton.disabled = false;
            deleteButton.textContent = "🗑️ Delete Fee Permanently";
            return;
        }

        showMessage(
            "Fee deleted successfully.",
            "success"
        );

        deleteButton.textContent = "✓ Deleted";

        setTimeout(() => {
            window.location.href =
                `dashboard.html?deleted=${Date.now()}`;
        }, 900);

    } catch (error) {
        console.error("Unexpected delete error:", error);

        showMessage(
            `Failed to delete fee: ${error.message}`,
            "error"
        );

        deleteButton.disabled = false;
        deleteButton.textContent = "🗑️ Delete Fee Permanently";
    }
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(value) {
    if (!value) {
        return "—";
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

function showMessage(text, type) {
    formMessage.textContent = text;
    formMessage.className = `form-message ${type}`;
    formMessage.style.display = "block";
}

function hideMessage() {
    formMessage.textContent = "";
    formMessage.className = "form-message";
    formMessage.style.display = "none";
}

function showError(text) {
    loadingCard.style.display = "none";
    deleteContent.style.display = "none";
    errorCard.style.display = "block";

    errorMessage.textContent =
        text || "Unable to load the requested fee.";
}

deleteButton?.addEventListener("click", deleteFee);