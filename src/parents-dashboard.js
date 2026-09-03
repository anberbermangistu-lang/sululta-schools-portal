import { supabase } from "./supabase.js";


let parents = [];
let students = [];
let filteredParents = [];


document.addEventListener(
    "DOMContentLoaded",
    initialize
);


async function initialize() {

    setupSidebar();

    setupLogout();

    setupFilters();

    await loadAdminProfile();

    await loadParents();

}


async function loadAdminProfile() {

    try {

        const {
            data: {
                user
            },
            error: authError
        } =
            await supabase.auth.getUser();


        if (authError) {
            throw authError;
        }


        if (!user) {

            window.location.href =
                "/login.html";

            return;

        }


        const {
            data: profile,
            error
        } =
            await supabase
                .from("profiles")
                .select(`
                    id,
                    first_name,
                    last_name,
                    username,
                    email,
                    role,
                    status,
                    photo_url
                `)
                .eq(
                    "id",
                    user.id
                )
                .maybeSingle();


        if (error) {
            throw error;
        }


        if (!profile) {
            return;
        }


        const role =
            String(
                profile.role || ""
            )
                .trim()
                .toLowerCase();


        if (role !== "admin") {

            if (role === "teacher") {

                window.location.href =
                    "/teachers/dashboard.html";

            } else if (role === "parent") {

                window.location.href =
                    "/parent/dashboard.html";

            } else {

                window.location.href =
                    "/login.html";

            }

            return;

        }


        updateAdminProfile(
            profile
        );


    } catch (error) {

        console.error(
            "Admin profile error:",
            error
        );

    }

}


async function loadParents() {

    setLoading();

    clearMessage();


    try {

        const {
            data: parentData,
            error: parentError
        } =
            await supabase
                .from("parents")
                .select(`
                    id,
                    parent_id,
                    first_name,
                    last_name,
                    gender,
                    relationship,
                    phone,
                    email,
                    address,
                    occupation,
                    user_id,
                    student_id,
                    status,
                    photo_url,
                    created_at,
                    updated_at
                `)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (parentError) {
            throw parentError;
        }


        const {
            data: studentData,
            error: studentError
        } =
            await supabase
                .from("students")
                .select(`
                    id,
                    student_id,
                    first_name,
                    last_name,
                    gender,
                    class,
                    section,
                    phone,
                    email,
                    photo_url,
                    status
                `);


        if (studentError) {
            throw studentError;
        }


        parents =
            parentData || [];


        students =
            studentData || [];


        filteredParents =
            [...parents];


        updateStatistics();

        applyFilters();


    } catch (error) {

        console.error(
            "Parent loading error:",
            error
        );


        parents = [];

        students = [];

        filteredParents = [];


        updateStatistics();


        renderParents();


        showMessage(
            error.message ||
            "Unable to load parent records.",
            "error"
        );

    }

}


function setupFilters() {

    const search =
        document.getElementById(
            "parentSearch"
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
            "refreshParents"
        );


    search?.addEventListener(
        "input",
        applyFilters
    );


    gender?.addEventListener(
        "change",
        applyFilters
    );


    status?.addEventListener(
        "change",
        applyFilters
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
        async () => {

            refresh.disabled =
                true;

            await loadParents();

            refresh.disabled =
                false;

        }
    );


    document
        .getElementById(
            "parentsTableBody"
        )
        ?.addEventListener(
            "click",
            handleTableAction
        );

}


