import { supabase } from "./supabase.js";

document.addEventListener("DOMContentLoaded", init);

async function init() {
    setupSidebar();
    setupDropdown();
    setupSearch();
    setupLogout();

    await checkAuth();

    await Promise.all([
        loadStats(),
        loadCharts()
    ]);
}

/* ──────────────────────────────────────────────────────────────
   AUTHENTICATION & PROFILE
────────────────────────────────────────────────────────────── */
async function checkAuth() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        window.location.replace("/login.html");
        return;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, role, status, photo_url, email")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile || profile.status !== "active" || profile.role !== "admin") {
        await supabase.auth.signOut();
        window.location.replace("/login.html");
        return;
    }

    const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Admin";
    const initial = fullName.charAt(0).toUpperCase() || "A";

    setEl("topName", fullName);
    setEl("topRole", capitalize(profile.role || "Administrator"));
    setEl("dropdownUserEmail", user.email || profile.email || "admin@school.com");

    const avatarImg = document.getElementById("topAvatarImg");
    const avatarInitial = document.getElementById("topAvatarInitial");

    if (profile.photo_url && avatarImg) {
        avatarImg.src = profile.photo_url;
        avatarImg.alt = fullName;
        avatarImg.style.display = "block";
        if (avatarInitial) avatarInitial.style.display = "none";
    } else {
        if (avatarInitial) avatarInitial.textContent = initial;
    }
}

/* ──────────────────────────────────────────────────────────────
   DASHBOARD STATS
────────────────────────────────────────────────────────────── */
async function loadStats() {
    try {
        const [students, teachers, classes, subjects] = await Promise.all([
            countTable("students"),
            countTable("teachers"),
            countTable("classes"),
            countTable("subjects")
        ]);

        setEl("statStudents", students.toLocaleString());
        setEl("statTeachers", teachers.toLocaleString());
        setEl("statClasses", classes.toLocaleString());
        setEl("statSubjects", subjects.toLocaleString());

        setEl("gradeTotal", students.toLocaleString());
        setEl("donutTotal", students.toLocaleString());
    } catch (err) {
        console.error("Error loading dashboard stats:", err);
    }
}

async function countTable(table) {
    const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
    if (error) {
        console.warn(`Count error on ${table}:`, error);
        return 0;
    }
    return count ?? 0;
}

/* ──────────────────────────────────────────────────────────────
   STUDENTS BY GRADE (DONUT CHART & BREAKDOWN LIST)
────────────────────────────────────────────────────────────── */
async function loadCharts() {
    await drawGradeChart();
}

async function drawGradeChart() {
    const canvas = document.getElementById("gradeChart");
    const listEl = document.getElementById("gradeBreakdownList");
    if (!canvas) return;

    // Fetch student grade records with class join
    const { data: students, error } = await supabase
        .from("students")
        .select("id, class, class_id, classes(class_name)")
        .eq("status", "active");

    if (error) {
        console.error("Error loading students by grade:", error);
    }

    const all = students || [];
    const totalStudents = all.length;

    // Resolve class/grade string for each student
    const resolvedGrades = all.map(s => {
        const joined = s.classes?.class_name || "";
        const direct = String(s.class || "").trim();
        return (joined || direct).toLowerCase();
    });

    // 4 secondary grades configuration
    const gradeConfigs = [
        { label: "Grade 9",  color: "#3b82f6", pattern: /\b9\b|grade\s*9/i },
        { label: "Grade 10", color: "#10b981", pattern: /\b10\b|grade\s*10/i },
        { label: "Grade 11", color: "#f59e0b", pattern: /\b11\b|grade\s*11/i },
        { label: "Grade 12", color: "#8b5cf6", pattern: /\b12\b|grade\s*12/i }
    ];

    // Compute actual counts per grade
    const counts = gradeConfigs.map(g =>
        resolvedGrades.filter(str => g.pattern.test(str)).length
    );

    const matchedTotal = counts.reduce((sum, n) => sum + n, 0);
    const denominator = matchedTotal > 0 ? matchedTotal : (totalStudents > 0 ? totalStudents : 1);

    // Render Grade Breakdown List on the Left
    if (listEl) {
        listEl.innerHTML = gradeConfigs.map((g, idx) => {
            const count = counts[idx];
            const pct = totalStudents > 0 ? Math.round((count / denominator) * 100) : 0;
            const studentWord = count === 1 ? "student" : "students";

            return `
                <div class="grade-row-item">
                    <div class="grade-row-top">
                        <div class="grade-label-group">
                            <span class="grade-color-indicator" style="background: ${g.color};"></span>
                            <span class="grade-name">${escHtml(g.label)}</span>
                        </div>
                        <div class="grade-stats-group">
                            <span class="grade-count-text">${count} ${studentWord}</span>
                            <span class="grade-pct-badge">${pct}%</span>
                        </div>
                    </div>
                    <div class="grade-progress-track">
                        <div class="grade-progress-bar" style="width: ${pct}%; background: ${g.color};"></div>
                    </div>
                </div>
            `;
        }).join("");
    }

    // Chart.js Donut Setup on the Right
    const chartLabels = [];
    const chartData = [];
    const chartColors = [];

    gradeConfigs.forEach((g, idx) => {
        if (counts[idx] > 0) {
            chartLabels.push(g.label);
            chartData.push(counts[idx]);
            chartColors.push(g.color);
        }
    });

    // Fallback if no students yet
    if (chartData.length === 0) {
        chartLabels.push("No students enrolled");
        chartData.push(1);
        chartColors.push("#e2e8f0");
    }

    // Destroy existing chart instance if any
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: chartLabels,
            datasets: [{
                data: chartData,
                backgroundColor: chartColors,
                borderWidth: 3,
                borderColor: "#ffffff",
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "70%",
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: "#0f172a",
                    titleFont: { size: 14, weight: "bold" },
                    bodyFont: { size: 13 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: (context) => {
                            if (context.label === "No students enrolled") return " 0 students";
                            const val = context.parsed;
                            const pct = totalStudents > 0 ? Math.round((val / denominator) * 100) : 0;
                            const unit = val === 1 ? "student" : "students";
                            return ` ${context.label}: ${val} ${unit} (${pct}%)`;
                        }
                    }
                }
            },
            animation: {
                duration: 750,
                easing: "easeOutQuart"
            }
        }
    });

    // Update Totals
    setEl("gradeTotal", totalStudents.toLocaleString());
    setEl("donutTotal", totalStudents.toLocaleString());
}

