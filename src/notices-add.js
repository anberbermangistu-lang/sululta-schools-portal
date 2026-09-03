import { supabase } from "./supabase.js";

const form = document.getElementById("noticeForm");
const formMessage = document.getElementById("formMessage");
const saveButton = document.getElementById("saveButton");

const titleInput = document.getElementById("title");
const messageInput = document.getElementById("message");
const audienceInput = document.getElementById("audience");
const publishDateInput = document.getElementById("publish_date");
const expiryDateInput = document.getElementById("expiry_date");


function showMessage(message, type) {

    if (!formMessage) {
        return;
    }

    formMessage.textContent =
        message;

    formMessage.className =
        `form-message ${type}`;

    formMessage.style.display =
        "block";
}


function clearMessage() {

    if (!formMessage) {
        return;
    }

    formMessage.textContent =
        "";

    formMessage.className =
        "form-message";

    formMessage.style.display =
        "none";
}


form.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        clearMessage();


        const title =
            titleInput.value.trim();

        const message =
            messageInput.value.trim();

        const audience =
            audienceInput.value;

        const publishDate =
            publishDateInput.value;

        const expiryDate =
            expiryDateInput.value;


        if (!title) {

            showMessage(
                "Please enter the notice title.",
                "error"
            );

            return;
        }


        if (!message) {

            showMessage(
                "Please enter the notice message.",
                "error"
            );

            return;
        }


        if (!audience) {

            showMessage(
                "Please select the audience.",
                "error"
            );

            return;
        }


        if (!publishDate) {

            showMessage(
                "Please select the publish date.",
                "error"
            );

            return;
        }


        if (
            expiryDate &&
            expiryDate < publishDate
        ) {

            showMessage(
                "Expiry date cannot be earlier than the publish date.",
                "error"
            );

            return;
        }


        saveButton.disabled =
            true;

        saveButton.textContent =
            "Saving...";


        const { error } =
            await supabase
                .from("notices")
                .insert([
                    {
                        title: title,
                        message: message,
                        audience: audience,
                        publish_date: publishDate,
                        expiry_date:
                            expiryDate || null
                    }
                ]);


        if (error) {

            console.error(
                "Failed to add notice:",
                error
            );

            showMessage(
                "Failed to add notice: " +
                error.message,
                "error"
            );

            saveButton.disabled =
                false;

            saveButton.textContent =
                "💾 Save Notice";

            return;
        }


        showMessage(
            "Notice added successfully.",
            "success"
        );


        saveButton.textContent =
            "✓ Saved";


        setTimeout(
            () => {

                window.location.href =
                    "dashboard.html?refresh=" +
                    Date.now();

            },
            800
        );

    }
);