import { AD_SPEND_CHANNELS } from "@/lib/mergeAdSpendDaily";

const KNOWN_IDS = new Set(AD_SPEND_CHANNELS.map((c) => c.id));

/**
 * Parse `adSpendExclude` query JSON array → validated platform ids.
 * @param {string | null | undefined} raw
 * @returns {string[]}
 */
export function parseAdSpendExcludeQueryParam(raw) {
    if (!raw || String(raw).trim() === "") return [];
    try {
        const decoded = decodeURIComponent(String(raw));
        const parsed = JSON.parse(decoded);
        if (!Array.isArray(parsed)) return [];
        return normalizeAdSpendExcludeList(parsed);
    } catch {
        return [];
    }
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
export function normalizeAdSpendExcludeList(value) {
    if (!Array.isArray(value)) return [];
    return [
        ...new Set(
            value.map((id) => String(id ?? "").trim()).filter((id) => KNOWN_IDS.has(id))
        ),
    ];
}
