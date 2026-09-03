import { supabase } from "./supabase.js";

const form = document.getElementById("timetableForm");
const message = document.getElementById("message");
const sidebarToggle = document.getElementById("sidebarToggle");
const sidebar = document.querySelector(".admin-sidebar");
const logoutButton = document.getElementById("logoutButton");

document.addEventListener("DOMContentLoaded", () => {

    setupSidebar();
    setupLogout();
    setupForm();

});


function setupSidebar() {

    if (!sidebarToggle || !sidebar) {
        return;
    }

    sidebarToggle.addEventListener("click", () => {

        sidebar.classList.toggle("open");

    });

}


function setupLogout() {

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener("click", () => {

        window.location.href = "../login.html";

    });

}


function setupForm() {

    if (!form) {
        console.error("Timetable form not found.");
        return;
    }

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        await saveTimetable();

    });

}


async function saveTimetable() {

    hideMessage();

    const saveButton =
        form.querySelector('button[type="submit"]');


    const className =
        document.getElementById("className")?.value.trim() || "";


    const section =
        document.getElementById("section")?.value.trim() || "";


    const subjectCode =
        document.getElementById("subjectCode")?.value.trim() || "";


    const subjectName =
        document.getElementById("subjectName")?.value.trim() || "";


    const day =
        document.getElementById("day")?.value || "";


    const academicYear =
        document.getElementById("academicYear")?.value.trim() || "";


    const startTime =
        document.getElementById("startTime")?.value || "";


    const endTime =
        document.getElementById("endTime")?.value || "";


    const roomNumber =
        document.getElementById("roomNumber")?.value.trim() || "";


    if (
        !className ||
        !section ||
        !subjectCode ||
        !subjectName ||
        !day ||
        !academicYear ||
        !startTime ||
        !endTime
    ) {

        showMessage(
            "Please fill in all required fields.",
            "error"
        );

        return;

    }


    if (endTime <= startTime) {

        showMessage(
            "End Time must be later than Start Time.",
            "error"
        );

        return;

    }


    if (saveButton) {

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

    }


    try {

        const { data, error } = await supabase

            .from("timetable")

            .insert({

                class_name: className,

                section: section,

                subject_code: subjectCode,

                subject_name: subjectName,

                day: day,

                start_time: startTime,

                end_time: endTime,

                room_number:
                    roomNumber || null,

                academic_year:
                    academicYear

            })

            .select()

            .single();


        if (error) {

            console.error(
                "Error saving timetable:",
                error
            );

            showMessage(
                error.message ||
                "Unable to save timetable.",
                "error"
            );

            return;

        }


        if (!data) {

            showMessage(
                "Timetable was not saved.",
                "error"
            );

            return;

        }


        showMessage(
            "Timetable saved successfully.",
            "success"
        );


        form.reset();


        setTimeout(() => {

            window.location.href =
                "dashboard.html";

        }, 800);


    } catch (error) {

        console.error(
            "Unexpected error:",
            error
        );

        showMessage(
            error.message ||
            "Unable to save timetable.",
            "error"
        );

    } finally {

        if (saveButton) {

            saveButton.disabled = false;

            saveButton.textContent =
                "💾 Save Timetable";

        }

    }

}


function showMessage(text, type) {

    if (!message) {

        alert(text);

        return;

    }


    message.textContent = text;

    message.className =
        `message ${type || ""}`;

    message.hidden = false;

}


function hideMessage() {

    if (!message) {
        return;
    }

    message.textContent = "";

    message.className = "message";

    message.hidden = true;

}