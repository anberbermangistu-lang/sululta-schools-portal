import { supabase } from "./supabase.js";

let allTimetable = [];
let assignedClasses = [];

async function initializeTeacherTimetable() {

    const {
        data: {
            user
        },
        error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
        window.location.href = "/login.html";
        return;
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
            email,
            username,
            role,
            status,
            photo_url
        `)
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile) {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return;
    }

    const role =
        String(profile.role || "")
            .trim()
            .toLowerCase();

    const status =
        String(profile.status || "")
            .trim()
            .toLowerCase();

    if (role !== "teacher") {

        if (role === "admin") {
            window.location.href = "/admin/dashboard.html";
        } else {
            window.location.href = "/login.html";
        }

        return;
    }

    if (status !== "active") {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return;
    }

    const {
        data: teacher,
        error: teacherError
    } = await supabase
        .from("teachers")
        .select(`
            id,
            teacher_id,
            first_name,
            last_name,
            photo_url,
            status
        `)
        .eq("user_id", user.id)
        .maybeSingle();

    if (teacherError || !teacher) {

        console.error(
            "Teacher error:",
            teacherError
        );

        showMessage(
            "Teacher record could not be found."
        );

        return;
    }

    displayTeacher(
        profile,
        teacher
    );

    await loadAssignedClasses(
        teacher.id
    );

    setupFilters();
    setupRefresh();
    setupLogout();
    setupSidebar();
}

async function loadAssignedClasses(
    teacherId
) {

    const {
        data: classes,
        error
    } = await supabase
        .from("classes")
        .select(`
            id,
            class_name,
            section,
            room_number,
            academic_year,
            status
        `)
        .eq(
            "class_teacher",
            teacherId
        )
        .order(
            "class_name",
            {
                ascending: true
            }
        );

    if (error) {

        console.error(
            "Assigned classes error:",
            error
        );

        showMessage(
            error.message
        );

        return;
    }

    assignedClasses =
        classes || [];

    setText(
        "totalClasses",
        assignedClasses.length
    );

    populateClassFilter();

    await loadTimetable();
}

async function loadTimetable() {

    const tableBody =
        document.getElementById(
            "timetableTableBody"
        );

    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = `
        <tr>
            <td
                colspan="7"
                class="table-empty"
            >
                Loading timetable...
            </td>
        </tr>
    `;

    if (!assignedClasses.length) {

        allTimetable = [];

        updateStatistics(
            []
        );

        renderTimetable(
            []
        );

        return;
    }

    const timetableResults = [];

    for (const classItem of assignedClasses) {

        const className =
            String(
                classItem.class_name || ""
            ).trim();

        const section =
            String(
                classItem.section || ""
            ).trim();

        if (!className || !section) {
            continue;
        }

        const {
            data,
            error
        } = await supabase
            .from("timetable")
            .select(`
                id,
                class_name,
                section,
                subject_code,
                subject_name,
                day,
                start_time,
                end_time,
                room_number,
                academic_year
            `)
            .ilike(
                "class_name",
                className
            )
            .ilike(
                "section",
                section
            )
            .order(
                "day",
                {
                    ascending: true
                }
            )
            .order(
                "start_time",
                {
                    ascending: true
                }
            );

        if (error) {

            console.error(
                "Timetable error:",
                error
            );

            continue;
        }

        if (data && data.length) {
            timetableResults.push(
                ...data
            );
        }
    }

    allTimetable =
        timetableResults;

    updateStatistics(
        allTimetable
    );

    renderTimetable(
        allTimetable
    );
}

function populateClassFilter() {

    const select =
        document.getElementById(
            "classFilter"
        );

    if (!select) {
        return;
    }

    select.innerHTML = `
        <option value="">
            All Classes
        </option>
    `;

    assignedClasses.forEach(
        item => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                `${item.class_name}|||${item.section}`;

            option.textContent =
                `${item.class_name} - ${item.section}`;

            select.appendChild(
                option
            );
        }
    );
}

function renderTimetable(
    records
) {

    const tableBody =
        document.getElementById(
            "timetableTableBody"
        );

    const emptyState =
        document.getElementById(
            "timetableEmptyState"
        );

    if (!tableBody) {
        return;
    }

    if (!records.length) {

        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="table-empty"
                >
                    No timetable records found.
                </td>
            </tr>
        `;

        if (emptyState) {
            emptyState.hidden = false;
        }

        return;
    }

    if (emptyState) {
        emptyState.hidden = true;
    }

    tableBody.innerHTML =
        records
            .map(
                (item, index) => {

                    return `
                        <tr>

                            <td>
                                ${index + 1}
                            </td>

                            <td>
                                <strong>
                                    ${escapeHtml(
                                        `${item.class_name || "—"} - ${item.section || "—"}`
                                    )}
                                </strong>
                            </td>

                            <td>
                                ${escapeHtml(
                                    item.subject_code ||
                                    "—"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    item.subject_name ||
                                    "—"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    item.day ||
                                    "—"
                                )}
                            </td>

                            <td>
                                ${formatTime(
                                    item.start_time
                                )}
                            </td>

                            <td>
                                ${formatTime(
                                    item.end_time
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    item.room_number ||
                                    "—"
                                )}
                            </td>

                        </tr>
                    `;
                }
            )
            .join("");

    updateSummary(
        records.length
    );
}

