import { supabase, getSession, getUserProfile, getRoleDashboard } from "./supabase.js";
import { ASSESSMENTS, ASSESSMENT_BY_KEY, getAssessmentDetails, normalizeAssessmentMark } from "./assessment-config.js";
import { saveAssessmentRecords, updateAssessmentRecord } from "./results-persistence.js";

/* ──────────────────────────────────────────────────────────────
   CONSTANTS & WEIGHTS
────────────────────────────────────────────────────────────── */
const WEIGHTS = Object.fromEntries(ASSESSMENTS.map(({ key, label, max }) => [key, { max, label }]));
const ASSESS_KEYS = ASSESSMENTS.map(({ key }) => key);

/* ──────────────────────────────────────────────────────────────
   STATE
────────────────────────────────────────────────────────────── */
let currentUser = null;
let currentTeacher = null;
let allSubjects = [];
let subjectRows = [];
let resolvedStudent = null;
let lookupTimer = null;
let editingResultId = null;
let editingAssessmentKey = null;
let editingExamType = null;
let cachedRecordedResults = [];
let cachedStudentsMap = new Map();

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
    setupRecordedResultsControls();

    await loadSubjects();
    await loadRecordedResults();
}

/* ──────────────────────────────────────────────────────────────
   AUTHENTICATION & PROFILE
────────────────────────────────────────────────────────────── */
async function checkTeacherAuth() {
    const session = await getSession();
    const user = session?.user;

    if (!user) {
        window.location.href = "/login.html";
        return false;
    }

    currentUser = user;

    // Fetch profile safely
    const profile = await getUserProfile(user.id);
    const role = String(profile?.role || "").trim().toLowerCase();

    if (role && role !== "teacher" && role !== "admin") {
        const dest = getRoleDashboard(role);
        if (dest) window.location.href = dest;
        return false;
    }

    // Try fetching teacher details by user_id
    let teacherRecord = null;
    try {
        const { data } = await supabase
            .from("teachers")
            .select("id, teacher_id, first_name, last_name, photo_url")
            .eq("user_id", user.id)
            .maybeSingle();
        teacherRecord = data;
    } catch (e) {
        console.warn("Teacher record lookup notice:", e);
    }

    // Fallback: match by email
    if (!teacherRecord && user.email) {
        try {
            const { data } = await supabase
                .from("teachers")
                .select("id, teacher_id, first_name, last_name, photo_url")
                .ilike("email", user.email.trim())
                .maybeSingle();
            if (data) {
                teacherRecord = data;
                await supabase.from("teachers").update({ user_id: user.id }).eq("id", teacherRecord.id);
            }
        } catch (_) {}
    }

    currentTeacher = teacherRecord;

    const displayName = teacherRecord?.first_name
        ? `${teacherRecord.first_name} ${teacherRecord.last_name || ""}`.trim()
        : (profile?.first_name ? `${profile.first_name} ${profile.last_name || ""}`.trim() : "Teacher");

    const photo = teacherRecord?.photo_url || profile.photo_url || localStorage.getItem(`sululta_teacher_photo_${teacherRecord?.id}`);

    const headerNameEl = document.getElementById("teacherHeaderName");
    const avatarEl = document.getElementById("teacherAvatar");

    if (headerNameEl) headerNameEl.textContent = displayName;
    if (avatarEl) {
        if (photo) {
            avatarEl.innerHTML = `<img src="${photo}" alt="${displayName}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        } else {
            avatarEl.textContent = displayName[0] ? displayName[0].toUpperCase() : "T";
        }
    }

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
                .select("student_id, first_name, last_name, class, section")
                .ilike("student_id", val)
                .maybeSingle();

            if (data && !error) {
                resolvedStudent = data;
                const fullName = `${data.first_name || ""} ${data.last_name || ""}`.trim();
                if (studentNameInput) studentNameInput.value = fullName;

                if (previewEl) {
                    previewEl.className = "student-preview-pill ok";
                    const sec = data.section ? ` - Sec ${data.section}` : "";
                    previewEl.textContent = `✓ ${fullName} (${data.class || "Student"}${sec})`;
                    previewEl.style.display = "inline-block";
                }
            } else {
                if (previewEl) {
                    previewEl.className = "student-preview-pill err";
                    previewEl.textContent = `✕ No student found for "${val}"`;
                    previewEl.style.display = "inline-block";
                }
            }
            updateSummaryAndActions();
        }, 300);
    });
}

/* ──────────────────────────────────────────────────────────────
   SUBJECT ROW MANAGEMENT
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
                marks: Object.fromEntries(ASSESS_KEYS.map(key => [key, ""])),
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
                <td colspan="9" style="text-align: center; color: #94a3b8; padding: 2.25rem 1rem; font-size: 0.875rem;">
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

function getAssessmentKey(examType) {
    return getAssessmentDetails(examType).category || null;
}

/* ──────────────────────────────────────────────────────────────
   SUMMARY & ACTION STATE
────────────────────────────────────────────────────────────── */
function updateSummaryAndActions() {
    const summaryCard = document.getElementById("summaryCard");
    const saveBtn = document.getElementById("saveResultsBtn");

    const rowsWithMarks = subjectRows.filter(r =>
        ASSESS_KEYS.some(key => r.marks[key] !== "" && r.marks[key] != null)
    );

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
   SAVE OR UPDATE RESULTS
────────────────────────────────────────────────────────────── */
function setupSaveResults() {
    const saveBtn = document.getElementById("saveResultsBtn");
    if (!saveBtn) return;

    saveBtn.addEventListener("click", async () => {
        if (!resolvedStudent) {
            showToast("Please enter a valid Student ID first.", "error");
            return;
        }

        const rowsWithMarks = subjectRows.filter(r =>
            ASSESS_KEYS.some(key => r.marks[key] !== "" && r.marks[key] != null)
        );
        if (!rowsWithMarks.length) {
            showToast("Please add at least one subject with entered marks.", "error");
            return;
        }

        const academicYear = document.getElementById("academicYear")?.value || "2026/2027";
        const semester = document.getElementById("semester")?.value || "Semester 1";
        const examType = `${semester} — ${academicYear}`;

        saveBtn.disabled = true;
        saveBtn.textContent = editingResultId ? "Updating..." : "Saving...";

        try {
            if (editingResultId) {
                const r = rowsWithMarks[0];
                const updateData = editingAssessmentKey
                    ? {
                        student_id: resolvedStudent.student_id,
                        subject_code: r.code,
                        exam_type: editingExamType,
                        mark: Number(r.marks[editingAssessmentKey]),
                        max_mark: WEIGHTS[editingAssessmentKey].max,
                        grade: null,
                        remark: getPerformanceRemark(
                            Number(r.marks[editingAssessmentKey]) /
                            WEIGHTS[editingAssessmentKey].max * 100
                        ),
                        updated_at: new Date().toISOString()
                    }
                    : {
                        student_id: resolvedStudent.student_id,
                        subject_code: r.code,
                        exam_type: examType,
                        mark: r.total,
                        max_mark: 100,
                        remark: getPerformanceRemark(r.total),
                        updated_at: new Date().toISOString()
                    };
                await updateAssessmentRecord(supabase, editingResultId, updateData);

                showToast(`✓ Result for ${resolvedStudent.student_id} (${r.code}) updated successfully!`, "success");
                cancelReEdit();

            } else {
                const records = rowsWithMarks.flatMap(row =>
                    ASSESS_KEYS
                        .filter(key => row.marks[key] !== "" && row.marks[key] != null)
                        .map(key => {
                            const mark = Number(row.marks[key]);
                            const percentage = mark / WEIGHTS[key].max * 100;

                            return {
                                student_id: resolvedStudent.student_id,
                                subject_code: row.code,
                                exam_type: `${WEIGHTS[key].label} — ${semester} — ${academicYear}`,
                                mark,
                                max_mark: WEIGHTS[key].max,
                                grade: null,
                                remark: getPerformanceRemark(percentage),
                                recorded_by: currentUser?.id || null
                            };
                        })
                );

                await saveAssessmentRecords(supabase, records);

                const studentFullName = `${resolvedStudent.first_name || ""} ${resolvedStudent.last_name || ""}`.trim();
                showToast(`✓ Results saved successfully for ${studentFullName}! ${records.length} assessment mark(s) recorded.`, "success");

                // Reset form
                subjectRows = [];
                renderSubjectTable();
                refreshSubjectDropdown();
                document.getElementById("studentId").value = "";
                document.getElementById("studentName").value = "";
                const previewEl = document.getElementById("studentPreview");
                if (previewEl) previewEl.style.display = "none";
                resolvedStudent = null;
                updateSummaryAndActions();
            }

            // Reload recorded results table
            await loadRecordedResults();

        } catch (err) {
            console.error("Error saving results:", err);
            showToast(`Error saving results: ${err.message || err}`, "error");
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = editingResultId ? "💾 Update Student Result" : "Save Results";
        }
    });
}

/* ──────────────────────────────────────────────────────────────
   RECORDED STUDENT RESULTS & RE-EDIT ENGINE
────────────────────────────────────────────────────────────── */
async function loadRecordedResults() {
    const tbody = document.getElementById("recordedResultsTbody");
    if (!tbody) return;

    try {
        const [resultsRes, studentsRes] = await Promise.all([
            supabase
                .from("results")
                .select("id, student_id, subject_code, exam_type, mark, max_mark, remark, created_at, recorded_by")
                .order("created_at", { ascending: false }),
            supabase
                .from("students")
                .select("id, student_id, first_name, last_name, class, section")
        ]);

        cachedRecordedResults = resultsRes.data || [];
        const students = studentsRes.data || [];

        cachedStudentsMap.clear();
        students.forEach(s => {
            if (s.student_id) cachedStudentsMap.set(String(s.student_id).trim().toUpperCase(), s);
        });

        // Populate exam filter options
        const examFilter = document.getElementById("recordedExamFilter");
        if (examFilter) {
            const currentVal = examFilter.value;
            const uniqueExams = [...new Set(cachedRecordedResults.map(r => r.exam_type).filter(Boolean))].sort();
            examFilter.innerHTML = '<option value="">All Exams / Semesters</option>' +
                uniqueExams.map(ex => `<option value="${escapeHtml(ex)}" ${currentVal === ex ? "selected" : ""}>${escapeHtml(ex)}</option>`).join("");
        }

        renderRecordedResultsTable();

    } catch (err) {
        console.error("Error loading recorded results:", err);
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #ef4444; padding: 2rem;">Failed to load results.</td></tr>';
    }
}

function renderRecordedResultsTable() {
    const tbody = document.getElementById("recordedResultsTbody");
    if (!tbody) return;

    const search = document.getElementById("recordedSearchInput")?.value.trim().toLowerCase() || "";
    const examFilter = document.getElementById("recordedExamFilter")?.value || "";

    const filtered = cachedRecordedResults.filter(r => {
        const sid = String(r.student_id || "").toLowerCase();
        const sub = String(r.subject_code || "").toLowerCase();
        const exam = String(r.exam_type || "").toLowerCase();
        const st = cachedStudentsMap.get(String(r.student_id || "").trim().toUpperCase());
        const sName = st ? `${st.first_name || ""} ${st.last_name || ""}`.toLowerCase() : "";

        const matchSearch = !search || sid.includes(search) || sub.includes(search) || exam.includes(search) || sName.includes(search);
        const matchExam = !examFilter || r.exam_type === examFilter;
        return matchSearch && matchExam;
    });

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; color: #94a3b8; padding: 2.5rem 1rem;">
                    No recorded student results found matching your criteria.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map((r, i) => {
        const details = getAssessmentDetails(r.exam_type, r.max_mark);
        const assessmentKey = details.category;
        const maxMark = details.maxMark;
        const mark = normalizeAssessmentMark(r.mark, details) ?? 0;
        const pass = mark / maxMark * 100 >= 50;
        const sid = String(r.student_id || "").trim().toUpperCase();
        const st = cachedStudentsMap.get(sid);
        const sName = st ? `${st.first_name || ""} ${st.last_name || ""}`.trim() : "—";
        const classStr = st?.class ? `${st.class} ${st.section ? `(${st.section})` : ""}` : "—";

        return `
            <tr>
                <td><strong style="color: #64748b;">${i + 1}</strong></td>
                <td><strong>${escapeHtml(r.student_id || "N/A")}</strong></td>
                <td>${escapeHtml(sName)}</td>
                <td><span style="font-size: 0.8125rem; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-weight: 600;">${escapeHtml(classStr)}</span></td>
                <td><strong style="color: #4f46e5;">${escapeHtml(r.subject_code || "N/A")}</strong></td>
                <td><small style="color: #64748b; font-weight: 500;">${escapeHtml(r.exam_type || "N/A")}</small></td>
                <td><strong style="font-size: 0.9375rem; color: #0f172a;">${mark.toFixed(1)} / ${maxMark}</strong></td>
                <td>
                    <span class="status-pill ${pass ? "pass" : "fail"}">
                        ${pass ? "Pass" : "Fail"}
                    </span>
                </td>
                <td><small style="color: #475569; font-weight: 500;">${escapeHtml(r.remark || (pass ? "Pass" : "Fail"))}</small></td>
                <td style="text-align: center;">
                    <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
                        <button type="button" class="btn-back" style="padding: 4px 10px; font-size: 11px; background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; cursor: pointer; font-weight: 700; border-radius: 6px;" onclick="window.reEditResult('${r.id}')" title="Re-edit this result">
                            ✏️ Re-Edit
                        </button>
                        <button type="button" class="btn-remove-row" style="font-size: 13px; padding: 4px 6px;" onclick="window.deleteStudentResult('${r.id}')" title="Delete result">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

function setupRecordedResultsControls() {
    document.getElementById("recordedSearchInput")?.addEventListener("input", renderRecordedResultsTable);
    document.getElementById("recordedExamFilter")?.addEventListener("change", renderRecordedResultsTable);
    document.getElementById("refreshRecordedBtn")?.addEventListener("click", loadRecordedResults);
    document.getElementById("cancelReEditBtn")?.addEventListener("click", cancelReEdit);
}

/* ──────────────────────────────────────────────────────────────
   RE-EDIT RESULT ACTION
────────────────────────────────────────────────────────────── */
window.reEditResult = function(resultId) {
    const result = cachedRecordedResults.find(r => String(r.id) === String(resultId));
    if (!result) return;

    editingResultId = result.id;

    // 1. Fill Student ID
    const studentIdInput = document.getElementById("studentId");
    const studentNameInput = document.getElementById("studentName");
    const previewEl = document.getElementById("studentPreview");

    if (studentIdInput) studentIdInput.value = result.student_id;

    // 2. Resolve Student
    const sid = String(result.student_id || "").trim().toUpperCase();
    const st = cachedStudentsMap.get(sid);
    const fullName = st ? `${st.first_name || ""} ${st.last_name || ""}`.trim() : "Student";
    if (studentNameInput) studentNameInput.value = fullName;

    resolvedStudent = {
        student_id: result.student_id,
        first_name: st?.first_name || "",
        last_name: st?.last_name || "",
        class: st?.class || "",
        section: st?.section || ""
    };

    if (previewEl) {
        previewEl.className = "student-preview-pill ok";
        const sec = st?.section ? ` - Sec ${st.section}` : "";
        previewEl.textContent = `✓ ${fullName} (${st?.class || "Student"}${sec})`;
        previewEl.style.display = "inline-block";
    }

    // 3. Match Semester & Academic Year
    const examStr = String(result.exam_type || "");
    const semSelect = document.getElementById("semester");
    if (semSelect) {
        if (examStr.includes("Semester 2")) semSelect.value = "Semester 2";
        else semSelect.value = "Semester 1";
    }

    const yearSelect = document.getElementById("academicYear");
    if (yearSelect) {
        const yearMatch = examStr.match(/\d{4}\/\d{4}/);
        if (yearMatch && yearMatch[0]) {
            yearSelect.value = yearMatch[0];
        }
    }

    // 4. Populate Subject & Assessment breakdown
    const subjectMatch = allSubjects.find(s => s.subject_code === result.subject_code);
    const subName = subjectMatch ? subjectMatch.subject_name : (result.subject_code || "Subject");
    const markVal = parseFloat(result.mark) || 0;
    editingAssessmentKey = getAssessmentKey(result.exam_type);
    editingExamType = result.exam_type;
    const resultDetails = getAssessmentDetails(result.exam_type, result.max_mark);
    const normalizedMark = normalizeAssessmentMark(markVal, resultDetails) ?? markVal;
    const markMaximum = resultDetails.maxMark;

    let marks;
    if (editingAssessmentKey) {
        marks = Object.fromEntries(ASSESS_KEYS.map(key => [key, ""]));
        marks[editingAssessmentKey] = normalizedMark;
    } else {
        let remaining = normalizedMark;
        marks = Object.fromEntries(ASSESS_KEYS.map(key => {
            const value = Math.min(ASSESSMENT_BY_KEY[key].max, remaining);
            remaining = Math.max(0, remaining - value);
            return [key, Math.round(value * 10) / 10];
        }));
    }

    subjectRows = [{
        code: result.subject_code,
        name: subName,
        marks,
        total: editingAssessmentKey ? calculateRowTotal(marks) : normalizedMark
    }];

    renderSubjectTable();
    refreshSubjectDropdown();

    // 5. Active Editing Banner
    const banner = document.getElementById("editingBanner");
    const bannerText = document.getElementById("editingBannerText");
    if (banner && bannerText) {
        bannerText.textContent = `Now Re-Editing result for ${result.student_id} (${subName} — ${markVal}/${markMaximum})`;
        banner.style.display = "flex";
    }

    // 6. Update Save Button
    const saveBtn = document.getElementById("saveResultsBtn");
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = `💾 Update Result for ${result.student_id}`;
    }

    // 7. Scroll to editor
    studentIdInput?.scrollIntoView({ behavior: "smooth", block: "center" });

    showToast(`Loaded result for ${result.student_id}. Make your adjustments in the table and click 'Update Result'.`, "success");
};

function cancelReEdit() {
    editingResultId = null;
    editingAssessmentKey = null;
    editingExamType = null;

    const banner = document.getElementById("editingBanner");
    if (banner) banner.style.display = "none";

    const saveBtn = document.getElementById("saveResultsBtn");
    if (saveBtn) saveBtn.textContent = "Save Results";

    // Clear form
    subjectRows = [];
    renderSubjectTable();
    refreshSubjectDropdown();
    document.getElementById("studentId").value = "";
    document.getElementById("studentName").value = "";
    const previewEl = document.getElementById("studentPreview");
    if (previewEl) previewEl.style.display = "none";
    resolvedStudent = null;
    updateSummaryAndActions();
}

window.deleteStudentResult = async function(resultId) {
    if (!confirm("Are you sure you want to delete this student result? This action cannot be undone.")) return;

    try {
        const { error } = await supabase.from("results").delete().eq("id", resultId);
        if (error) throw error;
        showToast("Student result deleted successfully.", "success");
        await loadRecordedResults();
    } catch (err) {
        console.error("Delete error:", err);
        showToast("Error deleting result: " + err.message, "error");
    }
};

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

    downloadTemplateBtn?.addEventListener("click", downloadTeacherExcelTemplate);
    clearBtn?.addEventListener("click", () => {
        parsedExcelRows = [];
        if (fileInput) fileInput.value = "";
        const preview = document.getElementById("excelPreviewContainer");
        if (preview) preview.style.display = "none";
    });

    fileInput?.addEventListener("change", handleTeacherExcelFileSelect);
    sendBtn?.addEventListener("click", handleSendExcelReportToAdmin);
}

function handleTeacherExcelFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        try {
            let json = [];
            if (typeof XLSX !== "undefined") {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: "array" });
                const firstSheetName = workbook.SheetNames[0];
                json = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName]);
            }

            if (!json.length) {
                alert("The selected Excel file is empty or formatted incorrectly.");
                return;
            }

            // Normalize fields
            parsedExcelRows = [];
            json.forEach(row => {
                const sid = row["Student ID"] || row["student_id"] || row["ID"];
                const sname = row["Student Name"] || row["student_name"] || row["Name"] || "Student";
                const mark = parseFloat(row["Mark"] || row["mark"] || row["Score"] || 0);
                const remark = row["Remark"] || row["remark"] || (mark >= 50 ? "Pass" : "Fail");

                if (sid) {
                    parsedExcelRows.push({
                        student_id: String(sid).trim().toUpperCase(),
                        student_name: sname,
                        mark: mark,
                        remark: remark
                    });
                }
            });

            if (!parsedExcelRows.length) {
                alert("Could not find required columns ('Student ID', 'Mark') in the uploaded file.");
                return;
            }

            renderTeacherExcelPreview();

        } catch (err) {
            console.error("Excel parse error:", err);
            alert("Error parsing Excel file: " + err.message);
        }
    };

    reader.readAsArrayBuffer(file);
}

