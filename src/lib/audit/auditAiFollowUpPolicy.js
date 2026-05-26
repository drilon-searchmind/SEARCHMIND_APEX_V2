/**
 * Audit follow-up chat policy — read-only on platforms/DB, but may load extra data into the thread.
 */

import { getAuditAnthropicMaxTokens } from "./auditAiReadOnlyPolicy";

export const AUDIT_FOLLOWUP_FETCH_TOOL = Object.freeze({
    name: "fetch_audit_data",
    description:
        "Load additional read-only marketing data for the audit period into this chat thread. " +
        "Does not modify ad accounts, Shopify, or the saved audit report. " +
        "Use when the user asks for more data, deeper metrics, or channel details not in the report.",
    input_schema: {
        type: "object",
        properties: {
            sources: {
                type: "array",
                description:
                    "Data sources to load. Omit or use [\"all\"] for all configured sources relevant to this customer.",
                items: {
                    type: "string",
                    enum: [
                        "all",
                        "shopify",
                        "merged",
                        "search_console",
                        "ahrefs",
                        "google_ads",
                        "meta",
                        "klaviyo",
                    ],
                },
            },
            reason: {
                type: "string",
                description: "Brief note on why this fetch helps answer the user (for logging).",
            },
        },
    },
});

export const AUDIT_FOLLOWUP_SYSTEM_APPENDIX = `

=== APEX AUDIT FOLLOW-UP — READ-ONLY WITH EPHEMERAL DATA FETCH ===
- You cannot write to ad platforms, Shopify, databases, or change the saved audit report.
- When the user needs metrics not in the report, call fetch_audit_data to load read-only data into this chat only.
- After a fetch, use the additional JSON in "Additional live-fetched data" — do not claim you cannot access more data if fetch succeeded.
- Never invent numbers; cite fetched data or the audit report.
- If fetch fails or a source is not configured, say so clearly and work with what you have.`;

/**
 * @param {string} system
 */
export function applyFollowUpSystemPrompt(system) {
    const base = typeof system === "string" ? system.trim() : "";
    return `${base}${AUDIT_FOLLOWUP_SYSTEM_APPENDIX}`;
}

/**
 * @param {{
 *   model: string,
 *   system: string,
 *   messages: Array<Record<string, unknown>>,
 *   maxTokens?: number,
 *   temperature?: number,
 * }} params
 */
export function buildFollowUpAnthropicBody(params) {
    const { model, system, messages, maxTokens, temperature } = params;
    const resolvedMax =
        Number(maxTokens) >= 256 && Number.isFinite(Number(maxTokens))
            ? Math.floor(Number(maxTokens))
            : getAuditAnthropicMaxTokens();

    return {
        model: String(model),
        max_tokens: resolvedMax,
        temperature: Math.min(Math.max(Number(temperature) ?? 0.4, 0), 1),
        system: applyFollowUpSystemPrompt(system),
        tools: [AUDIT_FOLLOWUP_FETCH_TOOL],
        messages: Array.isArray(messages) ? messages : [],
    };
}
