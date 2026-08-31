// src/lib/shopifyApi.js

import {
    normalizeShopifyShopDomain,
    shopifyAdminGraphqlEndpoint,
    getShopifyAdminApiVersion,
} from "./shopifyShopDomain";
import { shopifyAdminGraphqlPost } from "./shopifyAdminClient";

/**
 * Escapes a ShopifyQL query string for embedding in a GraphQL query.
 */
function escapeShopifyqlForGraphql(q) {
    return String(q).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isShopifyThrottled(json) {
    const errors = json?.errors;
    if (!Array.isArray(errors)) return false;
    return errors.some(
        (e) =>
            e?.extensions?.code === "THROTTLED" ||
            /rate limit/i.test(String(e?.message || ""))
    );
}

/**
 * Executes a ShopifyQL query against the Shopify Admin GraphQL API.
 * Requires read_reports scope.
 * @param {string} shopifyUrl - myshopify.com hostname (protocol optional)
 * @param {string} accessToken - Admin API access token
 * @param {string} shopifyqlQuery - ShopifyQL query string
 */
export async function shopifyqlQuery(shopifyUrl, accessToken, shopifyqlQuery, options = {}) {
    const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 5, 8));

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const escapedQuery = escapeShopifyqlForGraphql(shopifyqlQuery);
        const body = JSON.stringify({
            query: `query { shopifyqlQuery(query: "${escapedQuery}") { tableData { columns { name dataType displayName } rows } parseErrors } }`,
        });

        if (attempt === 1) {
            const domain = normalizeShopifyShopDomain(shopifyUrl);
            console.log(
                `[Shopify API] Request to shop: ${domain} (api ${getShopifyAdminApiVersion()})`
            );
            console.log(
                `[Shopify API] ShopifyQL: ${shopifyqlQuery.slice(0, 120)}${shopifyqlQuery.length > 120 ? "..." : ""}`
            );
        }

        const { res, json, endpoint, domain, apiVersion } = await shopifyAdminGraphqlPost(
            shopifyUrl,
            accessToken,
            body,
            { apiVersion: options.apiVersion }
        );
        if (apiVersion && apiVersion !== getShopifyAdminApiVersion() && attempt === 1) {
            console.warn(
                `[Shopify API] Using Admin API version ${apiVersion} (configured: ${getShopifyAdminApiVersion()})`
            );
        }

        if (!res.ok) {
            const errorBody = JSON.stringify(json) || (await res.text().catch(() => ""));
            console.error(
                `[Shopify API] Error ${res.status} ${res.statusText} for shop: ${domain}`
            );
            console.error(`[Shopify API] Endpoint: ${endpoint}`);
            console.error(`[Shopify API] Response:`, errorBody);
            if (res.status === 404) {
                console.error(
                    `[Shopify API] 404 hints: use *.myshopify.com (not custom domain), check API version (${getShopifyAdminApiVersion()}), verify access token and app scopes.`
                );
            }
            throw new Error(`Shopify API error: ${res.status}`);
        }

        const apiVersionHeader = res.headers.get("x-shopify-api-version");
        if (apiVersionHeader && attempt === 1) {
            console.log(`[Shopify API] X-Shopify-API-Version: ${apiVersionHeader}`);
        }

        if (isShopifyThrottled(json) && attempt < maxAttempts) {
            const waitMs = 400 * attempt * attempt;
            console.warn(
                `[Shopify API] Throttled for ${domain}, retry ${attempt}/${maxAttempts - 1} in ${waitMs}ms`
            );
            await sleep(waitMs);
            continue;
        }

        const shopifyql = json?.data?.shopifyqlQuery;
        const parseErrors = shopifyql?.parseErrors || [];
        const rows = shopifyql?.tableData?.rows || [];
        const gqlErrors = json?.errors || [];
        if (parseErrors?.length > 0) {
            console.warn(`[Shopify API] ShopifyQL parseErrors for ${domain}:`, parseErrors);
        }
        if (gqlErrors?.length > 0) {
            console.warn(`[Shopify API] GraphQL errors for ${domain}:`, gqlErrors);
        }
        if (rows.length === 0 && !parseErrors?.length && !gqlErrors?.length) {
            console.log(
                `[Shopify API] Empty rows for ${domain} (no parse/GraphQL errors). Possible causes: no sales in date range, or token missing read_reports scope.`
            );
        } else if (rows.length === 0 && isShopifyThrottled(json)) {
            console.warn(
                `[Shopify API] No rows after throttling for ${domain}. Markets overview may need fewer parallel requests.`
            );
        }
        console.log(
            `[Shopify API] Response: ${rows.length} rows, parseErrors: ${parseErrors.length}, gqlErrors: ${gqlErrors.length}`
        );
        return json;
    }

    return { data: { shopifyqlQuery: { tableData: { rows: [] }, parseErrors: [] } }, errors: [] };
}

export { normalizeShopifyShopDomain, shopifyAdminGraphqlEndpoint, getShopifyAdminApiVersion };
