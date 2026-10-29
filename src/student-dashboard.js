import { initThemeToggle } from "./theme.js";
import { supabase } from "./supabase.js";

const message = document.getElementById("studentMessage");
const profileMessage = document.getElementById("profileMessage");
const logoutButton = document.getElementById("logoutButton");
const profileForm = document.getElementById("personalProfileForm");
const passwordForm = document.getElementById("passwordForm");
const resultsBody = document.getElementById("studentResultsBody");
const attendanceBody = document.getElementById("studentAttendanceBody");
const timetableBody = document.getElementById("studentTimetableBody");
const subjectsBody = document.getElementById("studentSubjectsBody");
const subjectTotalsBody = document.getElementById("subjectTotalsBody");
const enrolledCardsGrid = document.getElementById("enrolledCardsGrid");
const noticesContainer = document.getElementById("studentNotices");

let student = null;
let profile = null;

// Academic state caches for reactive filtering
let allRawResults = [];
let allSubjectCatalog = [];
let subjectMap = new Map();
let allEnrolledSubjects = [];

/* ──────────────────────────────────────────────────────────────
   UI HELPERS & FORMATTING
────────────────────────────────────────────────────────────── */
function showMessage(element, text, type = "error") {
    if (!element) return;
    element.textContent = text;
    element.className = `message ${type}`;
    element.hidden = !text;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value == null || value === "" ? "—" : String(value);
}

function setValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value || "";
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function showEmptyRow(body, columnCount, text) {
    if (!body) return;
    body.replaceChildren();
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = columnCount;
    cell.className = "empty";
    cell.textContent = text;
    row.appendChild(cell);
    body.appendChild(row);
}

function getGradeLetter(mark) {
    const num = Number(mark);
    if (isNaN(num)) return "—";
    if (num >= 90) return "A";
    if (num >= 80) return "B";
    if (num >= 65) return "C";
    if (num >= 50) return "D";
    return "F";
}

function getGradeClass(letter) {
    switch (letter) {
        case "A": return "grade-a";
        case "B": return "grade-b";
        case "C": return "grade-c";
        case "D": return "grade-d";
        case "F": return "grade-f";
        default: return "";
    }
}

function getStatusBadgeHtml(mark) {
    const num = Number(mark);
    if (isNaN(num)) return '<span class="badge badge-warn">PENDING</span>';
    if (num >= 85) return '<span class="badge badge-emerald">DISTINCTION</span>';
    if (num >= 50) return '<span class="badge badge-pass">PASS</span>';
    return '<span class="badge badge-fail">FAIL</span>';
}

function getScoreBarColor(score) {
    if (score >= 80) return "#10b981";
    if (score >= 65) return "#3b82f6";
    if (score >= 50) return "#f59e0b";
    return "#ef4444";
}

function inferSubjectCategory(code, name) {
    const str = `${code || ""} ${name || ""}`.toLowerCase();
    if (str.includes("math") || str.includes("calc")) return "Mathematics & Logic";
    if (str.includes("phy") || str.includes("chem") || str.includes("bio") || str.includes("scie")) return "Natural Sciences (STEM)";
    if (str.includes("eng") || str.includes("amharic") || str.includes("orom") || str.includes("lang")) return "Languages & Literature";
    if (str.includes("hist") || str.includes("geog") || str.includes("civic") || str.includes("social")) return "Social Studies & Humanities";
    if (str.includes("ict") || str.includes("comp") || str.includes("tech")) return "Information Technology";
    if (str.includes("sport") || str.includes("health") || str.includes("pe") || str.includes("hpe")) return "Health & Physical Education";
    if (str.includes("art") || str.includes("music")) return "Arts & Culture";
    return "Core Secondary Curriculum";
}

/* ──────────────────────────────────────────────────────────────
   AVATAR RENDERING & STUDENT PROFILE PHOTO
────────────────────────────────────────────────────────────── */
function updateAllAvatars(photoUrl, fullName) {
    const initial = (fullName || "S").trim().charAt(0).toUpperCase() || "S";

    // 1. Header Avatar
    const headerAvatar = document.getElementById("studentAvatar");
    if (headerAvatar) {
        headerAvatar.replaceChildren();
        if (photoUrl) {
            const img = document.createElement("img");
            img.src = photoUrl;
            img.alt = fullName;
            img.onerror = () => { headerAvatar.textContent = initial; };
            headerAvatar.appendChild(img);
        } else {
            headerAvatar.textContent = initial;
        }
    }

    // 2. Sidebar Avatar
    const sidebarAvatar = document.getElementById("sidebarStudentAvatar");
    if (sidebarAvatar) {
        sidebarAvatar.replaceChildren();
        if (photoUrl) {
            const img = document.createElement("img");
            img.src = photoUrl;
            img.alt = fullName;
            img.onerror = () => { sidebarAvatar.textContent = initial; };
            sidebarAvatar.appendChild(img);
        } else {
            sidebarAvatar.textContent = initial;
        }
    }

    // 3. Profile Tab Large Avatar
    const profileAvatar = document.getElementById("studentProfileAvatarDisplay");
    if (profileAvatar) {
        profileAvatar.replaceChildren();
        if (photoUrl) {
            const img = document.createElement("img");
            img.src = photoUrl;
            img.alt = fullName;
            img.onerror = () => { profileAvatar.textContent = initial; };
            profileAvatar.appendChild(img);
        } else {
            profileAvatar.textContent = initial;
        }
    }

    // 4. Toggle remove photo button visibility
    const removeBtn = document.getElementById("removePhotoButton");
    if (removeBtn) {
        removeBtn.style.display = photoUrl ? "inline-flex" : "none";
    }
}

