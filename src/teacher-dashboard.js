import { initThemeToggle } from "./theme.js";
import { supabase, getSession, getUserProfile } from "./supabase.js";

let currentTeacher = null;
let assignedClasses = [];
let assignedStudents = [];
let teacherTimetable = [];

document.addEventListener("DOMContentLoaded", async () => {
    initThemeToggle();
    setupSidebar();
    setupLogout();
    await loadTeacherDashboard();
});

async function loadTeacherDashboard() {
    try {
        showMessage("");

        // Check active session using appropriate Supabase auth method
        const session = await getSession();
        const user = session?.user;

        if (!user) {
            // Only redirect when there is genuinely no active session
            window.location.replace("/login.html");
            return;
        }

        // 1. Fetch teacher record by user_id
        let teacher = null;
        try {
            const { data, error: teacherError } = await supabase
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
                    user_id,
                    status
                `)
                .eq("user_id", user.id)
                .maybeSingle();

            if (!teacherError && data) {
                teacher = data;
            }
        } catch (e) {
            console.warn("Teacher query by user_id notice:", e);
        }

        // 2. Fallback: match by email if user_id was not populated yet
        if (!teacher && user.email) {
            try {
                const { data: teacherByEmail, error: emailErr } = await supabase
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
                        user_id,
                        status
                    `)
                    .ilike("email", user.email.trim())
                    .maybeSingle();

                if (!emailErr && teacherByEmail) {
                    teacher = teacherByEmail;
                    // Auto-link user_id for future fast lookups
                    try {
                        await supabase
                            .from("teachers")
                            .update({ user_id: user.id })
                            .eq("id", teacher.id);
                    } catch (_) {}
                }
            } catch (e) {
                console.warn("Teacher query by email notice:", e);
            }
        }

        if (!teacher) {
            // Account is valid and authenticated; display helpful notice without logging out
            const profile = await getUserProfile(user.id);
            const fullName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Teacher";
            setText("teacherWelcome", `Hello, ${profile?.first_name || "Teacher"}`);
            setText("teacherHeaderName", fullName);
            setText("teacherName", fullName);
            setText("teacherEmail", user.email || "Not provided");
            showMessage("Your teacher account is active, but is not yet connected to a school teacher record. Please contact the administrator.");
            return;
        }

        currentTeacher = teacher;
        updateTeacherInformation();

        // Safely load all dashboard data panels without letting errors trigger a redirect or logout
        await Promise.allSettled([
            loadAssignedClasses(),
            loadAssignedStudents(),
            loadAttendanceStatistics(),
            loadResultsStatistics()
        ]);

        loadTeacherTimetableSchedule();

    } catch (error) {
        console.error("Teacher dashboard error:", error);
        // Display notification on dashboard; DO NOT redirect or clear session
        showMessage(error.message || "Unable to refresh all dashboard information.");
    }
}

function updateTeacherInformation() {
    if (!currentTeacher) return;

    const fullName = `${currentTeacher.first_name || ""} ${currentTeacher.last_name || ""}`.trim() || "Teacher";

    setText("teacherWelcome", `Hello, ${currentTeacher.first_name || "Teacher"}`);
    setText("teacherHeaderName", fullName);
    setText("teacherName", fullName);
    setText("teacherId", currentTeacher.teacher_id || "Not provided");
    setText("teacherEmail", currentTeacher.email || "Not provided");
    setText("teacherPhone", currentTeacher.phone || "Not provided");
    setText("teacherQualification", currentTeacher.qualification || "Not provided");
    setText("teacherStatus", capitalize(currentTeacher.status || "Active"));

    const avatar = document.getElementById("teacherAvatar");
    if (avatar) {
        const photo = currentTeacher.photo_url || localStorage.getItem(`sululta_teacher_photo_${currentTeacher.id}`);
        if (photo) {
            avatar.innerHTML = "";
            const image = document.createElement("img");
            image.src = photo;
            image.alt = fullName;
            image.style.width = "100%";
            image.style.height = "100%";
            image.style.objectFit = "cover";
            image.style.borderRadius = "50%";
            avatar.appendChild(image);
        } else {
            avatar.textContent = fullName.charAt(0).toUpperCase();
        }
    }
}

