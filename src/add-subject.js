import { supabase } from "./supabase.js";

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("subjectForm");
    const saveButton = document.getElementById("saveButton");
    const messageBox = document.getElementById("messageBox");

    setupSidebar();
    setupLogout();

    if (!form) {
        console.error("subjectForm was not found.");
        return;
    }

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        const subjectName =
            document.getElementById("subjectName")?.value.trim();

        const subjectCode =
            document.getElementById("subjectCode")?.value.trim();

        const gradeLevel =
            document.getElementById("gradeLevel")?.value.trim();

        const creditValue =
            document.getElementById("credit")?.value.trim();

        const description =
            document.getElementById("description")?.value.trim();

        if (!subjectName) {
            showMessage("Subject name is required.", "error");
            return;
        }

        if (!subjectCode) {
            showMessage("Subject code is required.", "error");
            return;
        }

        if (!gradeLevel) {
            showMessage("Grade level is required.", "error");
            return;
        }

        let credit = null;

        if (creditValue !== "") {

            credit = Number(creditValue);

            if (Number.isNaN(credit) || credit < 0) {
                showMessage(
                    "Credit must be a valid positive number.",
                    "error"
                );
                return;
            }
        }

        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        try {

            const { data: existingSubject, error: checkError } =
                await supabase
                    .from("subjects")
                    .select("id")
                    .eq("subject_code", subjectCode)
                    .maybeSingle();

            if (checkError) {
                throw checkError;
            }

            if (existingSubject) {
                showMessage(
                    "A subject with this code already exists.",
                    "error"
                );

                return;
            }

            const subjectData = {
                subject_name: subjectName,
                subject_code: subjectCode,
                grade_level: gradeLevel,
                credit: credit,
                description: description || null
            };

            const { error } =
                await supabase
                    .from("subjects")
                    .insert([subjectData]);

            if (error) {
                throw error;
            }

            showMessage(
                "Subject added successfully.",
                "success"
            );

            form.reset();

            setTimeout(() => {
                window.location.href =
                    "/subjects/dashboard.html";
            }, 1000);

        } catch (error) {

            console.error(
                "Error adding subject:",
                error
            );

            showMessage(
                error.message ||
                "Failed to add subject.",
                "error"
            );

        } finally {

            saveButton.disabled = false;
            saveButton.textContent = "Save Subject";
        }

    });

});


function setupSidebar() {

    const sidebarToggle =
        document.getElementById("sidebarToggle");

    if (!sidebarToggle) {
        return;
    }

    sidebarToggle.addEventListener("click", () => {

        const sidebar =
            document.querySelector(".admin-sidebar");

        if (sidebar) {
            sidebar.classList.toggle("open");
        }

    });
}


function setupLogout() {

    const logoutButton =
        document.getElementById("logoutButton");

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener("click", () => {
        window.location.href = "/login.html";
    });
}


function showMessage(message, type) {

    const messageBox =
        document.getElementById("messageBox");

    if (!messageBox) {
        return;
    }

    messageBox.textContent = message;

    messageBox.className =
        `message ${type}`;

    messageBox.hidden = false;

    setTimeout(() => {
        messageBox.hidden = true;
    }, 4000);
}