import { supabase } from "./supabase.js";

const message = document.getElementById("message");
const refreshButton = document.getElementById("refreshStudents");
const searchInput = document.getElementById("studentSearch");
const genderFilter = document.getElementById("genderFilter");
const statusFilter = document.getElementById("statusFilter");

const totalStudents = document.getElementById("totalStudents");
const maleStudents = document.getElementById("maleStudents");
const femaleStudents = document.getElementById("femaleStudents");
const activeStudents = document.getElementById("activeStudents");

const studentRecordBadge = document.getElementById("studentRecordBadge");
const studentsTableBody = document.getElementById("studentsTableBody");
const studentRecordSummary = document.getElementById("studentRecordSummary");

const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".admin-sidebar");

const adminAvatar = document.getElementById("adminAvatar");
const adminHeaderName = document.getElementById("adminHeaderName");

let students = [];

document.addEventListener("DOMContentLoaded", initialize);

window.addEventListener("pageshow", async () => {
    await checkAuthentication();
});

async function initialize() {
    setupSidebar();
    setupFilters();
    setupRefresh();
    setupLogout();

    const authenticated = await checkAuthentication();

    if (!authenticated) {
        return;
    }

    await loadAdminProfile();
    await loadStudents();
}

async function checkAuthentication() {
    try {
        const {
            data: { user },
            error
        } = await supabase.auth.getUser();

        if (error || !user) {
            window.location.replace("/login.html");
            return false;
        }

        return true;
    } catch (error) {
        console.error("Authentication error:", error);
        window.location.replace("/login.html");
        return false;
    }
}

async function loadAdminProfile() {
    try {
        const {
            data: { user },
            error: authError
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return;
        }

        const {
            data: profile,
            error
        } = await supabase
            .from("profiles")
            .select(`
                first_name,
                last_name,
                email,
                role,
                photo_url,
                status
            `)
            .eq("id", user.id)
            .maybeSingle();

        if (error) {
            console.error("Admin profile error:", error);
            return;
        }

        if (!profile) {
            return;
        }

        const fullName =
            `${profile.first_name || ""} ${profile.last_name || ""}`
                .trim() || "Admin";

        if (adminHeaderName) {
            adminHeaderName.textContent = fullName;
        }

        if (adminAvatar) {
            const photo = profile.photo_url;

            if (photo) {
                adminAvatar.innerHTML = "";

                const image = document.createElement("img");

                image.src = photo;
                image.alt = fullName;

                image.onerror = () => {
                    adminAvatar.textContent = getInitials(
                        profile.first_name,
                        profile.last_name
                    );
                };

                adminAvatar.appendChild(image);
            } else {
                adminAvatar.textContent = getInitials(
                    profile.first_name,
                    profile.last_name
                );
            }
        }
    } catch (error) {
        console.error("Profile loading error:", error);
    }
}

async function loadStudents() {
    showLoading();

    const {
        data,
        error
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
            parent_name,
            parent_phone,
            photo_url,
            status,
            created_at,
            updated_at,
            photo,
            class_id
        `)
        .order("id", {
            ascending: true
        });

    if (error) {
        console.error("Students loading error:", error);

        students = [];

        updateStatistics();
        renderStudents();

        showMessage(
            error.message || "Unable to load students.",
            "error"
        );

        return;
    }

    students = data || [];

    updateStatistics();
    renderStudents();
    hideMessage();
}

function updateStatistics() {
    const total = students.length;

    const male = students.filter(
        student =>
            normalizeGender(student.gender) === "male"
    ).length;

    const female = students.filter(
        student =>
            normalizeGender(student.gender) === "female"
    ).length;

    const active = students.filter(
        student =>
            normalizeStatus(student.status) === "active"
    ).length;

    if (totalStudents) {
        totalStudents.textContent = total;
    }

    if (maleStudents) {
        maleStudents.textContent = male;
    }

    if (femaleStudents) {
        femaleStudents.textContent = female;
    }

    if (activeStudents) {
        activeStudents.textContent = active;
    }
}

function renderStudents() {
    const search = String(
        searchInput?.value || ""
    )
        .trim()
        .toLowerCase();

    const selectedGender = normalizeGender(
        genderFilter?.value || "all"
    );

    const selectedStatus = normalizeStatus(
        statusFilter?.value || "all"
    );

    const filtered = students.filter(student => {
        const fullName =
            `${student.first_name || ""} ${student.last_name || ""}`
                .trim()
                .toLowerCase();

        const studentId = String(
            student.student_id || ""
        ).toLowerCase();

        const phone = String(
            student.phone || ""
        ).toLowerCase();

        const email = String(
            student.email || ""
        ).toLowerCase();

        const studentClass = String(
            student.class || ""
        ).toLowerCase();

        const section = String(
            student.section || ""
        ).toLowerCase();

        const gender = normalizeGender(
            student.gender
        );

        const status = normalizeStatus(
            student.status
        );

        const matchesSearch =
            !search ||
            fullName.includes(search) ||
            studentId.includes(search) ||
            phone.includes(search) ||
            email.includes(search) ||
            studentClass.includes(search) ||
            section.includes(search);

        const matchesGender =
            selectedGender === "all" ||
            gender === selectedGender;

        const matchesStatus =
            selectedStatus === "all" ||
            status === selectedStatus;

        return (
            matchesSearch &&
            matchesGender &&
            matchesStatus
        );
    });

    updateRecordCount(filtered.length);

    if (!studentsTableBody) {
        return;
    }

    if (!filtered.length) {
        studentsTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="loading-cell">
                    <div class="empty-state">
                        <div class="empty-icon">👨‍🎓</div>
                        <h3>No Students Found</h3>
                        <p>No students match your current search or filters.</p>
                    </div>
                </td>
            </tr>
        `;

        return;
    }

    studentsTableBody.innerHTML = filtered
        .map((student, index) =>
            createStudentRow(student, index)
        )
        .join("");

    setupActionButtons();
}

