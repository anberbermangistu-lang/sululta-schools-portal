import { supabase } from "./supabase.js";

let currentTeacher = null;
let assignedClasses = [];
let assignedStudents = [];

document.addEventListener("DOMContentLoaded", async () => {
setupSidebar();
setupLogout();
await loadTeacherDashboard();
});

async function loadTeacherDashboard() {
try {
showMessage("");
    const {
        data: {
            user
        },
        error: authError
    } = await supabase.auth.getUser();

    if (authError) {
        throw authError;
    }

    if (!user) {
        window.location.replace("/login.html");
        return;
    }

    const {
        data: teacher,
        error: teacherError
    } = await supabase
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

    if (teacherError) {
        throw teacherError;
    }

    if (!teacher) {
        showMessage(
            "Your account is not connected to a teacher record."
        );
        return;
    }

    currentTeacher = teacher;

    updateTeacherInformation();

    await loadAssignedClasses();

    await loadAssignedStudents();

    await loadAttendanceStatistics();

    await loadResultsStatistics();

} catch (error) {

    console.error(
        "Teacher dashboard error:",
        error
    );

    showMessage(
        error.message ||
        "Failed to load teacher dashboard."
    );
}
}

function updateTeacherInformation() {

if (!currentTeacher) {
    return;
}

const fullName =
    `${currentTeacher.first_name || ""} ${currentTeacher.last_name || ""}`
        .trim() ||
    "Teacher";

setText(
    "teacherWelcome",
    `Hello, ${currentTeacher.first_name || "Teacher"}`
);

setText(
    "teacherHeaderName",
    fullName
);

setText(
    "teacherName",
    fullName
);

setText(
    "teacherId",
    currentTeacher.teacher_id || "Not provided"
);

setText(
    "teacherEmail",
    currentTeacher.email || "Not provided"
);

setText(
    "teacherPhone",
    currentTeacher.phone || "Not provided"
);

setText(
    "teacherQualification",
    currentTeacher.qualification || "Not provided"
);

setText(
    "teacherStatus",
    capitalize(
        currentTeacher.status || "Active"
    )
);

const avatar =
    document.getElementById("teacherAvatar");

if (avatar) {

    if (currentTeacher.photo_url) {

        avatar.innerHTML = "";

        const image =
            document.createElement("img");

        image.src =
            currentTeacher.photo_url;

        image.alt =
            fullName;

        image.style.width =
            "100%";

        image.style.height =
            "100%";

        image.style.objectFit =
            "cover";

        image.style.borderRadius =
            "50%";

        avatar.appendChild(image);

    } else {

        avatar.textContent =
            fullName
                .charAt(0)
                .toUpperCase();
    }
}
}

async function loadAssignedClasses() {

if (!currentTeacher) {
    return;
}

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
        class_teacher,
        academic_year,
        status
    `)
    .eq(
        "class_teacher",
        currentTeacher.id
    )
    .eq(
        "status",
        "active"
    )
    .order(
        "class_name",
        {
            ascending: true
        }
    );

if (error) {
    throw error;
}

assignedClasses =
    data || [];

setText(
    "myClasses",
    assignedClasses.length
);

}

async function loadAssignedStudents() {
if (!currentTeacher) {
    return;
}

if (assignedClasses.length === 0) {

    assignedStudents = [];

    setText(
        "myStudents",
        "0"
    );

    return;
}

const classIds =
    assignedClasses.map(
        schoolClass => schoolClass.id
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
        date_of_birth,
        class,
        section,
        phone,
        email,
        photo_url,
        status,
        class_id
    `)
    .eq(
        "status",
        "active"
    )
    .in(
        "class_id",
        classIds
    )
    .order(
        "first_name",
        {
            ascending: true
        }
    );

if (error) {
    throw error;
}

assignedStudents =
    data || [];

setText(
    "myStudents",
    assignedStudents.length
);
}

async function loadAttendanceStatistics() {
if (assignedStudents.length === 0) {

    setText(
        "attendanceRate",
        "0%"
    );

    return;
}

const studentIds =
    assignedStudents.map(
        student => student.id
    );

const {
    data,
    error
} = await supabase
    .from("attendance")
    .select(`
        id,
        student_id,
        attendance_date,
        status
    `)
    .in(
        "student_id",
        studentIds
    );

if (error) {
    throw error;
}

const attendanceRecords =
    data || [];

if (attendanceRecords.length === 0) {

    setText(
        "attendanceRate",
        "0%"
    );

    return;
}

const presentRecords =
    attendanceRecords.filter(
        record =>
            String(record.status || "")
                .toLowerCase()
                .trim() === "present"
    );

const percentage =
    (
        presentRecords.length /
        attendanceRecords.length
    ) * 100;

setText(
    "attendanceRate",
    `${percentage.toFixed(1)}%`
);
}

async function loadResultsStatistics() {
if (assignedStudents.length === 0) {

    setText(
        "resultsCount",
        "0"
    );

    return;
}

const studentCodes =
    assignedStudents
        .map(
            student =>
                student.student_id
        )
        .filter(Boolean);

if (studentCodes.length === 0) {

    setText(
        "resultsCount",
        "0"
    );

    return;
}

const {
    data,
    error
} = await supabase
    .from("results")
    .select(`
        id,
        student_id
    `)
    .in(
        "student_id",
        studentCodes
    );

if (error) {
    throw error;
}

setText(
    "resultsCount",
    (data || []).length
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

if (!toggle || !sidebar) {
    return;
}

toggle.addEventListener(
    "click",
    () => {

        sidebar.classList.toggle(
            "mobile-open"
        );
    }
);
}

function setupLogout() {
const logoutButton =
    document.getElementById(
        "logoutButton"
    );

if (!logoutButton) {
    return;
}

logoutButton.addEventListener(
    "click",
    async () => {

        logoutButton.disabled =
            true;

        const {
            error
        } = await supabase.auth.signOut();

        if (error) {

            console.error(
                "Logout error:",
                error
            );

            logoutButton.disabled =
                false;

            showMessage(
                error.message ||
                "Failed to sign out."
            );

            return;
        }

        window.location.replace(
            "/login.html"
        );
    }
);
}
function showMessage(message) {
const element =
    document.getElementById(
        "teacherMessage"
    );

if (!element) {
    return;
}

if (!message) {

    element.hidden =
        true;

    element.textContent =
        "";

    return;
}

element.textContent =
    message;

element.hidden =
    false;
}

function setText(
id,
value
) {
const element =
    document.getElementById(id);

if (element) {
    element.textContent =
        value;
}
}

function capitalize(value) {
const text =
    String(value || "");

if (!text) {
    return "";
}

return (
    text.charAt(0).toUpperCase() +
    text.slice(1)
);

}