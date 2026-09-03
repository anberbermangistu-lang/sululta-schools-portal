import { supabase } from "./supabase.js";

let teacher = null;
let classes = [];
let subjects = [];
let students = [];

let selectedClassId = null;
let selectedSubjectCode = null;
let selectedExamType = null;

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

    if (profileError) {

        console.error(
            "Profile error:",
            profileError
        );

        showMessage(
            profileError.message
        );

        return null;
    }

    if (!profile) {

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
            photo_url,
            user_id,
            status
        `)
        .eq(
            "user_id",
            user.id
        )
        .maybeSingle();

    if (teacherError) {

        console.error(
            "Teacher error:",
            teacherError
        );

        showMessage(
            teacherError.message
        );

        return null;
    }

    if (!teacherRecord) {

        showMessage(
            "Your teacher record is not connected to your account."
        );

        return null;
    }

    return teacherRecord;
}

async function loadClasses() {

    const select =
        document.getElementById(
            "classSelect"
        );

    if (!select) {
        return;
    }

    select.innerHTML = `
        <option value="">
            Loading classes...
        </option>
    `;

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
            academic_year,
            class_teacher,
            status
        `)
        .eq(
            "class_teacher",
            teacher.id
        )
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

        select.innerHTML = `
            <option value="">
                Unable to load classes
            </option>
        `;

        showMessage(
            "Unable to load classes: " +
            error.message
        );

        return;
    }

    classes =
        data || [];

    select.innerHTML = `
        <option value="">
            Select Class
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

            select.appendChild(
                option
            );
        }
    );

    if (classes.length === 0) {

        showMessage(
            "No classes are assigned to your teacher account."
        );
    }
}

async function loadSubjects() {

    const select =
        document.getElementById(
            "subjectSelect"
        );

    if (!select) {
        return;
    }

    select.innerHTML = `
        <option value="">
            Loading subjects...
        </option>
    `;

    const {
        data,
        error
    } = await supabase
        .from("subjects")
        .select("*")
        .order(
            "subject_code"
        );

    if (error) {

        console.error(
            "Subjects error:",
            error
        );

        select.innerHTML = `
            <option value="">
                Unable to load subjects
            </option>
        `;

        showMessage(
            "Unable to load subjects: " +
            error.message
        );

        return;
    }

    subjects =
        data || [];

    select.innerHTML = `
        <option value="">
            Select Subject
        </option>
    `;

    subjects.forEach(
        subject => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                subject.subject_code;

            const name =
                subject.subject_name ||
                subject.name ||
                "";

            option.textContent =
                name
                    ? `${subject.subject_code} - ${name}`
                    : subject.subject_code;

            select.appendChild(
                option
            );
        }
    );

    if (subjects.length === 0) {

        showMessage(
            "No subjects were found."
        );
    }
}

async function loadStudents() {

    const classSelect =
        document.getElementById(
            "classSelect"
        );

    const subjectSelect =
        document.getElementById(
            "subjectSelect"
        );

    const examSelect =
        document.getElementById(
            "examType"
        );

    selectedClassId =
        classSelect?.value || "";

    selectedSubjectCode =
        subjectSelect?.value || "";

    selectedExamType =
        examSelect?.value || "";

    if (!selectedClassId) {

        showMessage(
            "Please select a class."
        );

        return;
    }

    if (!selectedSubjectCode) {

        showMessage(
            "Please select a subject."
        );

        return;
    }

    if (!selectedExamType) {

        showMessage(
            "Please select an exam type."
        );

        return;
    }

    const selectedClass =
        classes.find(
            item =>
                String(item.id) ===
                String(selectedClassId)
        );

    if (!selectedClass) {

        showMessage(
            "Selected class was not found."
        );

        return;
    }

    showMessage(
        "Loading students...",
        "success"
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
            class_id,
            status
        `)
        .eq(
            "class_id",
            Number(selectedClassId)
        )
        .eq(
            "status",
            "active"
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

    await loadExistingResults();

    renderStudents(
        selectedClass
    );
}

