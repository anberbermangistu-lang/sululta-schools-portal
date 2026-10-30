import { supabase, getSession, getUserProfile, getRoleDashboard } from "./supabase.js";

let teacher = null;
let currentUser = null;

/* ──────────────────────────────────────────────────────────────
   AUTHENTICATION & PROFILE FETCH
────────────────────────────────────────────────────────────── */
async function getTeacher() {
    const session = await getSession();
    const user = session?.user;

    if (!user) {
        window.location.href = "/login.html";
        return null;
    }

    currentUser = user;

    const profile = await getUserProfile(user.id);
    const role = String(profile?.role || "").trim().toLowerCase();

    if (role && role !== "teacher" && role !== "admin") {
        const dest = getRoleDashboard(role);
        if (dest) window.location.href = dest;
        return null;
    }

    // Fetch teacher record by user_id
    let teacherRecord = null;
    try {
        const { data } = await supabase
            .from("teachers")
            .select("id, teacher_id, first_name, last_name, gender, phone, email, address, qualification, photo_url, user_id, status, created_at, updated_at")
            .eq("user_id", user.id)
            .maybeSingle();
        teacherRecord = data;
    } catch (e) {
        console.warn("Teacher fetch warning:", e);
    }

    // Fallback: match by email
    if (!teacherRecord && user.email) {
        try {
            const { data } = await supabase
                .from("teachers")
                .select("id, teacher_id, first_name, last_name, gender, phone, email, address, qualification, photo_url, user_id, status, created_at, updated_at")
                .ilike("email", user.email.trim())
                .maybeSingle();
            if (data) {
                teacherRecord = data;
                await supabase.from("teachers").update({ user_id: user.id }).eq("id", teacherRecord.id);
            }
        } catch (_) {}
    }

    if (!teacherRecord) {
        showMessage("Your teacher record is not connected to your account. Contact administrator.", "error");
        return null;
    }

    // Merge cached local photo if present
    const cachedPhoto = localStorage.getItem(`sululta_teacher_photo_${teacherRecord.id}`);
    if (cachedPhoto && !teacherRecord.photo_url) {
        teacherRecord.photo_url = cachedPhoto;
    }

    return teacherRecord;
}

/* ──────────────────────────────────────────────────────────────
   RENDER PROFILE DATA (VIEW & EDIT FORMS)
────────────────────────────────────────────────────────────── */
function getFullName() {
    const f = String(teacher?.first_name || "").trim();
    const l = String(teacher?.last_name || "").trim();
    return `${f} ${l}`.trim() || "Teacher";
}

