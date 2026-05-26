/**
 * System prompt for post-audit follow-up chat (Claude).
 */

/**
 * @param {{
 *   auditReportSnapshot?: object,
 *   dateRange?: { startDate?: string, endDate?: string },
 *   comparisonDateRange?: { startDate?: string, endDate?: string } | null,
 *   customerName?: string,
 *   ephemeralDataContext?: object | null,
 * }} ctx
 */
export function buildAuditFollowUpSystemPrompt(ctx) {
    const report = ctx.auditReportSnapshot && typeof ctx.auditReportSnapshot === "object"
        ? ctx.auditReportSnapshot
        : {};
    const start = ctx.dateRange?.startDate || "—";
    const end = ctx.dateRange?.endDate || "—";
    const customer = (ctx.customerName || "").trim() || "the customer";

    const reportJson = JSON.stringify(report, null, 2);

    const compare =
        ctx.comparisonDateRange?.startDate && ctx.comparisonDateRange?.endDate
            ? `Comparison period: ${ctx.comparisonDateRange.startDate} → ${ctx.comparisonDateRange.endDate}.`
            : "No year-over-year comparison period was configured for this audit.";

    return `You are a senior paid media strategist at Searchmind helping colleagues act on a completed channel audit.

The user has already run an automated audit for ${customer}. The audit report below is your primary source of truth — cite specific findings, scores, and recommendations from it. Do not invent metrics that are not in the report or in the conversation.

Audit period: ${start} → ${end}.
${compare}

When the user asks follow-up questions:
- Be specific and actionable; reference section titles and finding severities where relevant.
- If they ask for prioritization, rank by business impact and ease of implementation.
- Match the user's language (English or Danish) in your replies.
- If they ask for more data, deeper metrics, or raw channel numbers not in the report, use the fetch_audit_data tool to load read-only data into this chat (not saved to the audit report).

When they request deliverables (HTML report, email summary, slide outline, checklist, client-ready memo, etc.):
- Produce complete, ready-to-use content.
- For standalone HTML: return valid HTML in a \`\`\`html fenced code block (include basic inline styles for readability).
- For documents meant to paste elsewhere, use clear Markdown structure.

Full audit report (JSON):
${reportJson}${formatEphemeralBlock(ctx.ephemeralDataContext)}`;
}

/**
 * @param {unknown} ephemeral
 */
function formatEphemeralBlock(ephemeral) {
    if (!ephemeral || typeof ephemeral !== "object") return "";
    let json;
    try {
        json = JSON.stringify(ephemeral, null, 2);
    } catch {
        return "";
    }
    if (!json || json === "{}") return "";
    return `

Additional live-fetched data (this chat thread only — not saved to the audit report):
${json}`;
}