function setupProfilePhotoUpload() {
    const fileInput = document.getElementById("studentPhotoInput");
    const uploadBtn = document.getElementById("uploadPhotoButton");
    const removeBtn = document.getElementById("removePhotoButton");
    const statusText = document.getElementById("photoStatusText");

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener("click", () => fileInput.click());
    }

    if (fileInput) {
        fileInput.addEventListener("change", async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            if (!file.type.startsWith("image/")) {
                showMessage(profileMessage, "Please select an image file (PNG, JPG, or WebP).", "error");
                fileInput.value = "";
                return;
            }

            if (file.size > 4 * 1024 * 1024) {
                showMessage(profileMessage, "Image file size must be less than 4MB.", "error");
                fileInput.value = "";
                return;
            }

            if (statusText) {
                statusText.textContent = "⏳ Uploading photo...";
                statusText.style.color = "#0284c7";
            }

            const reader = new FileReader();
            reader.onload = async (event) => {
                const dataUrl = event.target.result;
                let finalPhotoUrl = dataUrl;
                const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Student";

                // Preview immediately
                updateAllAvatars(dataUrl, fullName);

                try {
                    // Try Supabase Storage
                    const fileExt = file.name.split(".").pop() || "jpg";
                    const filePath = `students/${student.id}_${Date.now()}.${fileExt}`;
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
                    // Update students table
                    await supabase
                        .from("students")
                        .update({
                            photo_url: finalPhotoUrl
                        })
                        .eq("id", student.id);

                    // Update profiles table
                    if (profile?.id) {
                        await supabase
                            .from("profiles")
                            .update({
                                avatar_url: finalPhotoUrl
                            })
                            .eq("id", profile.id);
                    }

                    student.photo_url = finalPhotoUrl;
                    localStorage.setItem(`sululta_student_photo_${student.id}`, finalPhotoUrl);

                    if (statusText) {
                        statusText.textContent = "✓ Photo updated successfully!";
                        statusText.style.color = "#16a34a";
                        setTimeout(() => { if (statusText) statusText.textContent = ""; }, 4000);
                    }

                    showMessage(profileMessage, "Profile photo updated successfully!", "success");
                } catch (dbErr) {
                    console.error("Error saving photo to database:", dbErr);
                    // Still cached locally
                    localStorage.setItem(`sululta_student_photo_${student.id}`, finalPhotoUrl);
                    if (statusText) {
                        statusText.textContent = "✓ Photo saved locally!";
                        statusText.style.color = "#16a34a";
                    }
                } finally {
                    fileInput.value = "";
                }
            };

            reader.readAsDataURL(file);
        });
    }

    if (removeBtn) {
        removeBtn.addEventListener("click", async () => {
            const confirmRemove = window.confirm("Are you sure you want to remove your profile photo?");
            if (!confirmRemove) return;

            if (statusText) {
                statusText.textContent = "Removing photo...";
                statusText.style.color = "#64748b";
            }

            try {
                await supabase
                    .from("students")
                    .update({ photo_url: null })
                    .eq("id", student.id);

                if (profile?.id) {
                    await supabase
                        .from("profiles")
                        .update({ avatar_url: null })
                        .eq("id", profile.id);
                }

                localStorage.removeItem(`sululta_student_photo_${student.id}`);
                student.photo_url = null;

                const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Student";
                updateAllAvatars(null, fullName);

                if (statusText) {
                    statusText.textContent = "✓ Photo removed.";
                    statusText.style.color = "#64748b";
                    setTimeout(() => { if (statusText) statusText.textContent = ""; }, 3000);
                }
            } catch (err) {
                console.error("Remove photo error:", err);
                showMessage(profileMessage, "Failed to remove photo: " + err.message, "error");
            }
        });
    }
}

/* ──────────────────────────────────────────────────────────────
   TAB NAVIGATION
────────────────────────────────────────────────────────────── */
function setupTabNavigation() {
    const navLinks = document.querySelectorAll("nav a[data-tab], .sp-nav-link[data-tab]");
    const tabContents = document.querySelectorAll(".tab-content");
    const topbarTitle = document.getElementById("studentHeaderName");

    const tabTitles = {
        home: "Student Portal Overview",
        results: "My Examination & Assessment Results",
        attendance: "My Attendance",
        timetable: "My Class Timetable",
        subjects: "My Enrolled Curriculum Subjects",
        notices: "School Notices & Announcements",
        profile: "My Student Profile"
    };

    function switchTab(tabId) {
        const validTabId = tabTitles[tabId] ? tabId : "home";

        tabContents.forEach(tab => {
            tab.classList.toggle("active", tab.id === `tab-${validTabId}`);
        });

        navLinks.forEach(link => {
            const isMatch = link.dataset.tab === validTabId;
            link.classList.toggle("active", isMatch);
            if (isMatch) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });

        if (topbarTitle && tabTitles[validTabId]) {
            topbarTitle.textContent = tabTitles[validTabId];
        }

        if (window.location.hash.replace("#", "") !== validTabId) {
            history.replaceState(null, "", `#${validTabId}`);
        }
    }

    navLinks.forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();
            switchTab(link.dataset.tab);
        });
    });

    document.querySelectorAll("[data-tab-jump]").forEach(btn => {
        btn.addEventListener("click", e => {
            e.preventDefault();
            switchTab(btn.dataset.tabJump);
        });
    });

    window.addEventListener("hashchange", () => {
        const hash = window.location.hash.replace("#", "");
        if (hash) switchTab(hash);
    });

    // Mobile sidebar toggle
    const spToggle = document.getElementById("spMobileToggle");
    const spSidebar = document.getElementById("studentSidebar");
    const spBackdrop = document.getElementById("spBackdrop");

    if (spToggle && spSidebar) {
        const toggleSidebar = () => {
            spSidebar.classList.toggle("open");
            spBackdrop?.classList.toggle("show");
        };
        spToggle.addEventListener("click", toggleSidebar);
        spBackdrop?.addEventListener("click", toggleSidebar);
    }
}

