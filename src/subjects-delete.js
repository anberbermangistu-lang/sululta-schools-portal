import { supabase } from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const subjectId = params.get("id");

const loading = document.getElementById("loading");
const deleteCard = document.getElementById("deleteCard");
const message = document.getElementById("message");
const deleteButton = document.getElementById("deleteButton");

const subjectName = document.getElementById("subjectName");
const subjectCode = document.getElementById("subjectCode");

async function loadSubject() {

    if (!subjectId) {
        showError("Subject ID is missing.");
        return;
    }

    const { data, error } = await supabase
        .from("subjects")
        .select(`
            id,
            subject_code,
            subject_name,
            grade_level,
            credit
        `)
        .eq("id", subjectId)
        .single();

    if (error) {
        console.error(error);
        showError("Failed to load subject: " + error.message);
        return;
    }

    if (!data) {
        showError("Subject not found.");
        return;
    }

    subjectName.textContent = data.subject_name || "Subject";

    subjectCode.textContent =
        `${data.subject_code || ""} • ${data.grade_level || ""} • ${data.credit || 0} Credit`;

    loading.style.display = "none";
    deleteCard.style.display = "block";
}

deleteButton.addEventListener("click", async () => {

    if (!subjectId) {
        showError("Subject ID is missing.");
        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to permanently delete this subject?"
    );

    if (!confirmed) {
        return;
    }

    deleteButton.disabled = true;
    deleteButton.textContent = "Deleting...";

    const { error } = await supabase
        .from("subjects")
        .delete()
        .eq("id", subjectId);

    if (error) {

        console.error(error);

        showError(
            "Failed to delete subject: " + error.message
        );

        deleteButton.disabled = false;
        deleteButton.textContent = "🗑️ Delete Subject";

        return;
    }

    showSuccess("Subject deleted successfully.");

    deleteButton.textContent = "✓ Deleted";

    setTimeout(() => {
        window.location.href = "dashboard.html";
    }, 800);
});

function showError(text) {

    message.textContent = text;
    message.className = "message error";
    message.style.display = "block";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function showSuccess(text) {

    message.textContent = text;
    message.className = "message success";
    message.style.display = "block";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

const sidebarToggle = document.querySelector(".sidebar-toggle");
const sidebar = document.querySelector(".admin-sidebar");

if (sidebarToggle && sidebar) {

    sidebarToggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });

}

loadSubject();