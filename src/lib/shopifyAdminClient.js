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

/** @param {object} json */
export function shopifyGraphqlTopLevelErrors(json) {
    return Array.isArray(json?.errors) ? json.errors : [];
}

/** @param {object} json */
export function shopifyGraphqlIsThrottled(json) {
    return shopifyGraphqlTopLevelErrors(json).some(
        (e) =>
            e?.extensions?.code === "THROTTLED" ||
            /throttled/i.test(String(e?.message ?? ""))
    );
}

/**
 * @param {object} json
 * @param {number} attempt
 */
export function shopifyGraphqlThrottleWaitMs(json, attempt) {
    const ts = json?.extensions?.cost?.throttleStatus;
    const currentlyAvailable = ts?.currentlyAvailable;
    const restoreRate = ts?.restoreRate ?? 50;
    if (Number.isFinite(currentlyAvailable) && currentlyAvailable < 100) {
        const deficit = 100 - currentlyAvailable;
        return Math.min(20000, Math.ceil((deficit / restoreRate) * 1000) + 200);
    }
    return Math.min(20000, 500 * 2 ** attempt);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * GraphQL POST with THROTTLED / 429 / 5xx backoff (uses extensions.cost.throttleStatus when present).
 * @param {object} [options]
 * @param {number} [options.maxAttempts]
 */
export async function shopifyAdminGraphqlPostWithRetry(
    shopDomain,
    accessToken,
    payload,
    options = {}
) {
    const maxAttempts = options.maxAttempts ?? 8;
    let last = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        last = await shopifyAdminGraphqlPost(shopDomain, accessToken, payload, options);
        const throttled = shopifyGraphqlIsThrottled(last.json);
        const retryHttp = last.res.status === 429 || last.res.status >= 500;

        if (!throttled && !retryHttp) {
            return last;
        }

        const waitMs = throttled
            ? shopifyGraphqlThrottleWaitMs(last.json, attempt)
            : Math.min(20000, 500 * 2 ** attempt);
        await sleep(waitMs);
    }

    return last;
}

export { normalizeShopifyShopDomain, shopifyAdminGraphqlEndpoint, getShopifyAdminApiVersion };
