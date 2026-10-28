import { supabase } from "./supabase.js";

const message = document.getElementById("studentMessage");
const profileMessage = document.getElementById("profileMessage");
const logoutButton = document.getElementById("logoutButton");
const profileForm = document.getElementById("personalProfileForm");
const passwordForm = document.getElementById("passwordForm");
const resultsBody = document.getElementById("studentResultsBody");
const attendanceBody = document.getElementById("studentAttendanceBody");
const timetableBody = document.getElementById("studentTimetableBody");
const subjectsBody = document.getElementById("studentSubjectsBody");
const subjectTotalsBody = document.getElementById("subjectTotalsBody");
const noticesContainer = document.getElementById("studentNotices");

let student = null;
let profile = null;

/* ──────────────────────────────────────────────────────────────
   UI HELPERS
────────────────────────────────────────────────────────────── */
function showMessage(element, text, type = "error") {
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`;
    element.hidden = !text;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value == null || value === "" ? "—" : String(value);
}

function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value || "";
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function addRow(body, values) {
    const row = document.createElement("tr");
    for (const value of values) {
        const cell = document.createElement("td");
        cell.textContent = value == null || value === "" ? "—" : String(value);
        row.appendChild(cell);
    }
    body.appendChild(row);
}

function showEmptyRow(body, columnCount, text) {
    if (!body) return;
    body.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = columnCount;
    cell.className = "empty";
    cell.textContent = text;
    row.appendChild(cell);
    body.appendChild(row);
}

function setAvatar(name, photoUrl) {
    const avatar = document.getElementById("studentAvatar");
    if (!avatar) return;

    avatar.replaceChildren();
    if (photoUrl) {
        const image = document.createElement("img");
        image.src = photoUrl;
        image.alt = "";
        image.width = 42;
        image.height = 42;
        image.style.borderRadius = "50%";
        image.style.objectFit = "cover";
        avatar.appendChild(image);
        return;
    }
    avatar.textContent = (name || "S").trim().charAt(0).toUpperCase() || "S";
}

/* ──────────────────────────────────────────────────────────────
   TAB NAVIGATION (Sidebar Function Switching)
────────────────────────────────────────────────────────────── */
function setupTabNavigation() {
    const navLinks = document.querySelectorAll("nav a[data-tab], .sp-nav-link[data-tab]");
    const tabContents = document.querySelectorAll(".tab-content");
    const topbarTitle = document.getElementById("studentHeaderName");

    const tabTitles = {
        home: "Student Portal Overview",
        results: "My Examination Results",
        attendance: "My Attendance",
        timetable: "My Class Timetable",
        subjects: "My Enrolled Subjects",
        notices: "School Notices & Announcements",
        profile: "My Profile"
    };

    function switchTab(tabId) {
        const validTabId = tabTitles[tabId] ? tabId : "home";

        tabContents.forEach(tab => {
            tab.classList.toggle("active", tab.id === `tab-${validTabId}`);
        });

        navLinks.forEach(link => {
            const isMatch = link.dataset.tab === validTabId;
            link.classList.toggle("active", isMatch);
            if (isMatch) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });

        if (topbarTitle && tabTitles[validTabId]) {
            topbarTitle.textContent = tabTitles[validTabId];
        }

        // Keep hash in URL without jump
        if (window.location.hash.replace("#", "") !== validTabId) {
            history.replaceState(null, "", `#${validTabId}`);
        }
    }

    navLinks.forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();
            switchTab(link.dataset.tab);
        });
    });

    document.querySelectorAll("[data-tab-jump]").forEach(btn => {
        btn.addEventListener("click", e => {
            e.preventDefault();
            switchTab(btn.dataset.tabJump);
        });
    });

    window.addEventListener("hashchange", () => {
        const hash = window.location.hash.replace("#", "");
        if (hash) switchTab(hash);
    });

    // Mobile sidebar drawer
    const spToggle = document.getElementById("spMobileToggle");
    const spSidebar = document.getElementById("studentSidebar");
    const spBackdrop = document.getElementById("spBackdrop");

    if (spToggle && spSidebar) {
        const toggleSidebar = () => {
            spSidebar.classList.toggle("open");
            spBackdrop?.classList.toggle("show");
        };
        spToggle.addEventListener("click", toggleSidebar);
        spBackdrop?.addEventListener("click", toggleSidebar);

        navLinks.forEach(link => {
            link.addEventListener("click", () => {
                if (window.innerWidth <= 820) {
                    spSidebar.classList.remove("open");
                    spBackdrop?.classList.remove("show");
                }
            });
        });
    }

    // Start on URL hash tab or default to home
    const initialHash = window.location.hash.replace("#", "");
    switchTab(initialHash || "home");
}

