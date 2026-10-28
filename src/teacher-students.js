import { supabase } from "./supabase.js";

let teacher = null;
let classes = [];
let students = [];
let filteredStudents = [];

async function getTeacher() {

    const {
        data: {
            user
        },
        error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {

        window.location.href =
            "/login.html";

        return null;
    }

    const {
        data: profile,
        error: profileError
    } = await supabase
        .from("profiles")
        .select(`
            id,
            role,
            status
        `)
        .eq(
            "id",
            user.id
        )
        .maybeSingle();

    if (profileError || !profile) {

        await supabase.auth.signOut();

        window.location.href =
            "/login.html";

        return null;
    }

    const role =
        String(profile.role || "")
            .trim()
            .toLowerCase();

    const status =
        String(profile.status || "")
            .trim()
            .toLowerCase();

    if (
        role !== "teacher" ||
        status !== "active"
    ) {

        await supabase.auth.signOut();

        window.location.href =
            "/login.html";

        return null;
    }

    const {
        data: teacherRecord,
        error: teacherError
    } = await supabase
        .from("teachers")
        .select(`
            id,
            teacher_id,
            first_name,
            last_name,
            email,
            phone,
            photo_url,
            user_id,
            status
        `)
        .eq(
            "user_id",
            user.id
        )
        .maybeSingle();

    if (teacherError || !teacherRecord) {

        console.error(
            "Teacher error:",
            teacherError
        );

        showMessage(
            "Your teacher account is not connected to a teacher record."
        );

        return null;
    }

    return teacherRecord;
}

async function loadClasses() {

    const {
        data,
        error
    } = await supabase
        .from("classes")
        .select(`
            id,
            class_name,
            section,
            room_number,
            class_teacher,
            academic_year,
            status
        `)
        .eq(
            "status",
            "active"
        )
        .order(
            "class_name"
        );

    if (error) {

        console.error(
            "Classes error:",
            error
        );

        showMessage(
            "Unable to load your classes: " +
            error.message
        );

        return;
    }

    classes =
        data || [];

    const filter =
        document.getElementById(
            "classFilter"
        );

    if (!filter) {
        return;
    }

    filter.innerHTML = `
        <option value="">
            All Classes
        </option>
    `;

    classes.forEach(
        item => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                String(item.id);

            option.textContent =
                `${item.class_name} - ${item.section}`;

            filter.appendChild(
                option
            );
        }
    );

    const totalClasses =
        document.getElementById(
            "totalClasses"
        );

    if (totalClasses) {

        totalClasses.textContent =
            classes.length;
    }
}