function applyFilters() {

    const searchInput =
        document.getElementById(
            "parentSearch"
        );


    const genderInput =
        document.getElementById(
            "genderFilter"
        );


    const statusInput =
        document.getElementById(
            "statusFilter"
        );


    const search =
        String(
            searchInput?.value || ""
        )
            .trim()
            .toLowerCase();


    const gender =
        String(
            genderInput?.value || ""
        )
            .trim()
            .toLowerCase();


    const status =
        String(
            statusInput?.value || ""
        )
            .trim()
            .toLowerCase();


    filteredParents =
        parents.filter(
            parent => {

                const parentName =
                    `${parent.first_name || ""} ${parent.last_name || ""}`
                        .trim();


                const student =
                    findStudent(
                        parent.student_id
                    );


                const childName =
                    student
                        ? `${student.first_name || ""} ${student.last_name || ""}`.trim()
                        : "";


                const searchableText =
                    [
                        parent.parent_id,
                        parentName,
                        parent.phone,
                        parent.email,
                        parent.relationship,
                        childName,
                        student?.student_id,
                        student?.class,
                        student?.section
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();


                const matchesSearch =
                    !search ||
                    searchableText.includes(
                        search
                    );


                const parentGender =
                    String(
                        parent.gender || ""
                    )
                        .trim()
                        .toLowerCase();


                const matchesGender =
                    !gender ||
                    parentGender === gender;


                const parentStatus =
                    String(
                        parent.status || ""
                    )
                        .trim()
                        .toLowerCase();


                const matchesStatus =
                    !status ||
                    parentStatus === status;


                return (
                    matchesSearch &&
                    matchesGender &&
                    matchesStatus
                );

            }
        );


    renderParents();

}


function clearFilters() {

    const search =
        document.getElementById(
            "parentSearch"
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

        search.value =
            "";

    }


    if (gender) {

        gender.value =
            "";

    }


    if (status) {

        status.value =
            "";

    }


    applyFilters();

}


function updateStatistics() {

    const total =
        parents.length;


    const male =
        parents.filter(
            parent =>
                String(
                    parent.gender || ""
                )
                    .trim()
                    .toLowerCase() ===
                "male"
        ).length;


    const female =
        parents.filter(
            parent =>
                String(
                    parent.gender || ""
                )
                    .trim()
                    .toLowerCase() ===
                "female"
        ).length;


    const active =
        parents.filter(
            parent =>
                String(
                    parent.status || ""
                )
                    .trim()
                    .toLowerCase() ===
                "active"
        ).length;


    setText(
        "totalParents",
        total
    );


    setText(
        "maleParents",
        male
    );


    setText(
        "femaleParents",
        female
    );


    setText(
        "activeParents",
        active
    );

}


function renderParents() {

    const tableBody =
        document.getElementById(
            "parentsTableBody"
        );


    if (!tableBody) {
        return;
    }


    const count =
        filteredParents.length;


    updateRecordCount(
        count
    );


    const emptyState =
        document.getElementById(
            "emptyState"
        );


    if (count === 0) {

        tableBody.innerHTML = `
            <tr>

                <td
                    colspan="9"
                    class="table-empty"
                >
                    No parent records found.
                </td>

            </tr>
        `;


        if (emptyState) {

            emptyState.hidden =
                false;

        }


        return;

    }


    if (emptyState) {

        emptyState.hidden =
            true;

    }


    tableBody.innerHTML =
        filteredParents
            .map(
                (parent, index) =>
                    createParentRow(
                        parent,
                        index
                    )
            )
            .join("");

}


function updateRecordCount(
    count
) {

    const text =
        `Showing ${count} record${count === 1 ? "" : "s"}`;


    const badge =
        document.getElementById(
            "recordBadge"
        );


    const summary =
        document.getElementById(
            "recordSummary"
        );


    const parentSummary =
        document.getElementById(
            "parentRecordSummary"
        );


    if (badge) {

        badge.textContent =
            `${count} Record${count === 1 ? "" : "s"}`;

    }


    if (summary) {

        summary.textContent =
            text;

    }


    if (parentSummary) {

        parentSummary.textContent =
            text;

    }

}


function createParentRow(
    parent,
    index
) {

    const student =
        findStudent(
            parent.student_id
        );


    const parentName =
        `${parent.first_name || ""} ${parent.last_name || ""}`
            .trim() ||
        "—";


    const childName =
        student
            ? `${student.first_name || ""} ${student.last_name || ""}`.trim()
            : "Not assigned";


    const gender =
        formatText(
            parent.gender
        );


    const relationship =
        formatText(
            parent.relationship
        );


    const phone =
        parent.phone ||
        "Not provided";


    const email =
        parent.email ||
        "Not provided";


    const parentStatus =
        String(
            parent.status || ""
        )
            .trim()
            .toLowerCase();


    const statusText =
        formatText(
            parent.status
        );


    const statusClass =
        parentStatus === "active"
            ? "status-active"
            : "status-fullinactive";


    const parentPhoto =
        parent.photo_url
            ? `
                <img
                    src="${escapeAttribute(parent.photo_url)}"
                    alt="${escapeAttribute(parentName)}"
                >
            `
            : `
                <span>
                    ${escapeHtml(
                        getInitial(
                            parentName
                        )
                    )}
                </span>
            `;


    const childPhoto =
        student?.photo_url
            ? `
                <img
                    src="${escapeAttribute(student.photo_url)}"
                    alt="${escapeAttribute(childName)}"
                >
            `
            : `
                <span>
                    ${escapeHtml(
                        getInitial(
                            childName
                        )
                    )}
                </span>
            `;


    return `
        <tr>

            <td>
                ${index + 1}
            </td>

            <td>

                <div class="table-person">

                    <div class="table-avatar">
                        ${parentPhoto}
                    </div>

                    <div>

                        <strong>
                            ${escapeHtml(
                                parentName
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(
                                parent.parent_id ||
                                "—"
                            )}
                        </span>

                    </div>

                </div>

            </td>

            <td>
                ${escapeHtml(
                    gender
                )}
            </td>

            <td>
                ${escapeHtml(
                    relationship
                )}
            </td>

            <td>
                ${escapeHtml(
                    phone
                )}
            </td>

            <td>
                ${escapeHtml(
                    email
                )}
            </td>

            <td>

                <div class="table-person">

                    <div class="table-avatar">
                        ${childPhoto}
                    </div>

                    <div>

                        <strong>
                            ${escapeHtml(
                                childName
                            )}
                        </strong>

                        ${
                            student
                                ? `
                                    <span>
                                        ${escapeHtml(
                                            student.student_id ||
                                            "—"
                                        )}
                                    </span>
                                `
                                : ""
                        }

                    </div>

                </div>

            </td>

            <td>

                <span
                    class="status-badge ${statusClass}"
                >
                    ${escapeHtml(
                        statusText
                    )}
                </span>

            </td>

            <td>

                <div class="table-actions">

                    <a
                        href="/parents/view.html?id=${encodeURIComponent(parent.id)}"
                        class="action-btn view-btn"
                        title="View Parent"
                    >
                        👁 View
                    </a>

                    <a
                        href="/parents/edit.html?id=${encodeURIComponent(parent.id)}"
                        class="action-btn edit-btn"
                        title="Edit Parent"
                    >
                        ✏️ Edit
                    </a>

                    <button
                        type="button"
                        class="action-btn delete-btn"
                        data-id="${escapeAttribute(parent.id)}"
                        title="Delete Parent"
                    >
                        🗑 Delete
                    </button>

                </div>

            </td>

        </tr>
    `;

}


function findStudent(
    studentId
) {

    if (
        studentId === null ||
        studentId === undefined ||
        studentId === ""
    ) {
        return null;
    }


    return (
        students.find(
            student =>
                String(student.id) ===
                String(studentId)
        ) ||
        students.find(
            student =>
                String(student.student_id) ===
                String(studentId)
        ) ||
        null
    );

}


async function handleTableAction(
    event
) {

    const button =
        event.target.closest(
            ".delete-btn"
        );


    if (!button) {
        return;
    }


    const parentId =
        button.dataset.id;


    if (!parentId) {
        return;
    }


    const parent =
        parents.find(
            item =>
                String(item.id) ===
                String(parentId)
        );


    if (!parent) {
        return;
    }


    const parentName =
        `${parent.first_name || ""} ${parent.last_name || ""}`
            .trim() ||
        "this parent";


    const confirmed =
        window.confirm(
            `Are you sure you want to delete ${parentName}?`
        );


    if (!confirmed) {
        return;
    }


    button.disabled =
        true;


    try {

        const {
            error
        } =
            await supabase
                .from("parents")
                .delete()
                .eq(
                    "id",
                    parentId
                );


        if (error) {
            throw error;
        }


        parents =
            parents.filter(
                item =>
                    String(item.id) !==
                    String(parentId)
            );


        updateStatistics();

        applyFilters();


        showMessage(
            "Parent deleted successfully.",
            "success"
        );


    } catch (error) {

        console.error(
            "Delete parent error:",
            error
        );


        button.disabled =
            false;


        showMessage(
            error.message ||
            "Unable to delete parent.",
            "error"
        );

    }

}


function updateAdminProfile(
    profile
) {

    const fullName =
        `${profile.first_name || ""} ${profile.last_name || ""}`
            .trim() ||
        profile.username ||
        "Administrator";


    const name =
        document.getElementById(
            "adminHeaderName"
        );


    if (name) {

        name.textContent =
            fullName;

    }


    const avatar =
        document.getElementById(
            "adminAvatar"
        );


    if (!avatar) {
        return;
    }


    avatar.innerHTML =
        "";


    if (profile.photo_url) {

        const image =
            document.createElement(
                "img"
            );


        image.src =
            profile.photo_url;


        image.alt =
            fullName;


        image.className =
            "admin-profile-image";


        image.addEventListener(
            "error",
            () => {

                avatar.innerHTML =
                    "";

                avatar.textContent =
                    getInitial(
                        fullName
                    );

            }
        );


        avatar.appendChild(
            image
        );


    } else {

        avatar.textContent =
            getInitial(
                fullName
            );

    }

}


function setupLogout() {

    const button =
        document.getElementById(
            "logoutButton"
        );


    button?.addEventListener(
        "click",
        async () => {

            button.disabled =
                true;


            const {
                error
            } =
                await supabase
                    .auth
                    .signOut();


            if (error) {

                button.disabled =
                    false;


                showMessage(
                    error.message ||
                    "Unable to sign out.",
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

    const toggle =
        document.getElementById(
            "sidebarToggle"
        );


    const sidebar =
        document.querySelector(
            ".admin-sidebar"
        );


    toggle?.addEventListener(
        "click",
        () => {

            sidebar?.classList.toggle(
                "open"
            );

        }
    );

}


function setLoading() {

    const tableBody =
        document.getElementById(
            "parentsTableBody"
        );


    const emptyState =
        document.getElementById(
            "emptyState"
        );


    if (emptyState) {

        emptyState.hidden =
            true;

    }


    if (tableBody) {

        tableBody.innerHTML = `
            <tr>

                <td
                    colspan="9"
                    class="table-empty"
                >
                    Loading parent records...
                </td>

            </tr>
        `;

    }


    updateRecordCount(
        0
    );

}


function showMessage(
    text,
    type = "info"
) {

    const box =
        document.getElementById(
            "parentMessage"
        );


    if (!box) {
        return;
    }


    box.textContent =
        text;


    box.className =
        `message ${type}`;


    box.hidden =
        false;

}


function clearMessage() {

    const box =
        document.getElementById(
            "parentMessage"
        );


    if (!box) {
        return;
    }


    box.textContent =
        "";


    box.className =
        "message";


    box.hidden =
        true;

}


function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value ?? "0";

    }

}


function formatText(
    value
) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "—";
    }


    return String(value)
        .replace(
            /_/g,
            " "
        )
        .replace(
            /\b\w/g,
            letter =>
                letter.toUpperCase()
        );

}


function getInitial(
    name
) {

    return String(
        name || "P"
    )
        .trim()
        .charAt(0)
        .toUpperCase() ||
        "P";

}


function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
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


function escapeAttribute(
    value
) {

    return escapeHtml(
        value
    );

}