/* ──────────────────────────────────────────────────────────────
   LOAD STUDENT PROFILE
────────────────────────────────────────────────────────────── */
async function loadStudentProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user) {
        window.location.replace("/login.html");
        return false;
    }

    const { data: currentProfile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, student_id, first_name, last_name, email, phone, avatar_url, status")
        .eq("id", authData.user.id)
        .maybeSingle();

    if (profileError || !currentProfile) {
        await supabase.auth.signOut();
        window.location.replace("/login.html");
        return false;
    }

    const role = String(currentProfile.role || "").trim().toLowerCase();
    if (role !== "student") {
        window.location.replace("/login.html");
        return false;
    }

    if (!currentProfile.student_id) {
        throw new Error("This student account is not linked to a school record.");
    }

    // Try finding by numeric id or by string student_id
    let schoolRecord = null;
    const isNum = !isNaN(Number(currentProfile.student_id));
    if (isNum) {
        const { data } = await supabase
            .from("students")
            .select("id, student_id, first_name, last_name, gender, date_of_birth, class, section, class_id, phone, email, address, photo_url, status")
            .eq("id", Number(currentProfile.student_id))
            .maybeSingle();
        schoolRecord = data;
    }
    if (!schoolRecord) {
        const { data } = await supabase
            .from("students")
            .select("id, student_id, first_name, last_name, gender, date_of_birth, class, section, class_id, phone, email, address, photo_url, status")
            .eq("student_id", String(currentProfile.student_id))
            .maybeSingle();
        schoolRecord = data;
    }

    if (!schoolRecord) {
        throw new Error("Your student school record could not be found.");
    }

    profile = currentProfile;
    student = schoolRecord;

    // Check cached photo
    const cachedPhoto = localStorage.getItem(`sululta_student_photo_${student.id}`);
    if (cachedPhoto && !student.photo_url) {
        student.photo_url = cachedPhoto;
    }

    const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Student";
    const studentCode = student.student_id || String(student.id);
    const classSection = `${student.class || "Not assigned"}${student.section ? " - " + student.section : ""}`;

    setText("studentStatus", student.status ? student.status.toUpperCase() : "ACTIVE");
    setText("studentId", studentCode);
    setText("studentClass", student.class || "Not assigned");
    setText("studentSection", student.section || "—");

    // Sidebar student profile at bottom
    setText("sidebarStudentName", fullName);
    setText("sidebarStudentGrade", student.class || "Grade 10");

    // Profile tab displays
    setText("profileStudentName", fullName);
    setText("profileStudentId", `Student ID: ${studentCode}`);

    // Home tab details
    setText("homeGreeting", `Welcome, ${student.first_name || "Student"}!`);
    setText("homeClass", student.class || "Grade 10");
    setText("homeSection", student.section || "—");

    // Attendance summary cards
    setText("attStudentId", studentCode);
    setText("attStudentClass", classSection);

    // Profile form pre-fills
    setText("gender", student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : "—");
    setText("dateOfBirth", formatDate(student.date_of_birth));
    setText("accountStatus", student.status ? student.status.toUpperCase() : "ACTIVE");
    setValue("firstName", student.first_name);
    setValue("lastName", student.last_name);
    setValue("email", student.email || profile.email);
    setValue("phone", student.phone || profile.phone);
    setValue("address", student.address);

    // Update all 3 avatars
    updateAllAvatars(student.photo_url || profile.avatar_url, fullName);

    setupProfilePhotoUpload();

    return true;
}

