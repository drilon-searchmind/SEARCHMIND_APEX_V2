/**
 * Claude API client for Apex audits — READ ONLY (see auditAiReadOnlyPolicy.js).
 *
 * Uses Anthropic Messages API only (text completion). No tools, MCP, or write actions.
 * CLAUDE_CODE_API_KEY / ANTHROPIC_API_KEY are credentials only; this module never
 * invokes Claude Code agent or tool endpoints.
 */

import {
    AUDIT_AI_ACCESS_MODE,
    AUDIT_ANTHROPIC_MESSAGES_URL,
    buildReadOnlyAuditAnthropicBody,
} from "./auditAiReadOnlyPolicy";

function getApiKey() {
    const key =
        (typeof process.env.CLAUDE_CODE_API_KEY === "string" &&
            process.env.CLAUDE_CODE_API_KEY.trim()) ||
        (typeof process.env.ANTHROPIC_API_KEY === "string" && process.env.ANTHROPIC_API_KEY.trim()) ||
        "";
    return key;
}

export function isAuditAiConfigured() {
    return Boolean(getApiKey());
}

/** @returns {'READ_ONLY'} */
export function getAuditAiAccessMode() {
    return AUDIT_AI_ACCESS_MODE.MODE;
}

export function getAuditAnthropicModel() {
    return (
        (typeof process.env.CLAUDE_AUDIT_MODEL === "string" &&
            process.env.CLAUDE_AUDIT_MODEL.trim()) ||
        "claude-sonnet-4-20250514"
    );
}

/**
 * @param {Response} res
 * @param {Record<string, unknown>} data
 */
function anthropicErrorMessage(res, data) {
    const err = data?.error;
    if (err && typeof err === "object" && typeof err.message === "string") return err.message;
    if (typeof data?.message === "string") return data.message;
    return `Anthropic API error (${res.status})`;
}

/**
 * Single gateway for audit Anthropic HTTP calls.
 * @param {ReturnType<typeof buildReadOnlyAuditAnthropicBody>} requestBody
 */
async function postReadOnlyAuditMessages(requestBody) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("CLAUDE_CODE_API_KEY is not configured");
    }

    const res = await fetch(AUDIT_ANTHROPIC_MESSAGES_URL.href, {
        method: "POST",
        headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(anthropicErrorMessage(res, data));
    }

    const blocks = Array.isArray(data.content) ? data.content : [];
    const text = blocks
        .filter((b) => b && b.type === "text" && typeof b.text === "string")
        .map((b) => b.text)
        .join("\n")
        .trim();

    const usage = data.usage && typeof data.usage === "object" ? data.usage : {};
    const tokensUsed =
        (Number(usage.input_tokens) || 0) + (Number(usage.output_tokens) || 0);

    return { text, model: requestBody.model, tokensUsed };
}

/**
 * @param {{ system: string, messages: Array<{ role: 'user' | 'assistant', content: string }>, maxTokens?: number, temperature?: number }} opts
 * @returns {Promise<{ text: string, model: string, tokensUsed: number }>}
 */
export async function callAuditAnthropicMessages({
    system,
    messages,
    maxTokens = 8192,
    temperature = 0.4,
}) {
    const requestBody = buildReadOnlyAuditAnthropicBody({
        model: getAuditAnthropicModel(),
        system,
        messages,
        maxTokens,
        temperature,
    });
    return postReadOnlyAuditMessages(requestBody);
}

/**
 * @param {{ system: string, user: string, maxTokens?: number, temperature?: number }} opts
 * @returns {Promise<string>}
 */
export async function callAuditAnthropic({ system, user, maxTokens = 8192, temperature = 0.35 }) {
    const { text } = await callAuditAnthropicMessages({
        system,
        messages: [{ role: "user", content: user }],
        maxTokens,
        temperature,
    });
    return text;
}
