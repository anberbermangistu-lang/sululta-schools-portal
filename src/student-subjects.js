import { supabase } from "./supabase.js";

const tableBody = document.getElementById("subjectsTableBody");
const emptyState = document.getElementById("subjectsEmptyState");
const message = document.getElementById("subjectsMessage");
const refreshButton = document.getElementById("refreshSubjects");
const searchInput = document.getElementById("subjectSearch");
const clearButton = document.getElementById("clearSubjectFilters");

const studentName = document.getElementById("studentName");
const studentClass = document.getElementById("studentClass");
const studentHeaderName = document.getElementById("studentHeaderName");
const studentAvatar = document.getElementById("studentAvatar");

const totalSubjects = document.getElementById("totalSubjects");
const totalCredits = document.getElementById("totalCredits");
const subjectsBadge = document.getElementById("subjectsBadge");
const subjectsSummary = document.getElementById("subjectsSummary");

const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".admin-sidebar");

let currentStudent = null;
let subjects = [];

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    setupSidebar();
    setupLogout();
    setupFilters();

    const student = await getCurrentStudent();

    if (!student) {
        return;
    }

    currentStudent = student;

    updateStudentProfile(student);

    await loadSubjects(student);
}

async function getCurrentStudent() {
    const {
        data: { user },
        error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
        window.location.href = "/login.html";
        return null;
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

    if (profileError || !profile) {
        console.error("Profile error:", profileError);
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return null;
    }

    const role = String(profile.role || "")
        .trim()
        .toLowerCase();

    const status = String(profile.status || "")
        .trim()
        .toLowerCase();

    if (role !== "student") {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return null;
    }

    if (status !== "active") {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return null;
    }

    if (!profile.email) {
        showMessage(
            "Your student account does not have an email address.",
            "error"
        );
        return null;
    }

    const {
        data: student,
        error: studentError
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
            photo_url,
            status
        `)
        .ilike("email", profile.email)
        .maybeSingle();

    if (studentError) {
        console.error("Student lookup error:", studentError);

        showMessage(
            studentError.message,
            "error"
        );

        return null;
    }

    if (!student) {
        showMessage(
            "Your student record was not found.",
            "error"
        );

        return null;
    }

    return student;
}

function updateStudentProfile(student) {
    const fullName =
        `${student.first_name || ""} ${student.last_name || ""}`
            .trim() || "Student";

    if (studentName) {
        studentName.textContent = fullName;
    }

    if (studentClass) {
        studentClass.textContent =
            student.class || "N/A";
    }

    if (studentHeaderName) {
        studentHeaderName.textContent = fullName;
    }

    if (studentAvatar) {
        const photo = getPhotoUrl(
            student.photo_url || student.photo
        );

        if (photo) {
            studentAvatar.innerHTML = "";

            const image =
                document.createElement("img");

            image.src = photo;
            image.alt = fullName;

            image.onerror = () => {
                studentAvatar.textContent =
                    getInitials(
                        student.first_name,
                        student.last_name
                    );
            };

            studentAvatar.appendChild(image);
        } else {
            studentAvatar.textContent =
                getInitials(
                    student.first_name,
                    student.last_name
                );
        }
    }
}

async function loadSubjects(student) {
    showLoading();

    const gradeLevel = normalizeGrade(
        student.class
    );

    if (!gradeLevel) {
        subjects = [];
        updateStatistics();
        showEmptyState();

        showMessage(
            "Your class information is not available.",
            "error"
        );

        return;
    }

    const {
        data,
        error
    } = await supabase
        .from("subjects")
        .select(`
            id,
            subject_code,
            subject_name,
            grade_level,
            credit,
            description
        `)
        .ilike(
            "grade_level",
            gradeLevel
        )
        .order(
            "subject_name",
            {
                ascending: true
            }
        );

    if (error) {
        console.error(
            "Subjects loading error:",
            error
        );

        subjects = [];

        showError(error.message);

        return;
    }

    subjects = data || [];

    updateStatistics();
    renderSubjects();
}

function renderSubjects() {
    const search =
        String(searchInput?.value || "")
            .trim()
            .toLowerCase();

    const filtered =
        subjects.filter(subject => {

            const code =
                String(
                    subject.subject_code || ""
                )
                    .trim()
                    .toLowerCase();

            const name =
                String(
                    subject.subject_name || ""
                )
                    .trim()
                    .toLowerCase();

            const grade =
                String(
                    subject.grade_level || ""
                )
                    .trim()
                    .toLowerCase();

            const description =
                String(
                    subject.description || ""
                )
                    .trim()
                    .toLowerCase();

            return (
                !search ||
                code.includes(search) ||
                name.includes(search) ||
                grade.includes(search) ||
                description.includes(search)
            );
        });

    updateRecordCount(filtered.length);

    if (!filtered.length) {
        showEmptyState();
        return;
    }

    if (emptyState) {
        emptyState.hidden = true;
        emptyState.style.display = "none";
    }

    if (!tableBody) {
        return;
    }

    tableBody.innerHTML =
        filtered
            .map(
                (subject, index) =>
                    createSubjectRow(
                        subject,
                        index
                    )
            )
            .join("");
}

function createSubjectRow(subject, index) {
    const code =
        subject.subject_code || "N/A";

    const name =
        subject.subject_name || "N/A";

    const grade =
        subject.grade_level || "N/A";

    const credit =
        subject.credit !== null &&
        subject.credit !== undefined
            ? Number(subject.credit).toFixed(2)
            : "0.00";

    const description =
        subject.description || "N/A";

    return `
        <tr>

            <td>
                ${index + 1}
            </td>

            <td>
                <strong>
                    ${escapeHtml(code)}
                </strong>
            </td>

            <td>
                ${escapeHtml(name)}
            </td>

            <td>
                ${escapeHtml(grade)}
            </td>

            <td>
                ${escapeHtml(credit)}
            </td>

            <td>
                ${escapeHtml(description)}
            </td>

        </tr>
    `;
}

function normalizeGrade(value) {
    const text =
        String(value || "")
            .trim()
            .toLowerCase();

    if (!text) {
        return "";
    }

    if (text.startsWith("grade ")) {
        return text.replace(
            /^grade\s+/,
            "Grade "
        );
    }

    if (/^\d+$/.test(text)) {
        return `Grade ${text}`;
    }

    return text;
}

function updateStatistics() {
    const total = subjects.length;

    const credits = subjects.reduce(
        (sum, subject) => {
            const value =
                Number(subject.credit);

            return sum +
                (Number.isFinite(value)
                    ? value
                    : 0);
        },
        0
    );

    if (totalSubjects) {
        totalSubjects.textContent = total;
    }

    if (totalCredits) {
        totalCredits.textContent =
            credits.toFixed(2);
    }

    if (subjectsBadge) {
        subjectsBadge.textContent =
            `${total} ${
                total === 1
                    ? "Subject"
                    : "Subjects"
            }`;
    }
}

function updateRecordCount(count) {
    if (subjectsBadge) {
        subjectsBadge.textContent =
            `${count} ${
                count === 1
                    ? "Subject"
                    : "Subjects"
            }`;
    }

    if (subjectsSummary) {
        subjectsSummary.textContent =
            `Showing ${count} ${
                count === 1
                    ? "subject"
                    : "subjects"
            }`;
    }
}

function setupFilters() {
    searchInput?.addEventListener(
        "input",
        renderSubjects
    );

    clearButton?.addEventListener(
        "click",
        () => {
            if (searchInput) {
                searchInput.value = "";
            }

            renderSubjects();
        }
    );

    refreshButton?.addEventListener(
        "click",
        async () => {
            if (currentStudent) {
                await loadSubjects(
                    currentStudent
                );
            }
        }
    );
}

function setupSidebar() {
    if (!sidebarToggle || !sidebar) {
        return;
    }

    sidebarToggle.addEventListener(
        "click",
        () => {
            sidebar.classList.toggle(
                "mobile-open"
            );
        }
    );
}

function setupLogout() {
    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener(
        "click",
        async () => {

            const {
                error
            } = await supabase.auth.signOut();

            if (error) {
                showMessage(
                    error.message,
                    "error"
                );

                return;
            }

            window.location.href =
                "/login.html";
        }
    );
}

function showLoading() {
    if (tableBody) {
        tableBody.innerHTML = `
            <tr>

                <td
                    colspan="6"
                    class="loading-cell">

                    Loading subjects...

                </td>

            </tr>
        `;
    }

    if (emptyState) {
        emptyState.hidden = true;
        emptyState.style.display = "none";
    }
}

function showEmptyState() {
    if (tableBody) {
        tableBody.innerHTML = "";
    }

    if (emptyState) {
        emptyState.hidden = false;
        emptyState.style.display = "flex";
    }

    updateRecordCount(0);
}

function showError(errorText) {
    if (!tableBody) {
        return;
    }

    tableBody.innerHTML = `
        <tr>

            <td
                colspan="6"
                class="loading-cell">

                <div class="empty-state">

                    <div class="empty-icon">
                        ⚠️
                    </div>

                    <h3>
                        Unable to Load Subjects
                    </h3>

                    <p>
                        ${escapeHtml(errorText)}
                    </p>

                    <button
                        type="button"
                        class="btn btn-primary"
                        id="retrySubjects">

                        ↻ Try Again

                    </button>

                </div>

            </td>

        </tr>
    `;

    document
        .getElementById("retrySubjects")
        ?.addEventListener(
            "click",
            async () => {
                if (currentStudent) {
                    await loadSubjects(
                        currentStudent
                    );
                }
            }
        );
}

function showMessage(
    text,
    type = "info"
) {
    if (!message) {
        return;
    }

    message.textContent = text;

    message.className =
        `message ${type}`;

    message.hidden = false;
}

function getPhotoUrl(photo) {
    if (!photo) {
        return null;
    }

    const value =
        String(photo).trim();

    if (!value) {
        return null;
    }

    if (
        value.startsWith("http://") ||
        value.startsWith("https://")
    ) {
        return value;
    }

    const path =
        value.replace(/^\/+/, "");

    const {
        data
    } = supabase.storage
        .from("students")
        .getPublicUrl(path);

    return data?.publicUrl || null;
}

function getInitials(first, last) {
    const firstName =
        String(first || "").trim();

    const lastName =
        String(last || "").trim();

    if (firstName && lastName) {
        return (
            firstName[0] +
            lastName[0]
        ).toUpperCase();
    }

    if (firstName) {
        return firstName[0].toUpperCase();
    }

    if (lastName) {
        return lastName[0].toUpperCase();
    }

    return "S";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