/* ──────────────────────────────────────────────────────────────
   LOAD STUDENT PROFILE
────────────────────────────────────────────────────────────── */
async function loadStudentProfile() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) {
        window.location.replace("/login.html");
        return false;
    }

    const { data: currentProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, role, phone, photo_url, status, student_id")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) throw profileError;
    if (!currentProfile || currentProfile.role !== "student") {
        await supabase.auth.signOut();
        window.location.replace("/login.html");
        return false;
    }

    if (!currentProfile.student_id) {
        throw new Error("This student account is not linked to a school record.");
    }

    // Try finding by numeric id or by string student_id
    let schoolRecord = null;
    const isNum = !isNaN(Number(currentProfile.student_id));
    if (isNum) {
        const { data } = await supabase
            .from("students")
            .select("id, student_id, first_name, last_name, gender, date_of_birth, class, section, class_id, phone, email, address, photo_url, status")
            .eq("id", Number(currentProfile.student_id))
            .maybeSingle();
        schoolRecord = data;
    }
    if (!schoolRecord) {
        const { data } = await supabase
            .from("students")
            .select("id, student_id, first_name, last_name, gender, date_of_birth, class, section, class_id, phone, email, address, photo_url, status")
            .eq("student_id", String(currentProfile.student_id))
            .maybeSingle();
        schoolRecord = data;
    }

    if (!schoolRecord) {
        throw new Error("Your student school record could not be found.");
    }

    profile = currentProfile;
    student = schoolRecord;

    const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Student";
    const studentCode = student.student_id || String(student.id);
    const classSection = `${student.class || "Not assigned"}${student.section ? " - " + student.section : ""}`;

    setText("studentStatus", student.status ? student.status.toUpperCase() : "ACTIVE");
    setText("studentId", studentCode);
    setText("studentClass", student.class || "Not assigned");
    setText("studentSection", student.section || "—");

    // Sidebar student profile at bottom
    setText("sidebarStudentName", fullName);
    setText("sidebarStudentGrade", student.class || "Grade 10");
    const sbAvatar = document.getElementById("sidebarStudentAvatar");
    if (sbAvatar) {
        sbAvatar.replaceChildren();
        const photo = student.photo_url || profile.photo_url;
        if (photo) {
            const img = document.createElement("img");
            img.src = photo;
            img.alt = "";
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.borderRadius = "50%";
            img.style.objectFit = "cover";
            sbAvatar.appendChild(img);
        } else {
            const initial = (student.first_name || profile.first_name || "S").trim().charAt(0).toUpperCase();
            sbAvatar.textContent = initial || "S";
        }
    }

    // Home tab details
    setText("homeGreeting", `Welcome, ${student.first_name || "Student"}!`);
    setText("homeClass", student.class || "Grade 10");
    setText("homeSection", student.section || "—");

    // Attendance summary cards
    setText("attStudentId", studentCode);
    setText("attStudentClass", classSection);

    setText("gender", student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : "—");
    setText("dateOfBirth", formatDate(student.date_of_birth));
    setText("accountStatus", student.status ? student.status.toUpperCase() : "ACTIVE");
    setValue("firstName", student.first_name);
    setValue("lastName", student.last_name);
    setValue("email", student.email || profile.email);
    setValue("phone", student.phone || profile.phone);
    setValue("address", student.address);
    setAvatar(fullName, student.photo_url || profile.photo_url);

    return true;
}

