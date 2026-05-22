/**
 * Parse Claude audit responses that should be JSON but often include prose or fences.
 */

/**
 * @param {string} str
 */
function tryParseJsonObject(str) {
    const parsed = JSON.parse(str);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Expected a JSON object at the root");
    }
    return parsed;
}

/**
 * Extract the first balanced `{ ... }` object, respecting string escapes.
 * @param {string} text
 * @returns {string | null}
 */
export function extractFirstJsonObjectString(text) {
    const start = text.indexOf("{");
    if (start < 0) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = start; i < text.length; i++) {
        const c = text[i];

        if (inString) {
            if (escape) {
                escape = false;
            } else if (c === "\\") {
                escape = true;
            } else if (c === '"') {
                inString = false;
            }
            continue;
        }

        if (c === '"') {
            inString = true;
            continue;
        }
        if (c === "{") depth++;
        if (c === "}") {
            depth--;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }

    return null;
}

/**
 * @param {string} raw
 * @returns {object}
 */
export function parseAuditJsonLoose(raw) {
    const s = String(raw || "").trim();
    if (!s) {
        throw new Error("Empty model response");
    }

    const attempts = [];

    const fenceMatches = [...s.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
    for (const m of fenceMatches) {
        const block = m[1]?.trim();
        if (block) attempts.push(block);
    }

    const edgeUnfenced = s
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
    if (edgeUnfenced) attempts.push(edgeUnfenced);

    const embedded = extractFirstJsonObjectString(s);
    if (embedded) attempts.push(embedded);

    let lastError = null;
    for (const candidate of attempts) {
        try {
            return tryParseJsonObject(candidate);
        } catch (e) {
            lastError = e;
        }
    }

    const preview = s.length > 120 ? `${s.slice(0, 120)}…` : s;
    const msg = lastError?.message || "not valid JSON";
    throw new Error(`${msg} (response starts: ${preview})`);
}
