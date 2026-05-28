/** ShopifyQL `sales_channel` value for the Online Store channel. */
export const SHOPIFY_SALES_CHANNEL_ONLINE_STORE = "Online Store";

/**
 * When true, Shopify revenue queries only include Online Store sales (not POS, etc.).
 * @param {Record<string, unknown> | null | undefined} settings
 */
export function isShopifyOnlineStoreOnlyEnabled(settings) {
    return settings?.shopifyOnlineStoreOnly === true;
}

/** @param {string} value */
export function escapeShopifyQlString(value) {
    return String(value).replace(/'/g, "''");
}

/**
 * Append Online Store filter to ShopifyQL WHERE parts (mutates array).
 * @param {string[]} whereParts
 * @param {Record<string, unknown> | null | undefined} settings
 */
export function appendShopifyOnlineStoreFilter(whereParts, settings) {
    if (!isShopifyOnlineStoreOnlyEnabled(settings)) return;
    whereParts.push(
        `sales_channel = '${escapeShopifyQlString(SHOPIFY_SALES_CHANNEL_ONLINE_STORE)}'`
    );
}

/**
 * @param {string[]} whereParts
 * @returns {string} `WHERE …` or empty string
 */
export function shopifySalesWhereClause(whereParts) {
    return whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
}

/**
 * Shopify Admin order search filter for Online Store only (`source_name:web`).
 * @param {Record<string, unknown> | null | undefined} settings
 * @returns {string|null}
 */
export function shopifyOrderSearchOnlineStoreClause(settings) {
    return isShopifyOnlineStoreOnlyEnabled(settings) ? "source_name:web" : null;
}

/**
 * @param {string} baseQuery - existing order search query
 * @param {Record<string, unknown> | null | undefined} settings
 */
export function combineShopifyOrderSearchQuery(baseQuery, settings) {
    const channelClause = shopifyOrderSearchOnlineStoreClause(settings);
    if (!channelClause) return baseQuery;
    return `${baseQuery} AND ${channelClause}`;
}
