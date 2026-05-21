import { getEnglishTaskPrompt } from "./auditTaskPromptsEn.js";
import {
    getActiveChannelPromptBody,
    getActiveSystemPromptBody,
    ensureAuditPromptLibrary,
} from "./auditPromptDb";
import { auditGroupIdFromCardId, getAuditCatalogCard } from "./auditPromptCatalog";
import { isAuditChannelScope } from "./auditPromptScopes";

export const AUDIT_OUTPUT_SCHEMA_INSTRUCTION = `
Return STRICT JSON only (no markdown fences) matching this shape:
{
  "audit_id": "<card id>",
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

/**
 * @returns {Promise<string>}
 */
export async function getAuditSystemPrompt() {
    const body = await getActiveSystemPromptBody();
    return body || FALLBACK_SYSTEM_PROMPT;
}

/**
 * @param {string} cardId
 * @returns {Promise<{ title: string, tag: string, dataLine: string, taskPrompt: string }|null>}
 */
export async function getTaskPromptForCardId(cardId) {
    const catalog = getAuditCatalogCard(cardId);
    const groupId = auditGroupIdFromCardId(cardId);

    if (groupId && isAuditChannelScope(groupId)) {
        const taskPrompt = await getActiveChannelPromptBody(groupId);
        if (taskPrompt) {
            return {
                title: catalog?.card?.title || "Analysis",
                tag: catalog?.card?.tag || "Analysis",
                dataLine: catalog?.card?.description || "",
                taskPrompt,
            };
        }
    }

    const en = getEnglishTaskPrompt(cardId);
    if (en) return en;

    return null;
}

/**
 * Warm cache before batch audit runs.
 */
export async function preloadAuditPrompts() {
    await ensureAuditPromptLibrary();
    await getActiveSystemPromptBody();
}
