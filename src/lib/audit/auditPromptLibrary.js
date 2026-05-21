import fs from "fs";
import path from "path";
import { getEnglishTaskPrompt } from "./auditTaskPromptsEn.js";

const PROMPTS_MD_CANDIDATES = [
    path.join(process.cwd(), "src", "lib", "audit", "data", "audit-prompts.md"),
    path.join(process.cwd(), "code_templates", "apex-run-audit-mockup", "audit-prompts.md"),
];

/** @type {string|null} */
let cachedSystemPrompt = null;
/** @type {Map<string, { title: string, tag: string, dataLine: string, taskPrompt: string }>|null} */
let cachedTaskPrompts = null;

function readPromptsFile() {
    for (const p of PROMPTS_MD_CANDIDATES) {
        if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
    }
    console.warn("[audit] audit-prompts.md not found");
    return "";
}

/**
 * @returns {string}
 */
export function getAuditSystemPrompt() {
    if (cachedSystemPrompt) return cachedSystemPrompt;
    const content = readPromptsFile();
    const m =
        content.match(/## Shared system prompt\s+```\s*([\s\S]*?)```/) ||
        content.match(/## Fælles system-prompt\s+```\s*([\s\S]*?)```/);
    const fromMd = m?.[1]?.trim() || "";
    cachedSystemPrompt =
        fromMd.includes("Always respond in English") && !fromMd.startsWith("Du er")
            ? fromMd
            : DEFAULT_SYSTEM_PROMPT;
    return cachedSystemPrompt;
}

/**
 * @returns {Map<string, { title: string, tag: string, dataLine: string, taskPrompt: string }>}
 */
export function getAuditTaskPromptsById() {
    if (cachedTaskPrompts) return cachedTaskPrompts;
    const content = readPromptsFile();
    const map = new Map();
    const re =
        /### ([\w-]+)\s+[—–-]\s+([^\n]+?)\s+·\s+\*([^*]+)\*\s*\n\*\*Data:\*\*([^\n]*)\n```\s*([\s\S]*?)```/g;
    let match;
    while ((match = re.exec(content)) !== null) {
        map.set(match[1], {
            title: match[2].trim(),
            tag: match[3].trim(),
            dataLine: match[4].trim(),
            taskPrompt: match[5].trim(),
        });
    }
    cachedTaskPrompts = map;
    return map;
}

/**
 * @param {string} cardId
 * @returns {{ title: string, tag: string, dataLine: string, taskPrompt: string }|null}
 */
export function getTaskPromptForCardId(cardId) {
    const en = getEnglishTaskPrompt(cardId);
    if (en) return en;
    return getAuditTaskPromptsById().get(cardId) || null;
}

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

const DEFAULT_SYSTEM_PROMPT = `You are a senior performance and growth marketing analyst running a data-driven audit for a Shopify e-commerce brand.
Always respond in English. Be specific and action-oriented. Never invent numbers.`;
