import { supabase } from "./supabase.js";

let teacher = null;
let classes = [];
let students = [];
let filteredStudents = [];
let selectedSectionClassId = "";

async function getTeacher() {
    const {
        data: { user },
        error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
        window.location.href = "/login.html";
        return null;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, status")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile) {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return null;
    }

    const role = String(profile.role || "").trim().toLowerCase();
    const status = String(profile.status || "").trim().toLowerCase();

    if (role !== "teacher" || status !== "active") {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return null;
    }

    const { data: teacherRecord, error: teacherError } = await supabase
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
        .eq("user_id", user.id)
        .maybeSingle();

    if (teacherError || !teacherRecord) {
        console.error("Teacher error:", teacherError);
        showMessage("Your teacher account is not connected to a teacher record.");
        return null;
    }

    return teacherRecord;
}

async function loadAssignedClasses() {
    const [classesRes, timetableRes] = await Promise.all([
        supabase
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
            .eq("status", "active")
            .order("class_name", { ascending: true })
            .order("section", { ascending: true }),
        supabase
            .from("timetable")
            .select("*")
    ]);

    if (classesRes.error) {
        console.error("Classes error:", classesRes.error);
        showMessage("Unable to load your classes: " + classesRes.error.message);
        return [];
    }

    const allClasses = classesRes.data || [];
    const allTimetable = timetableRes.data || [];

    let timetableTeachers = {};
    let teacherAssignments = [];
    try {
        timetableTeachers = JSON.parse(localStorage.getItem("sululta_timetable_teachers") || "{}");
        teacherAssignments = JSON.parse(localStorage.getItem("sululta_teacher_subject_assignments") || "[]");
    } catch (e) {}

    // Match timetable entries for this teacher
    const myTimetable = allTimetable.filter(entry => {
        if (entry.teacher_id != null) {
            if (Number(entry.teacher_id) === Number(teacher?.id)) return true;
            if (teacher?.teacher_id && String(entry.teacher_id) === String(teacher.teacher_id)) return true;
        }
        const cached = timetableTeachers[entry.id];
        if (cached?.teacher_id != null) {
            if (Number(cached.teacher_id) === Number(teacher?.id)) return true;
            if (teacher?.teacher_id && String(cached.teacher_id) === String(teacher.teacher_id)) return true;
        }
        const tName = (entry.teacher_name || cached?.teacher_name || "").toLowerCase();
        if (tName && teacher) {
            if (teacher.last_name && tName.includes(teacher.last_name.toLowerCase())) return true;
            if (teacher.first_name && tName.includes(teacher.first_name.toLowerCase())) return true;
        }
        const match = teacherAssignments.some(a =>
            (Number(a.teacher_id) === Number(teacher?.id) || (teacher?.teacher_id && String(a.teacher_id) === String(teacher.teacher_id))) &&
            a.subject_code === entry.subject_code &&
            (!a.class_name || (a.class_name.toLowerCase() === (entry.class_name || "").toLowerCase() && (!a.section || a.section.toLowerCase() === (entry.section || "").toLowerCase())))
        );
        if (match) return true;
        return false;
    });

    const myClassKeys = new Set(myTimetable.map(t => `${t.class_name}|${t.section}`.toLowerCase()));

    const myAssignmentClassIds = new Set(
        teacherAssignments
            .filter(a => Number(a.teacher_id) === Number(teacher?.id) || (teacher?.teacher_id && String(a.teacher_id) === String(teacher.teacher_id)))
            .map(a => a.class_id != null ? String(a.class_id) : null)
            .filter(Boolean)
    );

    // Derive ONLY the classes/sections assigned to this teacher
    classes = allClasses.filter(c => {
        const key = `${c.class_name}|${c.section}`.toLowerCase();
        const isClassTeacher = c.class_teacher != null && (
            String(c.class_teacher) === String(teacher?.id) ||
            (teacher?.teacher_id && String(c.class_teacher) === String(teacher.teacher_id)) ||
            (teacher?.last_name && String(c.class_teacher).toLowerCase().includes(teacher.last_name.toLowerCase()))
        );
        const isAssigned = myAssignmentClassIds.has(String(c.id));
        return myClassKeys.has(key) || isClassTeacher || isAssigned;
    });

    return classes;
}

