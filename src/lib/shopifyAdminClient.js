import {
    normalizeShopifyShopDomain,
    shopifyAdminGraphqlEndpoint,
    getShopifyAdminApiVersion,
    SHOPIFY_ADMIN_API_VERSION_FALLBACKS,
} from "./shopifyShopDomain.js";

/**
 * POST to Shopify Admin GraphQL; follows redirects without turning POST into GET.
 * @param {object} [options]
 * @param {string} [options.apiVersion] — override Admin API version in URL
 */
export async function shopifyAdminGraphqlFetch(shopDomain, accessToken, body, options = {}) {
    let domain = normalizeShopifyShopDomain(shopDomain);
    if (!domain) {
        throw new Error("Shopify shop domain is missing or invalid");
    }
    let endpoint = shopifyAdminGraphqlEndpoint(domain, options.apiVersion);

    for (let hop = 0; hop < 4; hop++) {
        const res = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": accessToken,
            },
            body,
            redirect: "manual",
        });

        if ([301, 302, 307, 308].includes(res.status)) {
            const location = res.headers.get("location");
            if (!location) break;
            const nextUrl = new URL(location, endpoint);
            domain = nextUrl.hostname;
            endpoint = nextUrl.href;
            console.warn(
                `[Shopify API] Redirect ${res.status} for ${shopDomain} → using ${domain}`
            );
            continue;
        }

        return { res, endpoint, domain };
    }

    throw new Error(`Shopify API redirect loop for shop: ${shopDomain}`);
}

/**
 * POST + parse JSON; on HTTP 404 with generic "Not Found", retries other stable API versions.
 */
export async function shopifyAdminGraphqlPost(shopDomain, accessToken, payload, options = {}) {
    const body =
        typeof payload === "string"
            ? payload
            : JSON.stringify(payload);

    const primaryVersion = options.apiVersion || getShopifyAdminApiVersion();
    const versionsToTry = [
        primaryVersion,
        ...SHOPIFY_ADMIN_API_VERSION_FALLBACKS.filter((v) => v !== primaryVersion),
    ];

    let last = null;
    for (const apiVersion of versionsToTry) {
        const { res, endpoint, domain } = await shopifyAdminGraphqlFetch(
            shopDomain,
            accessToken,
            body,
            { apiVersion }
        );
        const json = await res.json().catch(() => ({}));
        last = { res, json, endpoint, domain, apiVersion };

        if (res.status !== 404) {
            return last;
        }

        const errMsg = JSON.stringify(json?.errors ?? json);
        const genericNotFound =
            /not found/i.test(errMsg) || errMsg === '{"errors":"Not Found"}';
        if (!genericNotFound) {
            return last;
        }

        if (apiVersion !== versionsToTry[versionsToTry.length - 1]) {
            console.warn(
                `[Shopify API] HTTP 404 on api ${apiVersion} for ${domain}; retrying another Admin API version`
            );
        }
    }

    return last;
}

export { normalizeShopifyShopDomain, shopifyAdminGraphqlEndpoint, getShopifyAdminApiVersion };
