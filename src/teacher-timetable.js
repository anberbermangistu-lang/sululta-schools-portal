import { supabase, getSession, getUserProfile, getRoleDashboard } from "./supabase.js";

let allTimetable = [];
let assignedClasses = [];
let currentTeacherRecord = null;

async function initializeTeacherTimetable() {
    const session = await getSession();
    const user = session?.user;

    if (!user) {
        window.location.href = "/login.html";
        return;
    }

    const profile = await getUserProfile(user.id);
    const role = String(profile?.role || "").trim().toLowerCase();

    if (role && role !== "teacher") {
        const dest = getRoleDashboard(role);
        if (dest) window.location.href = dest;
        return;
    }

    let teacher = null;
    try {
        const { data } = await supabase
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
        teacher = data;
    } catch (e) {
        console.warn("Teacher record fetch notice:", e);
    }

    if (!teacher && user.email) {
        try {
            const { data } = await supabase
                .from("teachers")
                .select(`
                    id,
                    teacher_id,
                    first_name,
                    last_name,
                    photo_url,
                    status
                `)
                .ilike("email", user.email.trim())
                .maybeSingle();
            if (data) {
                teacher = data;
                await supabase.from("teachers").update({ user_id: user.id }).eq("id", teacher.id);
            }
        } catch (_) {}
    }

    if (!teacher) {
        showMessage("Teacher record could not be found for this account.");
        return;
    }

    currentTeacherRecord = teacher;

    displayTeacher(profile, teacher);
    await loadAssignedClasses(teacher.id);

    setupFilters();
    setupRefresh();
    setupLogout();
    setupSidebar();
}

async function loadAssignedClasses(teacherId) {
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
            .order("class_name", { ascending: true }),
        supabase
            .from("timetable")
            .select("*")
            .order("day", { ascending: true })
            .order("start_time", { ascending: true })
    ]);

    if (classesRes.error) {
        console.error("Assigned classes error:", classesRes.error);
        showMessage(classesRes.error.message);
        return;
    }

    const allClasses = (classesRes.data || []).filter(c => !c.status || String(c.status).toLowerCase() === "active");
    const allTimetableData = timetableRes.data || [];

    let timetableTeachers = {};
    let teacherAssignments = [];
    try {
        timetableTeachers = JSON.parse(localStorage.getItem("sululta_timetable_teachers") || "{}");
        teacherAssignments = JSON.parse(localStorage.getItem("sululta_teacher_subject_assignments") || "[]");
    } catch (e) {}

    // Filter timetable for ONLY this teacher
    allTimetable = allTimetableData.filter(entry => {
        // 1. Matched by teacher_id
        if (entry.teacher_id != null) {
            if (Number(entry.teacher_id) === Number(teacherId)) return true;
            if (currentTeacherRecord?.teacher_id && String(entry.teacher_id) === String(currentTeacherRecord.teacher_id)) return true;
        }

        // 2. Matched by cached timetable mapping
        const cached = timetableTeachers[entry.id];
        if (cached?.teacher_id != null) {
            if (Number(cached.teacher_id) === Number(teacherId)) return true;
            if (currentTeacherRecord?.teacher_id && String(cached.teacher_id) === String(currentTeacherRecord.teacher_id)) return true;
        }

        // 3. Matched by teacher name
        const entryTeacherName = (entry.teacher_name || cached?.teacher_name || "").toLowerCase();
        if (entryTeacherName && currentTeacherRecord) {
            if (currentTeacherRecord.last_name && entryTeacherName.includes(currentTeacherRecord.last_name.toLowerCase())) return true;
            if (currentTeacherRecord.first_name && entryTeacherName.includes(currentTeacherRecord.first_name.toLowerCase())) return true;
        }

        // 4. Matched by teacher_subject_assignments
        const match = teacherAssignments.some(a =>
            (Number(a.teacher_id) === Number(teacherId) || (currentTeacherRecord?.teacher_id && String(a.teacher_id) === String(currentTeacherRecord.teacher_id))) &&
            a.subject_code === entry.subject_code &&
            (!a.class_name || (a.class_name === entry.class_name && (!a.section || a.section === entry.section)))
        );
        if (match) return true;

        return false;
    });

    // Derive only the classes where this teacher has timetable entries (or is class_teacher)
    const timetableClassKeys = new Set(allTimetable.map(t => `${t.class_name}|${t.section}`.toLowerCase()));
    assignedClasses = allClasses.filter(c => {
        const key = `${c.class_name}|${c.section}`.toLowerCase();
        const isClassTeacher = c.class_teacher && (
            String(c.class_teacher) === String(teacherId) ||
            (currentTeacherRecord?.teacher_id && String(c.class_teacher) === String(currentTeacherRecord.teacher_id)) ||
            (currentTeacherRecord?.last_name && String(c.class_teacher).toLowerCase().includes(currentTeacherRecord.last_name.toLowerCase()))
        );
        return timetableClassKeys.has(key) || isClassTeacher;
    });

    setText("totalClasses", assignedClasses.length);
    populateClassFilter();
    updateStatistics(allTimetable);
    renderTimetable(allTimetable);
}

