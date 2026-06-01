/**
 * Parse Google Ads customer IDs from CustomerSettings.googleAdsCustomerId.
 * Supports a single ID or comma-separated list (e.g. "7969227273, 7969227272").
 */

/** @param {unknown} id */
export function normalizeGoogleAdsCustomerId(id) {
    const digits = String(id ?? "").replace(/\D/g, "");
    return digits;
}

/**
 * @param {unknown} raw — stored setting value
 * @returns {string[]} distinct numeric customer IDs (empty if none valid)
 */
export function parseGoogleAdsCustomerIds(raw) {
    const str = String(raw ?? "").trim();
    if (!str) return [];

    const parts = str.includes(",") ? str.split(",") : [str];
    /** @type {string[]} */
    const ids = [];
    const seen = new Set();

    for (const part of parts) {
        const id = normalizeGoogleAdsCustomerId(part.trim());
        if (!id || id === "0" || id === "1") continue;
        if (seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
    }
    return ids;
}

/** @param {unknown} raw */
export function hasMultipleGoogleAdsCustomerIds(raw) {
    return parseGoogleAdsCustomerIds(raw).length > 1;
}

/** First parsed ID, or normalized single value (for APIs that only accept one account). */
export function primaryGoogleAdsCustomerId(raw) {
    const ids = parseGoogleAdsCustomerIds(raw);
    if (ids.length > 0) return ids[0];
    return normalizeGoogleAdsCustomerId(raw);
}
