import { supabase } from "./supabase.js";

/* ──────────────────────────────────────────────────────────────
   CONSTANTS & WEIGHTS
────────────────────────────────────────────────────────────── */
const WEIGHTS = {
    assignment: { max: 10, label: "Assignment" },
    quiz:       { max: 10, label: "Quiz" },
    test:       { max: 20, label: "Test" },
    midterm:    { max: 25, label: "Midterm" },
    final:      { max: 35, label: "Final Exam" }
};
const ASSESS_KEYS = Object.keys(WEIGHTS);

/* ──────────────────────────────────────────────────────────────
   STATE
────────────────────────────────────────────────────────────── */
let currentUser = null;
let currentTeacher = null;
let allSubjects = [];
let subjectRows = [];
let resolvedStudent = null;
let lookupTimer = null;

/* ──────────────────────────────────────────────────────────────
   INIT ON DOM READY
────────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", initTeacherResults);

async function initTeacherResults() {
    setupSidebarAndLogout();

    const authenticated = await checkTeacherAuth();
    if (!authenticated) return;

    setupStudentLookup();
    setupAddSubject();
    setupSaveResults();
    setupExcelTeacherUpload();

    await loadSubjects();
}

/* ──────────────────────────────────────────────────────────────
   AUTHENTICATION & PROFILE
────────────────────────────────────────────────────────────── */
async function checkTeacherAuth() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        window.location.href = "/login.html";
        return false;
    }

    currentUser = user;

    // Fetch profile
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, role, status, first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile) {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return false;
    }

    const role = String(profile.role || "").trim().toLowerCase();
    const status = String(profile.status || "").trim().toLowerCase();

    if ((role !== "teacher" && role !== "admin") || status !== "active") {
        await supabase.auth.signOut();
        window.location.href = "/login.html";
        return false;
    }

    // Try fetching teacher details
    const { data: teacherRecord } = await supabase
        .from("teachers")
        .select("id, teacher_id, first_name, last_name, photo_url")
        .eq("user_id", user.id)
        .maybeSingle();

    currentTeacher = teacherRecord;

    const displayName = teacherRecord?.first_name
        ? `${teacherRecord.first_name} ${teacherRecord.last_name || ""}`.trim()
        : (profile.first_name ? `${profile.first_name} ${profile.last_name || ""}`.trim() : "Teacher");

    const headerNameEl = document.getElementById("teacherHeaderName");
    const avatarEl = document.getElementById("teacherAvatar");

    if (headerNameEl) headerNameEl.textContent = displayName;
    if (avatarEl) avatarEl.textContent = displayName[0] ? displayName[0].toUpperCase() : "T";

    return true;
}

/* ──────────────────────────────────────────────────────────────
   SIDEBAR & LOGOUT
────────────────────────────────────────────────────────────── */
function setupSidebarAndLogout() {
    const sidebarToggle = document.getElementById("sidebarToggle");
    const adminSidebar = document.getElementById("adminSidebar");
    if (sidebarToggle && adminSidebar) {
        sidebarToggle.addEventListener("click", () => {
            adminSidebar.classList.toggle("mobile-open");
        });
    }

    const logoutBtn = document.getElementById("logoutButton");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            await supabase.auth.signOut();
            window.location.href = "/login.html";
        });
    }
}

/* ──────────────────────────────────────────────────────────────
   LOAD SUBJECTS
────────────────────────────────────────────────────────────── */
async function loadSubjects() {
    const sel = document.getElementById("addSubjectSelect");
    const addBtn = document.getElementById("addSubjectBtn");

    const { data, error } = await supabase
        .from("subjects")
        .select("subject_code, subject_name")
        .order("subject_name");

    if (error || !data || !data.length) {
        if (sel) sel.innerHTML = '<option value="">No subjects found</option>';
        if (addBtn) addBtn.disabled = true;
        return;
    }

    allSubjects = data;
    refreshSubjectDropdown();
}

