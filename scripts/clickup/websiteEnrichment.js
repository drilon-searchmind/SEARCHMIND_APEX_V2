/**
 * Heuristics to map scraped website data → APEX Customer model fields.
 */

const CUSTOMER_TYPES = new Set(["Shopify", "WooCommerce", "Magento", "DanDomain", "Other"]);

export function normalizeDomain(input) {
    let d = String(input || "").trim();
    if (!d) return "";
    d = d.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/^www\./i, "");
    return d.toLowerCase();
}

export function domainToWebsiteUrl(domainOrName) {
    const domain = normalizeDomain(domainOrName);
    if (!domain) return "";
    return `https://${domain}`;
}

export function detectPlatformFromHtml(html, websiteUrl) {
    const h = (html || "").toLowerCase();
    const signals = [];
    const url = websiteUrl.replace(/\/$/, "");

    if (
        h.includes("cdn.shopify.com") ||
        h.includes("shopify.com/s/files") ||
        h.includes("myshopify.com") ||
        h.includes("shopify-features") ||
        h.includes("shopify.theme")
    ) {
        signals.push("shopify");
        return {
            customer_type: "Shopify",
            shopify_url: url,
            platform_signals: signals,
            confidence: "high",
        };
    }

    if (
        h.includes("woocommerce") ||
        h.includes("wp-content/plugins/woocommerce") ||
        (h.includes("wp-content") && (h.includes("add-to-cart") || h.includes("product")))
    ) {
        signals.push("woocommerce");
        return {
            customer_type: "WooCommerce",
            woo_commerce_api_url: `${url}/wp-json/wc/v3`,
            platform_signals: signals,
            confidence: "high",
        };
    }

    if (
        h.includes("magento") ||
        h.includes("mage/cookies") ||
        h.includes("/static/version") ||
        h.includes("x-magento")
    ) {
        signals.push("magento");
        return {
            customer_type: "Magento",
            magento_base_url: url,
            platform_signals: signals,
            confidence: "high",
        };
    }

    if (
        h.includes("hostedshop") ||
        h.includes("dandomain") ||
        h.includes("dan-domain") ||
        h.includes("shop.dandomain")
    ) {
        signals.push("dandomain");
        try {
            return {
                customer_type: "DanDomain",
                dan_domain_shop_host: new URL(url).hostname,
                platform_signals: signals,
                confidence: "medium",
            };
        } catch {
            return {
                customer_type: "DanDomain",
                dan_domain_shop_host: "",
                platform_signals: signals,
                confidence: "medium",
            };
        }
    }

    if (h.includes("squarespace") || h.includes("static1.squarespace")) {
        signals.push("squarespace");
    }
    if (h.includes("prestashop")) signals.push("prestashop");
    if (h.includes("bigcommerce")) signals.push("bigcommerce");

    return {
        customer_type: signals.length ? "Other" : "",
        platform_signals: signals,
        confidence: signals.length ? "low" : "",
    };
}

export function detectTrackingFromHtml(html) {
    const text = html || "";
    const allGa4 = [...text.matchAll(/\bG-[A-Z0-9]{6,}\b/gi)].map((m) => m[0].toUpperCase());
    const ga4Measurement =
        allGa4.find((id) => isPlausibleGa4MeasurementId(id)) || "";
    const gtmId = text.match(/\bGTM-[A-Z0-9]+\b/i)?.[0]?.toUpperCase() || "";
    const uaId = text.match(/\bUA-\d+-\d+\b/i)?.[0]?.toUpperCase() || "";

    const propertyMatch = text.match(
        /(?:ga4\s*property|property\s*id|analytics\s*property)[^\d]{0,20}(\d{6,12})/i
    );
    const ga4PropertyId = propertyMatch?.[1] || "";

    return {
        ga4_measurement_id: ga4Measurement,
        google_tag_manager_id: gtmId,
        universal_analytics_id: uaId,
        ga4_property_id: ga4PropertyId,
    };
}

function isPlausibleGa4MeasurementId(id) {
    if (!id || !/^G-[A-Z0-9]{6,12}$/i.test(id)) return false;
    const upper = id.toUpperCase();
    const blocklist = new Set(["G-RECAPTCHA", "G-PLACEHOLDER", "G-XXXXXXXXXX"]);
    return !blocklist.has(upper);
}

export function mapBusinessCategory(extractData, htmlHints = {}) {
    const model = String(extractData?.business_model || "").toLowerCase();
    if (model === "b2b") return "b2b";
    if (model === "ecommerce") return "ecommerce";
    if (model === "hybrid") return "ecommerce";

    if (extractData?.sells_to_businesses_only === true && extractData?.sells_products_online !== true) {
        return "b2b";
    }
    if (extractData?.sells_products_online === true) return "ecommerce";
    if (htmlHints.customer_type && htmlHints.customer_type !== "Other") return "ecommerce";
    return "";
}

