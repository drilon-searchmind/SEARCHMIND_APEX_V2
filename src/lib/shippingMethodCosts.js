/**
 * Shipping cost by Shopify shipping / delivery method (ProfitMetrics-style).
 * Configured method rates match order shipping titles; unmatched orders use fallback.
 */

import { shopifyqlQuery } from "./shopifyApi";
import {
    appendShopifyOnlineStoreFilter,
    escapeShopifyQlString,
    shopifySalesWhereClause,
} from "./shopifyQlFilters";

/**
 * @param {unknown} list
 * @returns {{ name: string, costPerOrder: number }[]}
 */
export function normalizeShippingMethodCosts(list) {
    if (!Array.isArray(list)) return [];
    return list
        .map((row) => ({
            name: String(row?.name || "").trim(),
            costPerOrder: Number(row?.costPerOrder) || 0,
        }))
        .filter((row) => row.name);
}

export function hasShippingMethodCosts(staticExp = {}) {
    return normalizeShippingMethodCosts(staticExp.shippingMethodCosts).length > 0;
}

/**
 * Case-insensitive exact match, then substring (either direction).
 * @param {string} methodName
 * @param {{ name: string, costPerOrder: number }[]} costs
 * @returns {number|null} configured rate or null if unmatched
 */
export function matchShippingMethodCost(methodName, costs) {
    const needle = String(methodName || "").trim().toLowerCase();
    if (!needle) return null;
    const list = normalizeShippingMethodCosts(costs);
    const exact = list.find((c) => c.name.toLowerCase() === needle);
    if (exact) return exact.costPerOrder;
    const partial = list.find(
        (c) =>
            needle.includes(c.name.toLowerCase()) ||
            c.name.toLowerCase().includes(needle)
    );
    return partial ? partial.costPerOrder : null;
}

/**
 * @param {Record<string, number>|Map<string, number>|Array<{ name?: string, method?: string, orders?: number }>} counts
 * @param {{ name: string, costPerOrder: number }[]} methodCosts
 * @param {number} fallbackPerOrder
 * @param {number} [totalOrders] — when provided, unmatched = total − matched
 */
export function computeShippingCostFromMethodCounts(
    counts,
    methodCosts,
    fallbackPerOrder,
    totalOrders = null
) {
    const costs = normalizeShippingMethodCosts(methodCosts);
    const fallback = Number(fallbackPerOrder) || 0;

    /** @type {Map<string, number>} */
    const byName = new Map();
    if (counts instanceof Map) {
        for (const [k, v] of counts) {
            const name = String(k || "").trim();
            if (!name) continue;
            byName.set(name, (byName.get(name) || 0) + (Number(v) || 0));
        }
    } else if (Array.isArray(counts)) {
        for (const row of counts) {
            const name = String(row?.name || row?.method || "").trim();
            if (!name) continue;
            byName.set(name, (byName.get(name) || 0) + (Number(row?.orders) || 0));
        }
    } else if (counts && typeof counts === "object") {
        for (const [k, v] of Object.entries(counts)) {
            const name = String(k || "").trim();
            if (!name) continue;
            byName.set(name, (byName.get(name) || 0) + (Number(v) || 0));
        }
    }

    if (costs.length === 0) {
        const orders =
            totalOrders != null
                ? Number(totalOrders) || 0
                : [...byName.values()].reduce((s, n) => s + n, 0);
        return orders * fallback;
    }

    let matchedOrders = 0;
    let totalCost = 0;
    for (const [name, orders] of byName) {
        const n = Number(orders) || 0;
        if (n <= 0) continue;
        const rate = matchShippingMethodCost(name, costs);
        if (rate == null) continue;
        matchedOrders += n;
        totalCost += n * rate;
    }

    const counted = [...byName.values()].reduce((s, n) => s + n, 0);
    const unmatched =
        totalOrders != null
            ? Math.max(0, (Number(totalOrders) || 0) - matchedOrders)
            : Math.max(0, counted - matchedOrders);
    totalCost += unmatched * fallback;
    return totalCost;
}

/**
 * Aggregate daily rows `{ period, method, orders }` for one calendar day.
 * @param {Array<{ period?: string, method?: string, orders?: number }>} dailyRows
 * @param {string} ymd
 */
export function shippingMethodCountsForDay(dailyRows, ymd) {
    const day = String(ymd || "").slice(0, 10);
    /** @type {Map<string, number>} */
    const map = new Map();
    for (const row of dailyRows || []) {
        if (String(row?.period || "").slice(0, 10) !== day) continue;
        const name = String(row?.method || "").trim() || "(unknown)";
        map.set(name, (map.get(name) || 0) + (Number(row?.orders) || 0));
    }
    return map;
}

/**
 * Sum method counts across all days (period total).
 * @param {Array<{ method?: string, orders?: number }>} dailyRows
 */
export function shippingMethodCountsForPeriod(dailyRows) {
    /** @type {Map<string, number>} */
    const map = new Map();
    for (const row of dailyRows || []) {
        const name = String(row?.method || "").trim() || "(unknown)";
        map.set(name, (map.get(name) || 0) + (Number(row?.orders) || 0));
    }
    return map;
}

/**
 * Try ShopifyQL dimensions until one returns rows without parse errors.
 * @param {string} shopUrl
 * @param {string} accessToken
 * @param {string} startDate
 * @param {string} endDate
 * @param {string[]} [extraWhereParts]
 * @returns {Promise<Array<{ period: string, method: string, orders: number }>>}
 */
