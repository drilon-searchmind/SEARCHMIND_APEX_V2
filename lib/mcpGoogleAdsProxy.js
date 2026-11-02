import { GoogleAdsApi } from "google-ads-api";

import { getDemoGooglePpcDashboardForRange } from "@/lib/demoAdMetrics";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { parseGoogleAdsCustomerIds } from "@/lib/googleAdsCustomerIdUtils";
import {
    loadGoogleAdsCustomerIdForMcp,
    MCP_GOOGLE_ADS_GAQL_RESOURCES,
} from "@root/lib/mcpProxyAllowlist";
import {
    getGoogleAdsDeveloperToken,
    getGoogleAdsManagerCustomerId,
    getGoogleAdsOAuthClientId,
    getGoogleAdsOAuthClientSecret,
    getGoogleAdsRefreshToken,
} from "@/lib/googleAdsOAuthEnv";

const BLOCKED_GAQL_PATTERN =
    /\b(INSERT|UPDATE|DELETE|MUTATE|CREATE|REMOVE|SET\b|ALTER|DROP)\b/i;

/**
 * @param {string} gaql
 */
export function validateMcpGoogleAdsGaql(gaql) {
    const query = String(gaql || "").trim();
    if (!query) throw new Error("GAQL query is required");
    if (!/^SELECT\b/is.test(query)) {
        throw new Error("Only SELECT queries are allowed");
    }
    if (BLOCKED_GAQL_PATTERN.test(query)) {
        throw new Error("Write or mutate operations are not allowed");
    }

    const fromMatch = query.match(/\bFROM\s+([a-z0-9_]+)/i);
    if (!fromMatch) {
        throw new Error("GAQL query must include a FROM resource");
    }

    const resource = fromMatch[1].toLowerCase();
    if (!MCP_GOOGLE_ADS_GAQL_RESOURCES.includes(resource)) {
        throw new Error(
            `Resource "${resource}" is not allowlisted. Allowed: ${MCP_GOOGLE_ADS_GAQL_RESOURCES.join(", ")}`
        );
    }

    return { query, resource };
}

function createGoogleAdsCustomer(googleAdsCustomerId) {
    const client = new GoogleAdsApi({
        client_id: getGoogleAdsOAuthClientId(),
        client_secret: getGoogleAdsOAuthClientSecret(),
        developer_token: getGoogleAdsDeveloperToken(),
    });
    return client.Customer({
        customer_id: googleAdsCustomerId,
        refresh_token: getGoogleAdsRefreshToken(),
        login_customer_id: getGoogleAdsManagerCustomerId(),
    });
}

/**
 * @param {string} customerId — APEX customer id
 * @param {string} gaql
 */
export async function executeMcpGoogleAdsGaqlProxy(customerId, gaql) {
    const { query } = validateMcpGoogleAdsGaql(gaql);
    const { googleAdsCustomerId, isDemo } = await loadGoogleAdsCustomerIdForMcp(customerId);

    if (isDemo || isDemoCustomerId(customerId)) {
        return {
            demo: true,
            rows: getDemoGooglePpcDashboardForRange("2025-01-01", "2025-01-31"),
            note: "Demo customer returns canned Google PPC metrics, not raw GAQL rows",
        };
    }

    const ids = parseGoogleAdsCustomerIds(googleAdsCustomerId);
    if (!ids.length) {
        throw new Error("No valid Google Ads customer IDs configured");
    }

    /** @type {unknown[]} */
    const allRows = [];
    for (const adsCustomerId of ids) {
        const customer = createGoogleAdsCustomer(adsCustomerId);
        const res = await customer.query(query);
        const rows = Array.isArray(res) ? res : res.results || [];
        allRows.push(...rows);
    }

    return {
        googleAdsCustomerIds: ids,
        rowCount: allRows.length,
        rows: allRows,
    };
}
