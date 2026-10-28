import { supabase } from "./supabase.js";

const form = document.getElementById("userForm");
const messageBox = document.getElementById("messageBox");
const saveButton = document.getElementById("saveButton");

let user = null;

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {

    setupSidebar();

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (!id) {
        showMessage("No user ID was provided.", "error");
        return;
    }

    await checkAdmin();
    await loadUser(id);
}

async function checkAdmin() {

    const {
        data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
        window.location.replace("/login.html");
        return;
    }

    const { data, error } = await supabase
        .from("profiles")
        .select("role,status")
        .eq("id", session.user.id)
        .maybeSingle();

    if (
        error ||
        !data ||
        data.role !== "admin" ||
        data.status !== "active"
    ) {
        window.location.replace("/login.html");
    }
}

async function loadUser(id) {

    const { data, error } = await supabase
        .from("profiles")
        .select(`
            id,
            first_name,
            last_name,
            email,
            username,
            phone,
            role,
            status,
            photo_url
        `)
        .eq("id", id)
        .maybeSingle();

    if (error) {

        console.error("Failed to load user:", error);

        showMessage(
            "Unable to load user information.",
            "error"
        );

        return;
    }

    if (!data) {

        showMessage(
            "User not found.",
            "error"
        );

        return;
    }

    user = data;

    fillForm(data);
}

function fillForm(data) {

    setValue("firstName", data.first_name);
    setValue("lastName", data.last_name);
    setValue("email", data.email);
    setValue("username", data.username);
    setValue("phone", data.phone);
    setValue("role", data.role);
    setValue("status", data.status);
}

function setValue(id, value) {

    const element = document.getElementById(id);

    if (element) {
        element.value = value ?? "";
    }
}

form?.addEventListener("submit", saveUser);

async function saveUser(event) {

    event.preventDefault();

    if (!user) {

        showMessage(
            "User information is not loaded.",
            "error"
        );

        return;
    }

    const firstName =
        document.getElementById("firstName")?.value.trim();

    const lastName =
        document.getElementById("lastName")?.value.trim();

    const email =
        document.getElementById("email")?.value.trim();

    const phone =
        document.getElementById("phone")?.value.trim();

    const status =
        document.getElementById("status")?.value;

    if (!firstName || !lastName || !email || !status) {

        showMessage(
            "Please complete all required fields.",
            "error"
        );

        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {

        const { error } = await supabase
            .from("profiles")
            .update({
                first_name: firstName,
                last_name: lastName,
                phone: phone || null,
                status: status
            })
            .eq("id", user.id);

        if (error) {
            throw new Error(error.message);
        }

        showMessage(
            "User updated successfully.",
            "success"
        );

        setTimeout(() => {
            window.location.href = "/admin/users.html";
        }, 900);

    } catch (error) {

        console.error("Save user error:", error);

        showMessage(
            error.message || "Unable to update user.",
            "error"
        );

    } finally {

        saveButton.disabled = false;
        saveButton.textContent = "Save Changes";
    }
}

function setupSidebar() {

    const sidebar = document.querySelector(".admin-sidebar");
    const toggle = document.getElementById("sidebarToggle");

    toggle?.addEventListener("click", () => {
        sidebar?.classList.toggle("mobile-open");
    });
}

function showMessage(message, type = "success") {

    if (!messageBox) {
        return;
    }

    messageBox.textContent = message;
    messageBox.className = `message ${type}`;

    setTimeout(() => {

        if (!messageBox) {
            return;
        }

        messageBox.textContent = "";
        messageBox.className = "message";

    }, 4000);
}