function refreshSubjectDropdown() {
    const sel = document.getElementById("addSubjectSelect");
    const addBtn = document.getElementById("addSubjectBtn");
    if (!sel) return;

    const usedCodes = subjectRows.map(r => r.code);
    const available = allSubjects.filter(s => !usedCodes.includes(s.subject_code));

    if (!available.length) {
        sel.innerHTML = '<option value="">All subjects added</option>';
        if (addBtn) addBtn.disabled = true;
        return;
    }

    sel.innerHTML = '<option value="">— Select Subject —</option>' +
        available.map(s => `<option value="${s.subject_code}">${escapeHtml(s.subject_name)} (${escapeHtml(s.subject_code)})</option>`).join("");

    if (addBtn) addBtn.disabled = false;
}

/* ──────────────────────────────────────────────────────────────
   STUDENT LOOKUP
────────────────────────────────────────────────────────────── */
function setupStudentLookup() {
    const studentIdInput = document.getElementById("studentId");
    const studentNameInput = document.getElementById("studentName");
    const previewEl = document.getElementById("studentPreview");

    if (!studentIdInput) return;

    studentIdInput.addEventListener("input", () => {
        clearTimeout(lookupTimer);
        const val = studentIdInput.value.trim();
        resolvedStudent = null;
        if (studentNameInput) studentNameInput.value = "";
        if (previewEl) {
            previewEl.style.display = "none";
            previewEl.className = "student-preview-pill";
            previewEl.textContent = "";
        }
        updateSummaryAndActions();

        if (!val) return;

        lookupTimer = setTimeout(async () => {
            const { data, error } = await supabase
                .from("students")
                .select("student_id, first_name, last_name, class")
                .ilike("student_id", val)
                .maybeSingle();

            if (data && !error) {
                resolvedStudent = data;
                const fullName = `${data.first_name || ""} ${data.last_name || ""}`.trim();
                if (studentNameInput) studentNameInput.value = fullName;

                if (previewEl) {
                    previewEl.className = "student-preview-pill ok";
                    previewEl.textContent = `✓ ${fullName}${data.class ? " — " + data.class : ""}`;
                    previewEl.style.display = "inline-block";
                }
            } else {
                resolvedStudent = null;
                if (previewEl) {
                    previewEl.className = "student-preview-pill err";
                    previewEl.textContent = "⚠ Student ID not found";
                    previewEl.style.display = "inline-block";
                }
            }

            updateSummaryAndActions();
        }, 350);
    });
}

/* ──────────────────────────────────────────────────────────────
   ADD & RENDER SUBJECTS
────────────────────────────────────────────────────────────── */
function setupAddSubject() {
    const addBtn = document.getElementById("addSubjectBtn");
    const sel = document.getElementById("addSubjectSelect");

    if (addBtn && sel) {
        addBtn.addEventListener("click", () => {
            const code = sel.value;
            if (!code) return;

            const found = allSubjects.find(s => s.subject_code === code);
            if (!found) return;

            subjectRows.push({
                code: found.subject_code,
                name: found.subject_name,
                marks: { assignment: "", quiz: "", test: "", midterm: "", final: "" },
                total: 0
            });

            renderSubjectTable();
            refreshSubjectDropdown();
        });
    }
}

function renderSubjectTable() {
    const tbody = document.getElementById("subjectRowsBody");
    if (!tbody) return;

    if (!subjectRows.length) {
        tbody.innerHTML = `
            <tr id="emptySubjectRow">
                <td colspan="8" style="text-align: center; color: #94a3b8; padding: 2.25rem 1rem; font-size: 0.875rem;">
                    No subjects added yet. Use the form below to add subjects.
                </td>
            </tr>
        `;
        updateSummaryAndActions();
        return;
    }

    tbody.innerHTML = subjectRows.map((row, idx) => `
        <tr data-row-idx="${idx}">
            <td class="td-subject">
                <strong>${escapeHtml(row.name)}</strong>
                <small>${escapeHtml(row.code)}</small>
            </td>
            ${ASSESS_KEYS.map(key => `
                <td>
                    <input type="number"
                        min="0"
                        max="${WEIGHTS[key].max}"
                        step="0.5"
                        class="assess-input"
                        data-idx="${idx}"
                        data-key="${key}"
                        value="${row.marks[key]}"
                        placeholder="/${WEIGHTS[key].max}">
                </td>
            `).join("")}
            <td>
                <span class="subject-total-badge ${row.total >= 50 ? "pass" : (row.total > 0 ? "fail" : "")}" id="row-total-${idx}">
                    ${row.total > 0 ? row.total.toFixed(1) : "—"}
                </span>
            </td>
            <td>
                <button type="button" class="btn-remove-row" data-idx="${idx}" title="Remove subject">✕</button>
            </td>
        </tr>
    `).join("");

    // Attach listeners
    tbody.querySelectorAll(".assess-input").forEach(inp => {
        inp.addEventListener("input", handleMarkInput);
    });

    tbody.querySelectorAll(".btn-remove-row").forEach(btn => {
        btn.addEventListener("click", () => {
            const idx = parseInt(btn.dataset.idx, 10);
            subjectRows.splice(idx, 1);
            renderSubjectTable();
            refreshSubjectDropdown();
        });
    });

    updateSummaryAndActions();
}

