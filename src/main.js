import { supabase } from "./supabase.js";

const totalStudents = document.getElementById("totalStudents");
const totalTeachers = document.getElementById("totalTeachers");
const totalClasses = document.getElementById("totalClasses");
const totalParents = document.getElementById("totalParents");

const overviewStudents = document.getElementById("overviewStudents");
const overviewTeachers = document.getElementById("overviewTeachers");
const overviewClasses = document.getElementById("overviewClasses");
const overviewParents = document.getElementById("overviewParents");

const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".admin-sidebar");

document.addEventListener("DOMContentLoaded", initializeDashboard);

async function initializeDashboard() {
    setupSidebar();
    setupLogout();

    const allowed = await checkAdminAccess();

    if (!allowed) {
        return;
    }

    await Promise.all([
        loadStatistics(),
        loadRecentStudents()
    ]);
}

async function checkAdminAccess() {
    const {
        data: { user },
        error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
        window.location.href = "/login.html";
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
            email,
            username,
            role,
            phone,
            photo_url,
            status
        `)
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
        console.error("Profile error:", profileError);
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return false;
    }

    if (!profile) {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return false;
    }

    const role = String(profile.role || "")
        .trim()
        .toLowerCase();

    const status = String(profile.status || "")
        .trim()
        .toLowerCase();

    if (status !== "active") {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return false;
    }

    if (role !== "admin") {
        redirectByRole(role);
        return false;
    }

    loadAdminProfile(profile);

    return true;
}

function redirectByRole(role) {
    const routes = {
        teacher: "/teacher/dashboard.html",
        student: "/student/dashboard.html",
        parent: "/parents/dashboard.html",
        librarian: "/library/dashboard.html",
        finance: "/fees/dashboard.html"
    };

    window.location.href =
        routes[role] || "/login.html";
}

function loadAdminProfile(profile) {
    const firstName = String(
        profile.first_name || ""
    ).trim();

    const lastName = String(
        profile.last_name || ""
    ).trim();

    const username = String(
        profile.username || ""
    ).trim();

    const fullName =
        `${firstName} ${lastName}`.trim() ||
        username ||
        "Administrator";

    const initial =
        firstName.charAt(0).toUpperCase() ||
        fullName.charAt(0).toUpperCase() ||
        "A";

    const adminName =
        document.getElementById("adminHeaderName");

    const adminAvatar =
        document.getElementById("adminAvatar");

    const welcomeTitle =
        document.getElementById("welcomeTitle");

    if (adminName) {
        adminName.textContent = fullName;
    }

    if (welcomeTitle) {
        welcomeTitle.textContent =
            `Hello, ${firstName || fullName}`;
    }

    if (!adminAvatar) {
        return;
    }

    adminAvatar.classList.add("admin-avatar-photo");
    adminAvatar.innerHTML = "";

    const photoUrl =
        String(profile.photo_url || "").trim();

    if (!photoUrl) {
        adminAvatar.textContent = initial;
        return;
    }

    const image =
        document.createElement("img");

    image.className = "admin-profile-image";
    image.src = photoUrl;
    image.alt = fullName;
    image.loading = "eager";
    image.decoding = "async";

    image.addEventListener("load", () => {
        adminAvatar.classList.add("has-photo");
        adminAvatar.classList.remove("no-photo");
    });

    image.addEventListener("error", () => {
        console.error(
            "Unable to load admin photo:",
            photoUrl
        );

        adminAvatar.innerHTML = "";
        adminAvatar.textContent = initial;
        adminAvatar.classList.remove("has-photo");
        adminAvatar.classList.add("no-photo");
    });

    adminAvatar.appendChild(image);
}

async function getCount(table) {
    const {
        count,
        error
    } = await supabase
        .from(table)
        .select("id", {
            count: "exact",
            head: true
        });

    if (error) {
        console.error(
            `${table} error:`,
            error
        );

        return 0;
    }

    return count || 0;
}

async function loadStatistics() {
    const [
        students,
        teachers,
        classes,
        parents
    ] = await Promise.all([
        getCount("students"),
        getCount("teachers"),
        getCount("classes"),
        getCount("parents")
    ]);

    if (totalStudents) {
        totalStudents.textContent = students;
    }

    if (totalTeachers) {
        totalTeachers.textContent = teachers;
    }

    if (totalClasses) {
        totalClasses.textContent = classes;
    }

    if (totalParents) {
        totalParents.textContent = parents;
    }

    if (overviewStudents) {
        overviewStudents.textContent =
            `${students} registered`;
    }

    if (overviewTeachers) {
        overviewTeachers.textContent =
            `${teachers} registered`;
    }

    if (overviewClasses) {
        overviewClasses.textContent =
            `${classes} available`;
    }

    if (overviewParents) {
        overviewParents.textContent =
            `${parents} registered`;
    }
}

async function loadRecentStudents() {
    const container =
        document.getElementById("recentStudents");

    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="recent-empty">
            Loading students...
        </div>
    `;

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
            class,
            section,
            photo_url,
            created_at
        `)
        .order("created_at", {
            ascending: false
        })
        .limit(5);

    if (error) {
        console.error(
            "Recent students error:",
            error
        );

        container.innerHTML = `
            <div class="recent-empty">
                Unable to load recent students.
            </div>
        `;

        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = `
            <div class="recent-empty">
                No students registered yet.
            </div>
        `;

        return;
    }

    container.innerHTML = data
        .map((student) => {
            const fullName =
                `${student.first_name || ""} ${student.last_name || ""}`
                    .trim() ||
                "Unnamed Student";

            const initials =
                fullName
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((name) =>
                        name.charAt(0).toUpperCase()
                    )
                    .slice(0, 2)
                    .join("") || "S";

            const photo =
                String(
                    student.photo_url || ""
                ).trim();

            return `
                <div class="recent-student">

                    <div class="recent-avatar">

                        ${
                            photo
                                ? `
                                    <img
                                        src="${escapeHtml(photo)}"
                                        alt="${escapeHtml(fullName)}"
                                        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                                    >

                                    <div
                                        class="recent-avatar-placeholder"
                                        style="display:none;"
                                    >
                                        ${escapeHtml(initials)}
                                    </div>
                                `
                                : `
                                    <div class="recent-avatar-placeholder">
                                        ${escapeHtml(initials)}
                                    </div>
                                `
                        }

                    </div>

                    <div class="recent-student-info">

                        <strong>
                            ${escapeHtml(fullName)}
                        </strong>

                        <span>
                            ${escapeHtml(
                                student.student_id || "No ID"
                            )}
                        </span>

                    </div>

                    <div class="recent-student-class">

                        <strong>
                            ${escapeHtml(
                                student.class || "No class"
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(
                                student.section || "No section"
                            )}
                        </span>

                    </div>

                </div>
            `;
        })
        .join("");
}

function setupSidebar() {
    if (!sidebarToggle || !sidebar) {
        return;
    }

    sidebarToggle.addEventListener("click", () => {
        sidebar.classList.toggle("mobile-open");
    });
}

function setupLogout() {
    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
        "click",
        logout
    );
}

async function logout() {
    if (logoutButton) {
        logoutButton.disabled = true;
    }

    const {
        error
    } = await supabase.auth.signOut();

    if (error) {
        console.error(
            "Logout error:",
            error
        );

        if (logoutButton) {
            logoutButton.disabled = false;
        }

        return;
    }

    window.location.href = "/login.html";
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}