function renderTeacherExcelPreview() {
    const container = document.getElementById("excelPreviewContainer");
    const tbody = document.getElementById("excelPreviewTbody");
    const title = document.getElementById("excelPreviewTitle");
    const statsPills = document.getElementById("excelStatsPills");

    if (!container || !tbody) return;

    const total = parsedExcelRows.length;
    const examType = document.getElementById("excelExamType")?.value || "Semester 1 Final Exam";
    const maximum = getAssessmentDetails(examType).maxMark;
    const passed = parsedExcelRows.filter(r => r.mark / maximum * 100 >= 50).length;
    const failed = total - passed;
    const passPct = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;
    const failPct = total > 0 ? ((failed / total) * 100).toFixed(1) : 0;

    if (title) title.textContent = `Parsed Results Preview (${total} Students)`;

    if (statsPills) {
        statsPills.innerHTML = `
            <span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;">
                Pass: ${passed} (${passPct}%)
            </span>
            <span style="background: #fee2e2; color: #b91c1c; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;">
                Fail: ${failed} (${failPct}%)
            </span>
        `;
    }

    tbody.innerHTML = parsedExcelRows.map((r, i) => `
        <tr>
            <td><strong>${i + 1}</strong></td>
            <td><strong>${escapeHtml(r.student_id)}</strong></td>
            <td>${escapeHtml(r.student_name)}</td>
            <td><strong>${r.mark} / ${maximum}</strong></td>
            <td>
                <span class="status-pill ${r.mark / maximum * 100 >= 50 ? "pass" : "fail"}">
                    ${r.mark / maximum * 100 >= 50 ? "Pass" : "Fail"}
                </span>
            </td>
            <td><small style="color: #64748b;">${escapeHtml(r.remark)}</small></td>
        </tr>
    `).join("");

    container.style.display = "block";
}