async function loadAssignedClasses() {
    if (!currentTeacher) return;

    try {
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
                .order("class_name", { ascending: true }),
            supabase
                .from("timetable")
                .select("*")
                .order("day", { ascending: true })
                .order("start_time", { ascending: true })
        ]);

        const allClasses = classesRes.data || [];
        const allTimetableData = timetableRes.data || [];

        let timetableTeachers = {};
        let teacherAssignments = [];
        try {
            timetableTeachers = JSON.parse(localStorage.getItem("sululta_timetable_teachers") || "{}");
            teacherAssignments = JSON.parse(localStorage.getItem("sululta_teacher_subject_assignments") || "[]");
        } catch (e) {}

        // Filter timetable records for this teacher
        teacherTimetable = allTimetableData.filter(entry => {
            if (entry.teacher_id != null) {
                if (Number(entry.teacher_id) === Number(currentTeacher.id)) return true;
                if (currentTeacher.teacher_id && String(entry.teacher_id) === String(currentTeacher.teacher_id)) return true;
            }

            const cached = timetableTeachers[entry.id];
            if (cached?.teacher_id != null) {
                if (Number(cached.teacher_id) === Number(currentTeacher.id)) return true;
                if (currentTeacher.teacher_id && String(cached.teacher_id) === String(currentTeacher.teacher_id)) return true;
            }

            const entryTeacherName = (entry.teacher_name || cached?.teacher_name || "").toLowerCase();
            if (entryTeacherName) {
                if (currentTeacher.last_name && entryTeacherName.includes(currentTeacher.last_name.toLowerCase())) return true;
                if (currentTeacher.first_name && entryTeacherName.includes(currentTeacher.first_name.toLowerCase())) return true;
            }

            const match = teacherAssignments.some(a =>
                (Number(a.teacher_id) === Number(currentTeacher.id) || (currentTeacher.teacher_id && String(a.teacher_id) === String(currentTeacher.teacher_id))) &&
                a.subject_code === entry.subject_code &&
                (!a.class_name || (a.class_name === entry.class_name && (!a.section || a.section === entry.section)))
            );
            if (match) return true;

            return false;
        });

        const myClassKeys = new Set(teacherTimetable.map(t => `${t.class_name}|${t.section}`.toLowerCase()));

        assignedClasses = allClasses.filter(c => {
            const key = `${c.class_name}|${c.section}`.toLowerCase();
            const isClassTeacher = c.class_teacher && (
                String(c.class_teacher) === String(currentTeacher.id) ||
                (currentTeacher.teacher_id && String(c.class_teacher) === String(currentTeacher.teacher_id)) ||
                (currentTeacher.last_name && String(c.class_teacher).toLowerCase().includes(currentTeacher.last_name.toLowerCase()))
            );
            return myClassKeys.has(key) || isClassTeacher;
        });

        setText("myClasses", assignedClasses.length);
    } catch (err) {
        console.warn("Could not load assigned classes:", err);
    }
}