function handleMarkInput(e) {
    const idx = parseInt(e.target.dataset.idx, 10);
    const key = e.target.dataset.key;
    const max = WEIGHTS[key].max;
    let val = e.target.value === "" ? "" : parseFloat(e.target.value);

    // Clamping to allowed range
    if (val !== "") {
        if (isNaN(val)) val = "";
        else if (val > max) { val = max; e.target.value = max; }
        else if (val < 0) { val = 0; e.target.value = 0; }
    }

    subjectRows[idx].marks[key] = val;
    subjectRows[idx].total = calculateRowTotal(subjectRows[idx].marks);

    // Update cell total directly to preserve input focus
    const cellEl = document.getElementById(`row-total-${idx}`);
    if (cellEl) {
        const t = subjectRows[idx].total;
        cellEl.textContent = t > 0 ? t.toFixed(1) : "—";
        cellEl.className = `subject-total-badge ${t >= 50 ? "pass" : (t > 0 ? "fail" : "")}`;
    }

    updateSummaryAndActions();
}

function calculateRowTotal(marks) {
    let sum = 0;
    let entered = false;
    ASSESS_KEYS.forEach(key => {
        const v = parseFloat(marks[key]);
        if (!isNaN(v) && marks[key] !== "") {
            sum += v;
            entered = true;
        }
    });
    return entered ? Math.min(100, Math.round(sum * 10) / 10) : 0;
}

function getPerformanceRemark(avg) {
    if (avg >= 90) return "Excellent";
    if (avg >= 80) return "Very Good";
    if (avg >= 70) return "Good";
    if (avg >= 60) return "Satisfactory";
    if (avg >= 50) return "Pass";
    return "Fail";
}

/* ──────────────────────────────────────────────────────────────
   SUMMARY & ACTION STATE
────────────────────────────────────────────────────────────── */
function updateSummaryAndActions() {
    const summaryCard = document.getElementById("summaryCard");
    const saveBtn = document.getElementById("saveResultsBtn");

    const rowsWithMarks = subjectRows.filter(r => r.total > 0);

    if (!rowsWithMarks.length) {
        if (summaryCard) summaryCard.style.display = "none";
        if (saveBtn) saveBtn.disabled = true;
        return;
    }

    if (summaryCard) summaryCard.style.display = "block";

    const count = rowsWithMarks.length;
    const totalMarks = rowsWithMarks.reduce((acc, r) => acc + r.total, 0);
    const avg = totalMarks / count;
    const remark = getPerformanceRemark(avg);
    const pass = avg >= 50;

    const sumSubjects = document.getElementById("sumSubjects");
    const sumTotal = document.getElementById("sumTotal");
    const sumAverage = document.getElementById("sumAverage");
    const sumRemark = document.getElementById("sumRemark");
    const sumStatus = document.getElementById("sumStatus");

    if (sumSubjects) sumSubjects.textContent = count;
    if (sumTotal) sumTotal.textContent = totalMarks.toFixed(1);
    if (sumAverage) sumAverage.textContent = avg.toFixed(1);
    if (sumRemark) sumRemark.textContent = remark;

    if (sumStatus) {
        sumStatus.textContent = pass ? "Pass" : "Fail";
        sumStatus.className = `status-pill ${pass ? "pass" : "fail"}`;
    }

    if (saveBtn) {
        saveBtn.disabled = !resolvedStudent;
    }
}

