import { getEnglishTaskPrompt } from "./auditTaskPromptsEn.js";
import {
    getActiveSystemPromptBody,
    getAuditPromptById,
    ensureAuditPromptLibrary,
} from "./auditPromptDb";
import { auditGroupIdFromCardId, getAuditCatalogCard } from "./auditPromptCatalog";

export const AUDIT_OUTPUT_SCHEMA_INSTRUCTION = `
Return STRICT JSON only (no markdown fences) matching this shape:
{
  "audit_id": "<analysis id>",
  "period": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "comparison": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" } | null,
  "summary": "2-4 sentences in English",
  "thresholds_used": "string",
  "findings": [
    {
      "title": "string",
      "type": "problem | opportunity",
      "severity": "critical | high | medium | low",
      "evidence": "string with concrete numbers",
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
  "data_gaps": "string"
}
Also include "health_score" (integer 0-100) and "grade" (A-F) at the root. Score must reflect THIS analysis only — vary scores across analyses; do not default every analysis to the same number.
Rubric from findings: mostly critical/high → 25-45; several high → 45-58; mixed medium → 58-72; few/low issues → 72-88; strong with opportunities → 85-95.
Include "health_score" and "grade" in the root of the JSON.
All narrative text must be in English.
`;

const FALLBACK_SYSTEM_PROMPT = `You are a senior performance and growth marketing analyst running a data-driven audit for a Shopify e-commerce brand.
Always respond in English. Be specific and action-oriented. Never invent numbers.`;

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

/**
 * @param {string} cardId — legacy catalog id (older audits / fallback)
 */
export async function getTaskPromptForCardId(cardId) {
    const en = getEnglishTaskPrompt(cardId);
    if (en) return en;
    const catalog = getAuditCatalogCard(cardId);
    if (catalog) {
        return {
            title: catalog.card.title,
            tag: catalog.card.tag,
            dataLine: catalog.card.description || "",
            taskPrompt: "",
        };
    }
    return null;
}

export async function preloadAuditPrompts() {
    await ensureAuditPromptLibrary();
    await getActiveSystemPromptBody();
}
