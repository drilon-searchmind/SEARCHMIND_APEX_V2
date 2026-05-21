/**
 * Claude API client for Apex audits (CLAUDE_CODE_API_KEY or ANTHROPIC_API_KEY).
 */

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
 * @param {{ system: string, messages: Array<{ role: 'user' | 'assistant', content: string }>, maxTokens?: number, temperature?: number }} opts
 * @returns {Promise<{ text: string, model: string, tokensUsed: number }>}
 */
export async function callAuditAnthropicMessages({
    system,
    messages,
    maxTokens = 8192,
    temperature = 0.4,
}) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("CLAUDE_CODE_API_KEY is not configured");
    }

    const model = getAuditAnthropicModel();

    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature,
            system,
            messages: messages.map((m) => ({
                role: m.role === "assistant" ? "assistant" : "user",
                content: m.content,
            })),
        }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(anthropicErrorMessage(res, data));
    }

    const blocks = Array.isArray(data.content) ? data.content : [];
    const text = blocks
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();

    const usage = data.usage && typeof data.usage === "object" ? data.usage : {};
    const tokensUsed =
        (Number(usage.input_tokens) || 0) + (Number(usage.output_tokens) || 0);

    return { text, model, tokensUsed };
}

/**
 * @param {{ system: string, user: string, maxTokens?: number, temperature?: number }} opts
 * @returns {Promise<string>}
 */
export async function callAuditAnthropic({ system, user, maxTokens = 8192, temperature = 0.35 }) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("CLAUDE_CODE_API_KEY is not configured");
    }

    const model = getAuditAnthropicModel();

    const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature,
            system,
            messages: [{ role: "user", content: user }],
        }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(anthropicErrorMessage(res, data));
    }

    const blocks = Array.isArray(data.content) ? data.content : [];
    const text = blocks
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
    return text.trim();
}