export async function fetchShopifyOrdersByShippingMethodDaily(
    shopUrl,
    accessToken,
    startDate,
    endDate,
    extraWhereParts = []
) {
    if (!shopUrl || !accessToken || !startDate || !endDate) return [];

    const whereParts = [...(extraWhereParts || [])];
    const whereClause = shopifySalesWhereClause(whereParts);

    const dimensionCandidates = [
        "delivery_method",
        "shipping_method",
        // Shipping lines often surface as product_title when line_type = shipping
        "product_title",
    ];

    for (const dim of dimensionCandidates) {
        const whereExtra =
            dim === "product_title"
                ? shopifySalesWhereClause([
                      ...whereParts,
                      `line_type = 'shipping'`,
                  ])
                : whereClause;
        const shopifyql = `
            FROM sales
            SHOW orders
            ${whereExtra}
            GROUP BY day, ${dim}
            SINCE ${startDate} UNTIL ${endDate}`;
        try {
            const res = await shopifyqlQuery(shopUrl, accessToken, shopifyql);
            const parseErrors = res?.data?.shopifyqlQuery?.parseErrors || [];
            const gqlErrors = res?.errors || [];
            if (parseErrors.length > 0 || gqlErrors.length > 0) continue;
            const rows = res?.data?.shopifyqlQuery?.tableData?.rows || [];
            if (!Array.isArray(rows)) continue;
            // Accept empty (valid schema, no orders) — do not try next dimension
            return rows.map((row) => ({
                period: String(row.day || "").slice(0, 10),
                method: String(row[dim] ?? row.delivery_method ?? row.shipping_method ?? row.product_title ?? "").trim(),
                orders: Number(row.orders) || 0,
            }));
        } catch (e) {
            console.warn(`[Shipping methods] ShopifyQL ${dim} failed:`, e?.message || e);
        }
    }

    console.warn(
        "[Shipping methods] No usable ShopifyQL dimension; falling back to flat shipping rate."
    );
    return [];
}

/**
 * Build WHERE parts for market/billing filters (mirrors mergedSources sales filter).
 * @param {Record<string, unknown>} settings
 * @param {string[]} [billingCountryNames]
 */
export function buildShippingMethodWhereParts(settings = {}, billingCountryNames = null) {
    const whereParts = [];
    const names = Array.isArray(billingCountryNames)
        ? [...new Set(billingCountryNames.map((n) => String(n || "").trim()).filter(Boolean))]
        : [];
    if (names.length === 1) {
        whereParts.push(`billing_country = '${escapeShopifyQlString(names[0])}'`);
    } else if (names.length > 1) {
        whereParts.push(
            `billing_country IN (${names.map((c) => `'${escapeShopifyQlString(c)}'`).join(", ")})`
        );
    }
    appendShopifyOnlineStoreFilter(whereParts, settings);
    return whereParts;
}

/**
 * Period totals grouped by billing country + shipping method (markets overview).
 * @returns {Promise<Array<{ billingCountry: string, method: string, orders: number }>>}
 */
export async function fetchShopifyOrdersByShippingMethodAndCountry(
    shopUrl,
    accessToken,
    startDate,
    endDate,
    settings = {}
) {
    if (!shopUrl || !accessToken || !startDate || !endDate) return [];
    const whereParts = buildShippingMethodWhereParts(settings, null);
    const whereClause = shopifySalesWhereClause(whereParts);
    const dimensionCandidates = ["delivery_method", "shipping_method", "product_title"];

    for (const dim of dimensionCandidates) {
        const whereExtra =
            dim === "product_title"
                ? shopifySalesWhereClause([...whereParts, `line_type = 'shipping'`])
                : whereClause;
        const shopifyql = `
            FROM sales
            SHOW orders
            ${whereExtra}
            GROUP BY billing_country, ${dim}
            SINCE ${startDate} UNTIL ${endDate}`;
        try {
            const res = await shopifyqlQuery(shopUrl, accessToken, shopifyql);
            const parseErrors = res?.data?.shopifyqlQuery?.parseErrors || [];
            const gqlErrors = res?.errors || [];
            if (parseErrors.length > 0 || gqlErrors.length > 0) continue;
            const rows = res?.data?.shopifyqlQuery?.tableData?.rows || [];
            if (!Array.isArray(rows)) continue;
            return rows.map((row) => ({
                billingCountry: String(row.billing_country || "").trim(),
                method: String(
                    row[dim] ??
                        row.delivery_method ??
                        row.shipping_method ??
                        row.product_title ??
                        ""
                ).trim(),
                orders: Number(row.orders) || 0,
            }));
        } catch (e) {
            console.warn(
                `[Shipping methods] country×${dim} ShopifyQL failed:`,
                e?.message || e
            );
        }
    }
    return [];
}

/**
 * Filter country×method rows to a set of billing country names.
 * @param {Array<{ billingCountry?: string, method?: string, orders?: number }>} rows
 * @param {string[]} billingCountryNames
 */
export function shippingMethodCountsForBillingCountries(rows, billingCountryNames) {
    const allowed = new Set(
        (billingCountryNames || []).map((n) => String(n || "").trim().toLowerCase()).filter(Boolean)
    );
    /** @type {Map<string, number>} */
    const map = new Map();
    for (const row of rows || []) {
        const country = String(row?.billingCountry || "").trim().toLowerCase();
        if (allowed.size > 0 && !allowed.has(country)) continue;
        const name = String(row?.method || "").trim() || "(unknown)";
        map.set(name, (map.get(name) || 0) + (Number(row?.orders) || 0));
    }
    return map;
}