export function mergeEnrichment({ clickupId, clickupName, websiteUrl, htmlResult, brandResult, extractResult }) {
    const html = htmlResult?.html || "";
    const platform = detectPlatformFromHtml(html, websiteUrl);
    const tracking = detectTrackingFromHtml(html);
    const data = extractResult?.data || {};
    const brand = brandResult?.brand || brandResult || {};

    const brandTitle = brand.title || brand.name || "";
    const brandIndustry =
        brand.industry?.eic?.[0]?.subindustry ||
        brand.industry?.eic?.[0]?.industry ||
        brand.industry ||
        "";

    let customerType =
        data.store_platform && CUSTOMER_TYPES.has(data.store_platform)
            ? data.store_platform
            : platform.customer_type || "";

    if (customerType === "unknown") customerType = "";

    const businessCategory = mapBusinessCategory(data, platform);

    const suggestedName =
        data.company_display_name ||
        brandTitle ||
        clickupName.replace(/\.(dk|com|se|no|eu)$/i, "").replace(/\./g, " ");

    const ga4PropertyId = data.ga4_property_id || tracking.ga4_property_id || "";
    let ga4MeasurementId = data.ga4_measurement_id || tracking.ga4_measurement_id || "";
    if (!isPlausibleGa4MeasurementId(ga4MeasurementId)) ga4MeasurementId = "";
    const gtmId = data.google_tag_manager_id || tracking.google_tag_manager_id || "";

    const signals = [
        ...(platform.platform_signals || []),
        ga4MeasurementId ? `ga4:${ga4MeasurementId}` : "",
        gtmId ? `gtm:${gtmId}` : "",
        tracking.universal_analytics_id ? `ua:${tracking.universal_analytics_id}` : "",
    ].filter(Boolean);

    const notes = [data.notes].filter(Boolean).join(" | ");

    let confidence = platform.confidence || "medium";
    if (customerType && businessCategory) confidence = "high";
    else if (!customerType && !businessCategory) confidence = "low";

    return {
        clickup_id: clickupId,
        clickup_name: clickupName,
        website_url: websiteUrl,
        suggested_customer_name: suggestedName,
        business_category: businessCategory,
        customer_type: businessCategory === "b2b" ? "Other" : customerType || "Other",
        shopify_url: platform.shopify_url || "",
        woo_commerce_api_url: platform.woo_commerce_api_url || "",
        magento_base_url: platform.magento_base_url || "",
        dan_domain_shop_host: platform.dan_domain_shop_host || "",
        ga4_property_id: ga4PropertyId,
        ga4_measurement_id: ga4MeasurementId,
        google_tag_manager_id: gtmId,
        google_search_console_property: websiteUrl.endsWith("/") ? websiteUrl : `${websiteUrl}/`,
        bing_webmaster_site_url: websiteUrl.endsWith("/") ? websiteUrl : `${websiteUrl}/`,
        customer_store_valuta_code: (data.primary_currency || "DKK").toUpperCase().slice(0, 3),
        company_description: data.company_description || brand.description || "",
        industry: data.industry || brandIndustry || "",
        sells_products_online: data.sells_products_online === true ? "yes" : data.sells_products_online === false ? "no" : "",
        sells_to_businesses_only: data.sells_to_businesses_only === true ? "yes" : data.sells_to_businesses_only === false ? "no" : "",
        platform_signals: signals.join("; "),
        enrichment_confidence: confidence,
        enrichment_notes: notes,
        context_urls_analyzed: (extractResult?.urls_analyzed || []).join(" | "),
        enrichment_status: "ok",
        enrichment_error: "",
        enriched_at: new Date().toISOString(),
    };
}

export function emptyEnrichmentRow({ clickupId, clickupName, websiteUrl, status, error }) {
    return {
        clickup_id: clickupId,
        clickup_name: clickupName,
        website_url: websiteUrl,
        suggested_customer_name: "",
        business_category: "",
        customer_type: "",
        shopify_url: "",
        woo_commerce_api_url: "",
        magento_base_url: "",
        dan_domain_shop_host: "",
        ga4_property_id: "",
        ga4_measurement_id: "",
        google_tag_manager_id: "",
        google_search_console_property: "",
        bing_webmaster_site_url: "",
        customer_store_valuta_code: "",
        company_description: "",
        industry: "",
        sells_products_online: "",
        sells_to_businesses_only: "",
        platform_signals: "",
        enrichment_confidence: "",
        enrichment_notes: "",
        context_urls_analyzed: "",
        enrichment_status: status,
        enrichment_error: error || "",
        enriched_at: new Date().toISOString(),
    };
}
