/**
 * Normalize Shopify Admin API host (myshopify.com only, no protocol/path).
 */

export function getShopifyAdminApiVersion() {
    const fromEnv = process.env.SHOPIFY_ADMIN_API_VERSION?.trim();
    return fromEnv || "2026-01";
}

/**
 * Admin API versions to try for ShopifyQL queries that need newer agentic dimensions.
 * Ordered newest-first; agentic_sales_channel requires a recent ShopifyQL schema.
 */
export const SHOPIFY_AGENTIC_SHOPIFYQL_API_VERSIONS = ["2026-04", "2026-01", "2025-10"];

/**
 * @param {string} shop — CustomerSettings.shopifyUrl or similar
 * @returns {string} e.g. store.myshopify.com
 */
export function normalizeShopifyShopDomain(shop) {
    let host = String(shop ?? "").trim();
    if (!host) return "";
    host = host.replace(/^https?:\/\//i, "");
    const slash = host.indexOf("/");
    if (slash >= 0) host = host.slice(0, slash);
    host = host.split("?")[0].split("#")[0];
    return host.replace(/\/$/, "").toLowerCase();
}

/**
 * @param {string} shop
 * @returns {string}
 */
export function shopifyAdminGraphqlEndpoint(shop, apiVersion) {
    const domain = normalizeShopifyShopDomain(shop);
    if (!domain) return "";
    const version = apiVersion?.trim() || getShopifyAdminApiVersion();
    return `https://${domain}/admin/api/${version}/graphql.json`;
}

/** Stable Admin API versions to try when configured version returns HTTP 404. */
export const SHOPIFY_ADMIN_API_VERSION_FALLBACKS = ["2026-04", "2026-01", "2025-10", "2025-07"];