/* ──────────────────────────────────────────────────────────────
   LOAD ACADEMIC RECORDS (RESULTS, ATTENDANCE, TIMETABLE, SUBJECTS, NOTICES)
────────────────────────────────────────────────────────────── */
async function loadAcademicRecords() {
    // 1. Fetch Subjects list
    let allSubjects = [];
    try {
        const { data } = await supabase
            .from("subjects")
            .select("subject_code, subject_name, grade_level")
            .order("subject_name");
        allSubjects = data || [];
    } catch (e) {
        console.warn("Could not load subjects catalog:", e);
    }
    const subjectNames = new Map(allSubjects.map(s => [s.subject_code, s.subject_name]));

    // 2. Load Results
    const studentKeys = [
        String(student.student_id || ""),
        String(student.id || "")
    ].filter(Boolean);

    let results = [];
    try {
        const { data, error } = await supabase
            .from("results")
            .select("subject_code, exam_type, mark, grade, remark, created_at")
            .in("student_id", studentKeys)
            .order("created_at", { ascending: false });

        if (!error && data) {
            results = data;
        }
    } catch (e) {
        console.error("Results load error:", e);
    }

    // Process results & calculate subject totals
    const marksBySubject = new Map();
    for (const result of results) {
        const mark = Number(result.mark);
        if (Number.isFinite(mark) && result.subject_code) {
            const currentTotal = marksBySubject.get(result.subject_code) || 0;
            marksBySubject.set(result.subject_code, currentTotal + mark);
        }
    }

    const subjectTotals = [];
    for (const [code, mark] of marksBySubject.entries()) {
        subjectTotals.push({
            code,
            name: subjectNames.get(code) || code,
            mark
        });
    }

    // Render Subject Totals
    showEmptyRow(subjectTotalsBody, 3, "No subject totals recorded yet.");
    if (subjectTotalsBody && subjectTotals.length) {
        subjectTotalsBody.replaceChildren();
        for (const item of subjectTotals) {
            const status = item.mark >= 50 ? "Pass" : "Needs Review";
            addRow(subjectTotalsBody, [
                item.name,
                `${item.mark.toFixed(1)} / 100`,
                status
            ]);
        }
    }

    // Render Detailed Results
    showEmptyRow(resultsBody, 5, "No examination results published yet.");
    if (resultsBody && results.length) {
        resultsBody.replaceChildren();
        for (const result of results) {
            const markVal = Number(result.mark);
            addRow(resultsBody, [
                subjectNames.get(result.subject_code) || result.subject_code,
                result.exam_type || "Assessment",
                result.mark == null ? "—" : `${markVal.toFixed(1)} / 100`,
                result.grade || (markVal >= 50 ? "Pass" : "Fail"),
                result.remark || (markVal >= 85 ? "Excellent" : (markVal >= 50 ? "Satisfactory" : "Needs improvement"))
            ]);
        }
    }

    // Update Overall Academic Summary
    const overallAverage = subjectTotals.length
        ? subjectTotals.reduce((sum, item) => sum + item.mark, 0) / subjectTotals.length
        : null;

    setText("averageMark", overallAverage == null ? "—" : `${overallAverage.toFixed(1)} / 100`);
    setText("homeAverage", overallAverage == null ? "—" : `${overallAverage.toFixed(1)}%`);
    setText("performanceStatus", overallAverage == null ? "Not calculated" : overallAverage >= 50 ? "Pass" : "Fail");
    setText(
        "performanceRemark",
        overallAverage == null
            ? "No marks recorded"
            : overallAverage >= 85
                ? "Excellent"
                : overallAverage >= 70
                    ? "Very good"
                    : overallAverage >= 50
                        ? "Satisfactory"
                        : "Needs improvement"
    );

    // 3. Load Attendance
    let attendance = [];
    try {
        const { data, error } = await supabase
            .from("attendance")
            .select("attendance_date, status, remark")
            .eq("student_id", student.id)
            .order("attendance_date", { ascending: false });

        if (!error && data) {
            attendance = data;
        }
    } catch (e) {
        console.warn("Attendance load error:", e);
    }

    showEmptyRow(attendanceBody, 3, "No attendance records found.");
    if (attendanceBody && attendance.length) {
        attendanceBody.replaceChildren();
        for (const item of attendance) {
            const statusDisplay = item.status
                ? item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase()
                : "Present";
            addRow(attendanceBody, [
                formatDate(item.attendance_date),
                statusDisplay,
                item.remark || "—"
            ]);
        }
    }
    setText("attendanceCount", `${attendance.length} record${attendance.length === 1 ? "" : "s"}`);

    // 4. Load Timetable STRICTLY FOR STUDENT'S OWN SECTION ONLY
    let targetClassName = (student.class || "").trim();
    let targetSection = (student.section || "").trim();
    let classTeacherName = "—";

    if (student.class_id) {
        try {
            const { data: classData } = await supabase
                .from("classes")
                .select("id, class_name, section, class_teacher")
                .eq("id", student.class_id)
                .maybeSingle();
            if (classData) {
                if (classData.class_name) targetClassName = classData.class_name;
                if (classData.section) targetSection = classData.section;
                if (classData.class_teacher) classTeacherName = String(classData.class_teacher);
            }
        } catch (err) {
            console.warn("Class lookup warning:", err);
        }
    }

    setText("ttStudentClass", targetClassName || "Not assigned");
    setText("ttStudentSection", targetSection || "—");
    setText("ttClassTeacher", classTeacherName);

    let timetableRecords = [];
    try {
        const { data: ttData, error: ttError } = await supabase
            .from("timetable")
            .select("*")
            .order("day", { ascending: true })
            .order("start_time", { ascending: true });

        if (!ttError && ttData) {
            // Filter strictly for OWN section:
            // Match both class name / grade number AND section strictly!
            timetableRecords = ttData.filter(entry => {
                const entryClass = String(entry.class_name || "").trim().toLowerCase();
                const entrySection = String(entry.section || "").trim().toLowerCase();
                const sClass = targetClassName.toLowerCase();
                const sSection = targetSection.toLowerCase();

                // Match class digits or name (e.g. "Grade 10" and "Grade 10", or "10" and "10")
                const cleanEntryClass = entryClass.replace(/[^0-9]/g, "");
                const cleanSClass = sClass.replace(/[^0-9]/g, "");
                const classMatches = entryClass === sClass ||
                    (cleanEntryClass && cleanSClass && cleanEntryClass === cleanSClass);

                // Match section strictly (e.g. "B" === "B")
                const sectionMatches = sSection ? entrySection === sSection : true;

                return classMatches && sectionMatches;
            });
        }
    } catch (err) {
        console.error("Timetable query error:", err);
    }

    // Resolve teacher names for timetable entries
    let teachersCatalog = [];
    try {
        const { data: tData } = await supabase
            .from("teachers")
            .select("id, teacher_id, first_name, last_name");
        teachersCatalog = tData || [];
    } catch (e) {}

    let timetableTeachers = {};
    let teacherAssignments = [];
    try {
        timetableTeachers = JSON.parse(localStorage.getItem("sululta_timetable_teachers") || "{}");
        teacherAssignments = JSON.parse(localStorage.getItem("sululta_teacher_subject_assignments") || "[]");
    } catch (e) {}

    // Sort timetable entries by days of the week then time
    const dayOrder = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7 };
    timetableRecords.sort((a, b) => {
        const dA = dayOrder[a.day] || 99;
        const dB = dayOrder[b.day] || 99;
        if (dA !== dB) return dA - dB;
        return String(a.start_time || "").localeCompare(String(b.start_time || ""));
    });

    showEmptyRow(timetableBody, 6, `No timetable records found for your section (${targetClassName || "Class"} - ${targetSection || "Section"}).`);

    if (timetableBody && timetableRecords.length) {
        timetableBody.replaceChildren();
        timetableRecords.forEach((entry, idx) => {
            const cached = timetableTeachers[entry.id];
            let teacherName = entry.teacher_name || cached?.teacher_name || "";
            if (!teacherName && (entry.teacher_id || cached?.teacher_id)) {
                const targetId = entry.teacher_id || cached?.teacher_id;
                const matchT = teachersCatalog.find(t => String(t.id) === String(targetId) || String(t.teacher_id) === String(targetId));
                if (matchT) teacherName = `${matchT.first_name} ${matchT.last_name}`;
            }
            if (!teacherName) {
                const matchA = teacherAssignments.find(a =>
                    a.subject_code === entry.subject_code &&
                    (!a.class_name || (a.class_name === entry.class_name && (!a.section || a.section === entry.section)))
                );
                if (matchA) {
                    const matchT = teachersCatalog.find(t => String(t.id) === String(matchA.teacher_id));
                    if (matchT) teacherName = `${matchT.first_name} ${matchT.last_name}`;
                }
            }

            const timeDisplay = entry.start_time
                ? `${entry.start_time.slice(0, 5)} – ${entry.end_time ? entry.end_time.slice(0, 5) : ""}`
                : "—";

            const subjectName = subjectNames.get(entry.subject_code) || entry.subject_name || entry.subject_code;
            const subjectDisplay = `${entry.subject_code ? entry.subject_code + " - " : ""}${subjectName}`;

            addRow(timetableBody, [
                String(idx + 1),
                entry.day || "—",
                timeDisplay,
                subjectDisplay,
                teacherName || "—",
                entry.room_number || "—"
            ]);
        });
    }

    const uniqueDays = new Set(timetableRecords.map(t => t.day).filter(Boolean));
    const uniqueYears = [...new Set(timetableRecords.map(t => t.academic_year).filter(Boolean))];

    setText("ttTotalPeriods", `${timetableRecords.length} period${timetableRecords.length === 1 ? "" : "s"}`);
    setText("ttDaysCount", `${uniqueDays.size} day${uniqueDays.size === 1 ? "" : "s"} / week`);
    setText("ttAcademicYear", uniqueYears.length ? uniqueYears.join(", ") : "2026/2027");

    // 5. Load My Subjects
    let assignedSubjectCodes = [];
    if (timetableRecords.length) {
        assignedSubjectCodes = [...new Set(timetableRecords.map(t => t.subject_code).filter(Boolean))];
    }

    for (const r of results) {
        if (r.subject_code && !assignedSubjectCodes.includes(r.subject_code)) {
            assignedSubjectCodes.push(r.subject_code);
        }
    }

    if (!assignedSubjectCodes.length) {
        const gradeDigits = (student.class || "").replace(/[^0-9]/g, "");
        if (gradeDigits) {
            const relevant = allSubjects.filter(s => s.grade_level && s.grade_level.includes(gradeDigits));
            if (relevant.length) {
                assignedSubjectCodes = relevant.map(s => s.subject_code);
            }
        }
        if (!assignedSubjectCodes.length) {
            assignedSubjectCodes = allSubjects.map(s => s.subject_code);
        }
    }

    showEmptyRow(subjectsBody, 2, "No subjects listed for this class.");
    if (subjectsBody && assignedSubjectCodes.length) {
        subjectsBody.replaceChildren();
        for (const code of assignedSubjectCodes) {
            addRow(subjectsBody, [code, subjectNames.get(code) || code]);
        }
    }

    // 6. Load School Notices
    let notices = [];
    try {
        const { data, error } = await supabase
            .from("notices")
            .select("title, message, publish_date")
            .order("publish_date", { ascending: false });

        if (!error && data && data.length) {
            notices = data;
        }
    } catch (e) {
        console.warn("Notices table unavailable:", e);
    }

    if (!notices.length) {
        notices = [
            {
                title: "Welcome to 2026/2027 Academic Year",
                message: "Classes and regular schedules are now active. Check your portal for timetable, attendance, and exam results updates.",
                publish_date: new Date().toISOString()
            },
            {
                title: "Assessment & Grading System",
                message: "Subject marks are evaluated continuously through Assignments (10%), Quizzes (10%), Tests (20%), Midterm (25%), and Final Exam (35%).",
                publish_date: new Date().toISOString()
            },
            {
                title: "School Library Circulation",
                message: "Textbooks and reference materials are available for loan in the school library during standard library hours.",
                publish_date: new Date().toISOString()
            }
        ];
    }

    if (noticesContainer) {
        noticesContainer.replaceChildren();
        for (const notice of notices) {
            const article = document.createElement("article");
            article.style.padding = "12px 0";
            article.style.borderBottom = "1px solid #e8edf4";

            const title = document.createElement("strong");
            title.style.display = "block";
            title.style.color = "#082b59";
            title.style.fontSize = "14px";
            title.textContent = notice.title;

            const date = document.createElement("small");
            date.style.display = "block";
            date.style.color = "#64748b";
            date.style.margin = "2px 0 6px";
            date.textContent = formatDate(notice.publish_date);

            const text = document.createElement("p");
            text.style.margin = "0";
            text.style.color = "#334155";
            text.style.fontSize = "13px";
            text.textContent = notice.message;

            article.append(title, date, text);
            noticesContainer.appendChild(article);
        }
    }
}

