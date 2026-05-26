import { callAuditAnthropic, isAuditAiConfigured } from "./auditAnthropic";
import { parseAuditJsonLoose } from "./auditJsonParse";
import { programmaticAhrefsRepairsFromErrors } from "./ahrefsSelectRepair";

const REPAIR_SYSTEM = `You are an Ahrefs API v3 Site Explorer parameter repair assistant for Searchmind Apex audits.

Given API error messages (especially "column not found" and "Available columns:" lists), output corrected query parameters.

Rules:
- Return ONLY a JSON object, no markdown.
- Shape: { "repairs": { "<section>": { "select": "comma-separated columns", "order_by": "column:asc|desc" } } } }
- Section keys must be one of: domain_rating, organic_keywords, top_pages, backlinks
- Only use column names that appear in the error's "Available columns" list (or standard Ahrefs names if no list is given).
- Map legacy names when needed (e.g. volume → top_keyword_volume on top-pages).
- Do not invent data or analysis text.`;

/**
 * @param {{ section?: string, message?: string }[]} ahrefsErrors
 * @returns {Promise<Record<string, { select: string, order_by?: string }>>}
 */
export async function suggestAhrefsRepairsViaClaude(ahrefsErrors) {
    const programmatic = programmaticAhrefsRepairsFromErrors(ahrefsErrors);
    if (!isAuditAiConfigured() || !ahrefsErrors?.length) {
        return programmatic;
    }

    const user = `These Ahrefs Site Explorer sub-requests failed during an audit data fetch. Suggest repaired select and order_by for each failed section.

Errors:
${JSON.stringify(ahrefsErrors, null, 2)}

Return JSON: { "repairs": { "top_pages": { "select": "...", "order_by": "..." }, ... } }`;

    try {
        const raw = await callAuditAnthropic({
            system: REPAIR_SYSTEM,
            user,
        });
        const parsed = await parseAuditJsonLoose(raw);
        const fromAi =
            parsed?.repairs && typeof parsed.repairs === "object"
                ? /** @type {Record<string, { select: string, order_by?: string }>} */ (
                      parsed.repairs
                  )
                : {};

        return { ...programmatic, ...fromAi };
    } catch (e) {
        console.warn("[auditAhrefsRepair] Claude repair failed, using programmatic only:", e?.message);
        return programmatic;
    }
}

/**
 * @param {import("./auditDeveloperDiagnostics").AuditDiagnosticItem[]} diagnosticItems
 * @returns {{ section?: string, message?: string }[]}
 */
export function ahrefsErrorsFromDiagnosticItems(diagnosticItems) {
    const out = [];
    for (const row of diagnosticItems || []) {
        if (row.category !== "data_fetch") continue;
        const src = String(row.source || "");
        if (!src.startsWith("ahrefs")) continue;
        const section = src.includes(".") ? src.split(".").slice(1).join(".") : "";
        out.push({
            section: section || "ahrefs",
            message: row.message,
        });
    }
    return out;
}
