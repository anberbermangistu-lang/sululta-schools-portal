import { supabase } from "./supabase.js";

const tableBody =
    document.getElementById("noticesTable");

const totalNotices =
    document.getElementById("totalNotices");

const totalNoticeTypes =
    document.getElementById("totalNoticeTypes");

const totalAudiences =
    document.getElementById("totalAudiences");

const activeNotices =
    document.getElementById("activeNotices");

const searchInput =
    document.getElementById("searchInput");

const noticeTypeFilter =
    document.getElementById("noticeTypeFilter");

const audienceFilter =
    document.getElementById("audienceFilter");

const clearFilters =
    document.getElementById("clearFilters");

const refreshButton =
    document.getElementById("refreshButton");

const recordBadge =
    document.getElementById("recordBadge");

const recordSummary =
    document.getElementById("recordSummary");

const messageBox =
    document.getElementById("messageBox");

const adminAvatar =
    document.getElementById("adminAvatar");

const adminHeaderName =
    document.getElementById("adminHeaderName");

const logoutButton =
    document.getElementById("logoutButton");

const sidebarToggle =
    document.getElementById("sidebarToggle");

const sidebar =
    document.querySelector(".admin-sidebar");

let notices = [];


document.addEventListener(
    "DOMContentLoaded",
    initialize
);


async function initialize() {

    setupSidebar();

    setupLogout();

    await loadAdminProfile();

    await loadNotices();

    setupFilters();

}


