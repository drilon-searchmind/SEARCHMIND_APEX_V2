/**
 * Shared channel audit scoring and executive-summary alignment (API + UI).
 */

export function gradeFromNumericScore(score) {
    if (score == null || !Number.isFinite(Number(score))) return "—";
    const s = Number(score);
    if (s >= 90) return "A";
    if (s >= 75) return "B";
    if (s >= 60) return "C";
    if (s >= 40) return "D";
    return "F";
}

export function meanChannelHealthFromReport(report) {
    const channels = Array.isArray(report?.channels) ? report.channels : [];
    const nums = channels
        .map((c) => c.healthScore)
        .filter((n) => n != null && Number.isFinite(Number(n)))
        .map(Number);
    if (nums.length === 0) return { score: null, grade: "—" };
    const score = Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
    return { score, grade: gradeFromNumericScore(score) };
}

/**
 * Remove opening claims about overall/aggregate scores that often disagree with the mean of channel scores.
 */
function stripConflictingOverallClaims(text) {
    if (!text) return "";
    let t = text.trim();
    t = t.replace(
        /\bThe overall multi-channel health score is\s+\d{1,3}(?:,\s*)?(?:with a grade of\s+[A-F][^.]*)?\.\s*/gi,
        ""
    );
    t = t.replace(/\boverall (?:multi-channel )?health score is\s+\d{1,3}[^.]*\.\s*/gi, "");
    t = t.replace(/\baggregate (?:health )?score (?:of|is)\s+\d{1,3}[^.]*\.\s*/gi, "");
    t = t.replace(/\bmean (?:channel )?health score (?:is|:)\s+\d{1,3}[^.]*\.\s*/gi, "");
    t = t.replace(/^(?:with a grade of\s+[A-F]\.\s*)+/i, "");
    return t.trim();
}

/**
 * Sets canonicalOverall from channel scores and prepends a single aligned summary line.
 * Mutates `report` in place.
 */
export function normalizeAuditReport(report) {
    if (!report || typeof report !== "object") return report;
    const { score, grade } = meanChannelHealthFromReport(report);
    report.canonicalOverall = { score, grade };

    if (score == null) return report;

    const prefix = `Mean channel health score: ${score} (Grade ${grade}). `;
    let body = String(report.executiveSummary || "").trim();
    body = stripConflictingOverallClaims(body);
    report.executiveSummary = (prefix + (body ? ` ${body}` : "")).trim();
    return report;
}

export function isMongoObjectIdString(s) {
    return typeof s === "string" && /^[a-f0-9]{24}$/i.test(s.trim());
}
