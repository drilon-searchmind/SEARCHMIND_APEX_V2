/**
 * @param {string} route
 * @param {Record<string, string>} params
 * @param {string} [accessReason]
 */
export function buildBlockedRouteAccessReason(route, params = {}, accessReason = "") {
    const explicit = String(accessReason || "").trim();
    if (explicit) return explicit.slice(0, 500);

    const parts = [`Blocked call_apex_api for ${route}`];
    if (params.startDate && params.endDate) {
        parts.push(`(${params.startDate} to ${params.endDate})`);
    } else if (params.period) {
        parts.push(`(period ${params.period})`);
    }
    if (params.channel) {
        parts.push(`channel=${params.channel}`);
    }
    return parts.join(" ").slice(0, 500);
}

/**
 * @param {{ email?: string | null, keyId?: string, authMethod?: string }} auditContext
 */
export function buildMcpRequestedBy(auditContext = {}) {
    if (auditContext.email) return String(auditContext.email);
    if (auditContext.keyId) return `mcp-key:${auditContext.keyId}`;
    return "unknown";
}
