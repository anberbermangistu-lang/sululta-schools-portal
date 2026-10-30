import { supabase } from "./supabase.js";

const tableBody = document.getElementById("usersTableBody");
const searchInput = document.getElementById("searchInput");
const roleFilter = document.getElementById("roleFilter");
const statusFilter = document.getElementById("statusFilter");
const clearFilters = document.getElementById("clearFilters");

const totalUsers = document.getElementById("totalUsers");
const activeUsers = document.getElementById("activeUsers");
const inactiveUsers = document.getElementById("inactiveUsers");
const staffUsers = document.getElementById("staffUsers");

const message = document.getElementById("message");
const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".admin-sidebar");
const addUserButton = document.getElementById("addUserButton");

let users = [];

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    setupSidebar();
    setupLogout();
    setupFilters();
    setupAddUser();

    const allowed = await checkAdmin();

    if (!allowed) {
        return;
    }

    await loadUsers();
}

async function checkAdmin() {
    const {
        data: { user },
        error
    } = await supabase.auth.getUser();

    if (error || !user) {
        window.location.href = "/login.html";
        return false;
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
            username,
            role,
            photo_url,
            status
        `)
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile) {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return false;
    }

    if (
        String(profile.role).toLowerCase() !== "admin" ||
        String(profile.status).toLowerCase() !== "active"
    ) {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return false;
    }

    updateAdminProfile(profile);

    return true;
}

function updateAdminProfile(profile) {
    const fullName =
        `${profile.first_name || ""} ${profile.last_name || ""}`.trim() ||
        profile.username ||
        "Administrator";

    const adminName = document.querySelector(
        ".admin-profile-info strong"
    );

    const adminRole = document.querySelector(
        ".admin-profile-info span"
    );

    const adminAvatar = document.querySelector(
        ".admin-avatar"
    );

    if (adminName) {
        adminName.textContent = fullName;
    }

    if (adminRole) {
        adminRole.textContent = "Admin";
    }

    if (adminAvatar) {
        if (profile.photo_url) {
            adminAvatar.innerHTML = "";

            const image = document.createElement("img");
            image.src = profile.photo_url;
            image.alt = fullName;

            adminAvatar.appendChild(image);
        } else {
            adminAvatar.textContent =
                fullName.charAt(0).toUpperCase();
        }
    }
}

async function loadUsers() {
    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = `
        <tr>
            <td colspan="7" class="table-empty">
                Loading accounts...
            </td>
        </tr>
    `;

    const {
        data,
        error
    } = await supabase
        .from("profiles")
        .select(`
            id,
            first_name,
            last_name,
            email,
            username,
            role,
            phone,
            photo_url,
            status,
            created_at
        `)
        .order("created_at", {
            ascending: false
        });

    if (error) {
        console.error("Users error:", error);

        showMessage(
            error.message,
            "error"
        );

        showEmpty(
            "Unable to load accounts."
        );

        return;
    }

    users = data || [];

    updateStatistics();
    renderUsers();
}

function renderUsers() {
    const search =
        searchInput?.value?.trim().toLowerCase() || "";

    const role =
        roleFilter?.value?.trim().toLowerCase() || "";

    const status =
        statusFilter?.value?.trim().toLowerCase() || "";

    const filtered = users.filter(user => {
        const name =
            `${user.first_name || ""} ${user.last_name || ""}`
                .toLowerCase();

        const email =
            String(user.email || "").toLowerCase();

        const username =
            String(user.username || "").toLowerCase();

        const userRole =
            String(user.role || "").toLowerCase();

        const userStatus =
            String(user.status || "").toLowerCase();

        const matchesSearch =
            !search ||
            name.includes(search) ||
            email.includes(search) ||
            username.includes(search);

        const matchesRole =
            !role ||
            userRole === role;

        const matchesStatus =
            !status ||
            userStatus === status;

        return (
            matchesSearch &&
            matchesRole &&
            matchesStatus
        );
    });

    if (filtered.length === 0) {
        showEmpty("No accounts found.");
        return;
    }

    tableBody.innerHTML = filtered
        .map((user, index) =>
            createUserRow(user, index)
        )
        .join("");
}

function createUserRow(user, index) {
    const fullName =
        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
        "Unnamed User";

    const role =
        String(user.role || "-").toLowerCase();

    const status =
        String(user.status || "inactive").toLowerCase();

    const roleText =
        role.charAt(0).toUpperCase() +
        role.slice(1);

    const statusText =
        status === "active"
            ? "Active"
            : "Inactive";

    const statusClass =
        status === "active"
            ? "status-active"
            : "status-inactive";

    const isAdmin =
        role === "admin";

    return `
        <tr>
            <td>${index + 1}</td>

            <td>
                <strong>
                    ${escapeHtml(fullName)}
                </strong>
            </td>

            <td>
                ${escapeHtml(user.email || "-")}
            </td>

            <td>
                ${escapeHtml(user.username || "-")}
            </td>

            <td>
                ${escapeHtml(roleText)}
            </td>

            <td>
                <span class="${statusClass}">
                    ${statusText}
                </span>
            </td>

            <td>
                <div class="table-actions">

                    <a
                        href="/admin/user-view.html?id=${encodeURIComponent(user.id)}"
                        class="btn btn-sm btn-secondary"
                    >
                        View
                    </a>

                    <a
                        href="/admin/user-edit.html?id=${encodeURIComponent(user.id)}"
                        class="btn btn-sm btn-primary"
                    >
                        Edit
                    </a>

                    ${
                        isAdmin
                            ? ""
                            : `
                                <button
                                    type="button"
                                    class="btn btn-sm ${
                                        status === "active"
                                            ? "btn-danger"
                                            : "btn-success"
                                    }"
                                    data-toggle-id="${escapeHtml(user.id)}"
                                >
                                    ${
                                        status === "active"
                                            ? "Disable"
                                            : "Enable"
                                    }
                                </button>
                            `
                    }

                    ${
                        isAdmin
                            ? ""
                            : `
                                <button
                                    type="button"
                                    class="btn btn-sm btn-warning"
                                    data-reset-id="${escapeHtml(user.id)}"
                                >
                                    Reset Password
                                </button>
                            `
                    }

                </div>
            </td>
        </tr>
    `;
}

function updateStatistics() {
    const total = users.length;

    const active = users.filter(
        user =>
            String(user.status || "").toLowerCase() ===
            "active"
    ).length;

    const inactive = users.filter(
        user =>
            String(user.status || "").toLowerCase() ===
            "inactive"
    ).length;

    const staff = users.filter(
        user =>
            [
                "admin",
                "teacher",
                "librarian"
            ].includes(
                String(user.role || "").toLowerCase()
            )
    ).length;

    if (totalUsers) {
        totalUsers.textContent = total;
    }

    if (activeUsers) {
        activeUsers.textContent = active;
    }

    if (inactiveUsers) {
        inactiveUsers.textContent = inactive;
    }

    if (staffUsers) {
        staffUsers.textContent = staff;
    }
}

function setupFilters() {
    searchInput?.addEventListener(
        "input",
        renderUsers
    );

    roleFilter?.addEventListener(
        "change",
        renderUsers
    );

    statusFilter?.addEventListener(
        "change",
        renderUsers
    );

    clearFilters?.addEventListener(
        "click",
        () => {
            if (searchInput) {
                searchInput.value = "";
            }

            if (roleFilter) {
                roleFilter.value = "";
            }

            if (statusFilter) {
                statusFilter.value = "";
            }

            renderUsers();
        }
    );
}

function setupAddUser() {
    if (!addUserButton) {
        return;
    }

    addUserButton.addEventListener(
        "click",
        () => {
            window.location.href =
                "/admin/user-add.html";
        }
    );
}

tableBody?.addEventListener(
    "click",
    async event => {
        const toggleButton =
            event.target.closest(
                "[data-toggle-id]"
            );

        if (toggleButton) {
            await toggleStatus(
                toggleButton.dataset.toggleId
            );

            return;
        }

        const resetButton =
            event.target.closest(
                "[data-reset-id]"
            );

        if (resetButton) {
            await resetUserPassword(
                resetButton.dataset.resetId
            );
        }
    }
);

async function toggleStatus(id) {
    const user =
        users.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!user) {
        return;
    }

    const currentStatus =
        String(
            user.status || ""
        ).toLowerCase();

    const newStatus =
        currentStatus === "active"
            ? "inactive"
            : "active";

    const fullName =
        `${user.first_name || ""} ${user.last_name || ""}`.trim();

    const confirmed =
        window.confirm(
            `${newStatus === "active" ? "Enable" : "Disable"} ${fullName}?`
        );

    if (!confirmed) {
        return;
    }

    const {
        error
    } = await supabase
        .from("profiles")
        .update({
            status: newStatus,
            updated_at: new Date().toISOString()
        })
        .eq("id", id);

    if (error) {
        console.error(
            "Status update error:",
            error
        );

        showMessage(
            error.message,
            "error"
        );

        return;
    }

    showMessage(
        "Account status updated successfully.",
        "success"
    );

    await loadUsers();
}

async function resetUserPassword(id) {
    const user =
        users.find(
            item =>
                String(item.id) ===
                String(id)
        );

    if (!user) {
        return;
    }

    const fullName =
        `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
        "this user";

    const password =
        window.prompt(
            `Enter a new temporary password for ${fullName}:`
        );

    if (password === null) {
        return;
    }

    if (password.length < 6) {
        showMessage(
            "Password must be at least 6 characters.",
            "error"
        );

        return;
    }

    const confirmed =
        window.confirm(
            `Reset the password for ${fullName}?`
        );

    if (!confirmed) {
        return;
    }

    // Use Supabase's built-in password reset email instead of the Edge Function
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
            redirectTo: `${window.location.origin}/reset-password.html`
        });

        if (error) {
            throw new Error(error.message);
        }

        showMessage(
            `Password reset email sent to ${user.email}.`,
            "success"
        );

    } catch (error) {
        console.error("Reset password error:", error);
        showMessage(
            error?.message || "Unable to send password reset email.",
            "error"
        );
    }
}

function setupLogout() {
    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
        "click",
        async () => {
            const {
                error
            } = await supabase.auth.signOut();

            if (error) {
                console.error(
                    "Logout error:",
                    error
                );

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

function setupSidebar() {
    if (
        !sidebarToggle ||
        !sidebar
    ) {
        return;
    }

    sidebarToggle.addEventListener(
        "click",
        () => {
            sidebar.classList.toggle(
                "mobile-open"
            );
        }
    );
}

function showEmpty(text) {
    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = `
        <tr>
            <td
                colspan="7"
                class="table-empty"
            >
                ${escapeHtml(text)}
            </td>
        </tr>
    `;
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

    setTimeout(
        () => {
            message.hidden = true;
        },
        5000
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