async function loadExistingResults() {

    if (
        !selectedSubjectCode ||
        !selectedExamType ||
        students.length === 0
    ) {

        return;
    }

    const studentCodes =
        students.map(
            student =>
                student.student_id
        );

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
            grade,
            remark,
            recorded_by,
            created_at
        `)
        .in(
            "student_id",
            studentCodes
        )
        .eq(
            "subject_code",
            selectedSubjectCode
        )
        .eq(
            "exam_type",
            selectedExamType
        );

    if (error) {

        console.error(
            "Results error:",
            error
        );

        showMessage(
            "Unable to load existing results: " +
            error.message
        );

        return;
    }

    window.existingResults =
        data || [];
}

function renderStudents(
    selectedClass
) {

    const panel =
        document.getElementById(
            "resultsPanel"
        );

    const title =
        document.getElementById(
            "selectedClassTitle"
        );

    const count =
        document.getElementById(
            "studentCount"
        );

    const body =
        document.getElementById(
            "resultsTableBody"
        );

    if (panel) {
        panel.hidden = false;
    }

    if (title) {

        title.textContent =
            `${selectedClass.class_name} - Section ${selectedClass.section}`;
    }

    if (count) {

        count.textContent =
            `${students.length} Students`;
    }

    if (!body) {
        return;
    }

    if (students.length === 0) {

        body.innerHTML = `
            <tr>

                <td
                    colspan="5"
                    class="table-empty">

                    No students found in this class.

                </td>

            </tr>
        `;

        showMessage(
            "No students are assigned to this class."
        );

        return;
    }

    const existingResults =
        window.existingResults || [];

    body.innerHTML =
        students.map(
            student => {

                const existing =
                    existingResults.find(
                        result =>
                            result.student_id ===
                            student.student_id
                    );

                const mark =
                    existing?.mark ?? "";

                const grade =
                    existing?.grade ||
                    "";

                const remark =
                    existing?.remark ||
                    "";

                const fullName =
                    `${student.first_name || ""} ${student.last_name || ""}`
                        .trim();

                return `
                    <tr
                        data-student-id="${student.id}">

                        <td>

                            <strong>
                                ${escapeHtml(
                                    fullName
                                )}
                            </strong>

                        </td>

                        <td>

                            ${escapeHtml(
                                student.student_id ||
                                "—"
                            )}

                        </td>

                        <td>

                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                class="result-mark"
                                data-student-id="${student.id}"
                                value="${mark}"
                                placeholder="0-100">

                        </td>

                        <td>

                            <strong
                                class="result-grade"
                                data-student-id="${student.id}">

                                ${escapeHtml(
                                    grade
                                )}

                            </strong>

                        </td>

                        <td>

                            <input
                                type="text"
                                class="result-remark"
                                data-student-id="${student.id}"
                                value="${escapeHtml(
                                    remark
                                )}"
                                placeholder="Remark">

                        </td>

                    </tr>
                `;
            }
        ).join("");

    document
        .querySelectorAll(
            ".result-mark"
        )
        .forEach(
            input => {

                input.addEventListener(
                    "input",
                    () => {

                        updateGrade(
                            input
                        );

                    }
                );

            }
        );

    document
        .querySelectorAll(
            ".result-mark"
        )
        .forEach(
            input => {

                updateGrade(
                    input
                );

            }
        );

    showMessage(
        `${students.length} student(s) loaded.`,
        "success"
    );
}

function updateGrade(
    input
) {

    const mark =
        Number(
            input.value
        );

    const studentId =
        input.dataset.studentId;

    const gradeElement =
        document.querySelector(
            `.result-grade[data-student-id="${studentId}"]`
        );

    if (!gradeElement) {
        return;
    }

    if (
        input.value === "" ||
        Number.isNaN(mark)
    ) {

        gradeElement.textContent =
            "";

        return;
    }

    gradeElement.textContent =
        calculateGrade(
            mark
        );
}

function calculateGrade(
    mark
) {

    if (mark >= 90) {
        return "A+";
    }

    if (mark >= 80) {
        return "A";
    }

    if (mark >= 70) {
        return "B";
    }

    if (mark >= 60) {
        return "C";
    }

    if (mark >= 50) {
        return "D";
    }

    return "F";
}

async function saveResults() {

    if (!selectedClassId) {

        showMessage(
            "Please select a class."
        );

        return;
    }

    if (!selectedSubjectCode) {

        showMessage(
            "Please select a subject."
        );

        return;
    }

    if (!selectedExamType) {

        showMessage(
            "Please select an exam type."
        );

        return;
    }

    if (students.length === 0) {

        showMessage(
            "There are no students to save."
        );

        return;
    }

    try {

        for (
            const student
            of students
        ) {

            const markInput =
                document.querySelector(
                    `.result-mark[data-student-id="${student.id}"]`
                );

            const remarkInput =
                document.querySelector(
                    `.result-remark[data-student-id="${student.id}"]`
                );

            const markValue =
                markInput?.value.trim() ||
                "";

            const remark =
                remarkInput?.value.trim() ||
                "";

            if (markValue === "") {
                continue;
            }

            const mark =
                Number(
                    markValue
                );

            if (
                Number.isNaN(mark) ||
                mark < 0 ||
                mark > 100
            ) {

                showMessage(
                    `Invalid mark for ${student.first_name} ${student.last_name}. Mark must be between 0 and 100.`
                );

                return;
            }

            const grade =
                calculateGrade(
                    mark
                );

            const {
                data: existing,
                error: findError
            } = await supabase
                .from("results")
                .select(`
                    id
                `)
                .eq(
                    "student_id",
                    student.student_id
                )
                .eq(
                    "subject_code",
                    selectedSubjectCode
                )
                .eq(
                    "exam_type",
                    selectedExamType
                )
                .maybeSingle();

            if (findError) {
                throw findError;
            }

            if (existing) {

                const {
                    error: updateError
                } = await supabase
                    .from("results")
                    .update({

                        mark:
                            mark,

                        grade:
                            grade,

                        remark:
                            remark,

                        recorded_by:
                            teacher.user_id

                    })
                    .eq(
                        "id",
                        existing.id
                    );

                if (updateError) {
                    throw updateError;
                }

            } else {

                const {
                    error: insertError
                } = await supabase
                    .from("results")
                    .insert({

                        student_id:
                            student.student_id,

                        subject_code:
                            selectedSubjectCode,

                        exam_type:
                            selectedExamType,

                        mark:
                            mark,

                        grade:
                            grade,

                        remark:
                            remark,

                        recorded_by:
                            teacher.user_id

                    });

                if (insertError) {
                    throw insertError;
                }
            }
        }

        showMessage(
            "Results saved successfully.",
            "success"
        );

        await loadStudents();

    } catch (error) {

        console.error(
            "Save results error:",
            error
        );

        showMessage(
            "Unable to save results: " +
            error.message
        );
    }
}

function showMessage(
    message,
    type = "error"
) {

    const element =
        document.getElementById(
            "resultsMessage"
        );

    if (!element) {
        return;
    }

    element.textContent =
        message;

    element.className =
        `form-message ${type}`;
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

    await loadClasses();

    await loadSubjects();

    const loadButton =
        document.getElementById(
            "loadStudents"
        );

    if (loadButton) {

        loadButton.addEventListener(
            "click",
            loadStudents
        );
    }

    const saveButton =
        document.getElementById(
            "saveResults"
        );

    if (saveButton) {

        saveButton.addEventListener(
            "click",
            saveResults
        );
    }
}

initialize();