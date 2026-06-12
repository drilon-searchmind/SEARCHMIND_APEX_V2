import { shopifyqlQuery } from "@/lib/shopifyApi";
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
        default:
            throw new Error(`Unknown ShopifyQL type: ${type}`);
    }
}

function demoShopifyqlTable(type) {
    const demo = getDemoPayload("shopifyql") || {};
    return demo[type] || { columns: [], rows: [] };
}

async function runShopifyql(type, shopUrl, accessToken, startDate, endDate, isDemo) {
    if (isDemo) {
        return {
            tableData: demoShopifyqlTable(type),
            parseErrors: [],
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

async function runGraphqlTemplate(type, shopUrl, accessToken, params, isDemo) {
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