async function handleSendExcelReportToAdmin() {
    if (!parsedExcelRows.length) {
        alert("Please choose a valid Excel file first.");
        return;
    }

    const subject = document.getElementById("excelSubjectSelect")?.value;
    const className = document.getElementById("excelClassSelect")?.value;
    const examType = document.getElementById("excelExamType")?.value || "Semester 1 Final Exam";
    const assessment = getAssessmentDetails(examType);
    const maxMark = assessment.maxMark;

    if (!subject) {
        alert("Please select the Subject for this report.");
        return;
    }
    const invalidRow = parsedExcelRows.find(row => row.mark < 0 || row.mark > maxMark);
    if (invalidRow) {
        alert(`Marks for ${examType} must be between 0 and ${maxMark}. Check student ${invalidRow.student_id}.`);
        return;
    }

    const sendBtn = document.getElementById("sendExcelToAdminBtn");
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.textContent = "Sending to Admin...";
    }

    try {
        const STORAGE_TEACHER_REPORTS = "sululta_teacher_excel_reports";
        let existingReports = [];
        try {
            const raw = localStorage.getItem(STORAGE_TEACHER_REPORTS);
            if (raw) existingReports = JSON.parse(raw);
        } catch (e) {}

        const total = parsedExcelRows.length;
        const passed = parsedExcelRows.filter(r => r.mark / maxMark * 100 >= 50).length;
        const failed = total - passed;
        const passPct = total > 0 ? ((passed / total) * 100).toFixed(1) + "%" : "0%";
        const failPct = total > 0 ? ((failed / total) * 100).toFixed(1) + "%" : "0%";
        const examType = document.getElementById("excelExamType")?.value || "Semester 1 Final Exam";
        const maxMark = getAssessmentDetails(examType).maxMark;

        const teacherName = currentTeacher?.first_name 
            ? `${currentTeacher.first_name} ${currentTeacher.last_name || ""}`.trim()
            : "Assigned Teacher";

        // Insert / sync to database results table
        const dbInserts = parsedExcelRows.map(r => ({
            student_id: r.student_id,
            subject_code: subject,
            exam_type: examType,
            mark: r.mark,
            max_mark: maxMark,
            remark: r.remark,
            recorded_by: currentUser?.id || null,
            created_at: new Date().toISOString()
        }));

        await saveAssessmentRecords(supabase, dbInserts);

        const newReport = {
            id: "rep_" + Date.now(),
            teacher_name: teacherName,
            subject_name: subject,
            subject_code: subject,
            class_name: className || "Secondary Grade",
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

        await loadRecordedResults();

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