/* ──────────────────────────────────────────────────────────────
   INTERACTIONS & UI
────────────────────────────────────────────────────────────── */
function setupSidebar() {
    const sidebar = document.getElementById("dashSidebar");
    const overlay = document.getElementById("dashOverlay");
    const menuBtn = document.getElementById("menuBtn");

    const open  = () => { sidebar?.classList.add("open");    overlay?.classList.add("active"); };
    const close = () => { sidebar?.classList.remove("open"); overlay?.classList.remove("active"); };

    menuBtn?.addEventListener("click", () =>
        sidebar?.classList.contains("open") ? close() : open()
    );
    overlay?.addEventListener("click", close);
}

function setupDropdown() {
    const profileBtn = document.getElementById("profileDropdownBtn");
    const dropdown = document.getElementById("userDropdownMenu");

    if (!profileBtn || !dropdown) return;

    profileBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("show");
        profileBtn.classList.toggle("open");
    });

    document.addEventListener("click", (e) => {
        if (!dropdown.contains(e.target) && !profileBtn.contains(e.target)) {
            dropdown.classList.remove("show");
            profileBtn.classList.remove("open");
        }
    });
}

function setupSearch() {
    const searchInput = document.getElementById("globalSearch");
    if (!searchInput) return;

    searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const query = searchInput.value.trim().toLowerCase();
            if (!query) return;

            if (query.includes("student")) {
                window.location.href = "/students/dashboard.html";
            } else if (query.includes("teacher")) {
                window.location.href = "/teachers/dashboard.html";
            } else if (query.includes("class")) {
                window.location.href = "/classes/dashboard.html";
            } else if (query.includes("subject")) {
                window.location.href = "/subjects/dashboard.html";
            } else if (query.includes("result") || query.includes("grade") || query.includes("mark")) {
                window.location.href = "/results/dashboard.html";
            } else if (query.includes("attendance")) {
                window.location.href = "/attendance/dashboard.html";
            } else if (query.includes("timetable") || query.includes("schedule")) {
                window.location.href = "/timetable/dashboard.html";
            } else if (query.includes("library") || query.includes("book")) {
                window.location.href = "/library/dashboard.html";
            } else if (query.includes("assign")) {
                window.location.href = "/admin/teacher-assignments.html";
            } else if (query.includes("user") || query.includes("setting")) {
                window.location.href = "/admin/users.html";
            }
        }
    });
}

function setupLogout() {
    const performLogout = async () => {
        await supabase.auth.signOut();
        window.location.replace("/login.html");
    };

    document.getElementById("logoutBtn")?.addEventListener("click", performLogout);
    document.getElementById("dropdownLogoutBtn")?.addEventListener("click", performLogout);
}

/* ──────────────────────────────────────────────────────────────
   HELPERS
────────────────────────────────────────────────────────────── */
function setEl(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function escHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function capitalize(str) {
    const s = String(str || "");
    return s ? s[0].toUpperCase() + s.slice(1) : "";
}