async function loadStudents() {

    if (classes.length === 0) {

        students = [];

        renderStudents();

        showMessage(
            "You currently have no assigned classes."
        );

        return;
    }

    const classIds =
        classes.map(
            item => item.id
        );

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
            class_id
        `)
        .in(
            "class_id",
            classIds
        )
        .order(
            "first_name"
        );

    if (error) {

        console.error(
            "Students error:",
            error
        );

        showMessage(
            "Unable to load students: " +
            error.message
        );

        return;
    }

    students =
        data || [];

    filteredStudents =
        [...students];

    updateStatistics();

    renderStudents();

    showMessage(
        `${students.length} student(s) loaded.`,
        "success"
    );
}

function updateStatistics() {

    const total =
        document.getElementById(
            "totalStudents"
        );

    const male =
        document.getElementById(
            "maleStudents"
        );

    const female =
        document.getElementById(
            "femaleStudents"
        );

    const active =
        students.filter(
            student =>
                String(
                    student.status || ""
                ).toLowerCase() ===
                "active"
        );

    const maleCount =
        students.filter(
            student =>
                String(
                    student.gender || ""
                ).toLowerCase() ===
                "male"
        ).length;

    const femaleCount =
        students.filter(
            student =>
                String(
                    student.gender || ""
                ).toLowerCase() ===
                "female"
        ).length;

    if (total) {

        total.textContent =
            students.length;
    }

    if (male) {

        male.textContent =
            maleCount;
    }

    if (female) {

        female.textContent =
            femaleCount;
    }

    const badge =
        document.getElementById(
            "recordBadge"
        );

    if (badge) {

        badge.textContent =
            `${students.length} Records`;
    }

    const summary =
        document.getElementById(
            "recordSummary"
        );

    if (summary) {

        summary.textContent =
            `Showing ${filteredStudents.length} of ${students.length} records`;
    }
}

function renderStudents() {

    const body =
        document.getElementById(
            "studentsTableBody"
        );

    const empty =
        document.getElementById(
            "studentsEmptyState"
        );

    if (!body) {
        return;
    }

    if (filteredStudents.length === 0) {

        body.innerHTML = `
            <tr>

                <td
                    colspan="7"
                    class="table-empty">

                    No students found.

                </td>

            </tr>
        `;

        if (empty) {
            empty.hidden = false;
        }

        updateStatistics();

        return;
    }

    if (empty) {
        empty.hidden = true;
    }

    body.innerHTML =
        filteredStudents.map(
            student => {

                const fullName =
                    `${student.first_name || ""} ${student.last_name || ""}`
                        .trim();

                const classRecord =
                    classes.find(
                        item =>
                            String(item.id) ===
                            String(student.class_id)
                    );

                const className =
                    classRecord?.class_name ||
                    student.class ||
                    "—";

                const section =
                    classRecord?.section ||
                    student.section ||
                    "—";

                const status =
                    String(
                        student.status || ""
                    ).toLowerCase();

                const statusClass =
                    status === "active"
                        ? "status-active"
                        : "status-inactive";

                return `
                    <tr>

                        <td>

                            <div
                                class="student-table-name">

                                <strong>
                                    ${escapeHtml(
                                        fullName ||
                                        "Unnamed Student"
                                    )}
                                </strong>

                            </div>

                        </td>

                        <td>
                            ${escapeHtml(
                                student.student_id ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                student.gender ||
                                "—"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                className
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                section
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                student.phone ||
                                "—"
                            )}
                        </td>

                        <td>

                            <span
                                class="${statusClass}">

                                ${escapeHtml(
                                    student.status ||
                                    "Unknown"
                                )}

                            </span>

                        </td>

                    </tr>
                `;
            }
        ).join("");

    updateStatistics();
}

function applyFilters() {

    const search =
        document.getElementById(
            "studentSearch"
        )?.value
            .trim()
            .toLowerCase() ||
        "";

    const classId =
        document.getElementById(
            "classFilter"
        )?.value ||
        "";

    const gender =
        document.getElementById(
            "genderFilter"
        )?.value ||
        "";

    const status =
        document.getElementById(
            "statusFilter"
        )?.value ||
        "";

    filteredStudents =
        students.filter(
            student => {

                const fullName =
                    `${student.first_name || ""} ${student.last_name || ""}`
                        .toLowerCase();

                const studentId =
                    String(
                        student.student_id ||
                        ""
                    ).toLowerCase();

                const phone =
                    String(
                        student.phone ||
                        ""
                    ).toLowerCase();

                const email =
                    String(
                        student.email ||
                        ""
                    ).toLowerCase();

                const matchesSearch =
                    !search ||
                    fullName.includes(search) ||
                    studentId.includes(search) ||
                    phone.includes(search) ||
                    email.includes(search);

                const matchesClass =
                    !classId ||
                    String(
                        student.class_id
                    ) ===
                    String(classId);

                const matchesGender =
                    !gender ||
                    String(
                        student.gender ||
                        ""
                    ).toLowerCase() ===
                    gender.toLowerCase();

                const matchesStatus =
                    !status ||
                    String(
                        student.status ||
                        ""
                    ).toLowerCase() ===
                    status.toLowerCase();

                return (
                    matchesSearch &&
                    matchesClass &&
                    matchesGender &&
                    matchesStatus
                );
            }
        );

    renderStudents();
}

function clearFilters() {

    const search =
        document.getElementById(
            "studentSearch"
        );

    const classFilter =
        document.getElementById(
            "classFilter"
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

    if (classFilter) {
        classFilter.value = "";
    }

    if (gender) {
        gender.value = "";
    }

    if (status) {
        status.value = "";
    }

    filteredStudents =
        [...students];

    renderStudents();

    showMessage(
        "Filters cleared.",
        "success"
    );
}

function setupFilters() {

    const search =
        document.getElementById(
            "studentSearch"
        );

    const classFilter =
        document.getElementById(
            "classFilter"
        );

    const genderFilter =
        document.getElementById(
            "genderFilter"
        );

    const statusFilter =
        document.getElementById(
            "statusFilter"
        );

    const clearButton =
        document.getElementById(
            "clearFilters"
        );

    const clearToolbar =
        document.getElementById(
            "clearFiltersToolbar"
        );

    search?.addEventListener(
        "input",
        applyFilters
    );

    classFilter?.addEventListener(
        "change",
        applyFilters
    );

    genderFilter?.addEventListener(
        "change",
        applyFilters
    );

    statusFilter?.addEventListener(
        "change",
        applyFilters
    );

    clearButton?.addEventListener(
        "click",
        clearFilters
    );

    clearToolbar?.addEventListener(
        "click",
        clearFilters
    );
}

function setupHeader() {

    const fullName =
        `${teacher.first_name || ""} ${teacher.last_name || ""}`
            .trim() ||
        "Teacher";

    const name =
        document.getElementById(
            "teacherHeaderName"
        );

    const avatar =
        document.getElementById(
            "teacherAvatar"
        );

    if (name) {

        name.textContent =
            fullName;
    }

    if (avatar) {

        if (teacher.photo_url) {

            avatar.innerHTML =
                "";

            const image =
                document.createElement(
                    "img"
                );

            image.src =
                teacher.photo_url;

            image.alt =
                fullName;

            avatar.appendChild(
                image
            );

        } else {

            avatar.textContent =
                fullName
                    .charAt(0)
                    .toUpperCase();
        }
    }
}

function setupLogout() {

    const button =
        document.getElementById(
            "logoutButton"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        async () => {

            const {
                error
            } =
                await supabase.auth.signOut();

            if (error) {

                console.error(
                    "Logout error:",
                    error
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

    if (
        toggle &&
        sidebar
    ) {

        toggle.addEventListener(
            "click",
            () => {

                sidebar.classList.toggle(
                    "mobile-open"
                );

            }
        );
    }
}

function setupRefresh() {

    const button =
        document.getElementById(
            "refreshStudents"
        );

    if (!button) {
        return;
    }

    button.addEventListener(
        "click",
        async () => {

            button.disabled =
                true;

            button.textContent =
                "↻ Loading...";

            await loadStudents();

            button.disabled =
                false;

            button.textContent =
                "↻ Refresh";
        }
    );
}

function showMessage(
    message,
    type = "error"
) {

    const element =
        document.getElementById(
            "studentsMessage"
        );

    if (!element) {
        return;
    }

    element.textContent =
        message;

    element.className =
        `form-message ${type}`;
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

async function initialize() {

    teacher =
        await getTeacher();

    if (!teacher) {
        return;
    }

    setupHeader();

    setupLogout();

    setupSidebar();

    setupFilters();

    setupRefresh();

    await loadClasses();

    await loadStudents();
}

initialize();