function renderSidebarSections(activeClassId = "") {
    const container = document.getElementById("sidebarSectionsList");
    if (!container) return;

    if (!classes.length) {
        container.innerHTML = `<span style="font-size:11px; color:rgba(255,255,255,0.45); padding:4px 8px; display:block;">No assigned sections</span>`;
        return;
    }

    let html = `
        <a href="javascript:void(0);"
           class="sidebar-sublink ${!activeClassId ? 'active' : ''}"
           data-class-id=""
           title="All My Sections">
            <span class="sublink-dot">•</span>
            <span>All Sections (${students.length})</span>
        </a>
    `;

    classes.forEach(c => {
        const count = students.filter(s =>
            String(s.class_id) === String(c.id) ||
            (String(s.class || "").trim().toLowerCase() === String(c.class_name || "").trim().toLowerCase() &&
             String(s.section || "").trim().toLowerCase() === String(c.section || "").trim().toLowerCase())
        ).length;

        const isCurrent = String(activeClassId) === String(c.id);

        html += `
            <a href="javascript:void(0);"
               class="sidebar-sublink ${isCurrent ? 'active' : ''}"
               data-class-id="${c.id}"
               title="${escapeHtml(c.class_name)} - Section ${escapeHtml(c.section)}">
                <span class="sublink-dot">•</span>
                <span>${escapeHtml(c.class_name)} - Sec ${escapeHtml(c.section)} (${count})</span>
            </a>
        `;
    });

    container.innerHTML = html;

    container.querySelectorAll(".sidebar-sublink").forEach(link => {
        link.addEventListener("click", () => {
            const cid = link.getAttribute("data-class-id") || "";
            selectSection(cid);
        });
    });
}

function renderSectionPills(activeClassId = "") {
    const container = document.getElementById("sectionPillsBar");
    if (!container) return;

    if (!classes.length) {
        container.innerHTML = "";
        return;
    }

    let html = `
        <button type="button"
                class="section-pill-btn ${!activeClassId ? 'active' : ''}"
                data-class-id="">
            All Sections <span class="pill-count">${students.length}</span>
        </button>
    `;

    classes.forEach(c => {
        const count = students.filter(s =>
            String(s.class_id) === String(c.id) ||
            (String(s.class || "").trim().toLowerCase() === String(c.class_name || "").trim().toLowerCase() &&
             String(s.section || "").trim().toLowerCase() === String(c.section || "").trim().toLowerCase())
        ).length;

        const isCurrent = String(activeClassId) === String(c.id);

        html += `
            <button type="button"
                    class="section-pill-btn ${isCurrent ? 'active' : ''}"
                    data-class-id="${c.id}">
                ${escapeHtml(c.class_name)} - Section ${escapeHtml(c.section)} <span class="pill-count">${count}</span>
            </button>
        `;
    });

    container.innerHTML = html;

    container.querySelectorAll(".section-pill-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const cid = btn.getAttribute("data-class-id") || "";
            selectSection(cid);
        });
    });
}

function populateClassFilter(activeClassId = "") {
    const filter = document.getElementById("classFilter");
    if (!filter) return;

    filter.innerHTML = `<option value="">All My Sections</option>`;

    classes.forEach(item => {
        const option = document.createElement("option");
        option.value = String(item.id);
        option.textContent = `${item.class_name} - Section ${item.section}`;
        if (String(activeClassId) === String(item.id)) {
            option.selected = true;
        }
        filter.appendChild(option);
    });

    const totalClasses = document.getElementById("totalClasses");
    if (totalClasses) {
        totalClasses.textContent = classes.length;
    }
}

function selectSection(classId) {
    selectedSectionClassId = classId;

    const filter = document.getElementById("classFilter");
    if (filter) {
        filter.value = classId;
    }

    // Update active highlight in sidebar sublinks
    document.querySelectorAll("#sidebarSectionsList .sidebar-sublink").forEach(link => {
        const cid = link.getAttribute("data-class-id") || "";
        link.classList.toggle("active", cid === classId);
    });

    // Update active highlight in section pills
    document.querySelectorAll("#sectionPillsBar .section-pill-btn").forEach(btn => {
        const cid = btn.getAttribute("data-class-id") || "";
        btn.classList.toggle("active", cid === classId);
    });

    applyFilters();
}