/* ──────────────────────────────────────────────────────────────
   SAVE RESULTS
────────────────────────────────────────────────────────────── */
function setupSaveResults() {
    const saveBtn = document.getElementById("saveResultsBtn");
    if (!saveBtn) return;

    saveBtn.addEventListener("click", async () => {
        if (!resolvedStudent) {
            showToast("Please enter a valid Student ID first.", "error");
            return;
        }

        const rowsWithMarks = subjectRows.filter(r => r.total > 0);
        if (!rowsWithMarks.length) {
            showToast("Please add at least one subject with entered marks.", "error");
            return;
        }

        const academicYear = document.getElementById("academicYear")?.value || "2026/2027";
        const semester = document.getElementById("semester")?.value || "Semester 1";
        const examType = `${semester} — ${academicYear}`;

        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        const inserts = rowsWithMarks.map(r => ({
            student_id:   resolvedStudent.student_id,
            subject_code: r.code,
            exam_type:    examType,
            mark:         r.total,
            grade:        null,
            remark:       getPerformanceRemark(r.total),
            recorded_by:  currentUser?.id || null
        }));

        try {
            // Remove previous entries for this student & semester to allow seamless update
            await supabase
                .from("results")
                .delete()
                .eq("student_id", resolvedStudent.student_id)
                .eq("exam_type", examType);

            const { error: insertError } = await supabase
                .from("results")
                .insert(inserts);

            if (insertError) {
                throw insertError;
            }

            const studentFullName = `${resolvedStudent.first_name || ""} ${resolvedStudent.last_name || ""}`.trim();
            showToast(`Results saved successfully for ${studentFullName}! ${inserts.length} subject(s) recorded.`, "success");

            // Reset form for next entry or offer quick return
            setTimeout(() => {
                subjectRows = [];
                renderSubjectTable();
                refreshSubjectDropdown();
                document.getElementById("studentId").value = "";
                document.getElementById("studentName").value = "";
                const previewEl = document.getElementById("studentPreview");
                if (previewEl) previewEl.style.display = "none";
                resolvedStudent = null;
                updateSummaryAndActions();
                saveBtn.disabled = true;
                saveBtn.textContent = "Save Results";
            }, 1800);

        } catch (err) {
            console.error("Error saving results:", err);
            showToast(`Error saving results: ${err.message || err}`, "error");
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Results";
        }
    });
}

