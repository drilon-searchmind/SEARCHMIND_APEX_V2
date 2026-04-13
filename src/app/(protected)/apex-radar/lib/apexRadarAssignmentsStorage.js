/**
 * Client-only persistence for Apex Radar account ↔ internal user assignments.
 * Replace with API when backend exists.
 */

const STORAGE_KEY = "apexRadarCustomerAssignments";

/** @returns {Record<string, Record<string, string[]>>} */
function safeParse(raw) {
    if (!raw || typeof raw !== "string") return {};
    try {
        const data = JSON.parse(raw);
        if (!data || typeof data !== "object" || Array.isArray(data)) return {};
        return data;
    } catch {
        return {};
    }
}

/**
 * @param {string} channel
 * @returns {Record<string, string[]>} accountRowId -> internal user ids
 */
export function readAssignmentsForChannel(channel) {
    if (typeof window === "undefined") return {};
    const ch = String(channel || "").trim();
    if (!ch) return {};
    const all = safeParse(window.localStorage.getItem(STORAGE_KEY));
    const byChannel = all[ch];
    if (!byChannel || typeof byChannel !== "object" || Array.isArray(byChannel)) return {};
    /** @type {Record<string, string[]>} */
    const out = {};
    for (const [accountKey, ids] of Object.entries(byChannel)) {
        if (!Array.isArray(ids)) continue;
        out[accountKey] = ids.map((x) => String(x)).filter(Boolean);
    }
    return out;
}

/**
 * @param {string} channel
 * @param {Record<string, string[]>} map
 */
export function writeAssignmentsForChannel(channel, map) {
    if (typeof window === "undefined") return;
    const ch = String(channel || "").trim();
    if (!ch) return;
    const all = safeParse(window.localStorage.getItem(STORAGE_KEY));
    const next = { ...all, [ch]: { ...map } };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("apex-radar-assignments-changed", { detail: { channel: ch } }));
}
