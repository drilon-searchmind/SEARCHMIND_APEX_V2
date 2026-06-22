import { fetchMergedSources } from "@/lib/mergedSourcesApi";
import { getDemoPayload, isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoMergedSourcesForRange } from "@/lib/demoMergedSources";
import { fetchMcpDataSource, loadCustomerForMcp } from "@root/lib/mcpDataService";
import { fetchMcpCustomerResource } from "@root/lib/mcpResourceService";
import {
    fetchMcpExtendedCustomerResource,
    fetchMcpExtendedGlobalResource,
} from "@root/lib/mcpExtendedService";
import { getCustomerById } from "@root/lib/customerOperations";
import { parseMcpDateRange } from "@root/lib/mcpApiHelpers";
import { queryParam } from "@root/lib/mcpQuery";
import { fetchMcpShopifyChannelAttribution } from "@root/lib/mcpShopifyChannelAttribution";

/** @typedef {{ description: string, method: 'GET', requiredParams?: string[], optionalParams?: string[], execute: (customerId: string, params: Record<string, string>) => Promise<unknown> }} McpApexProxyRoute */

function buildMergedSettings(data) {
    return {
        customerName: data.customerName,
        customerType: data.customerType || "Shopify",
        ...(data.CustomerSettings || {}),
        CustomerStaticExpenses: data.CustomerStaticExpenses || {},
    };
}

/** @type {Record<string, McpApexProxyRoute>} */
export const MCP_APEX_PROXY_ROUTES = {
    "/api/merged-sources": {
        description: "Combined store revenue and ad spend (daily overview backbone)",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        optionalParams: [
            "source",
            "shopifyMarkets",
            "shopifyMarketId",
            "shopifyMarketNoSelection",
            "shopifyMarketFilterAdSpend",
            "adSpendExclude",
        ],
        async execute(customerId, params) {
            const range = parseMcpDateRange(params.startDate, params.endDate);
            if (isDemoCustomerId(customerId)) {
                const customer = getDemoPayload("customer");
                const merged = getDemoMergedSourcesForRange(
                    range.startDate,
                    range.endDate,
                    customer,
                    {}
                );
                return {
                    customerId,
                    customerName: customer?.customerName || "Demo",
                    ...range,
                    ...merged,
                };
            }
            const doc = await getCustomerById(customerId);
            if (!doc) throw new Error("Customer not found");
            const data = doc.toObject ? doc.toObject() : doc;
            const merged = await fetchMergedSources(
                buildMergedSettings(data),
                range.startDate,
                range.endDate,
                {
                    dailyBreakdown: true,
                    source: queryParam(params, "source") || "mcp",
                }
            );
            return {
                customerId,
                customerName: data.customerName || "",
                ...range,
                ...merged,
            };
        },
    },
    "/api/markets-overview": {
        description: "Shopify markets overview rows",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpCustomerResource(customerId, "markets-overview", params);
        },
    },
    "/api/google-ads": {
        description: "Google Ads PPC dashboard metrics",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpDataSource("google-ads", customerId, params);
        },
    },
    "/api/facebook-ads": {
        description: "Meta/Facebook PS dashboard metrics",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpDataSource("facebook", customerId, params);
        },
    },
    "/api/klaviyo": {
        description: "Klaviyo email marketing metrics",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpDataSource("klaviyo-dashboard", customerId, params);
        },
    },
    "/api/shopify-products": {
        description: "Shopify product performance metrics",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        optionalParams: ["fast"],
        async execute(customerId, params) {
            return fetchMcpExtendedCustomerResource(customerId, "shopify-products", params);
        },
    },
    "/api/shopify-orders": {
        description: "Shopify order counts via ShopifyQL (read-only)",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpExtendedCustomerResource(customerId, "segmentation-shopifyql", {
                ...params,
                full: "false",
            });
        },
    },
    "/api/shopify-customers": {
        description: "Shopify new vs returning customers via ShopifyQL",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpExtendedCustomerResource(customerId, "segmentation-shopifyql", {
                ...params,
                full: "true",
            });
        },
    },
    "/api/shopify-analytics": {
        description: "Shopify store revenue metrics (store source only)",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpDataSource("store", customerId, params);
        },
    },
    "/api/seo-metrics": {
        description: "Google Search Console SEO metrics",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpDataSource("seo", customerId, params);
        },
    },
    "/api/customer-segmentation": {
        description: "Customer segmentation from merged sources",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpCustomerResource(customerId, "segmentation", params);
        },
    },
    "/api/data-wrapped": {
        description: "Monthly Data Wrapped summary",
        method: "GET",
        requiredParams: ["period"],
        async execute(customerId, params) {
            return fetchMcpExtendedCustomerResource(customerId, "data-wrapped", params);
        },
    },
    "/api/apex-radar": {
        description: "Apex Radar overview (Google or Meta)",
        method: "GET",
        requiredParams: ["startDate", "endDate", "channel"],
        async execute(customerId, params) {
            const channel = String(params.channel || "").trim().toLowerCase();
            if (channel === "google" || channel === "google-ads") {
                return fetchMcpExtendedGlobalResource("apex-radar-google-overview", {
                    ...params,
                    customerId,
                });
            }
            if (channel === "facebook" || channel === "meta") {
                return fetchMcpExtendedGlobalResource("apex-radar-facebook-overview", {
                    ...params,
                    customerId,
                });
            }
            throw new Error('channel must be "google-ads" or "facebook"');
        },
    },
};

