import { shopifyqlQuery } from "@/lib/shopifyApi";
import {
    fetchAgenticReferringChannelReport,
    fetchAgenticSalesChannelReport,
} from "@/lib/shopifyAgenticShopifyql";
import { shopifyAdminGraphqlPost } from "@/lib/shopifyAdminClient";
import { getDemoPayload, isDemoCustomerId } from "@/lib/demoCustomer";
import { parseMcpDateRange } from "@root/lib/mcpApiHelpers";
import { loadShopifyCredentialsForMcp } from "@root/lib/mcpProxyAllowlist";

const SHOPIFYQL_TYPES = new Set([
    "SalesReport",
    "OrdersReport",
    "ProductsReport",
    "CustomersReport",
    "InventoryReport",
    "AgenticSalesReport",
    "AgenticReferringReport",
]);

function clampLimit(value, fallback = 50, max = 250) {
    const n = Number.parseInt(String(value || ""), 10);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(n, max);
}

function buildShopifyql(type, startDate, endDate) {
    switch (type) {
        case "SalesReport":
            return `FROM sales
SHOW total_sales, net_sales, orders, gross_profit
GROUP BY day
SINCE ${startDate} UNTIL ${endDate}
ORDER BY day ASC`;
        case "OrdersReport":
            return `FROM orders
SHOW orders, gross_sales, net_sales
GROUP BY day
SINCE ${startDate} UNTIL ${endDate}
ORDER BY day ASC`;
        case "ProductsReport":
            return `FROM sales
SHOW net_sales, orders, units_sold
GROUP BY product_title
SINCE ${startDate} UNTIL ${endDate}
ORDER BY net_sales DESC
LIMIT 100`;
        case "CustomersReport":
            return `FROM sales
SHOW customers
WHERE new_or_returning_customer IS NOT NULL
GROUP BY new_or_returning_customer
SINCE ${startDate} UNTIL ${endDate}`;
        case "InventoryReport":
            return `FROM inventory
SHOW inventory_units, inventory_value
GROUP BY product_title
ORDER BY inventory_units DESC
LIMIT 100`;
        case "AgenticSalesReport":
        case "AgenticReferringReport":
            throw new Error(`${type} uses dedicated agentic ShopifyQL runner`);
        default:
            throw new Error(`Unknown ShopifyQL type: ${type}`);
    }
}

function demoShopifyqlTable(type) {
    const demo = getDemoPayload("shopifyql") || {};
    if (demo[type]) return demo[type];
    if (type === "AgenticSalesReport") {
        return {
            columns: [
                { name: "agentic_sales_channel", displayName: "Agentic sales channel" },
                { name: "net_sales", displayName: "Net sales" },
                { name: "orders", displayName: "Orders" },
            ],
            rows: [
                { agentic_sales_channel: "ChatGPT", net_sales: "18420.00", orders: "42" },
                { agentic_sales_channel: "Google AI Mode and Gemini", net_sales: "9650.00", orders: "18" },
            ],
        };
    }
    if (type === "AgenticReferringReport") {
        return {
            columns: [
                { name: "agentic_referring_channel", displayName: "Agentic referring channel" },
                { name: "net_sales", displayName: "Net sales" },
                { name: "orders", displayName: "Orders" },
            ],
            rows: [
                { agentic_referring_channel: "ChatGPT", net_sales: "22100.00", orders: "51" },
            ],
        };
    }
    return { columns: [], rows: [] };
}

async function runShopifyql(type, shopUrl, accessToken, startDate, endDate, isDemo) {
    if (isDemo) {
        return {
            tableData: demoShopifyqlTable(type),
            parseErrors: [],
        };
    }

    if (type === "AgenticSalesReport") {
        const report = await fetchAgenticSalesChannelReport(shopUrl, accessToken, startDate, endDate);
        return {
            tableData: report.tableData,
            parseErrors: report.parseErrors,
            apiVersion: report.apiVersion,
            fallback: report.fallback,
            note: report.note,
        };
    }

    if (type === "AgenticReferringReport") {
        const report = await fetchAgenticReferringChannelReport(shopUrl, accessToken, startDate, endDate);
        return {
            tableData: report.tableData,
            parseErrors: report.parseErrors,
            apiVersion: report.apiVersion,
            fallback: report.fallback,
            note: report.note,
            schema: report.schema,
        };
    }

    const q = buildShopifyql(type, startDate, endDate);
    const res = await shopifyqlQuery(shopUrl, accessToken, q);
    const shopifyql = res?.data?.shopifyqlQuery || {};
    return {
        tableData: shopifyql.tableData || { columns: [], rows: [] },
        parseErrors: shopifyql.parseErrors || [],
    };
}

