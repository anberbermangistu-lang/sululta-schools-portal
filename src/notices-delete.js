import { supabase } from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const noticeId = params.get("id");

const loading = document.getElementById("loading");
const deleteCard = document.getElementById("deleteCard");
const errorCard = document.getElementById("errorCard");

const noticeTitle = document.getElementById("noticeTitle");
const noticeAudience = document.getElementById("noticeAudience");

const deleteButton = document.getElementById("deleteButton");
const deleteMessage = document.getElementById("deleteMessage");


async function loadNotice() {

    if (!noticeId) {
        showError("Notice ID is missing.");
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

        showError(
            "Failed to load notice: " +
            error.message
        );

        return;
    }

    if (!data) {
        showError("Notice not found.");
        return;
    }

    noticeTitle.textContent =
        data.title || "-";

    noticeAudience.textContent =
        data.audience || "-";

    loading.style.display = "none";
    deleteCard.style.display = "block";
}


deleteButton.addEventListener(
    "click",
    async () => {

        clearMessage();

        const confirmed = confirm(
            "Are you sure you want to permanently delete this notice?"
        );

        if (!confirmed) {
            return;
        }

        deleteButton.disabled = true;

        deleteButton.textContent =
            "Deleting...";


        const { data, error } = await supabase
            .from("notices")
            .delete()
            .eq("id", noticeId)
            .select();


        if (error) {

            console.error(
                "Failed to delete notice:",
                error
            );

            showMessage(
                "Failed to delete notice: " +
                error.message,
                "error"
            );

            deleteButton.disabled = false;

            deleteButton.textContent =
                "🗑️ Delete Notice";

            return;
        }


        console.log(
            "Deleted notice:",
            data
        );


        if (!data || data.length === 0) {

            showMessage(
                "The notice was not deleted.",
                "error"
            );

            deleteButton.disabled = false;

            deleteButton.textContent =
                "🗑️ Delete Notice";

            return;
        }


        showMessage(
            "Notice deleted successfully.",
            "success"
        );

        deleteButton.textContent =
            "✓ Deleted";


        setTimeout(() => {

            window.location.replace(
                "dashboard.html?refresh=" +
                Date.now()
            );

        }, 800);
    }
);


function showMessage(text, type) {

    deleteMessage.textContent =
        text;

    deleteMessage.className =
        `form-message ${type}`;

    deleteMessage.style.display =
        "block";
}


function clearMessage() {

    deleteMessage.textContent =
        "";

    deleteMessage.className =
        "form-message";

    deleteMessage.style.display =
        "none";
}


function showError(message) {

    loading.style.display =
        "none";

    deleteCard.style.display =
        "none";

    errorCard.style.display =
        "block";

    const errorText =
        errorCard.querySelector(".table-empty");

    if (errorText) {
        errorText.textContent =
            message;
    }
}


document.addEventListener(
    "DOMContentLoaded",
    loadNotice
);