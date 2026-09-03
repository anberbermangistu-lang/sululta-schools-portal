import { supabase } from "./supabase.js";

const message = document.getElementById("message");
const refreshButton = document.getElementById("refreshAttendance");
const searchInput = document.getElementById("attendanceSearch");
const dateFilter = document.getElementById("dateFilter");
const statusFilter = document.getElementById("statusFilter");
const clearFiltersButton = document.getElementById("clearFilters");

const tableBody =
    document.getElementById("attendanceTableBody");

const sidebarToggle =
    document.getElementById("sidebarToggle");

const sidebar =
    document.querySelector(".admin-sidebar");

const logoutButton =
    document.getElementById("logoutButton");

const adminAvatar =
    document.getElementById("adminAvatar");

const adminHeaderName =
    document.getElementById("adminHeaderName");

const totalAttendance =
    document.getElementById("totalAttendance");

const presentCount =
    document.getElementById("presentCount");

const absentCount =
    document.getElementById("absentCount");

const lateCount =
    document.getElementById("lateCount");

const recordBadge =
    document.getElementById("recordBadge");

const recordSummary =
    document.getElementById("recordSummary");


let attendanceRecords = [];


document.addEventListener(
    "DOMContentLoaded",
    initialize
);


async function initialize() {

    setupSidebar();

    setupLogout();

    setupFilters();

    const allowed =
        await checkAdmin();

    if (!allowed) {
        return;
    }

    await loadAttendance();
}