function loadTeacherTimetableSchedule() {
    const container = document.getElementById("teacherTimetableContainer");
    if (!container) return;

    if (!teacherTimetable || !teacherTimetable.length) {
        container.innerHTML = `
            <div style="padding: 32px 16px; text-align: center; color: #64748b;">
                <p style="font-size: 15px; font-weight: 600; color: #334155; margin-bottom: 6px;">No Timetable Classes Assigned</p>
                <span style="font-size: 13px;">There are currently no timetable periods assigned to your account. When the administrator assigns classes to you in the timetable, your schedule will appear here.</span>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="overflow-x: auto;">
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                        <th style="padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; color: #475569;">#</th>
                        <th style="padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; color: #475569;">DAY</th>
                        <th style="padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; color: #475569;">TIME</th>
                        <th style="padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; color: #475569;">CLASS</th>
                        <th style="padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; color: #475569;">SUBJECT</th>
                        <th style="padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; color: #475569;">ROOM</th>
                    </tr>
                </thead>
                <tbody>
                    ${teacherTimetable.map((item, idx) => `
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 12px 14px; font-size: 13px; color: #64748b;">${idx + 1}</td>
                            <td style="padding: 12px 14px; font-size: 13px; font-weight: 600; color: #1e293b;">${item.day || "—"}</td>
                            <td style="padding: 12px 14px; font-size: 13px; color: #334155;">${item.start_time ? item.start_time.slice(0, 5) : "—"} – ${item.end_time ? item.end_time.slice(0, 5) : "—"}</td>
                            <td style="padding: 12px 14px; font-size: 13px; font-weight: 600; color: #2563eb;">${item.class_name || "—"} - ${item.section || "—"}</td>
                            <td style="padding: 12px 14px; font-size: 13px; color: #1e293b;"><strong>${item.subject_name || item.subject_code || "—"}</strong> <small style="color:#64748b;">(${item.subject_code || ""})</small></td>
                            <td style="padding: 12px 14px; font-size: 13px; color: #475569;">${item.room_number || "—"}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

async function loadAssignedStudents() {
    if (!currentTeacher || assignedClasses.length === 0) {
        assignedStudents = [];
        setText("myStudents", "0");
        return;
    }

    try {
        const classIds = assignedClasses.map(schoolClass => schoolClass.id);
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
                photo_url,
                status,
                class_id
            `)
            .eq("status", "active")
            .in("class_id", classIds)
            .order("first_name", { ascending: true });

        if (!error && data) {
            assignedStudents = data;
            setText("myStudents", assignedStudents.length);
        }
    } catch (e) {
        console.warn("Could not load assigned students:", e);
    }
}

async function loadAttendanceStatistics() {
    if (!currentTeacher || assignedStudents.length === 0) {
        setText("attendanceRate", "0%");
        return;
    }

    try {
        const studentIds = assignedStudents.map(student => student.id);
        const { data, error } = await supabase
            .from("attendance")
            .select(`
                id,
                student_id,
                attendance_date,
                status
            `)
            .in("student_id", studentIds);

        if (!error && data && data.length) {
            const presentRecords = data.filter(
                record => String(record.status || "").toLowerCase().trim() === "present"
            );
            const percentage = (presentRecords.length / data.length) * 100;
            setText("attendanceRate", `${percentage.toFixed(1)}%`);
        } else {
            setText("attendanceRate", "0%");
        }
    } catch (e) {
        console.warn("Could not load attendance stats:", e);
    }
}

async function loadResultsStatistics() {
    if (!currentTeacher || assignedStudents.length === 0) {
        setText("resultsCount", "0");
        return;
    }

    try {
        const studentCodes = assignedStudents
            .map(student => student.student_id)
            .filter(Boolean);

        if (studentCodes.length === 0) {
            setText("resultsCount", "0");
            return;
        }

        const { data, error } = await supabase
            .from("results")
            .select("id, student_id")
            .in("student_id", studentCodes);

        if (!error && data) {
            setText("resultsCount", data.length);
        }
    } catch (e) {
        console.warn("Could not load results stats:", e);
    }
}

function setupSidebar() {
    const toggle = document.getElementById("sidebarToggle");
    const sidebar = document.querySelector(".admin-sidebar");
    if (!toggle || !sidebar) return;

    toggle.addEventListener("click", () => {
        sidebar.classList.toggle("mobile-open");
    });
}

function setupLogout() {
    const logoutButton = document.getElementById("logoutButton");
    if (!logoutButton) return;

    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Logout error:", error);
        }
        window.location.replace("/login.html");
    });
}

function showMessage(message) {
    const element = document.getElementById("teacherMessage");
    if (!element) return;
    if (!message) {
        element.hidden = true;
        element.textContent = "";
        return;
    }
    element.textContent = message;
    element.hidden = false;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

function capitalize(value) {
    const text = String(value || "");
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
}