async function loadTimetable() {
    const tableBody = document.getElementById("timetableTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="8" class="table-empty">
                Loading your timetable schedule...
            </td>
        </tr>
    `;

    if (currentTeacherRecord?.id) {
        await loadAssignedClasses(currentTeacherRecord.id);
    }
}

function populateClassFilter() {
    const select = document.getElementById("classFilter");
    if (!select) return;

    select.innerHTML = `<option value="">All Classes (${assignedClasses.length})</option>`;

    assignedClasses.forEach(item => {
        const opt = document.createElement("option");
        opt.value = `${item.class_name}|||${item.section}`;
        opt.textContent = `${item.class_name} - ${item.section}`;
        select.appendChild(opt);
    });
}

function renderTimetable(records) {
    const tableBody = document.getElementById("timetableTableBody");
    const emptyState = document.getElementById("timetableEmptyState");

    if (!tableBody) return;

    if (!records.length) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="table-empty">
                    No timetable records found for your assigned classes.
                </td>
            </tr>
        `;
        if (emptyState) emptyState.hidden = false;
        updateSummary(0);
        return;
    }

    if (emptyState) emptyState.hidden = true;

    tableBody.innerHTML = records
        .map((item, index) => {
            return `
                <tr>
                    <td>${index + 1}</td>
                    <td><strong>${escapeHtml(`${item.class_name || "—"} - ${item.section || "—"}`)}</strong></td>
                    <td>${escapeHtml(item.subject_code || "—")}</td>
                    <td>${escapeHtml(item.subject_name || "—")}</td>
                    <td>${escapeHtml(item.day || "—")}</td>
                    <td>${formatTime(item.start_time)}</td>
                    <td>${formatTime(item.end_time)}</td>
                    <td>${escapeHtml(item.room_number || "—")}</td>
                </tr>
            `;
        })
        .join("");

    updateSummary(records.length);
}

function setupFilters() {
    const classFilter = document.getElementById("classFilter");
    const dayFilter = document.getElementById("dayFilter");
    const subjectSearch = document.getElementById("subjectSearch");
    const clearButton = document.getElementById("clearFilters");

    classFilter?.addEventListener("change", applyFilters);
    dayFilter?.addEventListener("change", applyFilters);
    subjectSearch?.addEventListener("input", applyFilters);

    clearButton?.addEventListener("click", () => {
        if (classFilter) classFilter.value = "";
        if (dayFilter) dayFilter.value = "";
        if (subjectSearch) subjectSearch.value = "";
        applyFilters();
    });
}

