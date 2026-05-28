/** Normalize MongoDB / API ids for consistent override map keys. */
export function normalizeMongoId(value, depth = 0) {
    if (value == null || depth > 4) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "bigint") return String(value);

    if (typeof value === "object") {
        if (typeof value.$oid === "string") return value.$oid.trim();

        // Mongoose / BSON ObjectId
        if (typeof value.toHexString === "function") {
            return value.toHexString();
        }

        if (typeof value.toString === "function") {
            const s = value.toString();
            if (/^[a-f0-9]{24}$/i.test(s)) return s;
        }

        // Subdocument wrapper — avoid self-referential _id loops
        if (value._id != null && value._id !== value) {
            return normalizeMongoId(value._id, depth + 1);
        }
    }

    const s = String(value).trim();
    return s === "[object Object]" ? "" : s;
}

/**
 * Build JSON for `googleAdsCampaignOverrides` on parent aggregated API.
 * Only sent when master toggle `googleAdsCampaignFilterEnabled=1` is on.
 *
 * @param {boolean} filterEnabled
 * @param {Record<string, Record<string, true>>} excludedCampaignsByChildId — campaign id keys to exclude from spend
 * @returns {string} JSON string or "" if nothing to send
 */
export function buildParentGoogleAdsCampaignOverridesJson(
    filterEnabled,
    excludedCampaignsByChildId
) {
    if (!filterEnabled) return "";

    /** @type {Record<string, { exclude: string[] }>} */
    const out = {};

    for (const [childId, exMap] of Object.entries(excludedCampaignsByChildId || {})) {
        const excludedIds = Object.keys(exMap || {}).filter((k) => exMap[k] === true);
        if (excludedIds.length > 0) {
            out[normalizeMongoId(childId)] = { exclude: excludedIds };
        }
    }

    return Object.keys(out).length === 0 ? "" : JSON.stringify(out);
}

/** Query string fragment for parent aggregated API (leading `&` segments). */
export function buildGoogleAdsCampaignQueryString(filterEnabled, excludedCampaignsByChildId) {
    if (!filterEnabled) return "";
    const json = buildParentGoogleAdsCampaignOverridesJson(true, excludedCampaignsByChildId);
    const parts = ["googleAdsCampaignFilterEnabled=1"];
    if (json) {
        parts.push(`googleAdsCampaignOverrides=${encodeURIComponent(json)}`);
    }
    return `&${parts.join("&")}`;
}

export const PARENT_GOOGLE_ADS_CAMPAIGNS_STORAGE_KEY = "apex-parent-google-ads-campaigns";

/**
 * @param {string} parentCustomerId
 * @returns {{ filterEnabled: boolean, excludedByChildId: Record<string, Record<string, true>> }}
 */
export function loadParentGoogleAdsCampaignsFromStorage(parentCustomerId) {
    if (typeof window === "undefined" || !parentCustomerId) {
        return { filterEnabled: false, excludedByChildId: {} };
    }
    try {
        const raw = window.localStorage.getItem(
            `${PARENT_GOOGLE_ADS_CAMPAIGNS_STORAGE_KEY}:${parentCustomerId}`
        );
        if (!raw) return { filterEnabled: false, excludedByChildId: {} };
        const parsed = JSON.parse(raw);
        const filterEnabled = parsed?.filterEnabled === true;
        const excludedByChildId = {};
        const src = parsed?.excludedByChildId;
        if (src && typeof src === "object") {
            for (const [cid, ids] of Object.entries(src)) {
                const childKey = normalizeMongoId(cid);
                if (!childKey) continue;
                if (Array.isArray(ids)) {
                    /** @type {Record<string, true>} */
                    const map = {};
                    for (const id of ids) {
                        if (id != null && String(id).trim()) map[String(id)] = true;
                    }
                    if (Object.keys(map).length > 0) excludedByChildId[childKey] = map;
                } else if (ids && typeof ids === "object") {
                    excludedByChildId[childKey] = { ...ids };
                }
            }
        }
        return { filterEnabled, excludedByChildId };
    } catch {
        return { filterEnabled: false, excludedByChildId: {} };
    }
}

/**
 * @param {string} parentCustomerId
 * @param {boolean} filterEnabled
 * @param {Record<string, Record<string, true>>} excludedByChildId
 */
export function saveParentGoogleAdsCampaignsToStorage(
    parentCustomerId,
    filterEnabled,
    excludedByChildId
) {
    if (typeof window === "undefined" || !parentCustomerId) return;
    try {
        const excludedSerialized = {};
        for (const [cid, map] of Object.entries(excludedByChildId || {})) {
            const childKey = normalizeMongoId(cid);
            if (!childKey) continue;
            const ids = Object.keys(map || {}).filter((k) => map[k] === true);
            if (ids.length > 0) excludedSerialized[childKey] = ids;
        }
        window.localStorage.setItem(
            `${PARENT_GOOGLE_ADS_CAMPAIGNS_STORAGE_KEY}:${parentCustomerId}`,
            JSON.stringify({
                filterEnabled: filterEnabled === true,
                excludedByChildId: excludedSerialized,
            })
        );
    } catch {
        /* ignore quota / private mode */
    }
}