async function loadStudents() {
    if (classes.length === 0) {
        students = [];
        filteredStudents = [];
        renderSidebarSections();
        renderSectionPills();
        populateClassFilter();
        renderStudents();
        updateStatistics();
        showMessage("You currently have no assigned classes or sections.");
        return;
    }

    const classIds = classes.map(item => item.id);

    const { data, error } = await supabase
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
        .order("first_name");

    if (error) {
        console.error("Students error:", error);
        showMessage("Unable to load students: " + error.message);
        return;
    }

    // Filter strictly to students belonging to this teacher's assigned classes/sections
    students = (data || []).filter(student => {
        if (student.class_id != null && classIds.some(id => String(id) === String(student.class_id))) {
            return true;
        }
        return classes.some(c =>
            c.class_name.trim().toLowerCase() === String(student.class || "").trim().toLowerCase() &&
            c.section.trim().toLowerCase() === String(student.section || "").trim().toLowerCase()
        );
    });

    filteredStudents = [...students];

    // Check URL parameters for section or class filter
    const urlParams = new URLSearchParams(window.location.search);
    const initialClassId = urlParams.get("class_id");
    const initialSection = urlParams.get("section");

    let activeId = "";
    if (initialClassId && classes.some(c => String(c.id) === String(initialClassId))) {
        activeId = String(initialClassId);
    } else if (initialSection) {
        const found = classes.find(c => c.section.trim().toLowerCase() === initialSection.trim().toLowerCase());
        if (found) activeId = String(found.id);
    }

    selectedSectionClassId = activeId;

    renderSidebarSections(activeId);
    renderSectionPills(activeId);
    populateClassFilter(activeId);

    if (activeId) {
        applyFilters();
    } else {
        updateStatistics();
        renderStudents();
    }

    if (students.length > 0) {
        showMessage(`${students.length} student(s) in your assigned section(s).`, "success");
    } else {
        showMessage("No students found in your assigned sections.");
    }
}

function updateStatistics() {
    const total = document.getElementById("totalStudents");
    const male = document.getElementById("maleStudents");
    const female = document.getElementById("femaleStudents");

    const maleCount = students.filter(student =>
        String(student.gender || "").toLowerCase() === "male"
    ).length;

    const femaleCount = students.filter(student =>
        String(student.gender || "").toLowerCase() === "female"
    ).length;

    if (total) total.textContent = students.length;
    if (male) male.textContent = maleCount;
    if (female) female.textContent = femaleCount;

    const badge = document.getElementById("recordBadge");
    if (badge) {
        badge.textContent = `${filteredStudents.length} Records`;
    }

    const summary = document.getElementById("recordSummary");
    if (summary) {
        summary.textContent = `Showing ${filteredStudents.length} of ${students.length} records`;
    }
}