function applyFilters() {
    const classFilter = document.getElementById("classFilter");
    const dayFilter = document.getElementById("dayFilter");
    const subjectSearch = document.getElementById("subjectSearch");

    const classValue = classFilter?.value || "";
    const dayValue = String(dayFilter?.value || "").trim().toLowerCase();
    const searchValue = String(subjectSearch?.value || "").trim().toLowerCase();

    let filtered = [...allTimetable];

    if (classValue) {
        const [selectedClass, selectedSection] = classValue.split("|||");
        filtered = filtered.filter(
            item =>
                String(item.class_name || "").trim().toLowerCase() === String(selectedClass || "").trim().toLowerCase() &&
                String(item.section || "").trim().toLowerCase() === String(selectedSection || "").trim().toLowerCase()
        );
    }

    if (dayValue) {
        filtered = filtered.filter(
            item => String(item.day || "").trim().toLowerCase() === dayValue
        );
    }

    if (searchValue) {
        filtered = filtered.filter(item => {
            const subject = String(item.subject_name || "").toLowerCase();
            const code = String(item.subject_code || "").toLowerCase();
            return subject.includes(searchValue) || code.includes(searchValue);
        });
    }

    renderTimetable(filtered);
}

function updateStatistics(records) {
    setText("totalEntries", records.length);

    const classSet = new Set(
        records.map(item => `${item.class_name || ""}-${item.section || ""}`)
    );

    setText(
        "totalClasses",
        assignedClasses.length ? assignedClasses.length : classSet.size
    );

    const subjectSet = new Set(
        records
            .map(item => String(item.subject_code || item.subject_name || "").trim().toLowerCase())
            .filter(Boolean)
    );

    setText("totalSubjects", subjectSet.size);

    const years = records.map(item => item.academic_year).filter(Boolean);
    const uniqueYears = [...new Set(years)];

    setText(
        "academicYear",
        uniqueYears.length === 1 ? uniqueYears[0] : uniqueYears.length ? uniqueYears.join(", ") : "—"
    );

    setText("recordBadge", `${records.length} Record${records.length === 1 ? "" : "s"}`);
}

function updateSummary(count) {
    setText("recordSummary", `Showing ${count} record${count === 1 ? "" : "s"}`);
}

function displayTeacher(profile, teacher) {
    const fullName = `${teacher.first_name || profile.first_name || ""} ${teacher.last_name || profile.last_name || ""}`.trim() || profile.username || "Teacher";

    setText("teacherHeaderName", fullName);

    const avatar = document.getElementById("teacherAvatar");
    const photo = teacher.photo_url || profile.photo_url;

    if (avatar && photo) {
        avatar.innerHTML = "";
        const image = document.createElement("img");
        image.src = photo;
        image.alt = fullName;
        avatar.appendChild(image);
    } else if (avatar) {
        avatar.textContent = fullName.charAt(0).toUpperCase();
    }
}

function setupRefresh() {
    const button = document.getElementById("refreshTimetable");
    button?.addEventListener("click", async () => {
        await loadTimetable();
    });
}

function setupLogout() {
    const button = document.getElementById("logoutButton");
    button?.addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
    });
}

function setupSidebar() {
    const toggle = document.getElementById("sidebarToggle");
    const sidebar = document.querySelector(".admin-sidebar");
    toggle?.addEventListener("click", () => {
        sidebar?.classList.toggle("mobile-open");
    });
}

function formatTime(value) {
    if (!value) return "—";
    const parts = String(value).split(":");
    if (parts.length < 2) return escapeHtml(value);
    return `${parts[0]}:${parts[1]}`;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function showMessage(message) {
    const element = document.getElementById("timetableMessage");
    if (element) {
        element.textContent = message;
        element.classList.add("error");
    }

    const tableBody = document.getElementById("timetableTableBody");
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="table-empty">
                    ${escapeHtml(message)}
                </td>
            </tr>
        `;
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

initializeTeacherTimetable();
