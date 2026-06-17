/**
 * Thin Context.dev REST client for ClickUp enrichment scripts.
 * Docs: https://docs.context.dev/introduction
 */

const API_BASE = "https://api.context.dev/v1";

export function getContextDevApiKey() {
    const key =
        process.env.CONTEXT_DEV_API_KEY?.trim() ||
        process.env.CONTEXT_API_KEY?.trim() ||
        "";
    if (!key) {
        throw new Error(
            "Missing Context.dev API key. Set CONTEXT_DEV_API_KEY or CONTEXT_API_KEY in .env"
        );
    }
    return key;
}

async function parseJsonResponse(res) {
    const text = await res.text();
    let json;
    try {
        json = text ? JSON.parse(text) : {};
    } catch {
        json = { message: text };
    }
    return { json, ok: res.ok, status: res.status, headers: res.headers };
}

export async function contextDevRequest(path, { method = "GET", query, body, timeoutMS = 120000 } = {}) {
    const apiKey = getContextDevApiKey();
    const url = new URL(`${API_BASE}${path}`);
    if (query) {
        for (const [key, value] of Object.entries(query)) {
            if (value != null && value !== "") {
                url.searchParams.set(key, String(value));
            }
        }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMS);

    try {
        const res = await fetch(url.toString(), {
            method,
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${apiKey}`,
                ...(body ? { "Content-Type": "application/json" } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });

        const { json, ok, status, headers } = await parseJsonResponse(res);

        if (status === 429) {
            const retryAfter = Number(headers.get("Retry-After") || 5);
            const err = new Error(json.message || "Rate limited by Context.dev");
            err.code = "RATE_LIMITED";
            err.retryAfterSec = retryAfter;
            throw err;
        }

        if (!ok) {
            const err = new Error(json.message || `Context.dev HTTP ${status}`);
            err.code = json.error_code || "CONTEXT_DEV_ERROR";
            err.status = status;
            err.keyMetadata = json.key_metadata;
            throw err;
        }

        return json;
    } finally {
        clearTimeout(timer);
    }
}

/** 1 credit — raw HTML for platform / tag detection */
export async function scrapeHtml(url, { timeoutMS = 90000 } = {}) {
    return contextDevRequest("/web/scrape/html", {
        query: { url, maxAgeMs: 604800000, timeoutMS },
        timeoutMS: timeoutMS + 5000,
    });
}

/** 10 credits — brand profile */
export async function retrieveBrand(domain, { timeoutMS = 90000 } = {}) {
    return contextDevRequest("/brand/retrieve", {
        query: { domain, timeoutMS },
        timeoutMS: timeoutMS + 5000,
    });
}

/** 10 credits — structured extraction */
export async function extractStructuredData(url, { schema, instructions, maxPages = 5, timeoutMS = 120000 } = {}) {
    return contextDevRequest("/web/extract", {
        method: "POST",
        body: {
            url,
            schema,
            instructions,
            maxPages,
            maxDepth: 2,
            factCheck: false,
            timeoutMS,
        },
        timeoutMS: timeoutMS + 10000,
    });
}

export const APEX_ENRICHMENT_SCHEMA = {
    type: "object",
    properties: {
        company_display_name: {
            type: "string",
            description:
                "Official company or brand name shown on the website (not the domain).",
        },
        business_model: {
            type: "string",
            enum: ["ecommerce", "b2b", "hybrid", "unknown"],
            description:
                "ecommerce = sells products/services online to consumers; b2b = lead-gen / corporate services without a webshop; hybrid = both.",
        },
        store_platform: {
            type: "string",
            enum: ["Shopify", "WooCommerce", "Magento", "DanDomain", "Other", "unknown"],
            description:
                "Underlying ecommerce platform if detectable (Shopify, WooCommerce/WordPress shop, Magento, DanDomain HostedShop, or Other).",
        },
        primary_currency: {
            type: "string",
            description: "Primary store currency ISO code if visible (e.g. DKK, EUR, SEK).",
        },
        sells_products_online: {
            type: "boolean",
            description: "True if the site has a product catalog, cart, or checkout.",
        },
        sells_to_businesses_only: {
            type: "boolean",
            description: "True if the site primarily targets B2B buyers (quotes, dealers, wholesale).",
        },
        company_description: {
            type: "string",
            description: "One-sentence description of what the company does.",
        },
        industry: {
            type: "string",
            description: "Industry or vertical (e.g. fashion, industrial equipment, healthcare).",
        },
        ga4_measurement_id: {
            type: "string",
            description:
                "Google Analytics 4 measurement ID if visible in scripts (format G-XXXXXXXX). Leave empty if not found.",
        },
        google_tag_manager_id: {
            type: "string",
            description: "Google Tag Manager container ID if visible (format GTM-XXXX). Leave empty if not found.",
        },
        ga4_property_id: {
            type: "string",
            description:
                "Numeric GA4 property ID ONLY if explicitly stated on the site. Usually not public — leave empty if unsure.",
        },
        notes: {
            type: "string",
            description: "Any other useful onboarding notes for a marketing dashboard setup.",
        },
    },
    additionalProperties: false,
};

export const APEX_ENRICHMENT_INSTRUCTIONS = `Analyze this Danish/European company website for marketing dashboard onboarding.
Detect ecommerce platform (Shopify, WooCommerce, Magento, DanDomain HostedShop) from page structure, cart, checkout, or tech hints.
Decide if the business is primarily ecommerce (online store) or B2B (lead generation, corporate site, dealer portal without consumer checkout).
Look for Google Analytics / GTM IDs in page scripts if present.
Prefer facts from the homepage, shop pages, and about page.`;
