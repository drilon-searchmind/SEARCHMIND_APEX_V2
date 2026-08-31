import { shopifyqlQuery } from "@/lib/shopifyApi";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { parseMcpDateRange } from "@root/lib/mcpApiHelpers";
import { loadShopifyCredentialsForMcp } from "@root/lib/mcpProxyAllowlist";
import {
    buildTrafficByReferrerDomainQuery,
    filterAiReferrerDomainRows,
} from "@root/lib/mcpShopifyReferrerDomainSessions";

function buildSalesByChannelQuery(startDate, endDate) {
    return `FROM sales
SHOW net_sales, orders, gross_sales, total_sales
GROUP BY sales_channel
SINCE ${startDate} UNTIL ${endDate}
ORDER BY net_sales DESC
LIMIT 100`;
}

function buildTrafficByReferrerQuery(startDate, endDate) {
    return `FROM sessions
SHOW sessions, online_store_visitors, conversion_rate
GROUP BY referrer_source
SINCE ${startDate} UNTIL ${endDate}
ORDER BY sessions DESC
LIMIT 100`;
}

function buildUtmSourceQuery(startDate, endDate) {
    return `FROM sessions
SHOW sessions, conversion_rate
GROUP BY utm_source, utm_medium
SINCE ${startDate} UNTIL ${endDate}
ORDER BY sessions DESC
LIMIT 100`;
}

/**
 * @param {string} shopUrl
 * @param {string} accessToken
 * @param {string} query
 */
async function runShopifyql(shopUrl, accessToken, query) {
    const res = await shopifyqlQuery(shopUrl, accessToken, query);
    const shopifyql = res?.data?.shopifyqlQuery || {};
    return {
        query,
        tableData: shopifyql.tableData || { columns: [], rows: [] },
        parseErrors: shopifyql.parseErrors || [],
    };
}

function demoChannelAttribution() {
    return {
        salesByChannel: {
            tableData: {
                columns: [
                    { name: "sales_channel", displayName: "Sales channel" },
                    { name: "net_sales", displayName: "Net sales" },
                    { name: "orders", displayName: "Orders" },
                ],
                rows: [
                    { sales_channel: "Online Store", net_sales: "125000.00", orders: "820" },
                    { sales_channel: "POS", net_sales: "12400.00", orders: "95" },
                ],
            },
            parseErrors: [],
        },
        trafficByReferrerSource: {
            tableData: {
                columns: [
                    { name: "referrer_source", displayName: "Referrer source" },
                    { name: "sessions", displayName: "Sessions" },
                ],
                rows: [
                    { referrer_source: "google", sessions: "4200" },
                    { referrer_source: "facebook", sessions: "3100" },
                    { referrer_source: "direct", sessions: "2800" },
                ],
            },
            parseErrors: [],
        },
        trafficByUtmSource: {
            tableData: {
                columns: [
                    { name: "utm_source", displayName: "UTM source" },
                    { name: "utm_medium", displayName: "UTM medium" },
                    { name: "sessions", displayName: "Sessions" },
                ],
                rows: [
                    { utm_source: "google", utm_medium: "cpc", sessions: "2100" },
                    { utm_source: "facebook", utm_medium: "paid", sessions: "1800" },
                ],
            },
            parseErrors: [],
        },
        trafficByReferrerDomain: {
            tableData: {
                columns: [
                    { name: "referrer_domain", displayName: "Referrer domain" },
                    { name: "sessions", displayName: "Sessions" },
                ],
                rows: [
                    { referrer_domain: "google.com", sessions: "4200" },
                    { referrer_domain: "perplexity.ai", sessions: "58" },
                    { referrer_domain: "chatgpt.com", sessions: "2263" },
                ],
            },
            parseErrors: [],
        },
    };
}

/**
 * Shopify channel + traffic attribution via read-only ShopifyQL.
 * @param {string} customerId
 * @param {Record<string, string>} params
 */
export async function fetchMcpShopifyChannelAttribution(customerId, params = {}) {
    const range = parseMcpDateRange(params.startDate, params.endDate);
    const creds = await loadShopifyCredentialsForMcp(customerId);
    const isDemo = isDemoCustomerId(customerId) || creds.isDemo;

    if (isDemo) {
        return {
            customerId,
            ...range,
            demo: true,
            kind: "shopifyql-channel-attribution",
            ...demoChannelAttribution(),
        };
    }

    const { startDate, endDate } = range;
    const referrerDomainQuery = buildTrafficByReferrerDomainQuery(startDate, endDate);
    const [salesByChannel, trafficByReferrerSource, trafficByUtmSource, trafficByReferrerDomain] =
        await Promise.all([
        runShopifyql(creds.shopUrl, creds.accessToken, buildSalesByChannelQuery(startDate, endDate)),
        runShopifyql(
            creds.shopUrl,
            creds.accessToken,
            buildTrafficByReferrerQuery(startDate, endDate)
        ),
        runShopifyql(creds.shopUrl, creds.accessToken, buildUtmSourceQuery(startDate, endDate)),
        runShopifyql(creds.shopUrl, creds.accessToken, referrerDomainQuery),
    ]);
    const referrerDomainRows = trafficByReferrerDomain.tableData?.rows || [];
    const aiReferrerDomainRows = filterAiReferrerDomainRows(referrerDomainRows);

    return {
        customerId,
        ...range,
        kind: "shopifyql-channel-attribution",
        salesByChannel,
        trafficByReferrerSource,
        trafficByUtmSource,
        trafficByReferrerDomain: {
            ...trafficByReferrerDomain,
            dimension: "referrer_domain",
            schema: "sessions",
            humanTrafficOnly: true,
        },
        aiReferrerDomains: {
            rows: aiReferrerDomainRows,
            note:
                aiReferrerDomainRows.length > 0
                    ? "AI/agent referrer domains from referrer_domain breakdown."
                    : "No known AI/agent referrer domains in referrer_domain breakdown for this period.",
        },
        notes: [
            "salesByChannel: revenue/orders grouped by Shopify sales_channel (Online Store, POS, Agentic Storefronts, etc.)",
            "trafficByReferrerSource: sessions grouped by referrer_source",
            "trafficByReferrerDomain: sessions grouped by referrer_domain (domain-level, UTM-independent)",
            "trafficByUtmSource: sessions grouped by utm_source + utm_medium",
            "For domain-only analysis (e.g. Perplexity vs ChatGPT) use /api/shopify-referrer-domain-sessions or aiReferrerDomains subset.",
            "For AI/agentic order attribution use /api/shopify-agentic-attribution or shopify_graphql_read queryType AgenticSalesReport / ordersAttribution.",
        ],
    };
}
