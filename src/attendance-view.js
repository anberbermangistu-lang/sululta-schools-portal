import { supabase } from "./supabase.js";

const loadingState =
    document.getElementById("loadingState");

const attendanceDetails =
    document.getElementById(
        "attendanceDetails"
    );

const message =
    document.getElementById("message");

const studentCode =
    document.getElementById("studentCode");

const studentName =
    document.getElementById("studentName");

const className =
    document.getElementById("className");

const attendanceDate =
    document.getElementById(
        "attendanceDate"
    );

const attendanceStatus =
    document.getElementById(
        "attendanceStatus"
    );

const attendanceRemark =
    document.getElementById(
        "attendanceRemark"
    );

const recordedBy =
    document.getElementById("recordedBy");

const createdAt =
    document.getElementById("createdAt");

const editAttendance =
    document.getElementById(
        "editAttendance"
    );

const sidebarToggle =
    document.getElementById(
        "sidebarToggle"
    );

const sidebar =
    document.querySelector(
        ".admin-sidebar"
    );

const logoutButton =
    document.getElementById(
        "logoutButton"
    );


document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupSidebar();
        setupLogout();

        const params =
            new URLSearchParams(
                window.location.search
            );

        const id =
            params.get("id");


        if (!id) {

            showError(
                "Attendance ID is missing."
            );

            return;
        }


        if (editAttendance) {

            editAttendance.href =
                `edit.html?id=${encodeURIComponent(
                    id
                )}`;

        }


        loadAttendance(id);

    }
);


function setupSidebar() {

    if (
        !sidebarToggle ||
        !sidebar
    ) {
        return;
    }


    sidebarToggle.addEventListener(
        "click",
        () => {

            sidebar.classList.toggle(
                "open"
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
        () => {

            window.location.href =
                "../login.html";

        }
    );

}


async function loadAttendance(id) {

    try {

        const {
            data,
            error
        } = await supabase
            .from("attendance")
            .select(`
                id,
                student_id,
                attendance_date,
                status,
                remark,
                recorded_by,
                created_at
            `)
            .eq(
                "id",
                id
            )
            .maybeSingle();


        if (error) {

            console.error(
                "Error loading attendance:",
                error
            );

            showError(
                error.message ||
                "Failed to load attendance."
            );

            return;
        }


        if (!data) {

            showError(
                "Attendance record was not found."
            );

            return;
        }


        const student =
            await loadStudent(
                data.student_id
            );


        displayAttendance(
            data,
            student
        );


    } catch (error) {

        console.error(
            "Error loading attendance:",
            error
        );

        showError(
            "Failed to load attendance."
        );

    }

}


async function loadStudent(
    studentId
) {

    if (
        studentId === null ||
        studentId === undefined
    ) {

        return null;

    }


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
            class_id,
            class
        `)
        .eq(
            "id",
            studentId
        )
        .maybeSingle();


    if (error) {

        console.error(
            "Error loading student:",
            error
        );

        return null;

    }


    if (!data) {
        return null;
    }


    let classData = null;


    if (
        data.class_id !== null &&
        data.class_id !== undefined &&
        data.class_id !== ""
    ) {

        const {
            data: classResult,
            error: classError
        } = await supabase
            .from("classes")
            .select(`
                id,
                class_name,
                section
            `)
            .eq(
                "id",
                data.class_id
            )
            .maybeSingle();


        if (!classError) {

            classData =
                classResult;

        }

    }


    return {

        ...data,

        classData

    };

}


function displayAttendance(
    attendance,
    student
) {

    if (loadingState) {
        loadingState.hidden =
            true;
    }


    if (attendanceDetails) {
        attendanceDetails.hidden =
            false;
    }


    if (student) {

        const fullName = [

            student.first_name || "",

            student.last_name || ""

        ]
            .join(" ")
            .trim();


        setText(
            studentCode,
            student.student_id ||
            "-"
        );


        setText(
            studentName,
            fullName ||
            "Unknown Student"
        );


        /*
         * Get class from class_id first.
         */
        let classText =
            "-";


        if (
            student.class_id !== null &&
            student.class_id !== undefined &&
            student.class_id !== ""
        ) {

            if (
                student.classData
            ) {

                classText =
                    student.classData.class_name ||
                    "";


                if (
                    student.classData.section
                ) {

                    classText +=
                        ` - ${student.classData.section}`;

                }

            }

        }


        /*
         * Fallback to students.class
         */
        if (
            classText === "-" &&
            student.class
        ) {

            classText =
                student.class;

        }


        setText(
            className,
            classText ||
            "-"
        );


    } else {

        setText(
            studentCode,
            "-"
        );

        setText(
            studentName,
            "Unknown Student"
        );

        setText(
            className,
            "-"
        );

    }


    setText(
        attendanceDate,
        formatDate(
            attendance.attendance_date
        )
    );


    displayStatus(
        attendance.status
    );


    setText(
        attendanceRemark,
        attendance.remark ||
        "-"
    );


    setText(
        recordedBy,
        attendance.recorded_by ||
        "-"
    );


    setText(
        createdAt,
        formatDateTime(
            attendance.created_at
        )
    );

}


function displayStatus(status) {

    if (!attendanceStatus) {
        return;
    }


    const value =
        String(
            status || ""
        ).toLowerCase();


    let text =
        "Unknown";


    if (
        value === "present"
    ) {

        text = "Present";

    } else if (
        value === "absent"
    ) {

        text = "Absent";

    } else if (
        value === "late"
    ) {

        text = "Late";

    } else if (
        value === "excused"
    ) {

        text = "Excused";

    } else if (value) {

        text =
            capitalize(value);

    }


    attendanceStatus.textContent =
        text;


    attendanceStatus.className =
        `detail-value status-${value || "unknown"}`;

}


function setText(
    element,
    value
) {

    if (!element) {
        return;
    }


    element.textContent =
        value;

}


function formatDate(value) {

    if (!value) {
        return "-";
    }


    const date =
        new Date(
            `${value}T00:00:00`
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

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


function formatDateTime(value) {

    if (!value) {
        return "-";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return value;

    }


    return date.toLocaleString(
        "en-GB",
        {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );

}


function capitalize(value) {

    if (!value) {
        return "";
    }


    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );

}


function showError(text) {

    if (loadingState) {

        loadingState.textContent =
            text;

        loadingState.hidden =
            false;

    }


    if (attendanceDetails) {

        attendanceDetails.hidden =
            true;

    }


    if (message) {

        message.textContent =
            text;

        message.className =
            "message error";

        message.hidden =
            false;

    }

}