/* ──────────────────────────────────────────────────────────────
   HELPERS
────────────────────────────────────────────────────────────── */
function showToast(text, type) {
    const el = document.getElementById("messageToast");
    if (!el) return;
    el.textContent = text;
    el.className = `message-toast ${type}`;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function escapeHtml(str) {
    return String(str ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ──────────────────────────────────────────────────────────────
   TEACHER EXCEL BULK UPLOAD & SEND TO ADMIN
────────────────────────────────────────────────────────────── */
let parsedExcelRows = [];

function setupExcelTeacherUpload() {
    const fileInput = document.getElementById("excelFileInput");
    const downloadTemplateBtn = document.getElementById("teacherDownloadTemplateBtn");
    const sendBtn = document.getElementById("sendExcelToAdminBtn");
    const clearBtn = document.getElementById("clearExcelBtn");
    const subjectSelect = document.getElementById("excelSubjectSelect");

    // Populate subject select once allSubjects loaded
    const checkSubjects = setInterval(() => {
        if (allSubjects && allSubjects.length > 0 && subjectSelect) {
            clearInterval(checkSubjects);
            subjectSelect.innerHTML = '<option value="">Select Subject</option>' +
                allSubjects.map(s => `<option value="${s.subject_code}">${escapeHtml(s.subject_name)} (${s.subject_code})</option>`).join("");
        }
    }, 200);

    downloadTemplateBtn?.addEventListener("click", () => {
        downloadTeacherExcelTemplate();
    });

    fileInput?.addEventListener("change", (e) => {
        handleTeacherExcelSelect(e);
    });

    clearBtn?.addEventListener("click", () => {
        parsedExcelRows = [];
        if (fileInput) fileInput.value = "";
        const preview = document.getElementById("excelPreviewContainer");
        if (preview) preview.style.display = "none";
    });

    sendBtn?.addEventListener("click", async () => {
        await submitExcelReportToAdmin();
    });
}

function handleTeacherExcelSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            let json = [];
            if (typeof XLSX !== "undefined") {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const firstSheet = workbook.SheetNames[0];
                json = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
            }

            if (!json || !json.length) {
                alert("The selected Excel file is empty or does not have standard columns.");
                return;
            }

            parsedExcelRows = [];
            json.forEach(row => {
                const sid = row["Student ID"] || row["student_id"] || row["StudentID"] || row["ID"];
                const name = row["Student Name"] || row["student_name"] || row["Name"] || "Student";
                const mark = parseFloat(row["Mark"] || row["mark"] || row["Score"] || row["Total"] || 0);
                const remark = row["Remark"] || row["remark"] || (mark >= 50 ? "Pass" : "Fail");

                if (sid) {
                    parsedExcelRows.push({
                        student_id: String(sid).trim().toUpperCase(),
                        student_name: String(name).trim(),
                        mark: mark,
                        status: mark >= 50 ? "PASS" : "FAIL",
                        remark: remark
                    });
                }
            });

            if (!parsedExcelRows.length) {
                alert("Could not find any student records. Ensure column names are 'Student ID' and 'Mark'.");
                return;
            }

            renderTeacherExcelPreview();

        } catch (err) {
            console.error("Error reading Excel file:", err);
            alert("Error parsing Excel file: " + err.message);
        }
    };

    reader.readAsArrayBuffer(file);
}

