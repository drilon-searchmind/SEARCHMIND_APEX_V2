/**
 * Build a follow-up prompt for a single audit finding.
 * @param {object} finding
 * @param {(severity: string) => string} [formatSeverity]
 */
export function buildFindingElaborationPrompt(finding, formatSeverity = (s) => s || "—") {
    const title = finding?.title || "Untitled finding";
    const severity = formatSeverity(finding?.severity);
    const context = finding?.rationale || finding?.evidence || "—";
    const impact = finding?.impact ? `\n**Impact:** ${finding.impact}` : "";
    const recommendation =
        finding?.recommendation || finding?.recommendedAction
            ? `\n**Recommendation:** ${finding.recommendation || finding.recommendedAction}`
            : "";
    const businessCase = finding?.business_case
        ? `\n**Business case:** ${finding.business_case}`
        : "";

    return `Please analyze this audit finding in depth. Elaborate on root causes, how to validate with data, prioritization vs other issues, implementation steps, and risks if ignored.

**Finding:** ${title}
**Severity:** ${severity}

**Context:**
${context}${impact}${recommendation}${businessCase}`;
}
