import { supabase } from "./supabase.js";

let allTeachers = [];

document.addEventListener("DOMContentLoaded", () => {

    setupSidebar();

    setupLogout();

    setupFilters();

    loadTeachers();

});

async function loadTeachers() {

    const tableBody =
        document.getElementById("teachersTableBody");

    if (tableBody) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="loading-cell">
                    Loading teacher records...
                </td>
            </tr>
        `;

    }

    try {

        const {
            data,
            error
        } = await supabase
            .from("teachers")
            .select(`
                id,
                teacher_id,
                first_name,
                last_name,
                gender,
                phone,
                email,
                qualification,
                photo_url,
                status,
                created_at
            `)
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        if (error) {
            throw error;
        }

        allTeachers = data || [];

        updateStatistics();

        renderTeachers();

    } catch (error) {

        console.error(
            "Load teachers error:",
            error
        );

        if (tableBody) {

            tableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="loading-cell">
                        Failed to load teacher records.
                    </td>
                </tr>
            `;

        }
    }
}

function updateStatistics() {

    const total =
        allTeachers.length;

    const male =
        allTeachers.filter(
            teacher =>
                String(
                    teacher.gender || ""
                ).toLowerCase() === "male"
        ).length;

    const female =
        allTeachers.filter(
            teacher =>
                String(
                    teacher.gender || ""
                ).toLowerCase() === "female"
        ).length;

    const active =
        allTeachers.filter(
            teacher =>
                String(
                    teacher.status || ""
                ).toLowerCase() === "active"
        ).length;

    setText(
        "totalTeachers",
        total
    );

    setText(
        "maleTeachers",
        male
    );

    setText(
        "femaleTeachers",
        female
    );

    setText(
        "activeTeachers",
        active
    );

    setText(
        "recordBadge",
        `${total} Records`
    );
}

function renderTeachers() {

    const tableBody =
        document.getElementById(
            "teachersTableBody"
        );

    const emptyState =
        document.getElementById(
            "emptyState"
        );

    if (!tableBody) {
        return;
    }

    const search =
        document.getElementById(
            "teacherSearch"
        )?.value
            .trim()
            .toLowerCase() || "";

    const gender =
        document.getElementById(
            "genderFilter"
        )?.value || "all";

    const status =
        document.getElementById(
            "statusFilter"
        )?.value || "all";

    const filtered =
        allTeachers.filter(
            teacher => {

                const fullName =
                    `${teacher.first_name || ""} ${teacher.last_name || ""}`
                        .trim()
                        .toLowerCase();

                const teacherId =
                    String(
                        teacher.teacher_id || ""
                    ).toLowerCase();

                const qualification =
                    String(
                        teacher.qualification || ""
                    ).toLowerCase();

                const teacherGender =
                    String(
                        teacher.gender || ""
                    ).toLowerCase();

                const teacherStatus =
                    String(
                        teacher.status || ""
                    ).toLowerCase();

                const matchesSearch =
                    !search ||
                    teacherId.includes(search) ||
                    fullName.includes(search) ||
                    qualification.includes(search);

                const matchesGender =
                    gender === "all" ||
                    teacherGender === gender;

                const matchesStatus =
                    status === "all" ||
                    teacherStatus === status;

                return (
                    matchesSearch &&
                    matchesGender &&
                    matchesStatus
                );
            }
        );

    setText(
        "recordSummary",
        `Showing ${filtered.length} of ${allTeachers.length} records`
    );

    if (filtered.length === 0) {

        tableBody.innerHTML = "";

        if (emptyState) {
            emptyState.hidden = false;
        }

        return;
    }

    if (emptyState) {
        emptyState.hidden = true;
    }

    tableBody.innerHTML =
        filtered
            .map(
                (teacher, index) =>
                    createTeacherRow(
                        teacher,
                        index
                    )
            )
            .join("");
}

