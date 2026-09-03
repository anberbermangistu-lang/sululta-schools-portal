import { supabase } from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const noticeId = params.get("id");

const loading = document.getElementById("loading");
const noticeContent = document.getElementById("noticeContent");
const errorCard = document.getElementById("errorCard");

const noticeTitle = document.getElementById("noticeTitle");
const noticeMessage = document.getElementById("noticeMessage");
const noticeAudience = document.getElementById("noticeAudience");
const noticeAudienceDetails = document.getElementById("noticeAudienceDetails");
const noticePublishDate = document.getElementById("noticePublishDate");
const noticeExpiryDate = document.getElementById("noticeExpiryDate");
const noticeCreatedAt = document.getElementById("noticeCreatedAt");
const noticeUpdatedAt = document.getElementById("noticeUpdatedAt");

const editButton = document.getElementById("editButton");


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

    renderNotice(data);
}


function renderNotice(notice) {

    if (noticeTitle) {
        noticeTitle.textContent =
            notice.title || "-";
    }


    if (noticeMessage) {
        noticeMessage.textContent =
            notice.message || "-";
    }


    if (noticeAudience) {
        noticeAudience.textContent =
            notice.audience || "-";
    }


    if (noticeAudienceDetails) {
        noticeAudienceDetails.textContent =
            notice.audience || "-";
    }


    if (noticePublishDate) {
        noticePublishDate.textContent =
            formatDate(notice.publish_date);
    }


    if (noticeExpiryDate) {
        noticeExpiryDate.textContent =
            formatDate(notice.expiry_date);
    }


    if (noticeCreatedAt) {
        noticeCreatedAt.textContent =
            formatDateTime(notice.created_at);
    }


    if (noticeUpdatedAt) {
        noticeUpdatedAt.textContent =
            formatDateTime(notice.updated_at);
    }


    if (editButton) {

        editButton.href =
            `edit.html?id=${encodeURIComponent(
                notice.id
            )}`;
    }


    loading.style.display =
        "none";

    noticeContent.style.display =
        "block";
}


function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(
            value + "T00:00:00"
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "—";
    }

    return date.toLocaleDateString(
        "en-US",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}


function formatDateTime(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "—";
    }

    return (
        date.toLocaleDateString(
            "en-US",
            {
                year: "numeric",
                month: "short",
                day: "numeric"
            }
        ) +
        ", " +
        date.toLocaleTimeString(
            "en-US",
            {
                hour: "numeric",
                minute: "2-digit"
            }
        )
    );
}


function showError(message) {

    if (loading) {
        loading.style.display =
            "none";
    }


    if (noticeContent) {
        noticeContent.style.display =
            "none";
    }


    if (errorCard) {

        errorCard.style.display =
            "block";

        const errorText =
            errorCard.querySelector(
                ".table-empty"
            );

        if (errorText) {
            errorText.textContent =
                message;
        }

    } else {

        console.error(message);
    }
}


document.addEventListener(
    "DOMContentLoaded",
    loadNotice
);