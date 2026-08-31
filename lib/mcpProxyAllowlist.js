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
import { fetchMcpShopifyReferrerDomainSessions } from "@root/lib/mcpShopifyReferrerDomainSessions";
import { fetchMcpMetaAdCreatives } from "@root/lib/mcpMetaAdCreatives";
import { fetchMcpShopifyAgenticAttribution } from "@root/lib/mcpShopifyAgenticAttribution";
import { fetchWeeklyAudit } from "@root/lib/weeklyAuditApi";
import {
    fetchKlaviyoFlowsOverview,
    fetchKlaviyoScheduledCampaigns,
} from "@/lib/klaviyoPlanningApi";
import { getDemoKlaviyoFlowsOverview, getDemoKlaviyoScheduledCampaigns } from "@/lib/demoAdMetrics";

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
    "/api/weekly-audit": {
        description:
            "Compact weekly audit JSON — blended KPIs, PPC/PS/SEO/EM summaries, top sellers (server-side aggregation)",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        optionalParams: ["compare", "periodStart", "periodEnd"],
        async execute(customerId, params) {
            const periodStart = params.periodStart || params.startDate;
            const periodEnd = params.periodEnd || params.endDate;
            const compareRaw = String(params.compare || "prev_period").trim();
            const compare = compareRaw === "yoy" ? "yoy" : "prev_period";
            return fetchWeeklyAudit(customerId, {
                periodStart: String(periodStart).trim(),
                periodEnd: String(periodEnd).trim(),
                compare,
            });
        },
    },
    "/api/klaviyo-scheduled-campaigns": {
        description:
            "Klaviyo planned email campaigns (scheduled, draft, preparing) — calendar / pipeline view",
        method: "GET",
        optionalParams: ["daysAhead", "includeDrafts"],
        async execute(customerId, params) {
            const daysAhead = params.daysAhead != null ? Number(params.daysAhead) : 60;
            const includeDrafts = String(params.includeDrafts ?? "true") !== "false";
            if (isDemoCustomerId(customerId)) {
                return { customerId, ...getDemoKlaviyoScheduledCampaigns(daysAhead) };
            }
            const doc = await getCustomerById(customerId);
            if (!doc) throw new Error("Customer not found");
            const apiKey = doc?.CustomerSettings?.klaviyoPrivateApiKey;
            if (!apiKey?.trim()) throw new Error("Klaviyo not configured for this customer");
            const data = await fetchKlaviyoScheduledCampaigns(apiKey.trim(), {
                daysAhead,
                includeDrafts,
            });
            return { customerId, customerName: doc.customerName || "", ...data };
        },
    },
    "/api/klaviyo-flows": {
        description:
            "Klaviyo flow setup — triggers, delays, and email steps per flow (strategy / best-practice view)",
        method: "GET",
        optionalParams: ["includeActions", "status", "maxFlows"],
        async execute(customerId, params) {
            const includeActions = String(params.includeActions ?? "true") !== "false";
            const status = params.status ? String(params.status).trim().toLowerCase() : null;
            const maxFlows = params.maxFlows != null ? Number(params.maxFlows) : 80;
            if (isDemoCustomerId(customerId)) {
                return { customerId, ...getDemoKlaviyoFlowsOverview() };
            }
            const doc = await getCustomerById(customerId);
            if (!doc) throw new Error("Customer not found");
            const apiKey = doc?.CustomerSettings?.klaviyoPrivateApiKey;
            if (!apiKey?.trim()) throw new Error("Klaviyo not configured for this customer");
            const data = await fetchKlaviyoFlowsOverview(apiKey.trim(), {
                includeActions,
                status,
                maxFlows,
            });
            return { customerId, customerName: doc.customerName || "", ...data };
        },
    },
    "/api/shopify-channel-attribution": {
        description:
            "Shopify channel attribution via ShopifyQL (sales by sales_channel, sessions by referrer/UTM/referrer_domain)",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpShopifyChannelAttribution(customerId, params);
        },
    },
    "/api/shopify-referrer-domain-sessions": {
        description:
            "Shopify sessions grouped by referrer_domain (domain-level traffic, UTM-independent — for Perplexity/ChatGPT/Copilot comparisons)",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpShopifyReferrerDomainSessions(customerId, params);
        },
    },
    "/api/shopify-agentic-attribution": {
        description:
            "Shopify Agentic Storefronts attribution via ShopifyQL (agentic_sales_channel, agentic_referring_channel)",
        method: "GET",
        requiredParams: ["startDate", "endDate"],
        async execute(customerId, params) {
            return fetchMcpShopifyAgenticAttribution(customerId, params);
        },
    },
    "/api/meta-ad-creatives": {
        description:
            "Live Meta/Facebook ads with creative thumbnails (default: ACTIVE ads only). Optional limit, activeOnly.",
        method: "GET",
        requiredParams: [],
        optionalParams: ["limit", "activeOnly"],
        async execute(customerId, params) {
            return fetchMcpMetaAdCreatives(customerId, params);
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
    "AgenticSalesReport",
    "AgenticReferringReport",
    "orders",
    "ordersAttribution",
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
    "ads-with-creatives",
    "ad-preview",
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
export { loadMetaAdAccountForMcp } from "@root/lib/mcpMetaAccount";

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
