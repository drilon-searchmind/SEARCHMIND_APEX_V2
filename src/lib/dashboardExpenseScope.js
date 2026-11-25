/**
 * Build expenseScope for /dashboard views from Shopify Markets filter state.
 * When all markets are included (or markets feature off), returns null → global costs.
 */

/**
 * @param {{
 *   shopifyMarketsFeatureOn?: boolean,
 *   shopifyMarkets?: Array<{ shopifyqlMarketId?: string }>,
 *   appliedExcludedShopifyMarkets?: Record<string, boolean>,
 * }} filters
 * @returns {{ mode: 'selection', marketIds: string[] } | null}
 */
export function expenseScopeFromMarketFilters(filters) {
    if (!filters?.shopifyMarketsFeatureOn) return null;
    const all = Array.isArray(filters.shopifyMarkets) ? filters.shopifyMarkets : [];
    if (all.length === 0) return null;
    const excluded = filters.appliedExcludedShopifyMarkets || {};
    const selected = all
        .map((m) => String(m.shopifyqlMarketId || "").trim())
        .filter((id) => id && excluded[id] !== true);
    if (selected.length === 0) return null;
    if (selected.length >= all.length) return null;
    return { mode: "selection", marketIds: selected };
}