const ORDERS_ATTRIBUTION_VISIT_FIELDS = `
      source
      sourceType
      referrerUrl
      landingPage
      utmParameters { source medium campaign term content }
`;

const ORDERS_ATTRIBUTION_GRAPHQL_VARIANTS = [
    {
        name: "full",
        fields: `
      sourceName
      tags
      app { name }
      channelInformation { channelDefinition { channelName handle } }
      attribution { displayName handle }
      customerJourneySummary {
        firstVisit {${ORDERS_ATTRIBUTION_VISIT_FIELDS} }
        lastVisit {${ORDERS_ATTRIBUTION_VISIT_FIELDS} }
        daysToConversion
      }`,
    },
    {
        name: "attribution-without-journey",
        fields: `
      sourceName
      tags
      app { name }
      channelInformation { channelDefinition { channelName handle } }
      attribution { displayName handle }`,
    },
    {
        name: "legacy",
        fields: `
      sourceName
      tags
      app { name }
      channelInformation { channelDefinition { channelName handle } }
      customerJourneySummary {
        firstVisit {${ORDERS_ATTRIBUTION_VISIT_FIELDS} }
        lastVisit {${ORDERS_ATTRIBUTION_VISIT_FIELDS} }
        daysToConversion
      }`,
    },
];

function demoOrdersAttributionGraphql() {
    return {
        orders: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
                {
                    id: "gid://shopify/Order/demo-1001",
                    name: "#1001",
                    createdAt: "2026-08-15T10:22:00Z",
                    displayFinancialStatus: "PAID",
                    totalPriceSet: { shopMoney: { amount: "1299.00", currencyCode: "DKK" } },
                    sourceName: "web",
                    tags: ["agentic:chatgpt"],
                    app: { name: "Online Store" },
                    channelInformation: {
                        channelDefinition: { channelName: "Online Store", handle: "online-store" },
                    },
                    attribution: { displayName: "ChatGPT", handle: "chatgpt" },
                    customerJourneySummary: {
                        firstVisit: {
                            source: "ChatGPT",
                            sourceType: "utm",
                            referrerUrl: "https://chatgpt.com/",
                            landingPage: "/products/demo-product",
                            utmParameters: { source: "chatgpt.com", medium: "referral", campaign: null, term: null, content: null },
                        },
                        lastVisit: {
                            source: "ChatGPT",
                            sourceType: "utm",
                            referrerUrl: "https://chatgpt.com/",
                            landingPage: "/products/demo-product",
                            utmParameters: { source: "chatgpt.com", medium: "referral", campaign: null, term: null, content: null },
                        },
                        daysToConversion: 0,
                    },
                },
            ],
        },
        queryVariant: "demo",
    };
}

async function runOrdersAttributionGraphql(shopUrl, accessToken, params) {
    const startDate = params.startDate;
    const endDate = params.endDate;
    if (!startDate || !endDate) {
        throw new Error("startDate and endDate are required for ordersAttribution GraphQL");
    }

    const first = clampLimit(params.first, 25, 100);
    const after = params.after ? `"${String(params.after).replace(/"/g, '\\"')}"` : "null";
    const searchQuery = `created_at:>=${startDate} created_at:<=${endDate}`;

    let lastError = null;
    for (const variant of ORDERS_ATTRIBUTION_GRAPHQL_VARIANTS) {
        const query = `query {
  orders(first: ${first}, after: ${after}, query: "${searchQuery}") {
    pageInfo { hasNextPage endCursor }
    nodes {
      id name createdAt displayFinancialStatus totalPriceSet { shopMoney { amount currencyCode } }
      ${variant.fields}
    }
  }
}`;

        const { res, json } = await shopifyAdminGraphqlPost(shopUrl, accessToken, { query });
        if (!res.ok) {
            throw new Error(`Shopify GraphQL error: ${res.status}`);
        }
        if (Array.isArray(json?.errors) && json.errors.length) {
            lastError = json.errors[0]?.message || "Shopify GraphQL query failed";
            continue;
        }
        return {
            ...(json?.data || {}),
            queryVariant: variant.name,
        };
    }

    throw new Error(lastError || "Shopify GraphQL ordersAttribution query failed");
}

