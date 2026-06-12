import { sanitizeForMcp } from "@root/lib/mcpSanitize";
import {
    assertMcpProxyRateLimit,
    assertRequiredParams,
    logMcpProxyAudit,
    normalizeProxyParams,
} from "@root/lib/mcpProxyGuardrails";
import {
    getMcpApexProxyRoute,
    isAllowedMcpApexProxyRoute,
    listMcpApexProxyRoutes,
    MCP_GOOGLE_ADS_GAQL_RESOURCES,
    MCP_META_PROXY_ENDPOINTS,
    MCP_SHOPIFY_PROXY_QUERY_TYPES,
    normalizeApexProxyRoute,
} from "@root/lib/mcpProxyAllowlist";
import { executeMcpGoogleAdsGaqlProxy } from "@root/lib/mcpGoogleAdsProxy";
import { executeMcpMetaProxy } from "@root/lib/mcpMetaProxy";
import { executeMcpShopifyProxy } from "@root/lib/mcpShopifyProxy";

/**
 * @param {string} route
 * @param {string} customerId
 * @param {Record<string, unknown>} [params]
 * @param {{ keyId?: string, authMethod?: string }} [auditContext]
 */
export async function executeMcpApexProxy(route, customerId, params = {}, auditContext = {}) {
    const id = String(customerId || "").trim();
    if (!id) throw new Error("customerId is required");

    const normalizedRoute = normalizeApexProxyRoute(route);
    if (!isAllowedMcpApexProxyRoute(normalizedRoute)) {
        throw new Error(`Route not allowlisted: ${route}`);
    }

    assertMcpProxyRateLimit(id, auditContext.keyId);

    const query = normalizeProxyParams(params);
    const def = getMcpApexProxyRoute(normalizedRoute);
    if (def.requiredParams?.length) {
        assertRequiredParams(query, def.requiredParams);
    }

    const started = Date.now();
    const data = await def.execute(id, query);

    logMcpProxyAudit({
        proxy: "apex",
        route: normalizedRoute,
        customerId: id,
        keyId: auditContext.keyId || "",
        authMethod: auditContext.authMethod || "",
        durationMs: Date.now() - started,
        paramKeys: Object.keys(query),
    });

    return sanitizeForMcp({
        readOnly: true,
        proxy: "apex",
        route: normalizedRoute,
        customerId: id,
        params: query,
        data,
    });
}

/**
 * @param {string} queryType
 * @param {string} customerId
 * @param {Record<string, unknown>} [params]
 * @param {{ keyId?: string, authMethod?: string }} [auditContext]
 */
export async function executeMcpShopifyProxyCall(
    queryType,
    customerId,
    params = {},
    auditContext = {}
) {
    const id = String(customerId || "").trim();
    if (!id) throw new Error("customerId is required");

    const type = String(queryType || "").trim();
    if (!MCP_SHOPIFY_PROXY_QUERY_TYPES.includes(type)) {
        throw new Error(
            `queryType not allowlisted. Allowed: ${MCP_SHOPIFY_PROXY_QUERY_TYPES.join(", ")}`
        );
    }

    assertMcpProxyRateLimit(id, auditContext.keyId);
    const query = normalizeProxyParams(params);

    const started = Date.now();
    const data = await executeMcpShopifyProxy(type, id, query);

    logMcpProxyAudit({
        proxy: "shopify",
        queryType: type,
        customerId: id,
        keyId: auditContext.keyId || "",
        authMethod: auditContext.authMethod || "",
        durationMs: Date.now() - started,
        paramKeys: Object.keys(query),
    });

    return sanitizeForMcp({
        readOnly: true,
        proxy: "shopify",
        queryType: type,
        customerId: id,
        params: query,
        data,
    });
}

/**
 * @param {string} customerId
 * @param {string} gaql
 * @param {{ keyId?: string, authMethod?: string }} [auditContext]
 */
export async function executeMcpGoogleAdsProxyCall(
    customerId,
    gaql,
    auditContext = {}
) {
    const id = String(customerId || "").trim();
    if (!id) throw new Error("customerId is required");

    const query = String(gaql || "").trim();
    if (!query) throw new Error("query is required");

    assertMcpProxyRateLimit(id, auditContext.keyId);

    const started = Date.now();
    const data = await executeMcpGoogleAdsGaqlProxy(id, query);

    logMcpProxyAudit({
        proxy: "google-ads",
        customerId: id,
        keyId: auditContext.keyId || "",
        authMethod: auditContext.authMethod || "",
        durationMs: Date.now() - started,
        queryPreview: query.slice(0, 120),
    });

    return sanitizeForMcp({
        readOnly: true,
        proxy: "google-ads",
        customerId: id,
        data,
    });
}

/**
 * @param {string} endpoint
 * @param {string} customerId
 * @param {Record<string, unknown>} [params]
 * @param {{ keyId?: string, authMethod?: string }} [auditContext]
 */
export async function executeMcpMetaProxyCall(
    endpoint,
    customerId,
    params = {},
    auditContext = {}
) {
    const id = String(customerId || "").trim();
    if (!id) throw new Error("customerId is required");

    const ep = String(endpoint || "").trim().toLowerCase();
    if (!MCP_META_PROXY_ENDPOINTS.includes(ep)) {
        throw new Error(
            `endpoint not allowlisted. Allowed: ${MCP_META_PROXY_ENDPOINTS.join(", ")}`
        );
    }

    assertMcpProxyRateLimit(id, auditContext.keyId);
    const query = normalizeProxyParams(params);

    const started = Date.now();
    const data = await executeMcpMetaProxy(ep, id, query);

    logMcpProxyAudit({
        proxy: "meta",
        endpoint: ep,
        customerId: id,
        keyId: auditContext.keyId || "",
        authMethod: auditContext.authMethod || "",
        durationMs: Date.now() - started,
        paramKeys: Object.keys(query),
    });

    return sanitizeForMcp({
        readOnly: true,
        proxy: "meta",
        endpoint: ep,
        customerId: id,
        params: query,
        data,
    });
}

export function listMcpProxyCatalog() {
    return {
        readOnly: true,
        guardrails: {
            customerIdRequired: true,
            writesAllowed: false,
            credentialsServerSide: true,
            responseSanitized: true,
            rateLimitPerCustomerPerMinute: 60,
            auditLog: true,
            oauthDomain: "@searchmind.dk",
        },
        apex: listMcpApexProxyRoutes(),
        shopify: {
            endpoint: "POST /api/mcp/proxy/shopify",
            queryTypes: MCP_SHOPIFY_PROXY_QUERY_TYPES,
        },
        googleAds: {
            endpoint: "POST /api/mcp/proxy/google-ads",
            allowedResources: MCP_GOOGLE_ADS_GAQL_RESOURCES,
        },
        meta: {
            endpoints: MCP_META_PROXY_ENDPOINTS,
        },
    };
}
