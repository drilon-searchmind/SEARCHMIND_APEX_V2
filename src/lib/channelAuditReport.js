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

/** Mean of per-analysis scores (v2 audit reports). */
export function meanAnalysisHealthFromReport(report) {
    const analyses = Array.isArray(report?.analyses) ? report.analyses : [];
    const nums = analyses
        .map((a) => a.health_score)
        .filter((n) => n != null && Number.isFinite(Number(n)))
        .map(Number);
    if (nums.length === 0) return { score: null, grade: "—" };
    const score = Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
    return { score, grade: gradeFromNumericScore(score) };
}

/**
 * Deterministic 0–100 score from finding severities (problems reduce score; opportunities nudge up slightly).
 * @param {Array<{ severity?: string, type?: string }>} findings
 * @returns {number|null}
 */
export function deriveHealthScoreFromFindings(findings) {
    if (!Array.isArray(findings) || findings.length === 0) return null;

    let penalty = 0;
    let opportunityBoost = 0;

    for (const f of findings) {
        const sev = String(f.severity || "").toLowerCase();
        const type = String(f.type || "").toLowerCase();
        if (type === "opportunity" || type === "mulighed") {
            opportunityBoost += 3;
            continue;
        }
        if (sev === "critical" || sev === "kritisk") penalty += 22;
        else if (sev === "high" || sev === "høj" || sev === "hoj") penalty += 14;
        else if (sev === "medium") penalty += 8;
        else if (sev === "low" || sev === "lav") penalty += 4;
        else penalty += 6;
    }

    const raw = 100 - penalty + Math.min(opportunityBoost, 12);
    return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Use model-provided score only (prompts control whether scores exist).
 * @param {Array<{ severity?: string, type?: string }>} [_findings]
 * @param {number|null|undefined} aiScore
 */
export function resolveAnalysisHealthScore(_findings, aiScore) {
    if (aiScore != null && Number.isFinite(Number(aiScore))) {
        return Math.round(Number(aiScore));
    }
    return null;
}

/**
 * @param {string|number|null|undefined} grade
 * @param {number|null|undefined} healthScore
 */
export function pickModelGrade(grade, healthScore) {
    const g = grade != null ? String(grade).trim() : "";
    if (g && g !== "—") return g;
    if (healthScore != null && Number.isFinite(Number(healthScore))) {
        return gradeFromNumericScore(healthScore);
    }
    return null;
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
    t = t.replace(
        /^Overall health score:\s*\d{1,3}\s*\/\s*100\s*\(Grade\s+[A-F]\)\.\s*/i,
        ""
    );
    return t.trim();
}

/**
 * Sets canonicalOverall from stored scores when present (no synthetic summary text).
 * Mutates `report` in place.
 */
export function normalizeAuditReport(report) {
    if (!report || typeof report !== "object") return report;
    const useAnalyses =
        report.version === 2 &&
        Array.isArray(report.analyses) &&
        report.analyses.length > 0;
    const { score, grade } = useAnalyses
        ? meanAnalysisHealthFromReport(report)
        : meanChannelHealthFromReport(report);
    report.canonicalOverall = { score, grade };

    if (report.executiveSummary) {
        report.executiveSummary = stripConflictingOverallClaims(
            String(report.executiveSummary)
        );
    }
    return report;
}

export function isMongoObjectIdString(s) {
    return typeof s === "string" && /^[a-f0-9]{24}$/i.test(s.trim());
}