function createTeacherRow(
    teacher,
    index
) {

    const fullName =
        `${teacher.first_name || ""} ${teacher.last_name || ""}`
            .trim() ||
        "Unnamed Teacher";

    const gender =
        String(
            teacher.gender || ""
        );

    const status =
        String(
            teacher.status || ""
        );

    const statusClass =
        status.toLowerCase() === "active"
            ? "active"
            : "inactive";

    const photo =
        teacher.photo_url
            ? `
                <img
                    src="${escapeHtml(teacher.photo_url)}"
                    alt="${escapeHtml(fullName)}"
                    style="
                        width:42px;
                        height:42px;
                        object-fit:cover;
                        border-radius:50%;
                    ">
              `
            : `
                <div
                    style="
                        width:42px;
                        height:42px;
                        border-radius:50%;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        background:#e2e8f0;
                        font-weight:700;
                    ">
                    ${escapeHtml(
                        fullName
                            .charAt(0)
                            .toUpperCase()
                    )}
                </div>
              `;

    return `
        <tr>

            <td>
                ${index + 1}
            </td>

            <td>

                <div
                    style="
                        display:flex;
                        align-items:center;
                        gap:10px;
                    ">

                    ${photo}

                    <div>

                        <strong>
                            ${escapeHtml(fullName)}
                        </strong>

                        <small
                            style="
                                display:block;
                                color:#64748b;
                            ">

                            ${escapeHtml(
                                teacher.teacher_id || ""
                            )}

                        </small>

                    </div>

                </div>

            </td>

            <td>
                ${capitalize(gender)}
            </td>

            <td>
                ${escapeHtml(
                    teacher.qualification ||
                    "Not provided"
                )}
            </td>

            <td>
                ${escapeHtml(
                    teacher.phone ||
                    "Not provided"
                )}
            </td>

            <td>
                ${escapeHtml(
                    teacher.email ||
                    "Not provided"
                )}
            </td>

            <td>

                <span
                    class="status-badge ${statusClass}">

                    ${capitalize(
                        status || "Unknown"
                    )}

                </span>

            </td>

            <td>

                <div
                    style="
                        display:flex;
                        gap:6px;
                        flex-wrap:wrap;
                    ">

                    <a
                        href="/teachers/view.html?id=${encodeURIComponent(teacher.id)}"
                        class="btn btn-secondary">

                        View

                    </a>

                    <a
                        href="/teachers/edit.html?id=${encodeURIComponent(teacher.id)}"
                        class="btn btn-primary">

                        Edit

                    </a>

                    <button
                        type="button"
                        class="btn btn-danger"
                        data-delete-id="${escapeHtml(teacher.id)}">

                        Delete

                    </button>

                </div>

            </td>

        </tr>
    `;
}

function setupFilters() {

    const search =
        document.getElementById(
            "teacherSearch"
        );

    const gender =
        document.getElementById(
            "genderFilter"
        );

    const status =
        document.getElementById(
            "statusFilter"
        );

    const clear =
        document.getElementById(
            "clearFilters"
        );

    const clearToolbar =
        document.getElementById(
            "clearFiltersToolbar"
        );

    const refresh =
        document.getElementById(
            "refreshTeachers"
        );

    search?.addEventListener(
        "input",
        renderTeachers
    );

    gender?.addEventListener(
        "change",
        renderTeachers
    );

    status?.addEventListener(
        "change",
        renderTeachers
    );

    clear?.addEventListener(
        "click",
        clearFilters
    );

    clearToolbar?.addEventListener(
        "click",
        clearFilters
    );

    refresh?.addEventListener(
        "click",
        loadTeachers
    );

    document
        .getElementById(
            "teachersTableBody"
        )
        ?.addEventListener(
            "click",
            handleTableClick
        );
}

function clearFilters() {

    const search =
        document.getElementById(
            "teacherSearch"
        );

    const gender =
        document.getElementById(
            "genderFilter"
        );

    const status =
        document.getElementById(
            "statusFilter"
        );

    if (search) {
        search.value = "";
    }

    if (gender) {
        gender.value = "all";
    }

    if (status) {
        status.value = "all";
    }

    renderTeachers();
}

async function handleTableClick(event) {

    const button =
        event.target.closest(
            "[data-delete-id]"
        );

    if (!button) {
        return;
    }

    const id =
        button.dataset.deleteId;

    if (!id) {
        return;
    }

    const confirmed =
        window.confirm(
            "Are you sure you want to delete this teacher?"
        );

    if (!confirmed) {
        return;
    }

    button.disabled = true;

    try {

        const {
            data: teacher,
            error: findError
        } = await supabase
            .from("teachers")
            .select("photo_url")
            .eq("id", id)
            .maybeSingle();

        if (findError) {
            throw findError;
        }

        const {
            error: deleteError
        } = await supabase
            .from("teachers")
            .delete()
            .eq("id", id);

        if (deleteError) {
            throw deleteError;
        }

        if (teacher?.photo_url) {

            await deletePhoto(
                teacher.photo_url
            );
        }

        await loadTeachers();

    } catch (error) {

        console.error(
            "Delete teacher error:",
            error
        );

        alert(
            error.message ||
            "Failed to delete teacher."
        );

        button.disabled = false;
    }
}

async function deletePhoto(photoUrl) {

    try {

        const marker =
            "/storage/v1/object/public/teacher-photos/";

        const index =
            photoUrl.indexOf(marker);

        if (index === -1) {
            return;
        }

        const path =
            photoUrl.substring(
                index + marker.length
            );

        await supabase
            .storage
            .from("teacher-photos")
            .remove([path]);

    } catch (error) {

        console.error(
            "Photo delete error:",
            error
        );

    }
}

function setupSidebar() {

    const toggle =
        document.getElementById(
            "sidebarToggle"
        );

    const sidebar =
        document.querySelector(
            ".admin-sidebar"
        );

    if (!toggle || !sidebar) {
        return;
    }

    toggle.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "mobile-open"
            );

        }
    );
}

function setupLogout() {

    const logoutButton =
        document.getElementById(
            "logoutButton"
        );

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

                return;
            }

            window.location.assign(
                "/login.html"
            );

        }
    );
}

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function capitalize(value) {

    const text =
        String(value || "");

    if (!text) {
        return "";
    }

    return (
        text.charAt(0).toUpperCase() +
        text.slice(1)
    );
}

function escapeHtml(value) {

    return String(value ?? "")
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}