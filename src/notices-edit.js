import { supabase } from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const noticeId = params.get("id");

const form = document.getElementById("noticeForm");
const loading = document.getElementById("loading");
const formCard = document.getElementById("formCard");
const formMessage = document.getElementById("formMessage");
const saveButton = document.getElementById("saveButton");

const titleInput = document.getElementById("title");
const messageInput = document.getElementById("message");
const audienceInput = document.getElementById("audience");
const publishDateInput = document.getElementById("publish_date");
const expiryDateInput = document.getElementById("expiry_date");


async function loadNotice() {

    if (!noticeId) {

        showMessage(
            "Notice ID is missing.",
            "error"
        );

        loading.style.display = "none";

        return;
    }


    const { data, error } = await supabase
        .from("notices")
        .select("*")
        .eq("id", noticeId)
        .single();


    if (error) {

        console.error(
            "Failed to load notice:",
            error
        );

        showMessage(
            "Failed to load notice: " +
            error.message,
            "error"
        );

        loading.style.display = "none";

        return;
    }


    if (!data) {

        showMessage(
            "Notice not found.",
            "error"
        );

        loading.style.display = "none";

        return;
    }


    titleInput.value =
        data.title || "";

    messageInput.value =
        data.message || "";

    audienceInput.value =
        data.audience || "";

    publishDateInput.value =
        data.publish_date || "";

    expiryDateInput.value =
        data.expiry_date || "";


    loading.style.display =
        "none";

    formCard.style.display =
        "block";
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
            "Updating...";


        const { data, error } =
            await supabase
                .from("notices")
                .update({
                    title: title,
                    message: message,
                    audience: audience,
                    publish_date: publishDate,
                    expiry_date:
                        expiryDate || null,
                    updated_at:
                        new Date().toISOString()
                })
                .eq("id", noticeId)
                .select();


        if (error) {

            console.error(
                "Failed to update notice:",
                error
            );

            showMessage(
                "Failed to update notice: " +
                error.message,
                "error"
            );

            saveButton.disabled =
                false;

            saveButton.textContent =
                "💾 Update Notice";

            return;
        }


        if (!data || data.length === 0) {

            showMessage(
                "The notice was not updated.",
                "error"
            );

            saveButton.disabled =
                false;

            saveButton.textContent =
                "💾 Update Notice";

            return;
        }


        showMessage(
            "Notice updated successfully.",
            "success"
        );


        saveButton.textContent =
            "✓ Updated";


        setTimeout(
            () => {

                window.location.href =
                    `view.html?id=${encodeURIComponent(noticeId)}`;

            },
            800
        );

    }
);


function showMessage(text, type) {

    formMessage.textContent =
        text;

    formMessage.className =
        `form-message ${type}`;

    formMessage.style.display =
        "block";
}


function clearMessage() {

    formMessage.textContent =
        "";

    formMessage.className =
        "form-message";

    formMessage.style.display =
        "none";
}


document.addEventListener(
    "DOMContentLoaded",
    loadNotice
);