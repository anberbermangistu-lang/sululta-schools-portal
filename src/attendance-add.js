import { supabase } from "./supabase.js";

const form =
    document.getElementById("attendanceForm");

const studentSelect =
    document.getElementById("student_id");

const dateInput =
    document.getElementById("attendance_date");

const statusSelect =
    document.getElementById("status");

const remarkInput =
    document.getElementById("remark");

const saveButton =
    document.getElementById("saveAttendance");

const message =
    document.getElementById("message");

const sidebarToggle =
    document.getElementById("sidebarToggle");

const sidebar =
    document.querySelector(".admin-sidebar");

const logoutButton =
    document.getElementById("logoutButton");


document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupSidebar();
        setupLogout();
        setToday();
        loadStudents();
        setupForm();

    }
);


function setupSidebar() {

    if (!sidebarToggle || !sidebar) {
        return;
    }

    sidebarToggle.addEventListener(
        "click",
        () => {
            sidebar.classList.toggle("open");
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


function setToday() {

    if (!dateInput) {
        return;
    }

    const today =
        new Date();

    const year =
        today.getFullYear();

    const month =
        String(
            today.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            today.getDate()
        ).padStart(2, "0");

    dateInput.value =
        `${year}-${month}-${day}`;
}


async function loadStudents() {

    if (!studentSelect) {
        return;
    }

    studentSelect.innerHTML = `
        <option value="">
            Loading students...
        </option>
    `;

    try {

        const { data, error } =
            await supabase
                .from("students")
                .select(`
                    id,
                    student_id,
                    first_name,
                    last_name,
                    class_id
                `)
                .order(
                    "first_name",
                    {
                        ascending: true
                    }
                );

        if (error) {

            console.error(
                "Error loading students:",
                error
            );

            studentSelect.innerHTML = `
                <option value="">
                    Unable to load students
                </option>
            `;

            showMessage(
                error.message ||
                "Unable to load students.",
                "error"
            );

            return;
        }

        const students =
            data || [];

        if (students.length === 0) {

            studentSelect.innerHTML = `
                <option value="">
                    No students found
                </option>
            `;

            return;
        }

        studentSelect.innerHTML = `
            <option value="">
                Select Student
            </option>
        `;

        students.forEach(
            (student) => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    student.id;

                const name = [
                    student.first_name || "",
                    student.last_name || ""
                ]
                    .join(" ")
                    .trim();

                option.textContent =
                    `${student.student_id || "-"} - ${name || "Unknown Student"}`;

                studentSelect.appendChild(
                    option
                );

            }
        );

    } catch (error) {

        console.error(
            "Error loading students:",
            error
        );

        showMessage(
            "Unable to load students.",
            "error"
        );
    }
}


function setupForm() {

    if (!form) {
        return;
    }

    form.addEventListener(
        "submit",
        saveAttendance
    );
}


async function saveAttendance(event) {

    event.preventDefault();

    if (!studentSelect.value) {

        showMessage(
            "Please select a student.",
            "error"
        );

        studentSelect.focus();

        return;
    }

    if (!dateInput.value) {

        showMessage(
            "Please select the attendance date.",
            "error"
        );

        dateInput.focus();

        return;
    }

    if (!statusSelect.value) {

        showMessage(
            "Please select attendance status.",
            "error"
        );

        statusSelect.focus();

        return;
    }


    saveButton.disabled = true;

    saveButton.textContent =
        "Saving...";

    hideMessage();


    try {

        const studentId =
            Number(
                studentSelect.value
            );

        const attendanceDate =
            dateInput.value;

        const status =
            statusSelect.value;

        const remark =
            remarkInput.value.trim();


        const { data, error } =
            await supabase
                .from("attendance")
                .insert([
                    {
                        student_id:
                            studentId,

                        attendance_date:
                            attendanceDate,

                        status:
                            status,

                        remark:
                            remark || null
                    }
                ])
                .select();


        if (error) {

            console.error(
                "Error saving attendance:",
                error
            );

            showMessage(
                error.message ||
                "Failed to save attendance.",
                "error"
            );

            return;
        }


        if (!data || data.length === 0) {

            showMessage(
                "Attendance was not saved.",
                "error"
            );

            return;
        }


        showMessage(
            "Attendance saved successfully.",
            "success"
        );


        setTimeout(
            () => {
                window.location.href =
                    "dashboard.html";
            },
            800
        );


    } catch (error) {

        console.error(
            "Error saving attendance:",
            error
        );

        showMessage(
            "Failed to save attendance.",
            "error"
        );

    } finally {

        saveButton.disabled = false;

        saveButton.textContent =
            "Save Attendance";
    }
}


function showMessage(
    text,
    type
) {

    if (!message) {
        return;
    }

    message.textContent =
        text;

    message.className =
        `message ${type}`;

    message.hidden =
        false;
}


function hideMessage() {

    if (!message) {
        return;
    }

    message.textContent =
        "";

    message.className =
        "message";

    message.hidden =
        true;
}