function createStudentRow(student, index) {
    const fullName =
        `${student.first_name || ""} ${student.last_name || ""}`
            .trim() || "Unnamed Student";

    const gender = normalizeGender(
        student.gender
    );

    const status = normalizeStatus(
        student.status
    );

    const studentClass =
        student.class || "—";

    const section =
        student.section || "—";

    const phone =
        student.phone || "—";

    const photo = getPhotoUrl(
        student.photo_url ||
        student.photo
    );

    const avatar = photo
        ? `
            <img
                src="${escapeAttribute(photo)}"
                alt="${escapeAttribute(fullName)}"
                class="student-avatar-image"
                onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
            >
            <span
                class="student-avatar-fallback"
                style="display:none;"
            >
                ${escapeHtml(
                    getInitials(
                        student.first_name,
                        student.last_name
                    )
                )}
            </span>
        `
        : `
            <span class="student-avatar-fallback">
                ${escapeHtml(
                    getInitials(
                        student.first_name,
                        student.last_name
                    )
                )}
            </span>
        `;

    return `
        <tr>
            <td>${index + 1}</td>

            <td>
                <div class="student-cell">
                    <div class="student-avatar">
                        ${avatar}
                    </div>

                    <div class="student-info">
                        <strong>
                            ${escapeHtml(fullName)}
                        </strong>

                        <span>
                            ${escapeHtml(
                                student.student_id ||
                                "No ID"
                            )}
                        </span>
                    </div>
                </div>
            </td>

            <td>
                <span class="gender-text">
                    ${escapeHtml(
                        capitalize(gender)
                    )}
                </span>
            </td>

            <td>
                ${escapeHtml(studentClass)}
            </td>

            <td>
                ${escapeHtml(section)}
            </td>

            <td>
                ${escapeHtml(phone)}
            </td>

            <td>
                <span class="status-badge ${getStatusClass(status)}">
                    ${escapeHtml(
                        capitalize(status)
                    )}
                </span>
            </td>

            <td>
                <div class="action-buttons">
                    <a
                        href="/students/view.html?id=${encodeURIComponent(student.id)}"
                        class="btn btn-view"
                        title="View Student"
                    >
                        View
                    </a>

                    <a
                        href="/students/edit.html?id=${encodeURIComponent(student.id)}"
                        class="btn btn-edit"
                        title="Edit Student"
                    >
                        Edit
                    </a>

                    <a
                        href="/students/delete.html?id=${encodeURIComponent(student.id)}"
                        class="btn btn-delete"
                        title="Delete Student"
                    >
                        Delete
                    </a>
                </div>
            </td>
        </tr>
    `;
}

function setupFilters() {
    searchInput?.addEventListener(
        "input",
        renderStudents
    );

    genderFilter?.addEventListener(
        "change",
        renderStudents
    );

    statusFilter?.addEventListener(
        "change",
        renderStudents
    );
}

function setupRefresh() {
    refreshButton?.addEventListener(
        "click",
        async () => {
            refreshButton.disabled = true;

            try {
                await loadStudents();
            } finally {
                refreshButton.disabled = false;
            }
        }
    );
}

function setupActionButtons() {
    document
        .querySelectorAll(".btn-delete")
        .forEach(button => {
            button.addEventListener(
                "click",
                event => {
                    const confirmed = window.confirm(
                        "Are you sure you want to delete this student?"
                    );

                    if (!confirmed) {
                        event.preventDefault();
                    }
                }
            );
        });
}

function updateRecordCount(count) {
    if (studentRecordBadge) {
        studentRecordBadge.textContent =
            `${count} ${
                count === 1
                    ? "Record"
                    : "Records"
            }`;
    }

    if (studentRecordSummary) {
        studentRecordSummary.textContent =
            `Showing ${count} ${
                count === 1
                    ? "record"
                    : "records"
            }`;
    }
}

function showLoading() {
    if (!studentsTableBody) {
        return;
    }

    studentsTableBody.innerHTML = `
        <tr>
            <td colspan="8" class="loading-cell">
                Loading students...
            </td>
        </tr>
    `;
}

function showMessage(text, type = "info") {
    if (!message) {
        return;
    }

    message.textContent = text;
    message.className = `message ${type}`;
    message.hidden = false;
}

function hideMessage() {
    if (!message) {
        return;
    }

    message.hidden = true;
    message.textContent = "";
    message.className = "message";
}

function setupSidebar() {
    if (!sidebarToggle || !sidebar) {
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

function setupLogout() {
    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
        "click",
        async () => {
            logoutButton.disabled = true;

            const {
                error
            } = await supabase.auth.signOut();

            if (error) {
                showMessage(
                    error.message,
                    "error"
                );

                logoutButton.disabled = false;
                return;
            }

            window.location.replace(
                "/login.html"
            );
        }
    );
}

function normalizeGender(value) {
    const gender =
        String(value || "")
            .trim()
            .toLowerCase();

    if (gender === "male") {
        return "male";
    }

    if (gender === "female") {
        return "female";
    }

    return gender || "unknown";
}

function normalizeStatus(value) {
    const status =
        String(value || "")
            .trim()
            .toLowerCase();

    return status || "unknown";
}

function getStatusClass(status) {
    switch (status) {
        case "active":
            return "status-active";

        case "inactive":
            return "status-inactive";

        case "suspended":
            return "status-suspended";

        default:
            return "status-inactive";
    }
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
        value.startsWith("https://")
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

function capitalize(value) {
    const text =
        String(value || "");

    return text
        ? text[0].toUpperCase() +
          text.slice(1)
        : "";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value);
}