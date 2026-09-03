import { supabase } from "./supabase.js";

const params = new URLSearchParams(window.location.search);
const teacherId = params.get("id");

async function deleteTeacher() {
    if (!teacherId) {
        alert("Teacher ID is missing.");
        return;
    }

    const numericId = Number(teacherId);

    if (!Number.isInteger(numericId) || numericId <= 0) {
        alert("Invalid teacher ID.");
        return;
    }

    const confirmed = confirm(
        "Are you sure you want to delete this teacher?"
    );

    if (!confirmed) {
        return;
    }

    try {
        const { data: teacher, error: findError } = await supabase
            .from("teachers")
            .select("id, teacher_id, first_name, last_name, photo_url")
            .eq("id", numericId)
            .maybeSingle();

        if (findError) {
            throw findError;
        }

        if (!teacher) {
            throw new Error("Teacher not found.");
        }

        const { error: deleteError } = await supabase
            .from("teachers")
            .delete()
            .eq("id", numericId);

        if (deleteError) {
            throw deleteError;
        }

        alert(
            `${teacher.first_name} ${teacher.last_name} was deleted successfully.`
        );

        window.location.href = "/teachers/dashboard.html";

    } catch (error) {
        console.error("Delete teacher error:", error);

        alert(
            error.message ||
            "Failed to delete teacher."
        );
    }
}

deleteTeacher();