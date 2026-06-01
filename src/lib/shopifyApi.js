// src/lib/shopifyApi.js

/**
 * Escapes a ShopifyQL query string for embedding in a GraphQL query.
 */
function escapeShopifyqlForGraphql(q) {
    return String(q).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Executes a ShopifyQL query against the Shopify Admin GraphQL API.
 * Requires read_reports scope. Unauthenticated_read_* scopes do NOT work for this.
 * @param {string} shopifyUrl - The shop's myshopify.com domain (e.g. 'your-store.myshopify.com')
 * @param {string} accessToken - The Shopify Admin API access token (API password)
 * @param {string} shopifyqlQuery - The ShopifyQL query string
 * @returns {Promise<object>} - The raw response from Shopify
 */
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
 * @param {object} [options]
 * @param {number} [options.maxAttempts]
 */
export async function shopifyqlQuery(shopifyUrl, accessToken, shopifyqlQuery, options = {}) {
    const endpoint = `https://${shopifyUrl}/admin/api/2025-10/graphql.json`;
    const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 5, 8));

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const escapedQuery = escapeShopifyqlForGraphql(shopifyqlQuery);
        const body = JSON.stringify({
            query: `query { shopifyqlQuery(query: "${escapedQuery}") { tableData { columns { name dataType displayName } rows } parseErrors } }`,
        });
        if (attempt === 1) {
            console.log(`[Shopify API] Request to shop: ${shopifyUrl}`);
            console.log(
                `[Shopify API] ShopifyQL: ${shopifyqlQuery.slice(0, 120)}${shopifyqlQuery.length > 120 ? "..." : ""}`
            );
        }
        const res = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": accessToken,
            },
            body,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            const errorBody = JSON.stringify(json) || (await res.text());
            console.error(`[Shopify API] Error ${res.status} ${res.statusText} for shop: ${shopifyUrl}`);
            console.error(`[Shopify API] Response:`, errorBody);
            throw new Error(`Shopify API error: ${res.status}`);
        }

        if (isShopifyThrottled(json) && attempt < maxAttempts) {
            const waitMs = 400 * attempt * attempt;
            console.warn(
                `[Shopify API] Throttled for ${shopifyUrl}, retry ${attempt}/${maxAttempts - 1} in ${waitMs}ms`
            );
            await sleep(waitMs);
            continue;
        }

        const shopifyql = json?.data?.shopifyqlQuery;
        const parseErrors = shopifyql?.parseErrors || [];
        const rows = shopifyql?.tableData?.rows || [];
        const gqlErrors = json?.errors || [];
        if (parseErrors?.length > 0) {
            console.warn(`[Shopify API] ShopifyQL parseErrors for ${shopifyUrl}:`, parseErrors);
        }
        if (gqlErrors?.length > 0) {
            console.warn(`[Shopify API] GraphQL errors for ${shopifyUrl}:`, gqlErrors);
        }
        if (rows.length === 0 && !parseErrors?.length && !gqlErrors?.length) {
            console.log(
                `[Shopify API] Empty rows for ${shopifyUrl} (no parse/GraphQL errors). Possible causes: no sales in date range, or token missing read_reports scope.`
            );
        } else if (rows.length === 0 && isShopifyThrottled(json)) {
            console.warn(
                `[Shopify API] No rows after throttling for ${shopifyUrl}. Markets overview may need fewer parallel requests.`
            );
        }
        console.log(
            `[Shopify API] Response: ${rows.length} rows, parseErrors: ${parseErrors.length}, gqlErrors: ${gqlErrors.length}`
        );
        return json;
    }

    return { data: { shopifyqlQuery: { tableData: { rows: [] }, parseErrors: [] } }, errors: [] };
}