function renderTeacherExcelPreview() {
    const container = document.getElementById("excelPreviewContainer");
    const tbody = document.getElementById("excelPreviewTbody");
    const pills = document.getElementById("excelStatsPills");
    const title = document.getElementById("excelPreviewTitle");
    if (!container || !tbody) return;

    const total = parsedExcelRows.length;
    const passed = parsedExcelRows.filter(r => r.mark >= 50).length;
    const failed = total - passed;
    const passPct = ((passed / total) * 100).toFixed(1) + "%";
    const failPct = ((failed / total) * 100).toFixed(1) + "%";

    if (title) title.textContent = `Parsed ${total} Student Results`;
    if (pills) {
        pills.innerHTML = `
            <span style="background:#ecfdf5;color:#065f46;font-weight:700;padding:3px 10px;border-radius:20px;font-size:0.75rem;">${passed} Passed (${passPct})</span>
            <span style="background:#fef2f2;color:#991b1b;font-weight:700;padding:3px 10px;border-radius:20px;font-size:0.75rem;">${failed} Failed (${failPct})</span>
        `;
    }

    tbody.innerHTML = parsedExcelRows.map((r, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${escapeHtml(r.student_id)}</strong></td>
            <td>${escapeHtml(r.student_name)}</td>
            <td><strong>${r.mark}</strong></td>
            <td>
                <span class="status-pill ${r.status === 'PASS' ? 'pass' : 'fail'}" style="font-size:0.75rem;padding:2px 8px;">
                    ${r.status}
                </span>
            </td>
            <td>${escapeHtml(r.remark)}</td>
        </tr>
    `).join("");

    container.style.display = "block";
}

async function submitExcelReportToAdmin() {
    if (!parsedExcelRows.length) {
        alert("Please upload and preview an Excel file first.");
        return;
    }

    const subject = document.getElementById("excelSubjectSelect")?.value;
    const className = document.getElementById("excelClassSelect")?.value;
    const examType = document.getElementById("excelExamType")?.value || "Semester 1 Final Exam";

    if (!subject) {
        alert("Please select the Subject for this report.");
        return;
    }

    const sendBtn = document.getElementById("sendExcelToAdminBtn");
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = "Sending to Admin...";
    }

    const teacherName = currentTeacher
        ? `${currentTeacher.first_name} ${currentTeacher.last_name || ""}`.trim()
        : "Teacher";

    const total = parsedExcelRows.length;
    const passed = parsedExcelRows.filter(r => r.mark >= 50).length;
    const failed = total - passed;
    const passPct = ((passed / total) * 100).toFixed(1) + "%";
    const failPct = ((failed / total) * 100).toFixed(1) + "%";

    const inserts = parsedExcelRows.map(r => ({
        student_id:   r.student_id,
        subject_code: subject,
        exam_type:    examType,
        mark:         r.mark,
        grade:        null,
        remark:       r.remark || (r.mark >= 50 ? "Pass" : "Fail"),
        recorded_by:  currentUser?.id || null
    }));

    try {
        // 1. Insert/update to database results table
        const { error: insertError } = await supabase.from("results").insert(inserts);
        if (insertError) {
            console.warn("Database notice during batch insert (local report will still be sent):", insertError);
        }

        // 2. Log submission in shared teacher report storage for admin
        const STORAGE_TEACHER_REPORTS = "sululta_teacher_excel_reports";
        let existingReports = [];
        try {
            existingReports = JSON.parse(localStorage.getItem(STORAGE_TEACHER_REPORTS) || "[]");
        } catch (e) {}

        const newReport = {
            id: "rep_" + Date.now(),
            teacher_name: teacherName,
            subject_name: subject,
            subject_code: subject,
            class_name: className || "Assigned Class",
            exam_type: examType,
            submitted_at: new Date().toISOString(),
            total_students: total,
            passed_count: passed,
            failed_count: failed,
            pass_rate: passPct,
            fail_rate: failPct,
            records: parsedExcelRows.map(r => ({ ...r, subject_code: subject, exam_type: examType }))
        };

        existingReports.unshift(newReport);
        try {
            localStorage.setItem(STORAGE_TEACHER_REPORTS, JSON.stringify(existingReports));
        } catch (e) {}

        alert(`🎉 Results Successfully Sent to Admin!\n\nSubject: ${subject}\nClass: ${className || "N/A"}\nTotal Students: ${total}\nPassed: ${passed} (${passPct})\nFailed: ${failed} (${failPct})\n\nThe report is now visible on the Admin Dashboard.`);

        // Clear preview
        parsedExcelRows = [];
        const fileInput = document.getElementById("excelFileInput");
        if (fileInput) fileInput.value = "";
        const preview = document.getElementById("excelPreviewContainer");
        if (preview) preview.style.display = "none";

    } catch (err) {
        console.error("Submit error:", err);
        alert("Error sending report: " + err.message);
    } finally {
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.textContent = "🚀 Send Report to Admin";
        }
    }
}

function downloadTeacherExcelTemplate() {
    const templateRows = [
        { "Student ID": "STU001", "Student Name": "Abebe Bekele", "Mark": 85, "Remark": "Excellent" },
        { "Student ID": "STU002", "Student Name": "Chaltu Desta", "Mark": 64, "Remark": "Good" },
        { "Student ID": "STU003", "Student Name": "Dawit Tolosa", "Mark": 42, "Remark": "Needs Remedial" },
        { "Student ID": "STU004", "Student Name": "Fatuma Ahmed", "Mark": 91, "Remark": "Distinction" },
        { "Student ID": "STU005", "Student Name": "Gamachu Megersa", "Mark": 38, "Remark": "Needs Improvement" }
    ];

    if (typeof XLSX !== "undefined") {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateRows);
        XLSX.utils.book_append_sheet(wb, ws, "Marks Template");
        XLSX.writeFile(wb, "Sululta_Teacher_Marks_Template.xlsx");
    } else {
        const csv = "Student ID,Student Name,Mark,Remark\r\nSTU001,Abebe Bekele,85,Excellent\r\nSTU002,Chaltu Desta,64,Good\r\nSTU003,Dawit Tolosa,42,Needs Remedial";
        const link = document.createElement("a");
        link.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
        link.download = "Sululta_Teacher_Marks_Template.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