function formatDate(val) {
    if (!val) return "Not provided";
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function setText(id, val, fallback = "Not provided") {
    const el = document.getElementById(id);
    if (!el) return;
    const txt = (val === null || val === undefined || String(val).trim() === "") ? fallback : String(val);
    el.textContent = txt;
}

function renderAvatars(photoUrl, fullName) {
    const initial = fullName.charAt(0).toUpperCase() || "T";

    // 1. Header Avatar
    const headerAvatar = document.getElementById("teacherAvatar");
    if (headerAvatar) {
        headerAvatar.innerHTML = "";
        if (photoUrl) {
            const img = document.createElement("img");
            img.src = photoUrl;
            img.alt = fullName;
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover";
            img.style.borderRadius = "50%";
            img.onerror = () => { headerAvatar.textContent = initial; };
            headerAvatar.appendChild(img);
        } else {
            headerAvatar.textContent = initial;
        }
    }

    // 2. Large Profile Card Avatar
    const profileAvatar = document.getElementById("profileAvatar");
    if (profileAvatar) {
        profileAvatar.innerHTML = "";
        if (photoUrl) {
            const img = document.createElement("img");
            img.src = photoUrl;
            img.alt = fullName;
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover";
            img.onerror = () => { profileAvatar.textContent = initial; };
            profileAvatar.appendChild(img);
        } else {
            profileAvatar.textContent = initial;
        }
    }
}

function loadProfile() {
    const fullName = getFullName();

    // Header info
    setText("teacherHeaderName", fullName, "Teacher");
    setText("profileTeacherName", fullName, "Teacher");
    setText("profileTeacherId", teacher.teacher_id, "Teacher ID");

    // View mode fields
    setText("firstName", teacher.first_name);
    setText("lastName", teacher.last_name);
    setText("teacherId", teacher.teacher_id);
    setText("gender", teacher.gender ? (teacher.gender.charAt(0).toUpperCase() + teacher.gender.slice(1).toLowerCase()) : null);
    setText("phone", teacher.phone);
    setText("email", teacher.email);
    setText("qualification", teacher.qualification);
    setText("address", teacher.address);
    setText("status", teacher.status ? (teacher.status.charAt(0).toUpperCase() + teacher.status.slice(1).toLowerCase()) : "Active");
    setText("createdAt", formatDate(teacher.created_at));

    // Edit mode input pre-fill
    const editFirstName = document.getElementById("editFirstName");
    const editLastName = document.getElementById("editLastName");
    const editGender = document.getElementById("editGender");
    const editPhone = document.getElementById("editPhone");
    const editEmail = document.getElementById("editEmail");
    const editQualification = document.getElementById("editQualification");
    const editAddress = document.getElementById("editAddress");

    if (editFirstName) editFirstName.value = teacher.first_name || "";
    if (editLastName) editLastName.value = teacher.last_name || "";
    if (editGender) editGender.value = teacher.gender || "";
    if (editPhone) editPhone.value = teacher.phone || "";
    if (editEmail) editEmail.value = teacher.email || "";
    if (editQualification) editQualification.value = teacher.qualification || "";
    if (editAddress) editAddress.value = teacher.address || "";

    // Render photo
    renderAvatars(teacher.photo_url, fullName);
}

/* ──────────────────────────────────────────────────────────────
   PROFILE PHOTO UPLOAD HANDLER
────────────────────────────────────────────────────────────── */
function setupPhotoUpload() {
    const fileInput = document.getElementById("photoFileInput");
    const statusText = document.getElementById("photoStatusText");

    if (!fileInput) return;

    fileInput.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validation
        if (!file.type.startsWith("image/")) {
            showMessage("Please select a valid image file (PNG, JPG, or WebP).", "error");
            fileInput.value = "";
            return;
        }

        if (file.size > 4 * 1024 * 1024) {
            showMessage("Image size must be less than 4MB.", "error");
            fileInput.value = "";
            return;
        }

        if (statusText) statusText.textContent = "Uploading photo...";

        const reader = new FileReader();
        reader.onload = async (event) => {
            const dataUrl = event.target.result;
            let finalPhotoUrl = dataUrl;

            // Preview instantly
            renderAvatars(dataUrl, getFullName());

            try {
                // Try Supabase Storage upload
                const fileExt = file.name.split('.').pop() || 'jpg';
                const filePath = `teachers/${teacher.id}_${Date.now()}.${fileExt}`;
                
                const { error: storageError } = await supabase.storage
                    .from("avatars")
                    .upload(filePath, file, { upsert: true });

                if (!storageError) {
                    const { data: publicUrlData } = supabase.storage
                        .from("avatars")
                        .getPublicUrl(filePath);
                    if (publicUrlData?.publicUrl) {
                        finalPhotoUrl = publicUrlData.publicUrl;
                    }
                }
            } catch (storageErr) {
                console.warn("Storage upload notice (falling back to Data URL):", storageErr);
            }

            try {
                // Update teachers table
                await supabase
                    .from("teachers")
                    .update({
                        photo_url: finalPhotoUrl,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", teacher.id);

                // Update profiles table
                await supabase
                    .from("profiles")
                    .update({
                        photo_url: finalPhotoUrl
                    })
                    .eq("id", teacher.user_id);

                teacher.photo_url = finalPhotoUrl;
                localStorage.setItem(`sululta_teacher_photo_${teacher.id}`, finalPhotoUrl);

                if (statusText) statusText.textContent = "✓ Photo updated!";
                setTimeout(() => { if (statusText) statusText.textContent = ""; }, 4000);

                showMessage("Profile photo updated successfully!", "success");

            } catch (dbErr) {
                console.error("Error saving photo:", dbErr);
                showMessage("Notice: Photo saved locally. " + dbErr.message, "success");
            } finally {
                fileInput.value = "";
            }
        };

        reader.readAsDataURL(file);
    });
}

/* ──────────────────────────────────────────────────────────────
   EDIT PROFILE TOGGLE & FORM SUBMISSION
────────────────────────────────────────────────────────────── */
function setupEditMode() {
    const toggleBtn = document.getElementById("toggleEditBtn");
    const cancelBtn = document.getElementById("cancelEditBtn");
    const form = document.getElementById("editProfileForm");
    const viewContainer = document.getElementById("profileViewMode");
    const editContainer = document.getElementById("profileEditMode");

    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            const isEditing = editContainer.style.display !== "none";
            if (isEditing) {
                switchToView();
            } else {
                switchToEdit();
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener("click", () => {
            switchToView();
        });
    }

    function switchToEdit() {
        if (viewContainer) viewContainer.style.display = "none";
        if (editContainer) editContainer.style.display = "block";
        if (toggleBtn) toggleBtn.innerHTML = "👁️ View Mode";
        clearMessage();
    }

    function switchToView() {
        if (viewContainer) viewContainer.style.display = "block";
        if (editContainer) editContainer.style.display = "none";
        if (toggleBtn) toggleBtn.innerHTML = "✏️ Edit Information";
        clearMessage();
    }

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const saveBtn = document.getElementById("saveProfileBtn");
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = "Saving...";
            }

            const firstName = document.getElementById("editFirstName")?.value.trim() || "";
            const lastName = document.getElementById("editLastName")?.value.trim() || "";
            const gender = document.getElementById("editGender")?.value || "";
            const phone = document.getElementById("editPhone")?.value.trim() || "";
            const email = document.getElementById("editEmail")?.value.trim() || "";
            const qualification = document.getElementById("editQualification")?.value.trim() || "";
            const address = document.getElementById("editAddress")?.value.trim() || "";

            if (!firstName || !lastName) {
                showMessage("First Name and Last Name are required.", "error");
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = "💾 Save Changes";
                }
                return;
            }

            try {
                // 1. Update teachers table
                const { error: teacherUpdateErr } = await supabase
                    .from("teachers")
                    .update({
                        first_name: firstName,
                        last_name: lastName,
                        gender: gender,
                        phone: phone,
                        email: email,
                        qualification: qualification,
                        address: address,
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", teacher.id);

                if (teacherUpdateErr) {
                    throw teacherUpdateErr;
                }

                // 2. Update profiles table
                await supabase
                    .from("profiles")
                    .update({
                        first_name: firstName,
                        last_name: lastName
                    })
                    .eq("id", teacher.user_id);

                // Update in-memory teacher object
                teacher.first_name = firstName;
                teacher.last_name = lastName;
                teacher.gender = gender;
                teacher.phone = phone;
                teacher.email = email;
                teacher.qualification = qualification;
                teacher.address = address;

                loadProfile();
                switchToView();
                showMessage("Teacher information updated successfully!", "success");

            } catch (err) {
                console.error("Profile save error:", err);
                showMessage("Error updating information: " + err.message, "error");
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.textContent = "💾 Save Changes";
                }
            }
        });
    }
}