/**
 * Routes with MCP handlers that are not on the default allowlist.
 * Admins can grant access per customer after a request_route_access approval.
 * @type {Record<string, McpApexProxyRoute>}
 */
export const MCP_APEX_APPROVABLE_ROUTES = {
    "/api/pinterest-ads": {
        description: "Pinterest Ads dashboard metrics",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpDataSource("pinterest", customerId, params);
        },
    },
    "/api/snapchat-ads": {
        description: "Snapchat Ads dashboard metrics",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpDataSource("snapchat", customerId, params);
        },
    },
    "/api/reddit-ads": {
        description: "Reddit Ads dashboard metrics",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpDataSource("reddit", customerId, params);
        },
    },
    "/api/bing-ads": {
        description: "Microsoft Bing Ads dashboard metrics",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpDataSource("bing", customerId, params);
        },
    },
    "/api/ga4-metrics": {
        description: "GA4 sessions and users by day",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpDataSource("ga4", customerId, params);
        },
    },
    "/api/shopify-channel-attribution": {
        description:
            "Shopify channel attribution via ShopifyQL (sales by sales_channel, sessions by referrer/UTM)",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpShopifyChannelAttribution(customerId, params);
        },
    },
};

/**
 * @param {string} route
 */
export function isAllowedMcpApexProxyRoute(route) {
    return Object.hasOwn(MCP_APEX_PROXY_ROUTES, normalizeApexProxyRoute(route));
}

/**
 * @param {string} route
 */
export function isMcpApexApprovableRoute(route) {
    return Object.hasOwn(MCP_APEX_APPROVABLE_ROUTES, normalizeApexProxyRoute(route));
}

/**
 * @param {string} route
 */
export function isMcpApexRouteImplemented(route) {
    const key = normalizeApexProxyRoute(route);
    return Object.hasOwn(MCP_APEX_PROXY_ROUTES, key) || Object.hasOwn(MCP_APEX_APPROVABLE_ROUTES, key);
}

/**
 * @param {string} route
 */
export function normalizeApexProxyRoute(route) {
    const raw = String(route || "").trim();
    if (!raw) return "";
    const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
    return withSlash.replace(/\/+$/, "") || withSlash;
}

/**
 * @param {string} route
 */
