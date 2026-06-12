/** Max proxy calls per customer per rolling minute window. */
export const MCP_PROXY_RATE_LIMIT_PER_MINUTE = 60;

/** @type {Map<string, number[]>} */
const rateBuckets = new Map();

/**
 * @param {string} customerId
 * @param {string} [keyId]
 */
export function assertMcpProxyRateLimit(customerId, keyId = "") {
    const key = `${String(customerId || "").trim()}::${String(keyId || "").trim()}`;
    const now = Date.now();
    const windowMs = 60_000;
    const cutoff = now - windowMs;

    const hits = (rateBuckets.get(key) || []).filter((t) => t > cutoff);
    if (hits.length >= MCP_PROXY_RATE_LIMIT_PER_MINUTE) {
        throw new Error(
            `Rate limit exceeded for customer (${MCP_PROXY_RATE_LIMIT_PER_MINUTE}/min). Retry shortly.`
        );
    }
    hits.push(now);
    rateBuckets.set(key, hits);
}

/**
 * @param {Record<string, unknown>} entry
 */
export function logMcpProxyAudit(entry) {
    const payload = {
        ts: new Date().toISOString(),
        type: "mcp_proxy_audit",
        ...entry,
    };
    console.info(JSON.stringify(payload));
}

/**
 * @param {unknown} params
 * @returns {Record<string, string>}
 */
export function normalizeProxyParams(params) {
    if (!params || typeof params !== "object" || Array.isArray(params)) {
        return {};
    }
    /** @type {Record<string, string>} */
    const out = {};
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        if (typeof value === "object") {
            out[key] = JSON.stringify(value);
        } else {
            out[key] = String(value).trim();
        }
    }
    return out;
}

/**
 * @param {Record<string, string>} params
 * @param {string[]} required
 */
export function assertRequiredParams(params, required) {
    const missing = required.filter((key) => !params[key]);
    if (missing.length) {
        throw new Error(`Missing required params: ${missing.join(", ")}`);
    }
}
