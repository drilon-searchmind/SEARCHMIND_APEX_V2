import {
    getActiveSystemPromptBody,
    getAuditPromptById,
    ensureAuditPromptLibrary,
} from "./auditPromptDb";

/**
 * Technical JSON envelope only — field names, scores, and narrative structure
 * come from the active system + task prompts in MongoDB.
 */
export const AUDIT_JSON_ONLY_INSTRUCTION = `Reply with exactly one valid JSON object. No markdown code fences, no preamble, and no text before or after the JSON.`;

/** @returns {string} */
export function getAuditOutputSchemaInstruction() {
    return AUDIT_JSON_ONLY_INSTRUCTION;
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
