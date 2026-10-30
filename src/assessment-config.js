export const ASSESSMENTS = Object.freeze([
    { key: "quiz", label: "Quiz", max: 20, previousMax: 10 },
    { key: "test", label: "Test", max: 20, previousMax: 20 },
    { key: "assignment", label: "Assignment", max: 10, previousMax: 10 },
    { key: "classwork", label: "Classwork", max: 10, previousMax: 10 },
    { key: "midterm", label: "Midterm Exam", max: 20, previousMax: 25 },
    { key: "final", label: "Final Exam", max: 20, previousMax: 35 }
]);

export const ASSESSMENT_BY_KEY = Object.freeze(
    Object.fromEntries(ASSESSMENTS.map(assessment => [assessment.key, assessment]))
);

const ASSESSMENT_PATTERN = /^\s*(Assignment|Classwork|Quiz(?:zes)?|Test|Mid[\s-]*term(?:\s+Exam)?|Final(?:\s+Exam)?)(?:\s*[—–-]\s*(.*))?$/i;

export function getAssessmentDetails(examType, storedMaxMark = null) {
    const value = String(examType || "").trim();
    const match = value.match(ASSESSMENT_PATTERN);
    if (!match) {
        return { category: "", session: `legacy:${value}`, maxMark: 100, sourceMaxMark: Number(storedMaxMark) || 100 };
    }

    const label = match[1].toLowerCase().replace(/\s+/g, " ");
    const category = label.startsWith("quiz")
        ? "quiz"
        : label.startsWith("final")
            ? "final"
            : label.startsWith("mid")
                ? "midterm"
                : label.replace(/\s+/g, "");
    const assessment = ASSESSMENT_BY_KEY[category];

    return {
        category,
        session: (match[2] || "unspecified").trim(),
        maxMark: assessment.max,
        sourceMaxMark: Number(storedMaxMark) > 0
            ? Number(storedMaxMark)
            : assessment.previousMax
    };
}

export function normalizeAssessmentMark(mark, details) {
    const value = Number(mark);
    if (!Number.isFinite(value)) return null;
    if (!details.category) return Math.min(100, Math.max(0, value));
    const sourceMax = details.sourceMaxMark > 0 ? details.sourceMaxMark : details.maxMark;
    return Math.min(details.maxMark, Math.max(0, value / sourceMax * details.maxMark));
}
