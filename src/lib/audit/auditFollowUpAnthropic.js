/**
 * Anthropic client for audit follow-up chat (tools: ephemeral data fetch only).
 */

import { AUDIT_ANTHROPIC_MESSAGES_URL } from "./auditAiReadOnlyPolicy";
import { buildFollowUpAnthropicBody } from "./auditAiFollowUpPolicy";
import { getAuditAnthropicModel, isAuditAiConfigured } from "./auditAnthropic";

function getApiKey() {
    const key =
        (typeof process.env.CLAUDE_CODE_API_KEY === "string" &&
            process.env.CLAUDE_CODE_API_KEY.trim()) ||
        (typeof process.env.ANTHROPIC_API_KEY === "string" && process.env.ANTHROPIC_API_KEY.trim()) ||
        "";
    return key;
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
 * @param {ReturnType<typeof buildFollowUpAnthropicBody>} body
 */
async function postFollowUpMessages(body) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("CLAUDE_CODE_API_KEY is not configured");

    const res = await fetch(AUDIT_ANTHROPIC_MESSAGES_URL.href, {
        method: "POST",
        headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(anthropicErrorMessage(res, data));
    }

    const usage = data.usage && typeof data.usage === "object" ? data.usage : {};
    const tokensUsed =
        (Number(usage.input_tokens) || 0) + (Number(usage.output_tokens) || 0);

    return {
        content: Array.isArray(data.content) ? data.content : [],
        stopReason: data.stop_reason,
        model: body.model,
        tokensUsed,
    };
}

/**
 * @param {unknown[]} content
 */
export function extractTextFromAnthropicContent(content) {
    return (Array.isArray(content) ? content : [])
        .filter((b) => b && b.type === "text" && typeof b.text === "string")
        .map((b) => b.text)
        .join("\n")
        .trim();
}

/**
 * @param {unknown[]} content
 */
export function extractToolUsesFromAnthropicContent(content) {
    return (Array.isArray(content) ? content : [])
        .filter((b) => b && b.type === "tool_use" && typeof b.name === "string")
        .map((b) => ({
            id: String(b.id || ""),
            name: String(b.name),
            input: b.input && typeof b.input === "object" ? b.input : {},
        }));
}

/**
 * @param {Array<{ role: string, content: string | unknown[] }>} history
 */
function historyToAnthropicMessages(history) {
    return history.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
    }));
}

/**
 * Run follow-up turn with optional fetch_audit_data tool (max one fetch per user message).
 *
 * @param {{
 *   system: string,
 *   messages: Array<{ role: 'user' | 'assistant', content: string }>,
 *   onFetchAuditData: (input: { sources?: string[], reason?: string }) => Promise<string>,
 *   maxTokens?: number,
 *   temperature?: number,
 * }} opts
 * @returns {Promise<{ text: string, model: string, tokensUsed: number, didFetch: boolean }>}
 */
export async function callAuditFollowUpWithOptionalFetch(opts) {
    if (!isAuditAiConfigured()) {
        throw new Error("CLAUDE_CODE_API_KEY is not configured");
    }

    const model = getAuditAnthropicModel();
    let tokensUsed = 0;
    let didFetch = false;

    /** @type {Array<{ role: string, content: string | unknown[] }>} */
    let anthropicMessages = opts.messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
    }));

    for (let step = 0; step < 3; step++) {
        const system =
            typeof opts.getSystem === "function" ? opts.getSystem() : opts.system;
        const body = buildFollowUpAnthropicBody({
            model,
            system,
            messages: historyToAnthropicMessages(anthropicMessages),
            maxTokens: opts.maxTokens,
            temperature: opts.temperature ?? 0.4,
        });

        const response = await postFollowUpMessages(body);
        tokensUsed += response.tokensUsed;

        const toolUses = extractToolUsesFromAnthropicContent(response.content);
        const fetchTool = toolUses.find((t) => t.name === "fetch_audit_data");

        if (response.stopReason === "tool_use" && fetchTool && !didFetch) {
            didFetch = true;
            const input = /** @type {{ sources?: string[], reason?: string }} */ (fetchTool.input);
            let toolResultText;
            try {
                toolResultText = await opts.onFetchAuditData(input);
            } catch (e) {
                toolResultText = JSON.stringify({
                    ok: false,
                    error: e?.message || String(e),
                });
            }

            anthropicMessages = [
                ...anthropicMessages,
                { role: "assistant", content: response.content },
                {
                    role: "user",
                    content: [
                        {
                            type: "tool_result",
                            tool_use_id: fetchTool.id,
                            content: toolResultText,
                        },
                    ],
                },
            ];
            continue;
        }

        const text = extractTextFromAnthropicContent(response.content);
        if (!text && step < 2) {
            continue;
        }
        return { text: text || "(No response text)", model, tokensUsed, didFetch };
    }

    return {
        text: "I could not complete a response. Please try again.",
        model,
        tokensUsed,
        didFetch,
    };
}
