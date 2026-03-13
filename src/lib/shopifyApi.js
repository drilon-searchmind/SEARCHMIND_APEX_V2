// src/lib/shopifyApi.js



/**
 * Executes a ShopifyQL query against the Shopify Admin GraphQL API.
 * @param {string} shopifyUrl - The shop's myshopify.com domain (e.g. 'your-store.myshopify.com')
 * @param {string} accessToken - The Shopify Admin API access token (API password)
 * @param {string} shopifyqlQuery - The ShopifyQL query string
 * @returns {Promise<object>} - The raw response from Shopify
 */
export async function shopifyqlQuery(shopifyUrl, accessToken, shopifyqlQuery) {
    const endpoint = `https://${shopifyUrl}/admin/api/2025-10/graphql.json`;
    const body = JSON.stringify({
        query: `query { shopifyqlQuery(query: "${shopifyqlQuery}") { tableData { columns { name dataType displayName } rows } parseErrors } }`
    });
    console.log(`[Shopify API] Request to shop: ${shopifyUrl}`);
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
        },
        body,
    });
    if (!res.ok) {
        const errorBody = await res.text();
        console.error(`[Shopify API] Error ${res.status} ${res.statusText} for shop: ${shopifyUrl}`);
        console.error(`[Shopify API] Response body:`, errorBody);
        throw new Error(`Shopify API error: ${res.status}`);
    }
    return res.json();
}
