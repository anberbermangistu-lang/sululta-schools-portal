import { supabase } from "./supabase.js";

let teacher = null;
let assignedClasses = [];

async function initializeTeacherClasses() {
    const {
        data: { user },
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

    const role = String(profile.role || "").trim().toLowerCase();
    const status = String(profile.status || "").trim().toLowerCase();

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
        data: teacherRecord,
        error: teacherError
    } = await supabase
        .from("teachers")
        .select(`
            id,
            teacher_id,
            first_name,
            last_name,
            photo_url,
            user_id,
            status
        `)
        .eq("user_id", user.id)
        .maybeSingle();

    if (teacherError || !teacherRecord) {
        console.error("Teacher error:", teacherError);
        showError("Teacher record could not be found.");
        return;
    }

    teacher = teacherRecord;

    displayTeacher(profile, teacherRecord);
    setupLogout();
    setupSidebar();

    await loadClasses();

    const refreshButton = document.getElementById("refreshClasses");
    refreshButton?.addEventListener("click", loadClasses);
}

async function loadClasses() {
    const tableBody = document.getElementById("classesTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="5" class="table-empty">
                Loading assigned classes...
            </td>
        </tr>
    `;

    const [classesRes, timetableRes] = await Promise.all([
        supabase
            .from("classes")
            .select(`
                id,
                class_name,
                section,
                room_number,
                academic_year,
                class_teacher,
                status
            `)
            .order("class_name", { ascending: true }),
        supabase
            .from("timetable")
            .select("*")
    ]);

    if (classesRes.error) {
        console.error("Classes error:", classesRes.error);
        showError(classesRes.error.message);
        return;
    }

    const allClasses = (classesRes.data || []).filter(c => !c.status || String(c.status).toLowerCase() === "active");
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
            (!a.class_name || (a.class_name === entry.class_name && (!a.section || a.section === entry.section)))
        );
        if (match) return true;
        return false;
    });

    const myClassKeys = new Set(myTimetable.map(t => `${t.class_name}|${t.section}`.toLowerCase()));

    assignedClasses = allClasses.filter(c => {
        const key = `${c.class_name}|${c.section}`.toLowerCase();
        const isClassTeacher = c.class_teacher && (
            String(c.class_teacher) === String(teacher?.id) ||
            (teacher?.teacher_id && String(c.class_teacher) === String(teacher.teacher_id)) ||
            (teacher?.last_name && String(c.class_teacher).toLowerCase().includes(teacher.last_name.toLowerCase()))
        );
        return myClassKeys.has(key) || isClassTeacher;
    });

    updateStatistics(assignedClasses);
    renderClasses(assignedClasses);
    await loadStudentCount(assignedClasses);
}

function renderClasses(classes) {
    const tableBody = document.getElementById("classesTableBody");
    const emptyState = document.getElementById("classesEmptyState");

    if (!tableBody) return;

    if (!classes.length) {
        tableBody.innerHTML = "";
        if (emptyState) emptyState.hidden = false;
        return;
    }

    if (emptyState) emptyState.hidden = true;

    tableBody.innerHTML = classes.map(item => {
        const className = item.class_name || "—";
        const section = item.section || "—";
        const room = item.room_number || "—";
        const academicYear = item.academic_year || "—";
        const status = String(item.status || "").trim().toLowerCase();
        const statusText = status === "active" ? "Active" : "Inactive";
        const statusClass = status === "active" ? "status-active" : "status-inactive";

        return `
            <tr>
                <td><strong>${escapeHtml(className)}</strong></td>
                <td>${escapeHtml(section)}</td>
                <td>${escapeHtml(room)}</td>
                <td>${escapeHtml(academicYear)}</td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            </tr>
        `;
    }).join("");
}

function updateStatistics(classes) {
    const total = classes.length;
    setText("totalClasses", total);

    const academicYear = total > 0 ? classes[0].academic_year || "—" : "—";
    setText("academicYear", academicYear);

    const hasActiveClass = classes.some(item => String(item.status || "").trim().toLowerCase() === "active");
    setText("classStatus", hasActiveClass ? "Active" : "Inactive");
    setText("recordBadge", `${total} ${total === 1 ? "Record" : "Records"}`);
    setText("recordSummary", `Showing ${total} ${total === 1 ? "record" : "records"}`);
}

async function loadStudentCount(classes) {
    if (!classes.length) {
        setText("totalStudents", 0);
        return;
    }

    const classIds = classes.map(item => item.id);

    const { count, error } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .in("class_id", classIds);

    if (error) {
        console.error("Student count error:", error);
        setText("totalStudents", 0);
        return;
    }

    setText("totalStudents", count || 0);
}

function displayTeacher(profile, teacherRecord) {
    const fullName = `${teacherRecord.first_name || profile.first_name || ""} ${teacherRecord.last_name || profile.last_name || ""}`.trim() || profile.username || "Teacher";

    setText("teacherHeaderName", fullName);

    const avatar = document.getElementById("teacherAvatar");
    const photo = teacherRecord.photo_url || profile.photo_url;

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

function setupLogout() {
    const button = document.getElementById("logoutButton");
    button?.addEventListener("click", async () => {
        button.disabled = true;
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Logout error:", error);
            button.disabled = false;
            return;
        }
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

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function showError(message) {
    const tableBody = document.getElementById("classesTableBody");
    if (!tableBody) return;
    tableBody.innerHTML = `
        <tr>
            <td colspan="5" class="table-empty">
                ${escapeHtml(message)}
            </td>
        </tr>
    `;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

initializeTeacherClasses();
