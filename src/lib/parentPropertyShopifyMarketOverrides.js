/**
 * Build JSON for `shopifyMarketOverrides` query param on parent aggregated API.
 * Omit a child when “all markets enabled” (same as dashboards with no filter suffix).
 *
 * @param {Array<Record<string, unknown>>} childCustomers — parent’s child customer docs
 * @param {Record<string, Array<{ shopifyqlMarketId: string, handle?: string, name?: string }>>} catalogsByChildId
 * @param {Record<string, Record<string, true>>} excludedMarketsByChildId — shopifyqlMarketId keys
 * @returns {string} JSON string or "" if no overrides
 */
export function buildParentShopifyMarketOverridesJson(
    childCustomers,
    catalogsByChildId,
    excludedMarketsByChildId
) {
    if (!Array.isArray(childCustomers) || childCustomers.length === 0) return "";

    /** @type {Record<string, { noSelection?: true, markets?: Array<{ shopifyqlMarketId: string, handle: string }> }>} */
    const out = {};

    for (const c of childCustomers) {
        if (c.customerType !== "Shopify" || c.CustomerSettings?.shopifyMarketsEnabled !== true) continue;
        const id = String(c._id);
        const catalog = catalogsByChildId[id];
        if (!catalog || catalog.length === 0) continue;

        const excluded = excludedMarketsByChildId[id] || {};
        const enabled = catalog.filter((m) => excluded[m.shopifyqlMarketId] !== true);

        if (enabled.length === 0) {
            out[id] = { noSelection: true };
        } else if (enabled.length < catalog.length) {
            out[id] = {
                markets: enabled.map((m) => ({
                    shopifyqlMarketId: String(m.shopifyqlMarketId || "").trim(),
                    handle: m.handle || "",
                })),
            };
        }
    }

    return Object.keys(out).length === 0 ? "" : JSON.stringify(out);
}

/**
 * Build JSON for `adSpendPlatformOverrides` on parent aggregated API.
 * Only Shopify Markets children; omits child when no platforms excluded.
 *
 * @param {Array<Record<string, unknown>>} childCustomers
 * @param {Record<string, Record<string, true>>} excludedPlatformsByChildId — platform id keys (e.g. `facebook`)
 * @returns {string} JSON string or "" if no overrides
 */
export function buildParentAdSpendPlatformOverridesJson(childCustomers, excludedPlatformsByChildId) {
    if (!Array.isArray(childCustomers) || childCustomers.length === 0) return "";

    /** @type {Record<string, { exclude: string[] }>} */
    const out = {};

    for (const c of childCustomers) {
        if (c.customerType !== "Shopify" || c.CustomerSettings?.shopifyMarketsEnabled !== true) continue;
        const id = String(c._id);
        const exMap = excludedPlatformsByChildId[id] || {};
        const excludedIds = Object.keys(exMap).filter((k) => exMap[k] === true);
        if (excludedIds.length > 0) {
            out[id] = { exclude: excludedIds };
        }
    }

    return Object.keys(out).length === 0 ? "" : JSON.stringify(out);
}
