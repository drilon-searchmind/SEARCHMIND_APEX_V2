import { canAccessApexRadar } from "@/lib/apexRadarAccess";

/** @param {string} [hostname] */
export function isLocalhostHostname(hostname) {
    const h = String(hostname || "")
        .trim()
        .toLowerCase()
        .replace(/^\[|\]$/g, "");
    return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

/**
 * @param {Request | { headers?: { get?: (name: string) => string | null } } | { host?: string } | string | null | undefined} reqOrHost
 * @returns {string}
 */
export function getRequestHostname(reqOrHost) {
    if (typeof reqOrHost === "string") {
        return reqOrHost.split(":")[0];
    }
    if (reqOrHost && typeof reqOrHost === "object") {
        if ("host" in reqOrHost && reqOrHost.host) {
            return String(reqOrHost.host).split(":")[0];
        }
        const host = reqOrHost.headers?.get?.("host") || "";
        if (host) return host.split(":")[0];
    }
    return "";
}

/**
 * Localhost-only Apex Radar dev tools. Set `APEX_RADAR_DEV_TOOLS_EMAIL` in `.env` to your login email.
 * @param {{ email?: string | null } | null | undefined} user
 * @param {Request | { headers?: { get?: (name: string) => string | null } } | { host?: string } | string | null | undefined} reqOrHost
 */
export function canAccessApexRadarDevTools(user, reqOrHost) {
    if (!canAccessApexRadar(user)) return false;

    const hostname = getRequestHostname(reqOrHost);
    if (!isLocalhostHostname(hostname)) return false;

    const allowedEmail = process.env.APEX_RADAR_DEV_TOOLS_EMAIL?.trim().toLowerCase();
    if (!allowedEmail) return false;

    const userEmail = String(user?.email || "")
        .trim()
        .toLowerCase();
    return userEmail === allowedEmail;
}

export const APEX_RADAR_DEV_TOOLS_HREF = "/apex-radar/dev-tools";
