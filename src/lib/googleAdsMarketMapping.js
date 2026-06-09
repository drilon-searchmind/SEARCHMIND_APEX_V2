import {
    normalizeGoogleAdsCustomerId,
    parseGoogleAdsCustomerIds,
} from "./googleAdsCustomerIdUtils";

/**
 * @typedef {{ googleAdsCustomerId: string, shopifyqlMarketIds: string[] }} GoogleAdsMarketMappingEntry
 */

/**
 * @param {unknown} raw
 * @returns {GoogleAdsMarketMappingEntry[]}
 */
export function normalizeGoogleAdsMarketMapping(raw) {
    if (!Array.isArray(raw)) return [];
    /** @type {GoogleAdsMarketMappingEntry[]} */
    const out = [];
    const seen = new Set();
    for (const row of raw) {
        const googleAdsCustomerId = normalizeGoogleAdsCustomerId(row?.googleAdsCustomerId);
        if (!googleAdsCustomerId || seen.has(googleAdsCustomerId)) continue;
        seen.add(googleAdsCustomerId);
        const shopifyqlMarketIds = [
            ...new Set(
                (Array.isArray(row?.shopifyqlMarketIds) ? row.shopifyqlMarketIds : [])
                    .map((id) => String(id ?? "").trim())
                    .filter(Boolean)
            ),
        ];
        out.push({ googleAdsCustomerId, shopifyqlMarketIds });
    }
    return out;
}

/**
 * Keep one mapping row per configured Google Ads account; preserve market selections.
 * @param {unknown} rawMapping
 * @param {unknown} googleAdsCustomerIdRaw
 * @returns {GoogleAdsMarketMappingEntry[]}
 */
export function syncGoogleAdsMarketMappingWithCustomerIds(rawMapping, googleAdsCustomerIdRaw) {
    const ids = parseGoogleAdsCustomerIds(googleAdsCustomerIdRaw);
    const existing = normalizeGoogleAdsMarketMapping(rawMapping);
    const byId = new Map(existing.map((e) => [e.googleAdsCustomerId, e.shopifyqlMarketIds]));
    return ids.map((googleAdsCustomerId) => ({
        googleAdsCustomerId,
        shopifyqlMarketIds: byId.get(googleAdsCustomerId) || [],
    }));
}

/**
 * Whether account ↔ market mapping should drive filtered Google spend.
 * @param {Record<string, unknown>} settings
 */
export function googleAdsMarketMappingIsActive(settings) {
    const ids = parseGoogleAdsCustomerIds(settings?.googleAdsCustomerId);
    if (ids.length <= 1) return false;
    return normalizeGoogleAdsMarketMapping(settings?.googleAdsMarketMapping).some(
        (e) => e.shopifyqlMarketIds.length > 0
    );
}

/**
 * Resolve which Google Ads accounts to fetch when Shopify Markets + "filter ad spend by markets" is on.
 *
 * @param {Record<string, unknown>} settings — CustomerSettings
 * @param {Array<{ shopifyqlMarketId?: string }>} [selectedMarkets]
 * @returns {{ customerIds: string[], useAccountMapping: boolean, skipCountryFilter: boolean }}
 */
export function resolveGoogleAdsFetchPlan(settings, selectedMarkets) {
    const allIds = parseGoogleAdsCustomerIds(settings?.googleAdsCustomerId);
    if (allIds.length === 0) {
        return { customerIds: [], useAccountMapping: false, skipCountryFilter: false };
    }

    const mapping = normalizeGoogleAdsMarketMapping(settings?.googleAdsMarketMapping);
    const hasMapping =
        allIds.length > 1 && mapping.some((e) => e.shopifyqlMarketIds.length > 0);

    if (!hasMapping) {
        return { customerIds: allIds, useAccountMapping: false, skipCountryFilter: false };
    }

    const selectedMarketIds = new Set(
        (selectedMarkets || [])
            .map((m) => String(m?.shopifyqlMarketId ?? "").trim())
            .filter(Boolean)
    );
    if (selectedMarketIds.size === 0) {
        return { customerIds: allIds, useAccountMapping: false, skipCountryFilter: false };
    }

    /** @type {Set<string>} */
    const matchedAccounts = new Set();
    for (const entry of mapping) {
        const accountId = entry.googleAdsCustomerId;
        if (!allIds.includes(accountId)) continue;
        const overlaps = entry.shopifyqlMarketIds.some((mid) => selectedMarketIds.has(mid));
        if (overlaps) matchedAccounts.add(accountId);
    }

    if (matchedAccounts.size === 0) {
        return { customerIds: allIds, useAccountMapping: false, skipCountryFilter: false };
    }

    return {
        customerIds: allIds.filter((id) => matchedAccounts.has(id)),
        useAccountMapping: true,
        skipCountryFilter: true,
    };
}

/**
 * @param {GoogleAdsMarketMappingEntry[]} mapping
 * @param {string} googleAdsCustomerId
 * @param {string} shopifyqlMarketId
 * @param {boolean} checked
 * @returns {GoogleAdsMarketMappingEntry[]}
 */
export function toggleGoogleAdsMarketMapping(
    mapping,
    googleAdsCustomerId,
    shopifyqlMarketId,
    checked
) {
    const accountId = normalizeGoogleAdsCustomerId(googleAdsCustomerId);
    const marketId = String(shopifyqlMarketId ?? "").trim();
    if (!accountId || !marketId) return mapping;

    return (mapping || []).map((entry) => {
        if (entry.googleAdsCustomerId !== accountId) return entry;
        const set = new Set(entry.shopifyqlMarketIds || []);
        if (checked) set.add(marketId);
        else set.delete(marketId);
        return { ...entry, shopifyqlMarketIds: [...set] };
    });
}
