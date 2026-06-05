/**
 * Shared secret between APEX and mcp-server-apex (server-to-server only).
 */

/**
 * @param {Request} request
 * @returns {boolean}
 */
export function isValidMcpServiceRequest(request) {
    const expected = String(process.env.MCP_SERVICE_SECRET || "").trim();
    if (!expected) return false;
    const provided = String(request.headers.get("x-mcp-service-key") || "").trim();
    return provided.length > 0 && provided === expected;
}

/**
 * @param {Request} request
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function requireMcpServiceKey(request) {
    if (!process.env.MCP_SERVICE_SECRET) {
        return { ok: false, status: 503, error: "MCP_SERVICE_SECRET not configured" };
    }
    if (!isValidMcpServiceRequest(request)) {
        return { ok: false, status: 401, error: "Invalid MCP service key" };
    }
    return { ok: true };
}