/* ──────────────────────────────────────────────────────────────
   RENDER DETAILED RESULTS & SUBJECT TOTALS
────────────────────────────────────────────────────────────── */
function renderResultsTable() {
    const examFilter = document.getElementById("resultExamFilter")?.value || "all";
    const searchFilter = (document.getElementById("resultSearchInput")?.value || "").trim().toLowerCase();
    const countText = document.getElementById("resultsCountText");

    let filtered = allRawResults.filter(item => {
        // Exam type match
        if (examFilter !== "all" && item.exam_type !== examFilter) {
            return false;
        }
        // Search text match
        if (searchFilter) {
            const subjectName = (subjectMap.get(item.subject_code) || item.subject_name || "").toLowerCase();
            const subjectCode = String(item.subject_code || "").toLowerCase();
            const examType = String(item.exam_type || "").toLowerCase();
            if (!subjectName.includes(searchFilter) && !subjectCode.includes(searchFilter) && !examType.includes(searchFilter)) {
                return false;
            }
        }
        return true;
    });

    if (countText) {
        countText.textContent = `Showing ${filtered.length} of ${allRawResults.length} assessment record${allRawResults.length === 1 ? "" : "s"}`;
    }

    if (!resultsBody) return;

    if (!filtered.length) {
        showEmptyRow(resultsBody, 8, allRawResults.length === 0 ? "No examination results published yet." : "No assessment records match your filter criteria.");
        return;
    }

    resultsBody.replaceChildren();

    filtered.forEach(result => {
        const row = document.createElement("tr");
        const markVal = Number(result.mark);
        const subjectName = subjectMap.get(result.subject_code) || result.subject_name || result.subject_code;
        const letter = result.grade || getGradeLetter(markVal);
        const gradeClass = getGradeClass(letter);

        row.innerHTML = `
            <td><span class="subject-code-tag">${result.subject_code || "—"}</span></td>
            <td><strong>${subjectName}</strong></td>
            <td><span class="badge-exam">${result.exam_type || "Assessment"}</span></td>
            <td><strong>${isNaN(markVal) ? "—" : markVal.toFixed(1) + " / 100"}</strong></td>
            <td><span class="badge-grade ${gradeClass}">${letter}</span></td>
            <td>${getStatusBadgeHtml(markVal)}</td>
            <td>${result.remark || (markVal >= 85 ? "Excellent" : (markVal >= 50 ? "Satisfactory" : "Needs improvement"))}</td>
            <td style="color: #64748b; font-size: 12.5px;">${formatDate(result.created_at)}</td>
        `;

        resultsBody.appendChild(row);
    });
}

function computeAndRenderSubjectTotals() {
    // Group marks by subject code
    const bySubject = new Map();

    for (const r of allRawResults) {
        const code = r.subject_code;
        if (!code) continue;
        if (!bySubject.has(code)) {
            bySubject.set(code, {
                code,
                name: subjectMap.get(code) || r.subject_name || code,
                marks: [],
                examTypes: []
            });
        }
        const record = bySubject.get(code);
        const mark = Number(r.mark);
        if (!isNaN(mark)) {
            record.marks.push(mark);
        }
        if (r.exam_type && !record.examTypes.includes(r.exam_type)) {
            record.examTypes.push(r.exam_type);
        }
    }

    const totalsList = [];
    for (const [code, item] of bySubject.entries()) {
        const totalScore = item.marks.length
            ? item.marks.reduce((sum, m) => sum + m, 0) / item.marks.length
            : 0;
        totalsList.push({
            code,
            name: item.name,
            score: totalScore,
            examCount: item.marks.length,
            examTypes: item.examTypes
        });
    }

    // Sort by subject name
    totalsList.sort((a, b) => a.name.localeCompare(b.name));

    // Render Subject Totals Table
    if (subjectTotalsBody) {
        if (!totalsList.length) {
            showEmptyRow(subjectTotalsBody, 6, "No subject assessment totals calculated yet.");
        } else {
            subjectTotalsBody.replaceChildren();
            for (const item of totalsList) {
                const row = document.createElement("tr");
                const pct = Math.min(100, Math.max(0, item.score));
                const barColor = getScoreBarColor(pct);
                const letter = getGradeLetter(item.score);
                const gradeClass = getGradeClass(letter);

                const evaluationsText = item.examTypes.length
                    ? item.examTypes.map(t => `<span class="badge-exam" style="margin-right: 4px; font-size: 11px;">${t}</span>`).join("")
                    : '<span style="color: #94a3b8;">Single assessment</span>';

                row.innerHTML = `
                    <td><span class="subject-code-tag">${item.code}</span></td>
                    <td><strong>${item.name}</strong></td>
                    <td>${evaluationsText}</td>
                    <td>
                        <div class="progress-bar-wrap">
                            <div class="progress-bar-track">
                                <div class="progress-bar-fill" style="width: ${pct}%; background: ${barColor};"></div>
                            </div>
                            <span class="progress-bar-text" style="color: ${barColor};">${item.score.toFixed(1)}</span>
                        </div>
                    </td>
                    <td><span class="badge-grade ${gradeClass}">${letter}</span></td>
                    <td>${getStatusBadgeHtml(item.score)}</td>
                `;

                subjectTotalsBody.appendChild(row);
            }
        }
    }

    // Compute Overall Cumulative KPI Metrics
    const totalSubjectsCount = totalsList.length;
    const overallAvg = totalSubjectsCount
        ? totalsList.reduce((sum, item) => sum + item.score, 0) / totalSubjectsCount
        : null;

    const cumulativePoints = totalsList.reduce((sum, item) => sum + item.score, 0);
    const maxPoints = totalSubjectsCount * 100;

    // Update KPI Cards
    setText("kpiAverage", overallAvg == null ? "—" : `${overallAvg.toFixed(1)}%`);
    setText("kpiTotalPoints", overallAvg == null ? "—" : `${cumulativePoints.toFixed(1)} / ${maxPoints}`);
    setText("kpiEvaluatedCount", `${totalSubjectsCount} Subject${totalSubjectsCount === 1 ? "" : "s"}`);
    setText("kpiAverageSub", totalSubjectsCount ? `Across ${totalSubjectsCount} evaluated curriculum subjects` : "Awaiting assessment entries");
    setText("kpiTotalPointsSub", totalSubjectsCount ? `Earned across all evaluations` : "No marks registered");
    setText("kpiEvaluatedSub", `${allRawResults.length} total assessment submission${allRawResults.length === 1 ? "" : "s"}`);

    // Standing Badge & Remark
    const standingBadge = document.getElementById("standingBadge");
    if (overallAvg == null) {
        setText("kpiStanding", "PENDING");
        if (standingBadge) {
            standingBadge.textContent = "AWAITING";
            standingBadge.className = "badge badge-warn";
        }
    } else if (overallAvg >= 85) {
        setText("kpiStanding", "DISTINCTION");
        if (standingBadge) {
            standingBadge.textContent = "TOP HONORS";
            standingBadge.className = "badge badge-emerald";
        }
    } else if (overallAvg >= 50) {
        setText("kpiStanding", "PASS");
        if (standingBadge) {
            standingBadge.textContent = "PROMOTED";
            standingBadge.className = "badge badge-pass";
        }
    } else {
        setText("kpiStanding", "NEEDS REVIEW");
        if (standingBadge) {
            standingBadge.textContent = "ACADEMIC CONCERN";
            standingBadge.className = "badge badge-fail";
        }
    }

    // Top Profile Summary Facts
    setText("averageMark", overallAvg == null ? "—" : `${overallAvg.toFixed(1)} / 100`);
    setText("homeAverage", overallAvg == null ? "—" : `${overallAvg.toFixed(1)}%`);
    setText("performanceStatus", overallAvg == null ? "Not calculated" : overallAvg >= 50 ? "Pass" : "Fail");
    setText(
        "performanceRemark",
        overallAvg == null
            ? "No marks recorded"
            : overallAvg >= 85
                ? "Excellent Distinction"
                : overallAvg >= 75
                    ? "Very Good Standing"
                    : overallAvg >= 50
                        ? "Satisfactory Promotion"
                        : "Academic Support Required"
    );
}