function setupFilters() {

    const classFilter =
        document.getElementById(
            "classFilter"
        );

    const dayFilter =
        document.getElementById(
            "dayFilter"
        );

    const subjectSearch =
        document.getElementById(
            "subjectSearch"
        );

    const clearButton =
        document.getElementById(
            "clearFilters"
        );

    classFilter?.addEventListener(
        "change",
        applyFilters
    );

    dayFilter?.addEventListener(
        "change",
        applyFilters
    );

    subjectSearch?.addEventListener(
        "input",
        applyFilters
    );

    clearButton?.addEventListener(
        "click",
        () => {

            if (classFilter) {
                classFilter.value = "";
            }

            if (dayFilter) {
                dayFilter.value = "";
            }

            if (subjectSearch) {
                subjectSearch.value = "";
            }

            applyFilters();
        }
    );
}

function applyFilters() {

    const classFilter =
        document.getElementById(
            "classFilter"
        );

    const dayFilter =
        document.getElementById(
            "dayFilter"
        );

    const subjectSearch =
        document.getElementById(
            "subjectSearch"
        );

    const classValue =
        classFilter?.value || "";

    const dayValue =
        String(
            dayFilter?.value || ""
        )
        .trim()
        .toLowerCase();

    const searchValue =
        String(
            subjectSearch?.value || ""
        )
        .trim()
        .toLowerCase();

    let filtered =
        [...allTimetable];

    if (classValue) {

        const [
            selectedClass,
            selectedSection
        ] =
            classValue.split(
                "|||"
            );

        filtered =
            filtered.filter(
                item =>
                    String(
                        item.class_name || ""
                    )
                    .trim()
                    .toLowerCase() ===
                    String(
                        selectedClass || ""
                    )
                    .trim()
                    .toLowerCase()
                    &&
                    String(
                        item.section || ""
                    )
                    .trim()
                    .toLowerCase() ===
                    String(
                        selectedSection || ""
                    )
                    .trim()
                    .toLowerCase()
            );
    }

    if (dayValue) {

        filtered =
            filtered.filter(
                item =>
                    String(
                        item.day || ""
                    )
                    .trim()
                    .toLowerCase() ===
                    dayValue
            );
    }

    if (searchValue) {

        filtered =
            filtered.filter(
                item => {

                    const subject =
                        String(
                            item.subject_name ||
                            ""
                        )
                        .toLowerCase();

                    const code =
                        String(
                            item.subject_code ||
                            ""
                        )
                        .toLowerCase();

                    return (
                        subject.includes(
                            searchValue
                        )
                        ||
                        code.includes(
                            searchValue
                        )
                    );
                }
            );
    }

    renderTimetable(
        filtered
    );
}

function updateStatistics(
    records
) {

    setText(
        "totalEntries",
        records.length
    );

    const classSet =
        new Set(
            records.map(
                item =>
                    `${item.class_name || ""}-${item.section || ""}`
            )
        );

    setText(
        "totalClasses",
        assignedClasses.length
            ? assignedClasses.length
            : classSet.size
    );

    const subjectSet =
        new Set(
            records
                .map(
                    item =>
                        String(
                            item.subject_code ||
                            item.subject_name ||
                            ""
                        )
                        .trim()
                        .toLowerCase()
                )
                .filter(Boolean)
        );

    setText(
        "totalSubjects",
        subjectSet.size
    );

    const years =
        records
            .map(
                item =>
                    item.academic_year
            )
            .filter(Boolean);

    const uniqueYears =
        [...new Set(years)];

    setText(
        "academicYear",
        uniqueYears.length === 1
            ? uniqueYears[0]
            : uniqueYears.length
                ? uniqueYears.join(", ")
                : "—"
    );

    setText(
        "recordBadge",
        `${records.length} Records`
    );

    setText(
        "recordSummary",
        `Showing ${records.length} records`
    );
}

function updateSummary(
    count
) {

    setText(
        "recordBadge",
        `${count} Records`
    );

    setText(
        "recordSummary",
        `Showing ${count} records`
    );
}

function displayTeacher(
    profile,
    teacher
) {

    const fullName =
        `${teacher.first_name || profile.first_name || ""} ${teacher.last_name || profile.last_name || ""}`
            .trim()
        ||
        profile.username
        ||
        "Teacher";

    setText(
        "teacherHeaderName",
        fullName
    );

    const avatar =
        document.getElementById(
            "teacherAvatar"
        );

    const photo =
        teacher.photo_url ||
        profile.photo_url;

    if (
        avatar &&
        photo
    ) {

        avatar.innerHTML = "";

        const image =
            document.createElement(
                "img"
            );

        image.src = photo;
        image.alt = fullName;

        avatar.appendChild(
            image
        );

    } else if (avatar) {

        avatar.textContent =
            fullName
                .charAt(0)
                .toUpperCase();
    }
}

function setupRefresh() {

    const button =
        document.getElementById(
            "refreshTimetable"
        );

    button?.addEventListener(
        "click",
        async () => {

            await loadTimetable();
        }
    );
}

function setupLogout() {

    const button =
        document.getElementById(
            "logoutButton"
        );

    button?.addEventListener(
        "click",
        async () => {

            await supabase.auth.signOut();

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
                "mobile-open"
            );
        }
    );
}

function formatTime(
    value
) {

    if (!value) {
        return "—";
    }

    const parts =
        String(value)
            .split(":");

    if (parts.length < 2) {
        return escapeHtml(
            value
        );
    }

    return `${parts[0]}:${parts[1]}`;
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
            value;
    }
}

function showMessage(
    message
) {

    const element =
        document.getElementById(
            "timetableMessage"
        );

    if (element) {

        element.textContent =
            message;

        element.classList.add(
            "error"
        );
    }

    const tableBody =
        document.getElementById(
            "timetableTableBody"
        );

    if (tableBody) {

        tableBody.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="table-empty"
                >
                    ${escapeHtml(message)}
                </td>
            </tr>
        `;
    }
}

function escapeHtml(
    value
) {

    return String(value)
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

initializeTeacherTimetable();