import { supabase } from "./supabase.js";
import { ASSESSMENTS, getAssessmentDetails, normalizeAssessmentMark } from "./assessment-config.js";

const resultMessage = document.getElementById("resultMessage");
const resultsTableBody = document.getElementById("resultsTableBody");
const resultsEmptyState = document.getElementById("resultsEmptyState");

const totalSubjects = document.getElementById("totalSubjects");
const totalResults = document.getElementById("totalResults");
const averageMark = document.getElementById("averageMark");
const studentName = document.getElementById("studentName");

const studentHeaderName = document.getElementById("studentHeaderName");
const studentAvatar = document.getElementById("studentAvatar");

const resultBadge = document.getElementById("resultBadge");
const resultSummary = document.getElementById("resultSummary");

const resultSearch = document.getElementById("resultSearch");
const examFilter = document.getElementById("examFilter");
const gradeFilter = document.getElementById("gradeFilter");

const clearResultFilters = document.getElementById("clearResultFilters");
const refreshResults = document.getElementById("refreshResults");

const logoutButton = document.getElementById("logoutButton");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".admin-sidebar");

const EXAM_CATEGORIES = ASSESSMENTS;

let allResults = [];
let currentStudent = null;

function showMessage(message, type = "error") {
    if (!resultMessage) {
        return;
    }

    resultMessage.textContent = message;
    resultMessage.className = `message ${type}`;
    resultMessage.hidden = !message;
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatMark(mark, maxMark = 100) {
    const number = Number(mark);

    if (Number.isNaN(number)) {
        return "-";
    }

    return `${number.toFixed(2)} / ${maxMark}`;
}

function formatGrade(grade, percentage) {
    if (grade) return String(grade).toUpperCase();
    if (!Number.isFinite(percentage)) return "-";
    if (percentage >= 90) return "A";
    if (percentage >= 80) return "B";
    if (percentage >= 65) return "C";
    if (percentage >= 50) return "D";
    return "F";
}

function getGradeClass(grade) {
    const value = String(grade || "")
        .trim()
        .toUpperCase();

    if (value === "A" || value === "A+") {
        return "grade-a";
    }

    if (value === "B" || value === "B+") {
        return "grade-b";
    }

    if (value === "C" || value === "C+") {
        return "grade-c";
    }

    if (value === "D" || value === "D+") {
        return "grade-d";
    }

    if (value === "F") {
        return "grade-f";
    }

    return "";
}

function setupSidebar() {
    if (!sidebarToggle || !sidebar) {
        return;
    }

    sidebarToggle.addEventListener("click", () => {
        sidebar.classList.toggle("mobile-open");
    });
}

async function logout() {
    if (logoutButton) {
        logoutButton.disabled = true;
    }

    try {
        const { error } = await supabase.auth.signOut();

        if (error) {
            throw error;
        }

        window.location.replace("/login.html");
    } catch (error) {
        console.error("Logout error:", error);

        if (logoutButton) {
            logoutButton.disabled = false;
        }
    }
}

function setupLogout() {
    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener("click", logout);
}

async function getLoggedInUser() {
    const {
        data: { user },
        error
    } = await supabase.auth.getUser();

    if (error) {
        console.error("Auth error:", error);
        return null;
    }

    return user || null;
}

async function loadStudent() {
    const user = await getLoggedInUser();

    if (!user) {
        window.location.replace("/login.html");
        return null;
    }

    const {
        data: profile,
        error: profileError
    } = await supabase
        .from("profiles")
        .select("student_id")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError) {
        console.error("Student profile error:", profileError);
        throw new Error("Unable to load your student profile.");
    }

    let studentQuery = supabase
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
        `);

    if (profile?.student_id) {
        studentQuery = studentQuery.eq("id", profile.student_id);
    } else if (user.email) {
        studentQuery = studentQuery.ilike("email", user.email).limit(1);
    } else {
        throw new Error("No student record is linked to your login.");
    }

    const { data: linkedStudent, error } = await studentQuery.maybeSingle();

    if (error) {
        console.error("Student error:", error);
        throw new Error("Unable to load your student information.");
    }

    if (!linkedStudent) {
        throw new Error("No student record is linked to your login email.");
    }

    currentStudent = linkedStudent;

    loadStudentProfile(currentStudent);

    return currentStudent;
}

function loadStudentProfile(student) {
    const fullName =
        `${student.first_name || ""} ${student.last_name || ""}`.trim() ||
        "Student";

    if (studentName) {
        studentName.textContent = fullName;
    }

    if (studentHeaderName) {
        studentHeaderName.textContent = fullName;
    }

    if (studentAvatar) {
        if (student.photo_url) {
            studentAvatar.innerHTML = "";

            const image = document.createElement("img");

            image.src = student.photo_url;
            image.alt = fullName;

            studentAvatar.appendChild(image);
        } else {
            studentAvatar.textContent = fullName
                .charAt(0)
                .toUpperCase();
        }
    }
}

async function loadResults() {
    if (!currentStudent) {
        return;
    }

    showMessage("");

    const {
        data,
        error
    } = await supabase
        .from("results")
        .select(`
            id,
            student_id,
            subject_code,
            exam_type,
            mark,
            max_mark,
            grade,
            remark,
            recorded_by,
            created_at
        `)
        .in("student_id", [
            String(currentStudent.id),
            String(currentStudent.student_id)
        ])
        .order("created_at", {
            ascending: false
        });

    if (error) {
        console.error("Results error:", error);
        throw new Error("Unable to load your examination results.");
    }

    const results = data || [];

    if (results.length === 0) {
        allResults = [];
        renderResults();
        return;
    }

    const subjectCodes = [
        ...new Set(
            results
                .map(result => result.subject_code)
                .filter(Boolean)
        )
    ];

    const {
        data: subjects,
        error: subjectsError
    } = await supabase
        .from("subjects")
        .select(`
            subject_code,
            subject_name
        `)
        .in("subject_code", subjectCodes);

    if (subjectsError) {
        console.error("Subjects error:", subjectsError);
        throw new Error("Unable to load subject information.");
    }

    const subjectMap = new Map(
        (subjects || []).map(subject => [
            String(subject.subject_code).toLowerCase(),
            subject.subject_name
        ])
    );

    allResults = results.map(result => ({
        ...result,
        subject_name:
            subjectMap.get(
                String(result.subject_code || "").toLowerCase()
            ) || result.subject_code || "-"
    }));

    populateExamFilter();
    populateGradeFilter();

    renderResults();
}

function populateExamFilter() {
    if (!examFilter) {
        return;
    }

    examFilter.innerHTML = `
        <option value="all">All Exams</option>
    `;

    EXAM_CATEGORIES.forEach(({ value, label }) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        examFilter.appendChild(option);
    });

    if (allResults.some(result => !getExamCategory(result.exam_type))) {
        const option = document.createElement("option");
        option.value = "other";
        option.textContent = "Other Exams";
        examFilter.appendChild(option);
    }
}

function getExamCategory(examType) {
    return getAssessmentDetails(examType).category;
}

function getExamLabel(examType) {
    const category = getExamCategory(examType);
    const categoryLabel = EXAM_CATEGORIES.find(
        item => item.value === category
    )?.label;

    return categoryLabel || String(examType || "-");
}

function getExamMaximum(examType) {
    return getAssessmentDetails(examType).maxMark;
}

function populateGradeFilter() {
    if (!gradeFilter) {
        return;
    }

    const grades = [
        ...new Set(
            allResults
                .map(result => result.grade)
                .filter(Boolean)
        )
    ].sort();

    gradeFilter.innerHTML = `
        <option value="all">All Grades</option>
    `;

    grades.forEach(grade => {
        const option = document.createElement("option");

        option.value = grade;
        option.textContent = grade;

        gradeFilter.appendChild(option);
    });
}

function getFilteredResults() {
    const search = String(resultSearch?.value || "")
        .trim()
        .toLowerCase();

    const selectedExam = String(examFilter?.value || "all")
        .toLowerCase();

    const selectedGrade = String(gradeFilter?.value || "all")
        .toLowerCase();

    return allResults.filter(result => {
        const searchableText = [
            result.subject_name,
            result.subject_code,
            result.exam_type,
            result.grade,
            result.remark,
            result.mark
        ]
            .join(" ")
            .toLowerCase();

        const matchesSearch =
            !search ||
            searchableText.includes(search);

        const category = getExamCategory(result.exam_type);
        const matchesExam =
            selectedExam === "all" ||
            (selectedExam === "other"
                ? !category
                : category === selectedExam);

        const matchesGrade =
            selectedGrade === "all" ||
            String(result.grade || "").toLowerCase() === selectedGrade;

        return (
            matchesSearch &&
            matchesExam &&
            matchesGrade
        );
    });
}

function renderResults() {
    const filteredResults = getFilteredResults();

    updateStatistics(filteredResults);

    if (resultBadge) {
        resultBadge.textContent =
            `${filteredResults.length} Records`;
    }

    if (resultSummary) {
        resultSummary.textContent =
            `Showing ${filteredResults.length} of ${allResults.length} records`;
    }

    if (!resultsTableBody) {
        return;
    }

    if (filteredResults.length === 0) {
        resultsTableBody.innerHTML = "";

        if (resultsEmptyState) {
            resultsEmptyState.hidden = false;
        }

        return;
    }

    if (resultsEmptyState) {
        resultsEmptyState.hidden = true;
    }

    resultsTableBody.innerHTML = filteredResults
        .map((result, index) => {
            const details = getAssessmentDetails(result.exam_type, result.max_mark);
            const maxMark = getExamMaximum(result.exam_type);
            const mark = normalizeAssessmentMark(result.mark, details);
            const percentage = mark == null ? NaN : mark / maxMark * 100;
            const grade = formatGrade(result.grade, percentage);
            const gradeClass = getGradeClass(grade);

            return `
                <tr>
                    <td>${index + 1}</td>

                    <td>
                        <strong>
                            ${escapeHTML(result.subject_name)}
                        </strong>
                    </td>

                    <td>
                        ${escapeHTML(result.subject_code || "-")}
                    </td>

                    <td>
                        ${escapeHTML(getExamLabel(result.exam_type))}
                    </td>

                    <td>
                        <strong>
                            ${mark == null ? "-" : formatMark(mark, maxMark)}
                        </strong>
                    </td>

                    <td>
                        <span class="grade-badge ${gradeClass}">
                            ${escapeHTML(grade)}
                        </span>
                    </td>

                    <td>
                        ${escapeHTML(result.remark || "-")}
                    </td>
                </tr>
            `;
        })
        .join("");
}

function updateStatistics(results) {
    const subjects = new Set(
        results
            .map(result => result.subject_code)
            .filter(Boolean)
    );

    const marks = results
        .map(result => {
            const details = getAssessmentDetails(result.exam_type, result.max_mark);
            const mark = normalizeAssessmentMark(result.mark, details);
            return mark == null ? NaN : mark / details.maxMark * 100;
        })
        .filter(Number.isFinite);

    const average =
        marks.length > 0
            ? marks.reduce((sum, mark) => sum + mark, 0) / marks.length
            : 0;

    if (totalSubjects) {
        totalSubjects.textContent = subjects.size;
    }

    if (totalResults) {
        totalResults.textContent = results.length;
    }

    if (averageMark) {
        averageMark.textContent = average.toFixed(2);
    }
}

function clearFilters() {
    if (resultSearch) {
        resultSearch.value = "";
    }

    if (examFilter) {
        examFilter.value = "all";
    }

    if (gradeFilter) {
        gradeFilter.value = "all";
    }

    renderResults();
}

function setupFilters() {
    resultSearch?.addEventListener("input", renderResults);
    examFilter?.addEventListener("change", renderResults);
    gradeFilter?.addEventListener("change", renderResults);

    clearResultFilters?.addEventListener(
        "click",
        clearFilters
    );
}

async function initialize() {
    setupSidebar();
    setupLogout();
    setupFilters();

    try {
        const student = await loadStudent();

        if (!student) {
            return;
        }

        await loadResults();
    } catch (error) {
        console.error(
            "Student results initialization error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to load your results."
        );

        if (resultsTableBody) {
            resultsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="table-empty">
                        Unable to load results.
                    </td>
                </tr>
            `;
        }
    }
}

refreshResults?.addEventListener(
    "click",
    async () => {
        refreshResults.disabled = true;
        refreshResults.textContent = "↻ Loading...";

        try {
            const student = await loadStudent();

            if (student) {
                await loadResults();
            }
        } catch (error) {
            console.error(
                "Refresh results error:",
                error
            );

            showMessage(
                error.message ||
                "Unable to refresh results."
            );
        } finally {
            refreshResults.disabled = false;
            refreshResults.textContent = "↻ Refresh";
        }
    }
);

initialize();