async function runGraphqlTemplate(type, shopUrl, accessToken, params, isDemo) {
    if (type === "ordersAttribution") {
        if (isDemo) return demoOrdersAttributionGraphql();
        return runOrdersAttributionGraphql(shopUrl, accessToken, params);
    }

    if (isDemo) {
        return getDemoPayload(`shopifyGraphql_${type}`) || { nodes: [] };
    }

    const first = clampLimit(params.first, 25, 100);
    const after = params.after ? `"${String(params.after).replace(/"/g, '\\"')}"` : "null";

    let query = "";
    switch (type) {
        case "shop":
            query = `query { shop { name myshopifyDomain currencyCode primaryDomain { url } } }`;
            break;
        case "products":
            query = `query {
  products(first: ${first}, after: ${after}) {
    pageInfo { hasNextPage endCursor }
    nodes { id title status totalInventory createdAt }
  }
}`;
            break;
        case "orders": {
            const startDate = params.startDate;
            const endDate = params.endDate;
            if (!startDate || !endDate) {
                throw new Error("startDate and endDate are required for orders GraphQL");
            }
            query = `query {
  orders(first: ${first}, after: ${after}, query: "created_at:>=${startDate} created_at:<=${endDate}") {
    pageInfo { hasNextPage endCursor }
    nodes {
      id name createdAt displayFinancialStatus totalPriceSet { shopMoney { amount currencyCode } }
    }
  }
}`;
            break;
        }
        case "customers":
            query = `query {
  customers(first: ${first}, after: ${after}) {
    pageInfo { hasNextPage endCursor }
    nodes { id displayName email createdAt numberOfOrders amountSpent { amount currencyCode } }
  }
}`;
            break;
        case "inventory":
            query = `query {
  products(first: ${first}, after: ${after}) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id title
      variants(first: 20) {
        nodes { id title sku inventoryQuantity }
      }
    }
  }
}`;
            break;
        default:
            throw new Error(`Unknown GraphQL type: ${type}`);
    }

    const { res, json } = await shopifyAdminGraphqlPost(shopUrl, accessToken, { query });
    if (!res.ok) {
        throw new Error(`Shopify GraphQL error: ${res.status}`);
    }
    if (Array.isArray(json?.errors) && json.errors.length) {
        throw new Error(json.errors[0]?.message || "Shopify GraphQL query failed");
    }
    return json?.data || {};
}

/**
 * @param {string} queryType
 * @param {string} customerId
 * @param {Record<string, string>} params
 */
export async function executeMcpShopifyProxy(queryType, customerId, params = {}) {
    const creds = await loadShopifyCredentialsForMcp(customerId);
    const isDemo = isDemoCustomerId(customerId) || creds.isDemo;

    if (SHOPIFYQL_TYPES.has(queryType)) {
        const range = parseMcpDateRange(params.startDate, params.endDate);
        const result = await runShopifyql(
            queryType,
            creds.shopUrl,
            creds.accessToken,
            range.startDate,
            range.endDate,
            isDemo
        );
        return {
            kind: "shopifyql",
            queryType,
            ...range,
            ...result,
        };
    }

    const data = await runGraphqlTemplate(
        queryType,
        creds.shopUrl,
        creds.accessToken,
        params,
        isDemo
    );
    return {
        kind: "graphql",
        queryType,
        data,
    };
}