export function getMcpApexProxyRoute(route) {
    const key = normalizeApexProxyRoute(route);
    const def = MCP_APEX_PROXY_ROUTES[key] || MCP_APEX_APPROVABLE_ROUTES[key];
    if (!def) throw new Error(`Route not allowlisted: ${route}`);
    return def;
}

export function listMcpApexProxyRoutes() {
    return Object.entries(MCP_APEX_PROXY_ROUTES).map(([route, def]) => ({
        route,
        method: def.method,
        description: def.description,
        requiredParams: def.requiredParams || [],
        optionalParams: def.optionalParams || [],
        defaultAllowlisted: true,
    }));
}

export function listMcpApexApprovableRoutes() {
    return Object.entries(MCP_APEX_APPROVABLE_ROUTES).map(([route, def]) => ({
        route,
        method: def.method,
        description: def.description,
        requiredParams: def.requiredParams || [],
        optionalParams: def.optionalParams || [],
        defaultAllowlisted: false,
        requiresApproval: true,
    }));
}

/** Shopify proxy query types (ShopifyQL + Admin GraphQL templates). */
export const MCP_SHOPIFY_PROXY_QUERY_TYPES = [
    "SalesReport",
    "OrdersReport",
    "ProductsReport",
    "CustomersReport",
    "InventoryReport",
    "orders",
    "products",
    "customers",
    "inventory",
    "shop",
];

/** Google Ads GAQL resources allowlisted in FROM clauses. */
export const MCP_GOOGLE_ADS_GAQL_RESOURCES = [
    "campaign",
    "ad_group",
    "ad_group_ad",
    "keywords_view",
    "search_term_view",
    "customer",
    "campaign_budget",
    "geo_target_constant",
];

/** Meta proxy endpoints (read-only Graph API). */
export const MCP_META_PROXY_ENDPOINTS = [
    "insights",
    "campaigns",
    "adsets",
    "ads",
    "accounts",
];

/**
 * Resolve Shopify credentials for a customer (server-side only).
 * @param {string} customerId
 */
export async function loadShopifyCredentialsForMcp(customerId) {
    const customer = await loadCustomerForMcp(customerId);
    if (customer.isDemo) {
        return {
            shopUrl: "demo.myshopify.com",
            accessToken: "demo",
            isDemo: true,
        };
    }
    const cs = customer.settings || {};
    const shopUrl = cs.shopifyUrl;
    const accessToken = cs.shopifyApiPassword;
    if (!shopUrl || !accessToken) {
        throw new Error("Shopify not configured for this customer");
    }
    return { shopUrl, accessToken, isDemo: false };
}

/**
 * Resolve Meta ad account for a customer.
 * @param {string} customerId
 */
export async function loadMetaAdAccountForMcp(customerId) {
    const customer = await loadCustomerForMcp(customerId);
    const cs = customer.settings || {};
    const adAccountId = cs.facebookAdAccountId;
    if (!adAccountId && !customer.isDemo) {
        throw new Error("Meta ad account not configured for this customer");
    }
    const token = process.env.FACEBOOK_APP_TOKEN;
    if (!token && !customer.isDemo) {
        throw new Error("Facebook app token not configured on server");
    }
    return {
        adAccountId: adAccountId || "act_demo",
        metaIdInclude: cs.customerMetaID || "",
        metaIdExclude: cs.customerMetaIDExclude || "",
        accessToken: token || "",
        isDemo: customer.isDemo,
    };
}

/**
 * Resolve Google Ads customer id(s) for a customer.
 * @param {string} customerId
 */
export async function loadGoogleAdsCustomerIdForMcp(customerId) {
    const customer = await loadCustomerForMcp(customerId);
    const googleAdsCustomerId = customer.settings?.googleAdsCustomerId;
    if (!googleAdsCustomerId && !customer.isDemo) {
        throw new Error("Google Ads customer ID not configured for this customer");
    }
    return {
        googleAdsCustomerId: googleAdsCustomerId || "0000000000",
        isDemo: customer.isDemo,
    };
}