/* ──────────────────────────────────────────────────────────────
   MESSAGING & REFRESH UTILITIES
────────────────────────────────────────────────────────────── */
function showMessage(msg, type = "error") {
    const el = document.getElementById("profileMessage");
    if (!el) return;
    el.textContent = msg;
    el.className = `message ${type}`;
    el.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearMessage() {
    const el = document.getElementById("profileMessage");
    if (!el) return;
    el.textContent = "";
    el.hidden = true;
}

function setupRefresh() {
    const btn = document.getElementById("refreshProfile");
    if (!btn) return;

    btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "↻ Loading...";
        clearMessage();

        const fresh = await getTeacher();
        if (fresh) {
            teacher = fresh;
            loadProfile();
            showMessage("Profile refreshed successfully.", "success");
        }

        btn.disabled = false;
        btn.textContent = "↻ Refresh";
    });
}

function setupLogout() {
    const btn = document.getElementById("logoutButton");
    if (!btn) return;

    btn.addEventListener("click", async () => {
        btn.disabled = true;
        await supabase.auth.signOut();
        window.location.href = "/login.html";
    });
}

function setupSidebar() {
    const toggle = document.getElementById("sidebarToggle");
    const sidebar = document.querySelector(".admin-sidebar");
    if (toggle && sidebar) {
        toggle.addEventListener("click", () => {
            sidebar.classList.toggle("mobile-open");
        });
    }
}

/* ──────────────────────────────────────────────────────────────
   INITIALIZATION
────────────────────────────────────────────────────────────── */
async function initialize() {
    setupSidebar();
    setupLogout();

    teacher = await getTeacher();
    if (!teacher) return;

    loadProfile();
    setupPhotoUpload();
    setupEditMode();
    setupRefresh();
}

initialize();
