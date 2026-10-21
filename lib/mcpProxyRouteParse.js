/**
 * Pathname + query parsing for call_apex_api / executeMcpApexProxy (no Next.js imports).
 */

/**
 * @param {string} route
 */
export function normalizeApexProxyRoutePath(route) {
    const raw = String(route || "").trim();
    if (!raw) return "";
    const pathOnly = raw.split("?")[0].split("#")[0].trim();
    const withSlash = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
    return withSlash.replace(/\/+$/, "") || withSlash;
}

/**
 * @param {string} route
 * @returns {Record<string, string>}
 */
export function apexProxyQueryParamsFromRoute(route) {
    const raw = String(route || "").trim();
    if (!raw.includes("?")) return {};
    try {
        const url = new URL(raw.startsWith("/") ? raw : `/${raw}`, "http://apex.local");
        /** @type {Record<string, string>} */
        const out = {};
        for (const [key, value] of url.searchParams.entries()) {
            out[key] = value;
        }
        return out;
    } catch {
        return {};
    }
}
