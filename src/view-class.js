import { supabase } from "./supabase.js";

const params = new URLSearchParams(window.location.search);

const classId = params.get("id");

const classNameEl =
    document.getElementById("className");

const classSectionEl =
    document.getElementById("classSection");

const classRoomEl =
    document.getElementById("classRoom");

const classAcademicYearEl =
    document.getElementById("classAcademicYear");

const classNameDetailEl =
    document.getElementById("classNameDetail");

const classSectionDetailEl =
    document.getElementById("classSectionDetail");

const classRoomDetailEl =
    document.getElementById("classRoomDetail");

const classAcademicYearDetailEl =
    document.getElementById("classAcademicYearDetail");

const classTeacherEl =
    document.getElementById("classTeacher");

const classStudentsEl =
    document.getElementById("classStudents");

const classStatusEl =
    document.getElementById("classStatus");

const classCreatedEl =
    document.getElementById("classCreated");

const studentsTable =
    document.getElementById("studentsTable");

const message =
    document.getElementById("message");

const editClassButton =
    document.getElementById("editClassButton");

document.getElementById("sidebarToggle")?.addEventListener("click", () => {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    if (window.matchMedia("(max-width: 768px)").matches) {
        sidebar.classList.toggle("mobile-open");
    } else {
        sidebar.classList.toggle("collapsed");
    }
});

document.getElementById("logoutBtn")?.addEventListener("click", async event => {
    event.preventDefault();
    const { error } = await supabase.auth.signOut();
    if (error) {
        showMessage(`Unable to sign out: ${error.message}`);
        return;
    }
    window.location.href = "../login.html";
});


function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function setText(element, value) {

    if (!element) {
        return;
    }

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        element.textContent = "-";

        return;
    }

    element.textContent = value;
}


function formatDate(value) {

    if (!value) {
        return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


function normalize(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}


function showMessage(text, type = "error") {

    if (!message) {
        return;
    }

    message.textContent = text;

    message.className =
        `message ${type}`;

    message.style.display = "block";
}


async function loadClass() {

    if (!classId) {

        showMessage(
            "Class ID is missing."
        );

        return null;
    }


    const {
        data: classData,
        error
    } = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId)
        .single();


    if (error) {

        console.error(
            "Error loading class:",
            error
        );

        showMessage(
            "Unable to load class information."
        );

        return null;
    }


    setText(
        classNameEl,
        classData.class_name
    );

    setText(
        classSectionEl,
        classData.section
    );

    setText(
        classRoomEl,
        classData.room_number
    );

    setText(
        classAcademicYearEl,
        classData.academic_year
    );


    setText(
        classNameDetailEl,
        classData.class_name
    );

    setText(
        classSectionDetailEl,
        classData.section
    );

    setText(
        classRoomDetailEl,
        classData.room_number
    );

    setText(
        classAcademicYearDetailEl,
        classData.academic_year
    );


    setText(
        classStatusEl,
        classData.status
    );


    setText(
        classCreatedEl,
        formatDate(classData.created_at)
    );


    if (editClassButton) {

        editClassButton.href =
            `edit.html?id=${encodeURIComponent(classData.id)}`;

    }


    return classData;
}


async function loadTeacher(classData) {

    if (
        !classData ||
        classData.class_teacher === null ||
        classData.class_teacher === undefined ||
        classData.class_teacher === ""
    ) {

        setText(
            classTeacherEl,
            "-"
        );

        return;
    }


    const teacherValue =
        classData.class_teacher;


    const {
        data: teacher,
        error
    } = await supabase
        .from("teachers")
        .select(
            "id, teacher_id, first_name, last_name"
        )
        .eq(
            "id",
            teacherValue
        )
        .maybeSingle();


    if (error) {

        console.error(
            "Error loading teacher:",
            error
        );

        setText(
            classTeacherEl,
            teacherValue
        );

        return;
    }


    if (!teacher) {

        setText(
            classTeacherEl,
            teacherValue
        );

        return;
    }


    const fullName = [
        teacher.first_name,
        teacher.last_name
    ]
        .filter(Boolean)
        .join(" ")
        .trim();


    setText(
        classTeacherEl,
        fullName ||
        teacher.teacher_id ||
        teacher.id
    );
}


async function loadStudents(classData) {

    if (!studentsTable) {

        console.error(
            "studentsTable element not found."
        );

        return;
    }


    studentsTable.innerHTML = `
        <tr>
            <td
                colspan="6"
                class="table-empty"
            >
                Loading students...
            </td>
        </tr>
    `;


    const {
        data: students,
        error
    } = await supabase
        .from("students")
        .select("*")
        .eq("class_id", classData.id)
        .order(
            "id",
            {
                ascending: true
            }
        );


    if (error) {

        console.error(
            "Error loading students:",
            error
        );

        studentsTable.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="table-empty"
                >
                    Error loading students.
                </td>
            </tr>
        `;

        return;
    }


    if (
        !students ||
        students.length === 0
    ) {

        studentsTable.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="table-empty"
                >
                    No students exist in the system.
                </td>
            </tr>
        `;

        setText(
            classStudentsEl,
            "0"
        );

        return;
    }


    const matchedStudents = students || [];


    console.log(
        "Class:",
        classData.class_name
    );

    console.log(
        "Class ID:",
        classData.id
    );

    console.log(
        "Section:",
        classData.section
    );

    console.log(
        "All students:",
        students
    );

    console.log(
        "Matched students:",
        matchedStudents
    );


    if (
        matchedStudents.length === 0
    ) {

        studentsTable.innerHTML = `
            <tr>
                <td
                    colspan="6"
                    class="table-empty"
                >
                    No students are currently assigned to this class.
                </td>
            </tr>
        `;

        setText(
            classStudentsEl,
            "0"
        );

        return;
    }


    setText(
        classStudentsEl,
        matchedStudents.length
    );


    studentsTable.innerHTML =
        matchedStudents
            .map(
                (student, index) => {

                    const fullName = [
                        student.first_name,
                        student.last_name
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .trim();


                    const status =
                        normalize(
                            student.status
                        )
                        .replace(
                            /\s+/g,
                            "-"
                        );


                    return `
                        <tr>

                            <td>
                                ${index + 1}
                            </td>

                            <td>
                                <strong>
                                    ${escapeHTML(
                                        fullName ||
                                        student.student_id ||
                                        "-"
                                    )}
                                </strong>
                            </td>

                            <td>
                                ${escapeHTML(
                                    student.gender ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    student.section ||
                                    "-"
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    student.phone ||
                                    "-"
                                )}
                            </td>

                            <td>

                                <span
                                    class="status-badge ${status}"
                                >
                                    ${escapeHTML(
                                        student.status ||
                                        "-"
                                    )}
                                </span>

                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}


async function initializePage() {

    try {

        const classData =
            await loadClass();


        if (!classData) {
            return;
        }


        await loadTeacher(
            classData
        );


        await loadStudents(
            classData
        );


    } catch (error) {

        console.error(
            "Unexpected error:",
            error
        );

        showMessage(
            "An unexpected error occurred."
        );

    }

}


initializePage();