function renderStudents() {
    const body = document.getElementById("studentsTableBody");
    const empty = document.getElementById("studentsEmptyState");

    if (!body) return;

    if (filteredStudents.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty">
                    ${classes.length === 0 ? "You have no assigned classes or sections." : "No students found in the selected section/filter."}
                </td>
            </tr>
        `;

        if (empty) empty.hidden = false;
        updateStatistics();
        return;
    }

    if (empty) empty.hidden = true;

    body.innerHTML = filteredStudents.map(student => {
        const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim();

        const classRecord = classes.find(item =>
            String(item.id) === String(student.class_id) ||
            (item.class_name.trim().toLowerCase() === String(student.class || "").trim().toLowerCase() &&
             item.section.trim().toLowerCase() === String(student.section || "").trim().toLowerCase())
        );

        const className = classRecord?.class_name || student.class || "—";
        const section = classRecord?.section || student.section || "—";
        const status = String(student.status || "").toLowerCase();
        const statusClass = status === "active" ? "status-active" : "status-inactive";

        return `
            <tr>
                <td>
                    <div class="student-table-name">
                        <strong>${escapeHtml(fullName || "Unnamed Student")}</strong>
                    </div>
                </td>
                <td>${escapeHtml(student.student_id || "—")}</td>
                <td>${escapeHtml(student.gender || "—")}</td>
                <td>${escapeHtml(className)}</td>
                <td>
                    <span style="display:inline-block; padding:2px 8px; border-radius:12px; background:#eff6ff; color:#2563eb; font-weight:700; font-size:12px;">
                        Section ${escapeHtml(section)}
                    </span>
                </td>
                <td>${escapeHtml(student.phone || "—")}</td>
                <td>
                    <span class="${statusClass}">
                        ${escapeHtml(student.status || "Unknown")}
                    </span>
                </td>
            </tr>
        `;
    }).join("");

    updateStatistics();
}

function applyFilters() {
    const search = document.getElementById("studentSearch")?.value.trim().toLowerCase() || "";
    const classId = document.getElementById("classFilter")?.value || selectedSectionClassId || "";
    const gender = document.getElementById("genderFilter")?.value || "";
    const status = document.getElementById("statusFilter")?.value || "";

    filteredStudents = students.filter(student => {
        const fullName = `${student.first_name || ""} ${student.last_name || ""}`.toLowerCase();
        const studentId = String(student.student_id || "").toLowerCase();
        const phone = String(student.phone || "").toLowerCase();
        const email = String(student.email || "").toLowerCase();

        const matchesSearch =
            !search ||
            fullName.includes(search) ||
            studentId.includes(search) ||
            phone.includes(search) ||
            email.includes(search);

        const matchesClass =
            !classId ||
            String(student.class_id) === String(classId) ||
            classes.some(c =>
                String(c.id) === String(classId) &&
                c.class_name.trim().toLowerCase() === String(student.class || "").trim().toLowerCase() &&
                c.section.trim().toLowerCase() === String(student.section || "").trim().toLowerCase()
            );

        const matchesGender =
            !gender ||
            String(student.gender || "").toLowerCase() === gender.toLowerCase();

        const matchesStatus =
            !status ||
            String(student.status || "").toLowerCase() === status.toLowerCase();

        return matchesSearch && matchesClass && matchesGender && matchesStatus;
    });

    renderStudents();
}

function clearFilters() {
    const search = document.getElementById("studentSearch");
    const classFilter = document.getElementById("classFilter");
    const gender = document.getElementById("genderFilter");
    const status = document.getElementById("statusFilter");

    if (search) search.value = "";
    if (classFilter) classFilter.value = "";
    if (gender) gender.value = "";
    if (status) status.value = "";

    selectedSectionClassId = "";
    selectSection("");

    filteredStudents = [...students];
    renderStudents();
    showMessage("Filters cleared.", "success");
}

function setupFilters() {
    const search = document.getElementById("studentSearch");
    const classFilter = document.getElementById("classFilter");
    const genderFilter = document.getElementById("genderFilter");
    const statusFilter = document.getElementById("statusFilter");
    const clearButton = document.getElementById("clearFilters");
    const clearToolbar = document.getElementById("clearFiltersToolbar");

    search?.addEventListener("input", applyFilters);

    classFilter?.addEventListener("change", () => {
        selectSection(classFilter.value);
    });

    genderFilter?.addEventListener("change", applyFilters);
    statusFilter?.addEventListener("change", applyFilters);
    clearButton?.addEventListener("click", clearFilters);
    clearToolbar?.addEventListener("click", clearFilters);
}

function setupHeader() {
    const fullName = `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim() || "Teacher";
    const name = document.getElementById("teacherHeaderName");
    const avatar = document.getElementById("teacherAvatar");

    if (name) {
        name.textContent = fullName;
    }

    if (avatar) {
        if (teacher.photo_url) {
            avatar.innerHTML = "";
            const image = document.createElement("img");
            image.src = teacher.photo_url;
            image.alt = fullName;
            avatar.appendChild(image);
        } else {
            avatar.textContent = fullName.charAt(0).toUpperCase();
        }
    }
}

function setupLogout() {
    const button = document.getElementById("logoutButton");
    if (!button) return;

    button.addEventListener("click", async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Logout error:", error);
            return;
        }
        window.location.href = "/login.html";
    });
}

function setupSidebar() {
    const toggle = document.getElementById("sidebarToggle");
    const sidebar = document.querySelector(".admin-sidebar");

    if (toggle && sidebar) {
        toggle.addEventListener("click", () => {
            sidebar.classList.toggle("mobile-open");
        });
    }
}

function setupRefresh() {
    const button = document.getElementById("refreshStudents");
    if (!button) return;

    button.addEventListener("click", async () => {
        button.disabled = true;
        button.textContent = "↻ Loading...";

        await loadAssignedClasses();
        await loadStudents();

        button.disabled = false;
        button.textContent = "↻ Refresh";
    });
}

function showMessage(message, type = "error") {
    const element = document.getElementById("studentsMessage");
    if (!element) return;

    element.textContent = message;
    element.className = `form-message ${type}`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function initialize() {
    teacher = await getTeacher();
    if (!teacher) return;

    setupHeader();
    setupLogout();
    setupSidebar();
    setupFilters();
    setupRefresh();

    await loadAssignedClasses();
    await loadStudents();
}

initialize();