/* ──────────────────────────────────────────────────────────────
   PROFILE & PASSWORD FORMS
────────────────────────────────────────────────────────────── */
profileForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!student || !profile) return;

    const first_name = document.getElementById("firstName")?.value.trim() || "";
    const last_name = document.getElementById("lastName")?.value.trim() || "";
    const phone = document.getElementById("phone")?.value.trim() || null;
    const address = document.getElementById("address")?.value.trim() || null;
    const button = document.getElementById("saveProfileButton");

    if (!first_name || !last_name) {
        showMessage(profileMessage, "First and last name are required.");
        return;
    }

    if (button) button.disabled = true;
    try {
        const { error: studentError } = await supabase
            .from("students")
            .update({ first_name, last_name, phone, address })
            .eq("id", student.id);
        if (studentError) throw studentError;

        const { error: profileError } = await supabase
            .from("profiles")
            .update({ first_name, last_name, phone })
            .eq("id", profile.id);
        if (profileError) throw profileError;

        showMessage(profileMessage, "Profile updated successfully.", "success");
        await loadStudentProfile();
    } catch (error) {
        console.error("Student profile update failed:", error);
        showMessage(profileMessage, error.message || "Unable to update your profile.");
    } finally {
        if (button) button.disabled = false;
    }
});

passwordForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const password = document.getElementById("newPassword")?.value || "";
    const confirmation = document.getElementById("confirmNewPassword")?.value || "";
    const button = document.getElementById("changePasswordButton");

    if (password.length < 8) {
        showMessage(profileMessage, "Password must be at least 8 characters.");
        return;
    }
    if (password !== confirmation) {
        showMessage(profileMessage, "Passwords do not match.");
        return;
    }

    if (button) button.disabled = true;
    try {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        passwordForm.reset();
        showMessage(profileMessage, "Your password has been changed successfully.", "success");
    } catch (error) {
        console.error("Student password update failed:", error);
        showMessage(profileMessage, error.message || "Unable to change your password.");
    } finally {
        if (button) button.disabled = false;
    }
});

logoutButton?.addEventListener("click", async () => {
    logoutButton.disabled = true;
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.replace("/login.html");
    } catch (error) {
        console.error("Student logout failed:", error);
        showMessage(message, error.message || "Unable to sign out.");
        logoutButton.disabled = false;
    }
});

/* ──────────────────────────────────────────────────────────────
   INITIALIZE
────────────────────────────────────────────────────────────── */
async function initialize() {
    setupTabNavigation();
    try {
        const profileLoaded = await loadStudentProfile();
        if (profileLoaded) {
            await loadAcademicRecords();
        }
    } catch (error) {
        console.error("Student dashboard failed to load:", error);
        showMessage(message, error.message || "Unable to load your school information.");
    }
}

void initialize();