async function loadAdminProfile() {

    const {
        data: {
            user
        },
        error: userError
    } = await supabase.auth.getUser();

    if (
        userError ||
        !user
    ) {

        window.location.href =
            "/login.html";

        return;

    }


    const {
        data: profile,
        error
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
        .eq("id", user.id)
        .maybeSingle();


    if (
        error ||
        !profile
    ) {

        await supabase.auth.signOut();

        window.location.href =
            "/login.html";

        return;

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


    if (
        role !== "admin" ||
        status !== "active"
    ) {

        await supabase.auth.signOut();

        window.location.href =
            "/login.html";

        return;

    }


    const fullName =
        `${profile.first_name || ""} ${profile.last_name || ""}`
            .trim() ||
        profile.username ||
        "Administrator";


    if (adminHeaderName) {

        adminHeaderName.textContent =
            fullName;

    }


    if (adminAvatar) {

        if (profile.photo_url) {

            adminAvatar.innerHTML = "";

            const image =
                document.createElement("img");

            image.src =
                profile.photo_url;

            image.alt =
                fullName;

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

}


async function loadNotices() {

    if (!tableBody) {
        return;
    }


    tableBody.innerHTML = `
        <tr>
            <td
                colspan="7"
                class="table-empty"
            >
                Loading notices...
            </td>
        </tr>
    `;


    const {
        data,
        error
    } = await supabase
        .from("notices")
        .select("*")
        .order(
            "publish_date",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "Failed to load notices:",
            error
        );


        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="table-empty"
                >
                    Failed to load notices.
                </td>
            </tr>
        `;


        showMessage(
            error.message ||
            "Failed to load notices.",
            "error"
        );

        updateRecordCount(0);

        return;

    }


    notices =
        data || [];


    updateStatistics();

    buildNoticeTypeFilter();

    buildAudienceFilter();

    displayNotices();

}


function updateStatistics() {

    if (totalNotices) {

        totalNotices.textContent =
            notices.length;

    }


    const noticeTypes =
        new Set(
            notices
                .map(
                    notice =>
                        notice.notice_type ||
                        notice.type ||
                        "Notice"
                )
                .filter(Boolean)
        );


    if (totalNoticeTypes) {

        totalNoticeTypes.textContent =
            noticeTypes.size;

    }


    const audiences =
        new Set(
            notices
                .map(
                    notice =>
                        notice.audience
                )
                .filter(Boolean)
        );


    if (totalAudiences) {

        totalAudiences.textContent =
            audiences.size;

    }


    const today =
        new Date();


    today.setHours(
        0,
        0,
        0,
        0
    );


    const active =
        notices.filter(
            notice => {

                if (!notice.publish_date) {
                    return false;
                }


                const publishDate =
                    new Date(
                        `${notice.publish_date}T00:00:00`
                    );


                if (
                    publishDate >
                    today
                ) {

                    return false;

                }


                if (
                    notice.expiry_date
                ) {

                    const expiryDate =
                        new Date(
                            `${notice.expiry_date}T23:59:59`
                        );


                    if (
                        expiryDate <
                        today
                    ) {

                        return false;

                    }

                }


                return true;

            }
        );


    if (activeNotices) {

        activeNotices.textContent =
            active.length;

    }

}


function buildNoticeTypeFilter() {

    if (!noticeTypeFilter) {
        return;
    }


    const currentValue =
        noticeTypeFilter.value;


    const types =
        [
            ...new Set(
                notices
                    .map(
                        notice =>
                            notice.notice_type ||
                            notice.type ||
                            "Notice"
                    )
                    .filter(Boolean)
            )
        ]
            .sort();


    noticeTypeFilter.innerHTML = `
        <option value="">
            All Notice Types
        </option>
    `;


    types.forEach(
        type => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                type;

            option.textContent =
                type;

            noticeTypeFilter.appendChild(
                option
            );

        }
    );


    noticeTypeFilter.value =
        currentValue;

}


function buildAudienceFilter() {

    if (!audienceFilter) {
        return;
    }


    const currentValue =
        audienceFilter.value;


    const audiences =
        [
            ...new Set(
                notices
                    .map(
                        notice =>
                            notice.audience
                    )
                    .filter(Boolean)
            )
        ]
            .sort();


    audienceFilter.innerHTML = `
        <option value="">
            All Audiences
        </option>
    `;


    audiences.forEach(
        audience => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                audience;

            option.textContent =
                audience;

            audienceFilter.appendChild(
                option
            );

        }
    );


    audienceFilter.value =
        currentValue;

}


function displayNotices() {

    const search =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";


    const selectedType =
        noticeTypeFilter
            ? noticeTypeFilter.value
            : "";


    const selectedAudience =
        audienceFilter
            ? audienceFilter.value
            : "";


    const filtered =
        notices.filter(
            notice => {

                const noticeType =
                    notice.notice_type ||
                    notice.type ||
                    "Notice";


                const matchesSearch =
                    !search ||
                    String(
                        notice.title || ""
                    )
                        .toLowerCase()
                        .includes(search) ||

                    String(
                        notice.message || ""
                    )
                        .toLowerCase()
                        .includes(search) ||

                    String(
                        notice.audience || ""
                    )
                        .toLowerCase()
                        .includes(search) ||

                    String(
                        noticeType
                    )
                        .toLowerCase()
                        .includes(search);


                const matchesType =
                    !selectedType ||
                    noticeType ===
                    selectedType;


                const matchesAudience =
                    !selectedAudience ||
                    notice.audience ===
                    selectedAudience;


                return (
                    matchesSearch &&
                    matchesType &&
                    matchesAudience
                );

            }
        );


    updateRecordCount(
        filtered.length
    );


    if (
        filtered.length === 0
    ) {

        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="table-empty"
                >
                    No notices found.
                </td>
            </tr>
        `;

        return;

    }


    tableBody.innerHTML =
        filtered
            .map(
                (
                    notice,
                    index
                ) =>
                    createNoticeRow(
                        notice,
                        index
                    )
            )
            .join("");

}


function createNoticeRow(
    notice,
    index
) {

    const id =
        encodeURIComponent(
            notice.id
        );


    const noticeType =
        notice.notice_type ||
        notice.type ||
        "Notice";


    return `
        <tr>

            <td>
                ${index + 1}
            </td>

            <td>
                <strong>
                    ${escapeHtml(
                        notice.title ||
                        "—"
                    )}
                </strong>
            </td>

            <td>
                ${escapeHtml(
                    noticeType
                )}
            </td>

            <td>
                ${escapeHtml(
                    notice.audience ||
                    "—"
                )}
            </td>

            <td>
                ${formatDate(
                    notice.publish_date
                )}
            </td>

            <td>
                ${formatDate(
                    notice.expiry_date
                )}
            </td>

            <td>

                <div class="table-actions">

                    <a
                        href="/notices/view.html?id=${id}"
                        class="action-btn view-btn"
                        title="View Notice"
                    >
                        View
                    </a>

                    <a
                        href="/notices/edit.html?id=${id}"
                        class="action-btn edit-btn"
                        title="Edit Notice"
                    >
                        Edit
                    </a>

                    <button
                        type="button"
                        class="action-btn delete-btn"
                        data-id="${escapeHtml(
                            notice.id
                        )}"
                        title="Delete Notice"
                    >
                        Delete
                    </button>

                </div>

            </td>

        </tr>
    `;

}


function setupFilters() {

    searchInput?.addEventListener(
        "input",
        displayNotices
    );


    noticeTypeFilter?.addEventListener(
        "change",
        displayNotices
    );


    audienceFilter?.addEventListener(
        "change",
        displayNotices
    );


    clearFilters?.addEventListener(
        "click",
        clearAllFilters
    );


    refreshButton?.addEventListener(
        "click",
        async () => {

            await loadNotices();

        }
    );


    tableBody?.addEventListener(
        "click",
        handleTableClick
    );

}


function clearAllFilters() {

    if (searchInput) {

        searchInput.value =
            "";

    }


    if (noticeTypeFilter) {

        noticeTypeFilter.value =
            "";

    }


    if (audienceFilter) {

        audienceFilter.value =
            "";

    }


    displayNotices();

}


async function handleTableClick(
    event
) {

    const deleteButton =
        event.target.closest(
            ".delete-btn"
        );


    if (!deleteButton) {
        return;
    }


    const id =
        deleteButton.dataset.id;


    if (!id) {
        return;
    }


    const confirmed =
        window.confirm(
            "Are you sure you want to delete this notice?"
        );


    if (!confirmed) {
        return;
    }


    deleteButton.disabled =
        true;

    deleteButton.textContent =
        "Deleting...";


    const {
        error
    } = await supabase
        .from("notices")
        .delete()
        .eq(
            "id",
            id
        );


    if (error) {

        console.error(
            "Delete notice error:",
            error
        );


        deleteButton.disabled =
            false;

        deleteButton.textContent =
            "Delete";


        showMessage(
            error.message ||
            "Failed to delete notice.",
            "error"
        );

        return;

    }


    showMessage(
        "Notice deleted successfully.",
        "success"
    );


    await loadNotices();

}


function updateRecordCount(
    count
) {

    if (recordBadge) {

        recordBadge.textContent =
            `${count} ${
                count === 1
                    ? "Record"
                    : "Records"
            }`;

    }


    if (recordSummary) {

        recordSummary.textContent =
            `Showing ${count} ${
                count === 1
                    ? "record"
                    : "records"
            }`;

    }

}


function formatDate(
    value
) {

    if (!value) {
        return "—";
    }


    const date =
        new Date(
            `${value}T00:00:00`
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";

    }


    return date.toLocaleDateString(
        "en-US",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );

}


function escapeHtml(
    value
) {

    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


function showMessage(
    text,
    type = "info"
) {

    if (!messageBox) {
        return;
    }


    messageBox.textContent =
        text;

    messageBox.className =
        `message ${type}`;

    messageBox.hidden =
        false;


    setTimeout(
        () => {

            messageBox.hidden =
                true;

        },
        4000
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
            } = await supabase.auth.signOut();


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