async function checkAdmin() {

    const {
        data: {
            user
        },
        error
    } = await supabase
        .auth
        .getUser();


    if (error || !user) {

        window.location.href =
            "/login.html";

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
            email,
            role,
            photo_url,
            status
        `)
        .eq(
            "id",
            user.id
        )
        .maybeSingle();


    if (
        profileError ||
        !profile
    ) {

        await supabase
            .auth
            .signOut();

        window.location.href =
            "/login.html";

        return false;
    }


    const role =
        String(
            profile.role || ""
        )
            .trim()
            .toLowerCase();


    const status =
        String(
            profile.status || ""
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

        return false;
    }


    if (status !== "active") {

        await supabase
            .auth
            .signOut();

        window.location.href =
            "/login.html";

        return false;
    }


    updateAdminProfile(
        profile
    );


    return true;
}


async function loadAttendance() {

    showTableLoading();


    const {
        data,
        error
    } = await supabase
        .from("attendance")
        .select(`
            id,
            student_id,
            attendance_date,
            status,
            remark,
            created_at,
            students (
                id,
                student_id,
                first_name,
                last_name,
                class,
                section
            )
        `)
        .order(
            "attendance_date",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "Attendance error:",
            error
        );


        attendanceRecords = [];


        updateStatistics();


        showMessage(
            error.message ||
            "Failed to load attendance records.",
            "error"
        );


        showTableError(
            "Failed to load attendance records."
        );


        return;
    }


    attendanceRecords =
        Array.isArray(data)
            ? data
            : [];


    updateStatistics();

    applyFilters();
}


function updateStatistics() {

    const total =
        attendanceRecords.length;


    const present =
        attendanceRecords.filter(
            record =>
                normalizeStatus(
                    record.status
                ) === "present"
        ).length;


    const absent =
        attendanceRecords.filter(
            record =>
                normalizeStatus(
                    record.status
                ) === "absent"
        ).length;


    const late =
        attendanceRecords.filter(
            record =>
                normalizeStatus(
                    record.status
                ) === "late"
        ).length;


    setText(
        totalAttendance,
        total
    );


    setText(
        presentCount,
        present
    );


    setText(
        absentCount,
        absent
    );


    setText(
        lateCount,
        late
    );
}


function applyFilters() {

    const search =
        String(
            searchInput?.value || ""
        )
            .trim()
            .toLowerCase();


    const selectedDate =
        String(
            dateFilter?.value || ""
        )
            .trim();


    const selectedStatus =
        String(
            statusFilter?.value || ""
        )
            .trim()
            .toLowerCase();


    const filtered =
        attendanceRecords.filter(
            record => {

                const student =
                    record.students;


                const studentName =
                    `${student?.first_name || ""} ${student?.last_name || ""}`
                        .trim()
                        .toLowerCase();


                const studentId =
                    String(
                        student?.student_id ||
                        record.student_id ||
                        ""
                    )
                        .toLowerCase();


                const className =
                    String(
                        student?.class ||
                        ""
                    )
                        .toLowerCase();


                const section =
                    String(
                        student?.section ||
                        ""
                    )
                        .toLowerCase();


                const remark =
                    String(
                        record.remark ||
                        ""
                    )
                        .toLowerCase();


                const status =
                    normalizeStatus(
                        record.status
                    );


                const matchesSearch =
                    !search ||
                    studentName.includes(
                        search
                    ) ||
                    studentId.includes(
                        search
                    ) ||
                    className.includes(
                        search
                    ) ||
                    section.includes(
                        search
                    ) ||
                    remark.includes(
                        search
                    );


                const matchesDate =
                    !selectedDate ||
                    String(
                        record.attendance_date ||
                        ""
                    ).slice(
                        0,
                        10
                    ) === selectedDate;


                const matchesStatus =
                    !selectedStatus ||
                    selectedStatus === "all" ||
                    status === selectedStatus;


                return (
                    matchesSearch &&
                    matchesDate &&
                    matchesStatus
                );
            }
        );


    renderTable(
        filtered
    );
}


function renderTable(
    records
) {

    if (!tableBody) {
        return;
    }


    if (!records.length) {

        tableBody.innerHTML = `
            <tr>

                <td
                    colspan="8"
                    class="table-empty"
                >
                    No attendance records found.
                </td>

            </tr>
        `;


        updateRecordInformation(
            0
        );


        return;
    }


    tableBody.innerHTML =
        records
            .map(
                (
                    record,
                    index
                ) =>
                    createAttendanceRow(
                        record,
                        index
                    )
            )
            .join("");


    updateRecordInformation(
        records.length
    );


    setupDeleteButtons();
}


function createAttendanceRow(
    record,
    index
) {

    const student =
        record.students;


    const studentName =
        `${student?.first_name || ""} ${student?.last_name || ""}`
            .trim() ||
        "Unknown Student";


    const studentId =
        student?.student_id ||
        record.student_id ||
        "—";


    const className =
        student?.class ||
        "—";


    const section =
        student?.section ||
        "";


    const classDisplay =
        section
            ? `${className} - ${section}`
            : className;


    const status =
        normalizeStatus(
            record.status
        );


    const statusText =
        formatStatus(
            status
        );


    const statusClass =
        getStatusClass(
            status
        );


    const date =
        formatDate(
            record.attendance_date
        );


    const remark =
        record.remark ||
        "—";


    return `
        <tr>

            <td>
                ${index + 1}
            </td>

            <td>
                ${escapeHtml(date)}
            </td>

            <td>
                ${escapeHtml(studentId)}
            </td>

            <td>
                <strong>
                    ${escapeHtml(studentName)}
                </strong>
            </td>

            <td>
                ${escapeHtml(classDisplay)}
            </td>

            <td>

                <span
                    class="status-badge ${statusClass}"
                >
                    ${escapeHtml(statusText)}
                </span>

            </td>

            <td>
                ${escapeHtml(remark)}
            </td>

            <td>

                <div class="table-actions">

                    <a
                        href="/attendance/view.html?id=${encodeURIComponent(record.id)}"
                        class="action-btn view-btn"
                        title="View Attendance"
                    >
                        View
                    </a>

                    <a
                        href="/attendance/edit.html?id=${encodeURIComponent(record.id)}"
                        class="action-btn edit-btn"
                        title="Edit Attendance"
                    >
                        Edit
                    </a>

                    <button
                        type="button"
                        class="action-btn delete-btn"
                        data-id="${escapeHtml(record.id)}"
                        title="Delete Attendance"
                    >
                        Delete
                    </button>

                </div>

            </td>

        </tr>
    `;
}


function setupDeleteButtons() {

    const deleteButtons =
        document.querySelectorAll(
            ".delete-btn"
        );


    deleteButtons.forEach(
        button => {

            button.addEventListener(
                "click",
                async () => {

                    const id =
                        button.dataset.id;


                    if (!id) {
                        return;
                    }


                    const confirmed =
                        window.confirm(
                            "Are you sure you want to delete this attendance record?"
                        );


                    if (!confirmed) {
                        return;
                    }


                    await deleteAttendance(
                        id,
                        button
                    );
                }
            );
        }
    );
}


async function deleteAttendance(
    id,
    button
) {

    if (button) {

        button.disabled =
            true;

        button.textContent =
            "Deleting...";
    }


    const {
        error
    } = await supabase
        .from("attendance")
        .delete()
        .eq(
            "id",
            id
        );


    if (error) {

        console.error(
            "Delete attendance error:",
            error
        );


        if (button) {

            button.disabled =
                false;

            button.textContent =
                "Delete";
        }


        showMessage(
            error.message ||
            "Failed to delete attendance record.",
            "error"
        );


        return;
    }


    showMessage(
        "Attendance record deleted successfully.",
        "success"
    );


    await loadAttendance();
}


function updateRecordInformation(
    count
) {

    if (recordBadge) {

        recordBadge.textContent =
            `${count} Record${count === 1 ? "" : "s"}`;
    }


    if (recordSummary) {

        recordSummary.textContent =
            `Showing ${count} record${count === 1 ? "" : "s"}`;
    }
}


function setupFilters() {

    searchInput?.addEventListener(
        "input",
        applyFilters
    );


    dateFilter?.addEventListener(
        "change",
        applyFilters
    );


    statusFilter?.addEventListener(
        "change",
        applyFilters
    );


    clearFiltersButton?.addEventListener(
        "click",
        () => {

            if (searchInput) {
                searchInput.value = "";
            }


            if (dateFilter) {
                dateFilter.value = "";
            }


            if (statusFilter) {
                statusFilter.value = "";
            }


            applyFilters();
        }
    );


    refreshButton?.addEventListener(
        "click",
        async () => {

            await loadAttendance();

        }
    );
}


function setupSidebar() {

    sidebarToggle?.addEventListener(
        "click",
        () => {

            sidebar?.classList.toggle(
                "mobile-open"
            );
        }
    );
}


function setupLogout() {

    logoutButton?.addEventListener(
        "click",
        async () => {

            const {
                error
            } = await supabase
                .auth
                .signOut();


            if (error) {

                showMessage(
                    error.message ||
                    "Failed to sign out.",
                    "error"
                );

                return;
            }


            window.location.href =
                "/login.html";
        }
    );
}


function updateAdminProfile(
    profile
) {

    const fullName =
        `${profile.first_name || ""} ${profile.last_name || ""}`
            .trim() ||
        profile.username ||
        "Administrator";


    if (adminHeaderName) {

        adminHeaderName.textContent =
            fullName;
    }


    if (!adminAvatar) {
        return;
    }


    adminAvatar.classList.remove(
        "has-photo"
    );


    if (profile.photo_url) {

        adminAvatar.classList.add(
            "has-photo"
        );


        adminAvatar.innerHTML =
            "";


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


        adminAvatar.appendChild(
            image
        );

    } else {

        adminAvatar.textContent =
            fullName
                .charAt(0)
                .toUpperCase();
    }
}


function showTableLoading() {

    if (!tableBody) {
        return;
    }


    tableBody.innerHTML = `
        <tr>

            <td
                colspan="8"
                class="table-empty"
            >
                Loading attendance records...
            </td>

        </tr>
    `;
}


function showTableError(
    text
) {

    if (!tableBody) {
        return;
    }


    tableBody.innerHTML = `
        <tr>

            <td
                colspan="8"
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


    message.textContent =
        text;


    message.className =
        `message ${type}`;


    message.hidden =
        false;


    window.setTimeout(
        () => {

            message.hidden =
                true;

        },
        4000
    );
}


function normalizeStatus(
    value
) {

    return String(
        value || ""
    )
        .trim()
        .toLowerCase();
}


function formatStatus(
    value
) {

    const normalized =
        normalizeStatus(
            value
        );


    if (!normalized) {
        return "Unknown";
    }


    return normalized
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


function getStatusClass(
    status
) {

    switch (
        normalizeStatus(
            status
        )
    ) {

        case "present":
            return "status-active";

        case "absent":
            return "status-inactive";

        case "late":
            return "status-pending";

        case "excused":
            return "status-fullinactive";

        default:
            return "status-fullinactive";
    }
}


function formatDate(
    value
) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(value);
    }


    return date.toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
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


function setText(
    element,
    value
) {

    if (element) {
        element.textContent =
            value;
    }
}