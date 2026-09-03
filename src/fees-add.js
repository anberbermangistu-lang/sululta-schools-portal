import { supabase } from "./supabase.js";

const form = document.getElementById("feeForm");
const studentInput = document.getElementById("student_id");
const amountInput = document.getElementById("amount");
const paidInput = document.getElementById("paid_amount");
const dateInput = document.getElementById("payment_date");
const methodInput = document.getElementById("payment_method");
const statusInput = document.getElementById("status");
const balanceDisplay = document.getElementById("balanceDisplay");
const message = document.getElementById("formMessage");
const saveButton = document.getElementById("saveButton");

let students = [];

document.addEventListener("DOMContentLoaded", async () => {
    setDefaultDate();
    await loadStudents();
    calculateBalance();
});

async function loadStudents() {
    studentInput.innerHTML = `<option value="">Loading students...</option>`;
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

        studentInput.innerHTML = `
            <option value="">Unable to load students</option>
        `;

        showMessage(`Failed to load students: ${error.message}`, "error");
        return;
    }

    students = data || [];

    if (students.length === 0) {
        studentInput.innerHTML = `
            <option value="">No students found</option>
        `;

        showMessage("There are no registered students yet.", "error");
        return;
    }

    studentInput.innerHTML = `
        <option value="">Select a student</option>
        ${students.map(student => `
            <option value="${student.id}">
                ${escapeHtml(formatStudent(student))}
            </option>
        `).join("")}
    `;

    studentInput.disabled = false;
}

function formatStudent(student) {
    const name = `${student.first_name || ""} ${student.last_name || ""}`.trim();
    const studentId = student.student_id || "-";
    const className = student.class || "";
    const section = student.section || "";

    const classInfo = className
        ? ` • ${className}${section ? ` - ${section}` : ""}`
        : "";

    return `${studentId} - ${name}${classInfo}`;
}

function setDefaultDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    dateInput.value = `${year}-${month}-${day}`;
}

function calculateBalance() {
    const amount = Number(amountInput.value) || 0;
    const paid = Number(paidInput.value) || 0;

    const balance = Math.max(amount - paid, 0);

    balanceDisplay.textContent = `ETB ${formatMoney(balance)}`;

    if (balance === 0 && amount > 0) {
        balanceDisplay.classList.add("balance-paid");
        balanceDisplay.classList.remove("balance-due");
    } else if (balance > 0) {
        balanceDisplay.classList.add("balance-due");
        balanceDisplay.classList.remove("balance-paid");
    } else {
        balanceDisplay.classList.remove("balance-paid", "balance-due");
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
        showMessage("Please enter a valid fee amount greater than 0.", "error");
        amountInput.focus();
        return false;
    }

    if (!Number.isFinite(paid) || paid < 0) {
        showMessage("Please enter a valid paid amount.", "error");
        paidInput.focus();
        return false;
    }

    if (paid > amount) {
        showMessage("Paid amount cannot be greater than the total fee.", "error");
        paidInput.focus();
        return false;
    }

    if (!paymentDate) {
        showMessage("Please select the payment date.", "error");
        dateInput.focus();
        return false;
    }

    if (!paymentMethod) {
        showMessage("Please select a payment method.", "error");
        methodInput.focus();
        return false;
    }

    if (!status) {
        showMessage("Please select the payment status.", "error");
        statusInput.focus();
        return false;
    }

    return true;
}

async function checkDuplicateFee(studentId, paymentDate) {
    const { data, error } = await supabase
        .from("fees")
        .select("id")
        .eq("student_id", studentId)
        .eq("payment_date", paymentDate)
        .limit(1);

    if (error) {
        console.error("Duplicate check failed:", error);
        throw new Error(error.message);
    }

    return data && data.length > 0;
}

async function addFee(event) {
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
    saveButton.textContent = "Saving...";

    try {
        const duplicate = await checkDuplicateFee(studentId, paymentDate);

        if (duplicate) {
            showMessage(
                "A fee record already exists for this student on this payment date.",
                "error"
            );

            saveButton.disabled = false;
            saveButton.textContent = "💾 Save Fee";
            return;
        }

        const { data, error } = await supabase
            .from("fees")
            .insert([
                {
                    student_id: studentId,
                    amount,
                    paid_amount: paidAmount,
                    payment_date: paymentDate,
                    payment_method: paymentMethod,
                    status
                }
            ])
            .select()
            .single();

        if (error) {
            console.error("Failed to add fee:", error);
            showMessage(`Failed to add fee: ${error.message}`, "error");

            saveButton.disabled = false;
            saveButton.textContent = "💾 Save Fee";
            return;
        }

        showMessage("Fee added successfully.", "success");

        saveButton.textContent = "✓ Saved";

        setTimeout(() => {
            window.location.href = `dashboard.html?refresh=${Date.now()}`;
        }, 900);

    } catch (error) {
        console.error("Unexpected error:", error);

        showMessage(
            `Failed to add fee: ${error.message}`,
            "error"
        );

        saveButton.disabled = false;
        saveButton.textContent = "💾 Save Fee";
    }
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function showMessage(text, type) {
    message.textContent = text;
    message.className = `form-message ${type}`;
    message.style.display = "block";
}

function hideMessage() {
    message.textContent = "";
    message.className = "form-message";
    message.style.display = "none";
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
    const paid = Number(paidInput.value) || 0;

    if (amount <= 0) {
        return;
    }

    if (statusInput.value === "Paid" && paid < amount) {
        paidInput.value = amount;
        calculateBalance();
    }

    if (statusInput.value === "Unpaid") {
        paidInput.value = "0";
        calculateBalance();
    }
});

form?.addEventListener("submit", addFee);