/* ──────────────────────────────────────────────────────────────
   RENDER ENROLLED SUBJECTS (CARDS + TABLE + LIVE SEARCH)
────────────────────────────────────────────────────────────── */
function renderEnrolledSubjects() {
    const searchFilter = (document.getElementById("subjectSearchInput")?.value || "").trim().toLowerCase();
    const countText = document.getElementById("subjectSearchCount");
    const enrolledBadge = document.getElementById("enrolledBadge");

    const filtered = allEnrolledSubjects.filter(sub => {
        if (!searchFilter) return true;
        const name = (sub.name || "").toLowerCase();
        const code = (sub.code || "").toLowerCase();
        const teacher = (sub.teacher || "").toLowerCase();
        const cat = (sub.category || "").toLowerCase();
        return name.includes(searchFilter) || code.includes(searchFilter) || teacher.includes(searchFilter) || cat.includes(searchFilter);
    });

    if (countText) {
        countText.textContent = `Showing ${filtered.length} of ${allEnrolledSubjects.length} enrolled subject${allEnrolledSubjects.length === 1 ? "" : "s"}`;
    }

    if (enrolledBadge) {
        enrolledBadge.textContent = `✓ ${allEnrolledSubjects.length} Subjects Enrolled`;
    }
    setText("homeSubjectsCount", `${allEnrolledSubjects.length} Subjects`);

    // 1. Render Cards Grid
    if (enrolledCardsGrid) {
        enrolledCardsGrid.replaceChildren();
        if (!filtered.length) {
            const emptyDiv = document.createElement("div");
            emptyDiv.className = "card empty";
            emptyDiv.style.gridColumn = "1 / -1";
            emptyDiv.textContent = allEnrolledSubjects.length === 0 ? "No curriculum subjects found for your class." : "No enrolled subjects match your search.";
            enrolledCardsGrid.appendChild(emptyDiv);
        } else {
            for (const sub of filtered) {
                const card = document.createElement("div");
                card.className = "subject-card";
                card.innerHTML = `
                    <div>
                        <div class="subject-card-header">
                            <span class="subject-code-tag">${sub.code}</span>
                            <span class="badge badge-pass">✓ ENROLLED</span>
                        </div>
                        <h3 class="subject-title">${sub.name}</h3>
                        <div class="subject-category">${sub.category}</div>
                    </div>
                    <div class="subject-meta-grid">
                        <div class="subject-meta-item">
                            <span>Teacher</span>
                            <strong title="${sub.teacher}">👨‍🏫 ${sub.teacher}</strong>
                        </div>
                        <div class="subject-meta-item">
                            <span>Weekly Load</span>
                            <strong>${sub.periods} Period${sub.periods === 1 ? "" : "s"}</strong>
                        </div>
                        <div class="subject-meta-item">
                            <span>Classroom</span>
                            <strong>📍 ${sub.room}</strong>
                        </div>
                        <div class="subject-meta-item">
                            <span>Academic Year</span>
                            <strong>${sub.academicYear || "2026/2027"}</strong>
                        </div>
                    </div>
                `;
                enrolledCardsGrid.appendChild(card);
            }
        }
    }

    // 2. Render Overview Table
    if (subjectsBody) {
        if (!filtered.length) {
            showEmptyRow(subjectsBody, 8, allEnrolledSubjects.length === 0 ? "No subjects registered for this class." : "No enrolled subjects match your search.");
        } else {
            subjectsBody.replaceChildren();
            filtered.forEach((sub, idx) => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td style="color: #64748b;">${idx + 1}</td>
                    <td><span class="subject-code-tag">${sub.code}</span></td>
                    <td><strong>${sub.name}</strong></td>
                    <td style="color: #64748b; font-size: 13px;">${sub.category}</td>
                    <td><strong>${sub.periods}</strong> period${sub.periods === 1 ? "" : "s"}/wk</td>
                    <td>👨‍🏫 ${sub.teacher}</td>
                    <td>📍 ${sub.room}</td>
                    <td><span class="badge badge-pass">✓ Enrolled</span></td>
                `;
                subjectsBody.appendChild(row);
            });
        }
    }
}

/* ──────────────────────────────────────────────────────────────
   LOAD ACADEMIC RECORDS (RESULTS, ATTENDANCE, TIMETABLE, SUBJECTS, NOTICES)
────────────────────────────────────────────────────────────── */
async function loadAcademicRecords() {
    // 1. Fetch Subjects Catalog
    try {
        const { data } = await supabase
            .from("subjects")
            .select("subject_code, subject_name, grade_level, credit, description")
            .order("subject_name");
        allSubjectCatalog = data || [];
    } catch (e) {
        console.warn("Could not load subjects catalog:", e);
    }
    subjectMap = new Map(allSubjectCatalog.map(s => [s.subject_code, s.subject_name]));

    // 2. Load Results for this student
    const studentKeys = [
        String(student.student_id || ""),
        String(student.id || "")
    ].filter(Boolean);

    try {
        const { data, error } = await supabase
            .from("results")
            .select("id, subject_code, exam_type, mark, grade, remark, created_at")
            .in("student_id", studentKeys)
            .order("created_at", { ascending: false });

        if (!error && data) {
            allRawResults = data;
        }
    } catch (e) {
        console.error("Results load error:", e);
    }

    // Populate Exam Type filter options dynamically
    const examFilterSelect = document.getElementById("resultExamFilter");
    if (examFilterSelect) {
        const distinctExamTypes = [...new Set(allRawResults.map(r => r.exam_type).filter(Boolean))].sort();
        // Clear previous options except "All"
        examFilterSelect.innerHTML = '<option value="all">All Exam & Assessment Types</option>';
        for (const type of distinctExamTypes) {
            const opt = document.createElement("option");
            opt.value = type;
            opt.textContent = type;
            examFilterSelect.appendChild(opt);
        }
    }

    // Render detailed results & subject totals
    computeAndRenderSubjectTotals();
    renderResultsTable();

    // Wire up results filter listeners
    const examFilter = document.getElementById("resultExamFilter");
    const searchInput = document.getElementById("resultSearchInput");
    const clearBtn = document.getElementById("clearResultFilters");

    examFilter?.addEventListener("change", renderResultsTable);
    searchInput?.addEventListener("input", renderResultsTable);
    clearBtn?.addEventListener("click", () => {
        if (examFilter) examFilter.value = "all";
        if (searchInput) searchInput.value = "";
        renderResultsTable();
    });

    // 3. Load Timetable strictly for student's own class and section
    let targetClassName = (student.class || "").trim();
    let targetSection = (student.section || "").trim();
    let classTeacherName = "—";

    if (student.class_id) {
        try {
            const { data: classData } = await supabase
                .from("classes")
                .select("id, class_name, section, class_teacher")
                .eq("id", student.class_id)
                .maybeSingle();
            if (classData) {
                if (classData.class_name) targetClassName = classData.class_name;
                if (classData.section) targetSection = classData.section;
                if (classData.class_teacher) classTeacherName = String(classData.class_teacher);
            }
        } catch (err) {
            console.warn("Class lookup warning:", err);
        }
    }

    setText("ttStudentClass", targetClassName || "Not assigned");
    setText("ttStudentSection", targetSection || "—");
    setText("ttClassTeacher", classTeacherName);

    let timetableRecords = [];
    try {
        const { data: ttData, error: ttError } = await supabase
            .from("timetable")
            .select("*")
            .order("day", { ascending: true })
            .order("start_time", { ascending: true });

        if (!ttError && ttData) {
            timetableRecords = ttData.filter(entry => {
                const entryClass = String(entry.class_name || "").trim().toLowerCase();
                const entrySection = String(entry.section || "").trim().toLowerCase();
                const sClass = targetClassName.toLowerCase();
                const sSection = targetSection.toLowerCase();

                const cleanEntryClass = entryClass.replace(/[^0-9]/g, "");
                const cleanSClass = sClass.replace(/[^0-9]/g, "");
                const classMatches = entryClass === sClass ||
                    (cleanEntryClass && cleanSClass && cleanEntryClass === cleanSClass);

                const sectionMatches = sSection ? entrySection === sSection : true;
                return classMatches && sectionMatches;
            });
        }
    } catch (err) {
        console.error("Timetable query error:", err);
    }

    // Resolve teacher names
    let teachersCatalog = [];
    try {
        const { data: tData } = await supabase
            .from("teachers")
            .select("id, teacher_id, first_name, last_name");
        teachersCatalog = tData || [];
    } catch (e) {}

    let timetableTeachers = {};
    let teacherAssignments = [];
    try {
        timetableTeachers = JSON.parse(localStorage.getItem("sululta_timetable_teachers") || "{}");
        teacherAssignments = JSON.parse(localStorage.getItem("sululta_teacher_subject_assignments") || "[]");
    } catch (e) {}

    function resolveTeacherName(entry) {
        const cached = timetableTeachers[entry.id];
        let teacherName = entry.teacher_name || cached?.teacher_name || "";
        if (!teacherName && (entry.teacher_id || cached?.teacher_id)) {
            const targetId = entry.teacher_id || cached?.teacher_id;
            const matchT = teachersCatalog.find(t => String(t.id) === String(targetId) || String(t.teacher_id) === String(targetId));
            if (matchT) teacherName = `${matchT.first_name} ${matchT.last_name}`;
        }
        if (!teacherName) {
            const matchA = teacherAssignments.find(a =>
                a.subject_code === entry.subject_code &&
                (!a.class_name || (a.class_name === entry.class_name && (!a.section || a.section === entry.section)))
            );
            if (matchA) {
                const matchT = teachersCatalog.find(t => String(t.id) === String(matchA.teacher_id));
                if (matchT) teacherName = `${matchT.first_name} ${matchT.last_name}`;
            }
        }
        return teacherName || "Assigned Teacher";
    }

    // Sort timetable
    const dayOrder = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6, "Sunday": 7 };
    timetableRecords.sort((a, b) => {
        const dA = dayOrder[a.day] || 99;
        const dB = dayOrder[b.day] || 99;
        if (dA !== dB) return dA - dB;
        return String(a.start_time || "").localeCompare(String(b.start_time || ""));
    });

    // Render Timetable
    showEmptyRow(timetableBody, 6, `No timetable records found for your section (${targetClassName || "Class"} - ${targetSection || "Section"}).`);
    if (timetableBody && timetableRecords.length) {
        timetableBody.replaceChildren();
        timetableRecords.forEach((entry, idx) => {
            const teacherName = resolveTeacherName(entry);
            const timeDisplay = entry.start_time
                ? `${entry.start_time.slice(0, 5)} – ${entry.end_time ? entry.end_time.slice(0, 5) : ""}`
                : "—";

            const subjectName = subjectMap.get(entry.subject_code) || entry.subject_name || entry.subject_code;
            const subjectDisplay = `${entry.subject_code ? entry.subject_code + " - " : ""}${subjectName}`;

            const row = document.createElement("tr");
            row.innerHTML = `
                <td style="color: #64748b;">${idx + 1}</td>
                <td><strong>${entry.day || "—"}</strong></td>
                <td>${timeDisplay}</td>
                <td><strong>${subjectDisplay}</strong></td>
                <td>👨‍🏫 ${teacherName}</td>
                <td>📍 ${entry.room_number || "—"}</td>
            `;
            timetableBody.appendChild(row);
        });
    }

    const uniqueDays = new Set(timetableRecords.map(t => t.day).filter(Boolean));
    const uniqueYears = [...new Set(timetableRecords.map(t => t.academic_year).filter(Boolean))];

    setText("ttTotalPeriods", `${timetableRecords.length} period${timetableRecords.length === 1 ? "" : "s"}`);
    setText("ttDaysCount", `${uniqueDays.size} day${uniqueDays.size === 1 ? "" : "s"} / week`);
    setText("ttAcademicYear", uniqueYears.length ? uniqueYears.join(", ") : "2026/2027");

    // 4. Compile Enrolled Subjects List
    const subjectsMapCompiled = new Map();

    // From timetable
    for (const tt of timetableRecords) {
        const code = tt.subject_code;
        if (!code) continue;
        if (!subjectsMapCompiled.has(code)) {
            const sName = subjectMap.get(code) || tt.subject_name || code;
            subjectsMapCompiled.set(code, {
                code,
                name: sName,
                category: inferSubjectCategory(code, sName),
                periods: 0,
                teacher: resolveTeacherName(tt),
                room: tt.room_number || "Main Block",
                academicYear: tt.academic_year || "2026/2027"
            });
        }
        const item = subjectsMapCompiled.get(code);
        item.periods += 1;
        if (tt.room_number) item.room = tt.room_number;
    }

    // From student results (in case any subjects are tested that are not in current timetable)
    for (const r of allRawResults) {
        const code = r.subject_code;
        if (code && !subjectsMapCompiled.has(code)) {
            const sName = subjectMap.get(code) || r.subject_name || code;
            subjectsMapCompiled.set(code, {
                code,
                name: sName,
                category: inferSubjectCategory(code, sName),
                periods: 4,
                teacher: "Department Faculty",
                room: "Main Hall",
                academicYear: "2026/2027"
            });
        }
    }

    // If still empty, fall back to class grade curriculum subjects
    if (!subjectsMapCompiled.size) {
        const gradeDigits = (student.class || "").replace(/[^0-9]/g, "");
        let gradeCatalog = allSubjectCatalog;
        if (gradeDigits) {
            const relevant = allSubjectCatalog.filter(s => s.grade_level && s.grade_level.includes(gradeDigits));
            if (relevant.length) gradeCatalog = relevant;
        }
        for (const cat of gradeCatalog) {
            subjectsMapCompiled.set(cat.subject_code, {
                code: cat.subject_code,
                name: cat.subject_name,
                category: inferSubjectCategory(cat.subject_code, cat.subject_name),
                periods: Number(cat.credit) || 4,
                teacher: "Faculty Member",
                room: "Standard Room",
                academicYear: "2026/2027"
            });
        }
    }

    allEnrolledSubjects = Array.from(subjectsMapCompiled.values());
    allEnrolledSubjects.sort((a, b) => a.name.localeCompare(b.name));

    // Render Enrolled Subjects View
    renderEnrolledSubjects();

    // Wire up search filter for enrolled subjects
    document.getElementById("subjectSearchInput")?.addEventListener("input", renderEnrolledSubjects);

    // 5. Load Attendance Records
    let attendance = [];
    try {
        const { data, error } = await supabase
            .from("attendance")
            .select("attendance_date, status, remark")
            .eq("student_id", student.id)
            .order("attendance_date", { ascending: false });

        if (!error && data) {
            attendance = data;
        }
    } catch (e) {
        console.warn("Attendance load error:", e);
    }

    showEmptyRow(attendanceBody, 3, "No attendance records found.");
    if (attendanceBody && attendance.length) {
        attendanceBody.replaceChildren();
        for (const item of attendance) {
            const statusDisplay = item.status
                ? item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase()
                : "Present";
            const row = document.createElement("tr");
            row.innerHTML = `
                <td><strong>${formatDate(item.attendance_date)}</strong></td>
                <td><span class="badge ${statusDisplay === 'Present' ? 'badge-pass' : 'badge-fail'}">${statusDisplay}</span></td>
                <td>${item.remark || "—"}</td>
            `;
            attendanceBody.appendChild(row);
        }
    }
    setText("attendanceCount", `${attendance.length} record${attendance.length === 1 ? "" : "s"}`);

    // 6. Load Notices
    let notices = [];
    try {
        const { data, error } = await supabase
            .from("notices")
            .select("title, message, publish_date")
            .order("publish_date", { ascending: false });

        if (!error && data && data.length) {
            notices = data;
        }
    } catch (e) {
        console.warn("Notices table unavailable:", e);
    }

    if (!notices.length) {
        notices = [
            {
                title: "Welcome to 2026/2027 Academic Year",
                message: "Classes and regular schedules are now active. Check your portal for timetable, attendance, and exam results updates.",
                publish_date: new Date().toISOString()
            },
            {
                title: "Assessment & Grading System",
                message: "Subject marks are evaluated continuously through Assignments (10%), Quizzes (10%), Tests (20%), Midterm (25%), and Final Exam (35%).",
                publish_date: new Date().toISOString()
            },
            {
                title: "School Library Circulation",
                message: "Textbooks and reference materials are available for loan in the school library during standard library hours.",
                publish_date: new Date().toISOString()
            }
        ];
    }

    if (noticesContainer) {
        noticesContainer.replaceChildren();
        for (const notice of notices) {
            const article = document.createElement("article");
            article.style.padding = "12px 0";
            article.style.borderBottom = "1px solid #e8edf4";

            const title = document.createElement("strong");
            title.style.display = "block";
            title.style.color = "#082b59";
            title.style.fontSize = "14px";
            title.textContent = notice.title;

            const date = document.createElement("small");
            date.style.display = "block";
            date.style.color = "#64748b";
            date.style.margin = "2px 0 6px";
            date.textContent = formatDate(notice.publish_date);

            const text = document.createElement("p");
            text.style.margin = "0";
            text.style.color = "#334155";
            text.style.fontSize = "13px";
            text.textContent = notice.message;

            article.append(title, date, text);
            noticesContainer.appendChild(article);
        }
    }
}

/* ──────────────────────────────────────────────────────────────
   PROFILE & PASSWORD FORMS
────────────────────────────────────────────────────────────── */
profileForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!student || !profile) return;

    const first_name = document.getElementById("firstName")?.value.trim() || "";
    const last_name = document.getElementById("lastName")?.value.trim() || "";
    const phone = document.getElementById("phone")?.value.trim() || null;
    const address = document.getElementById("address")?.value.trim() || null;
    const button = document.getElementById("saveProfileButton");

    if (!first_name || !last_name) {
        showMessage(profileMessage, "First and last name are required.");
        return;
    }

    if (button) button.disabled = true;
    try {
        const { error: studentError } = await supabase
            .from("students")
            .update({ first_name, last_name, phone, address })
            .eq("id", student.id);
        if (studentError) throw studentError;

        const { error: profileError } = await supabase
            .from("profiles")
            .update({ first_name, last_name, phone })
            .eq("id", profile.id);
        if (profileError) throw profileError;

        showMessage(profileMessage, "Profile updated successfully.", "success");
        await loadStudentProfile();
    } catch (error) {
        console.error("Student profile update failed:", error);
        showMessage(profileMessage, error.message || "Unable to update your profile.");
    } finally {
        if (button) button.disabled = false;
    }
});

passwordForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const password = document.getElementById("newPassword")?.value || "";
    const confirmation = document.getElementById("confirmNewPassword")?.value || "";
    const button = document.getElementById("changePasswordButton");

    if (password.length < 8) {
        showMessage(profileMessage, "Password must be at least 8 characters.");
        return;
    }
    if (password !== confirmation) {
        showMessage(profileMessage, "Passwords do not match.");
        return;
    }

    if (button) button.disabled = true;
    try {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        passwordForm.reset();
        showMessage(profileMessage, "Your password has been changed successfully.", "success");
    } catch (error) {
        console.error("Student password update failed:", error);
        showMessage(profileMessage, error.message || "Unable to change your password.");
    } finally {
        if (button) button.disabled = false;
    }
});

logoutButton?.addEventListener("click", async () => {
    logoutButton.disabled = true;
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.replace("/login.html");
    } catch (error) {
        console.error("Student logout failed:", error);
        showMessage(message, error.message || "Unable to sign out.");
        logoutButton.disabled = false;
    }
});

/* ──────────────────────────────────────────────────────────────
   INITIALIZE
────────────────────────────────────────────────────────────── */
async function initialize() {
    initThemeToggle();
    setupTabNavigation();
    try {
        const profileLoaded = await loadStudentProfile();
        if (profileLoaded) {
            await loadAcademicRecords();
        }
    } catch (error) {
        console.error("Student dashboard failed to load:", error);
        showMessage(message, error.message || "Unable to load your school information.");
    }
}

void initialize();
