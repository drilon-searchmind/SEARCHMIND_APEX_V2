import {
    getActiveSystemPromptBody,
    getAuditPromptById,
    ensureAuditPromptLibrary,
} from "./auditPromptDb";

export const AUDIT_OUTPUT_SCHEMA_INSTRUCTION = `Return STRICT JSON only — your entire reply must be exactly one JSON object. No markdown fences. No preamble or closing text (never start with "Looking at", "Here is", "Based on", etc.).

CONTENT RULES (important):
- Do NOT summarize, shorten, or omit findings to save space. Include every material issue and opportunity you identify.
- Use full sentences and complete evidence. No arbitrary length limits on any field.
- If the task implies a list (search terms, campaigns, products, etc.), include all relevant items with numbers — do not cap at "top 5" unless the task explicitly asks for a limit.
- "summary" is a full analysis overview for this card (not a brief abstract).
- "findings" may contain as many items as the data supports.
- "prioritized_actions" should list all ranked actions you recommend (use rank 1, 2, 3, …).

Required JSON shape (same keys always; string values may be long):
{
  "audit_id": "<analysis id>",
  "period": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "comparison": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" } | null,
  "summary": "string — complete overview in English",
  "thresholds_used": "string — explain criteria and benchmarks used",
  "findings": [
    {
      "title": "string",
      "type": "problem | opportunity",
      "severity": "critical | high | medium | low",
      "evidence": "string — concrete data, metrics, examples (no length limit)",
      "impact": "string",
      "recommendation": "string",
      "business_case": "string",
      "expected_effect": "string",
      "confidence": "high | medium | low",
      "effort": "low | medium | high"
    }
  ],
  "prioritized_actions": [
    { "rank": 1, "action": "string", "channel": "string", "business_case": "string", "why": "string" }
  ],
  "data_gaps": "string — list missing data that limited the analysis"
}
Also include "health_score" (integer 0-100) and "grade" (A-F) at the root. Score must reflect THIS analysis only.
Rubric from findings: mostly critical/high → 25-45; several high → 45-58; mixed medium → 58-72; few/low issues → 72-88; strong with opportunities → 85-95.
All narrative text must be in English. Never invent metrics not present in the supplied data.`;

/** @returns {string} */
export function getAuditOutputSchemaInstruction() {
    return AUDIT_OUTPUT_SCHEMA_INSTRUCTION;
}

const FALLBACK_SYSTEM_PROMPT = `You are a senior performance and growth marketing analyst running a data-driven audit for a Shopify e-commerce brand.
Always respond in English. Be specific and action-oriented. Never invent numbers. Provide exhaustive, implementation-ready detail — do not summarize away findings.`;

export async function getAuditSystemPrompt() {
    const body = await getActiveSystemPromptBody();
    return body || FALLBACK_SYSTEM_PROMPT;
}

/**
 * @param {string} promptId — Mongo AuditPrompt id
 */
export async function getTaskPromptForPromptId(promptId) {
    const p = await getAuditPromptById(promptId);
    if (!p?.body) return null;
    return {
        title: p.title,
        tag: "Analysis",
        dataLine: p.description || "",
        taskPrompt: p.body,
        groupId: p.scope,
        promptId: p.id,
    };
}

export async function preloadAuditPrompts() {
    await ensureAuditPromptLibrary();
    await getActiveSystemPromptBody();
}
