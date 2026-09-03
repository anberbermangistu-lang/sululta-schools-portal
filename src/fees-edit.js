import { supabase } from "./supabase.js";

const form = document.getElementById("feeForm");
const loadingCard = document.getElementById("loadingCard");
const editContent = document.getElementById("editContent");
const errorCard = document.getElementById("errorCard");
const errorMessage = document.getElementById("errorMessage");

const studentInput = document.getElementById("student_id");
const amountInput = document.getElementById("amount");
const paidInput = document.getElementById("paid_amount");
const dateInput = document.getElementById("payment_date");
const methodInput = document.getElementById("payment_method");
const statusInput = document.getElementById("status");

const balanceDisplay = document.getElementById("balanceDisplay");
const formMessage = document.getElementById("formMessage");
const saveButton = document.getElementById("saveButton");

const params = new URLSearchParams(window.location.search);
const feeId = params.get("id");

let currentFee = null;

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
                created_at,
                updated_at
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

        currentFee = data;

        await loadStudents();

        populateForm(data);

        loadingCard.style.display = "none";
        editContent.style.display = "block";

    } catch (error) {
        console.error("Unexpected error:", error);
        showError(error.message);
    }
}

async function loadStudents() {
    studentInput.innerHTML = `
        <option value="">Loading students...</option>
    `;

    studentInput.disabled = true;

    const { data, error } = await supabase
        .from("students")
        .select(`
            id,
            student_id,
            first_name,
            last_name,
            class,
            section
        `)
        .order("first_name", { ascending: true });

    if (error) {
        console.error("Failed to load students:", error);
        throw new Error(`Failed to load students: ${error.message}`);
    }

    if (!data || data.length === 0) {
        throw new Error("No students are registered in the system.");
    }

    studentInput.innerHTML = `
        <option value="">Select a student</option>
        ${data.map(student => `
            <option value="${student.id}">
                ${escapeHtml(formatStudent(student))}
            </option>
        `).join("")}
    `;

    studentInput.disabled = false;
}

function populateForm(fee) {
    studentInput.value = String(fee.student_id);

    amountInput.value = fee.amount ?? "";
    paidInput.value = fee.paid_amount ?? "";
    dateInput.value = fee.payment_date ?? "";
    methodInput.value = fee.payment_method ?? "";
    statusInput.value = fee.status ?? "";

    calculateBalance();
}

function calculateBalance() {
    const amount = Number(amountInput.value) || 0;
    const paid = Number(paidInput.value) || 0;

    const balance = Math.max(amount - paid, 0);

    balanceDisplay.textContent = `ETB ${formatMoney(balance)}`;

    balanceDisplay.classList.remove(
        "balance-paid",
        "balance-due"
    );

    if (amount > 0 && balance === 0) {
        balanceDisplay.classList.add("balance-paid");
    } else if (balance > 0) {
        balanceDisplay.classList.add("balance-due");
    }

    updateStatusFromAmounts();
}

function updateStatusFromAmounts() {
    const amount = Number(amountInput.value) || 0;
    const paid = Number(paidInput.value) || 0;

    if (amount <= 0) {
        return;
    }

    if (paid >= amount) {
        statusInput.value = "Paid";
    } else if (paid > 0) {
        statusInput.value = "Partial";
    } else {
        statusInput.value = "Unpaid";
    }
}

function validateForm() {
    const studentId = studentInput.value;
    const amount = Number(amountInput.value);
    const paid = Number(paidInput.value);
    const paymentDate = dateInput.value;
    const paymentMethod = methodInput.value;
    const status = statusInput.value;

    if (!studentId) {
        showMessage("Please select a student.", "error");
        studentInput.focus();
        return false;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        showMessage(
            "Please enter a valid total fee amount greater than 0.",
            "error"
        );
        amountInput.focus();
        return false;
    }

    if (!Number.isFinite(paid) || paid < 0) {
        showMessage(
            "Please enter a valid paid amount.",
            "error"
        );
        paidInput.focus();
        return false;
    }

    if (paid > amount) {
        showMessage(
            "Paid amount cannot be greater than the total fee.",
            "error"
        );
        paidInput.focus();
        return false;
    }

    if (!paymentDate) {
        showMessage(
            "Please select the payment date.",
            "error"
        );
        dateInput.focus();
        return false;
    }

    if (!paymentMethod) {
        showMessage(
            "Please select a payment method.",
            "error"
        );
        methodInput.focus();
        return false;
    }

    if (!status) {
        showMessage(
            "Please select the payment status.",
            "error"
        );
        statusInput.focus();
        return false;
    }

    return true;
}

async function updateFee(event) {
    event.preventDefault();

    hideMessage();

    if (!validateForm()) {
        return;
    }

    const studentId = Number(studentInput.value);
    const amount = Number(amountInput.value);
    const paidAmount = Number(paidInput.value);
    const paymentDate = dateInput.value;
    const paymentMethod = methodInput.value;
    const status = statusInput.value;

    saveButton.disabled = true;
    saveButton.textContent = "Updating...";

    try {
        const { error } = await supabase
            .from("fees")
            .update({
                student_id: studentId,
                amount,
                paid_amount: paidAmount,
                payment_date: paymentDate,
                payment_method: paymentMethod,
                status,
                updated_at: new Date().toISOString()
            })
            .eq("id", feeId);

        if (error) {
            console.error("Failed to update fee:", error);

            showMessage(
                `Failed to update fee: ${error.message}`,
                "error"
            );

            saveButton.disabled = false;
            saveButton.textContent = "✓ Update Fee";
            return;
        }

        showMessage(
            "Fee updated successfully.",
            "success"
        );

        saveButton.textContent = "✓ Updated";

        setTimeout(() => {
            window.location.href =
                `view.html?id=${encodeURIComponent(feeId)}&updated=${Date.now()}`;
        }, 900);

    } catch (error) {
        console.error("Unexpected update error:", error);

        showMessage(
            `Failed to update fee: ${error.message}`,
            "error"
        );

        saveButton.disabled = false;
        saveButton.textContent = "✓ Update Fee";
    }
}

function formatStudent(student) {
    const name =
        `${student.first_name || ""} ${student.last_name || ""}`.trim();

    const studentId = student.student_id || "-";

    const className = student.class || "";

    const section = student.section || "";

    const classInfo = className
        ? ` • ${className}${section ? ` - ${section}` : ""}`
        : "";

    return `${studentId} - ${name}${classInfo}`;
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
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
    editContent.style.display = "none";
    errorCard.style.display = "block";

    errorMessage.textContent =
        text || "Unable to load the requested fee.";
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

amountInput?.addEventListener("input", calculateBalance);
paidInput?.addEventListener("input", calculateBalance);

statusInput?.addEventListener("change", () => {
    const amount = Number(amountInput.value) || 0;

    if (amount <= 0) {
        return;
    }

    if (statusInput.value === "Paid") {
        paidInput.value = amount;
    }

    if (statusInput.value === "Unpaid") {
        paidInput.value = "0";
    }

    calculateBalance();
});

form?.addEventListener("submit", updateFee);