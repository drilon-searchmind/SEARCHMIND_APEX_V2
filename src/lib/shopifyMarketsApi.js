/**
 * Shopify Markets catalog via Admin GraphQL (`markets` query).
 * Custom apps need the `read_markets` scope in addition to existing Admin API scopes.
 */

import { shopifyqlQuery } from "./shopifyApi";
import { normalizeShopifyShopDomain } from "./shopifyShopDomain";
import { shopifyAdminGraphqlPost } from "./shopifyAdminClient";
import {
    appendShopifyOnlineStoreFilter,
    escapeShopifyQlString,
    shopifySalesWhereClause,
} from "./shopifyQlFilters";
import { getCurrencyConversionTable, conversionRateToDkk } from "./currencyConversionTable";
import { buildAdSpendCountryFiltersFromRegionCountries } from "./shopifyMarketAdSpendCountries";

/** @param {Record<string, unknown>} json */
function extractMarketsConnectionPayload(json) {
    const conn = json?.data?.markets;
    if (!conn) return { rows: [], pageInfo: null };
    const edges = Array.isArray(conn.edges) ? conn.edges : [];
    const nodes = Array.isArray(conn.nodes) ? conn.nodes : [];
    const fromEdges = edges.map((e) => e?.node).filter(Boolean);
    const rows = fromEdges.length ? fromEdges : nodes;
    return { rows, pageInfo: conn.pageInfo || null };
}

/**
 * @param {string} gid - e.g. gid://shopify/Market/123
 * @returns {string} numeric id for Admin API market GID
 */
export function gidToNumericMarketId(gid) {
    if (!gid) return "";
    const s = String(gid);
    const m = s.match(/(\d+)\s*$/);
    return m ? m[1] : s;
}

/**
 * Filter ShopifyQL sales to market region countries via `billing_country`.
 * ShopifyQL does not expose `market_id` on all stores — region countries from Admin API are the reliable filter.
 * @param {string[]} whereParts
 * @param {string[]} billingCountryNames — display names from MarketRegionCountry
 * @param {(s: string) => string} escape
 * @returns {boolean} false when no country names
 */
export function appendShopifyMarketBillingCountryFilter(whereParts, billingCountryNames, escape) {
    const names = [
        ...new Set((billingCountryNames || []).map((n) => String(n).trim()).filter(Boolean)),
    ];
    if (names.length === 0) return false;
    if (names.length === 1) {
        whereParts.push(`billing_country = '${escape(names[0])}'`);
        return true;
    }
    whereParts.push(
        `billing_country IN (${names.map((c) => `'${escape(c)}'`).join(", ")})`
    );
    return true;
}

/**
 * @param {string} shopDomain - myshopify.com hostname (no protocol)
 * @param {string} accessToken - Admin API access token
 * @returns {Promise<{ markets: Array<{ gid: string, shopifyqlMarketId: string, name: string, handle: string }>, graphqlErrors?: string[] }>}
 */
export async function fetchShopifyMarketsCatalog(shopDomain, accessToken) {
    const domain = normalizeShopifyShopDomain(shopDomain);
    if (!domain || !accessToken) {
        return { markets: [] };
    }

    const queryEdges = `query MarketsEdges($first: Int!, $after: String) {
  markets(first: $first, after: $after) {
    edges {
      cursor
      node {
        id
        name
        handle
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

    const queryNodes = `query MarketsNodes($first: Int!, $after: String) {
  markets(first: $first, after: $after) {
    nodes {
      id
      name
      handle
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}`;

    const maxPages = 10;
    /** @type {string[]} */
    const graphqlErrors = [];

    async function fetchAllPages(query, label) {
        /** @type {Array<{ gid: string, shopifyqlMarketId: string, name: string, handle: string }>} */
        const acc = [];
        let after = null;
        for (let page = 0; page < maxPages; page++) {
            const { res, json } = await shopifyAdminGraphqlPost(domain, accessToken, {
                query,
                variables: { first: 100, after },
            });
            if (!res.ok) {
                graphqlErrors.push(
                    `${label}: ${json?.errors?.[0]?.message || `HTTP ${res.status}`}`
                );
                return acc;
            }
            if (json.errors?.length) {
                for (const e of json.errors) {
                    graphqlErrors.push(`${label}: ${e?.message || String(e)}`);
                }
                return acc;
            }
            const { rows, pageInfo } = extractMarketsConnectionPayload(json);
            for (const node of rows) {
                if (!node?.id) continue;
                const gid = node.id;
                acc.push({
                    gid,
                    shopifyqlMarketId: gidToNumericMarketId(gid),
                    name: node.name?.trim()
                        ? String(node.name)
                        : `Market ${gidToNumericMarketId(gid)}`,
                    handle: node.handle != null && String(node.handle).trim() !== ''
                        ? String(node.handle)
                        : "",
                });
            }
            if (!pageInfo?.hasNextPage || !pageInfo?.endCursor) break;
            after = pageInfo.endCursor;
        }
        return acc;
    }

    let out = await fetchAllPages(queryEdges, "markets(edges)");
    if (out.length === 0) {
        out = await fetchAllPages(queryNodes, "markets(nodes)");
    }
    if (out.length > 0) {
        graphqlErrors.length = 0;
    }

    /** Dedupe by numeric id */
    const seen = new Set();
    out = out.filter((m) => {
        const k = m.shopifyqlMarketId;
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
    });

    out.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    return { markets: out, graphqlErrors: graphqlErrors.length ? graphqlErrors : undefined };
}

/**
 * In-memory cache: `${shopDomain}:${marketNumericId}` → `{ name, code }[]` from MarketRegionCountry.
 */
const marketRegionCountriesCache = new Map();

/**
 * Paginates `market.conditions.regionsCondition.regions` and collects countries (name + ISO code).
 * @param {string} shopDomain
 * @param {string} accessToken
 * @param {string} marketNumericId
 * @returns {Promise<Array<{ name: string, code: string|null }>>}
 */
async function fetchMarketRegionCountries(shopDomain, accessToken, marketNumericId) {
    const domain = String(shopDomain || "")
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
    const mid = String(marketNumericId || "").trim();
    if (!domain || !accessToken || !mid) return [];

    const cacheKey = `${domain}:${mid}`;
    if (marketRegionCountriesCache.has(cacheKey)) {
        return marketRegionCountriesCache.get(cacheKey);
    }

    const marketGid = `gid://shopify/Market/${mid}`;

    const query = `
query MarketRegionCountries($id: ID!, $after: String) {
  market(id: $id) {
    id
    conditions {
      regionsCondition {
        regions(first: 100, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            __typename
            ... on MarketRegionCountry {
              name
              code
            }
          }
        }
      }
    }
  }
}`;

    /** @type {Map<string, { name: string, code: string|null }>} */
    const byKey = new Map();
    let after = null;
    const maxPages = 40;

    for (let page = 0; page < maxPages; page++) {
        const { res, json } = await shopifyAdminGraphqlPost(domain, accessToken, {
            query,
            variables: { id: marketGid, after },
        });
        if (!res.ok || json.errors?.length) {
            if (json.errors?.length) {
                console.warn(
                    `[shopifyMarketsApi] market ${mid} regions:`,
                    json.errors.map((e) => e?.message).filter(Boolean).join("; ")
                );
            }
            break;
        }
        const market = json?.data?.market;
        if (!market) break;

        const conn = market.conditions?.regionsCondition?.regions;
        for (const node of conn?.nodes || []) {
            if (node?.__typename && node.__typename !== "MarketRegionCountry") continue;
            const name = node?.name != null ? String(node.name).trim() : "";
            const code =
                node?.code != null && String(node.code).trim() !== ""
                    ? String(node.code).trim().toUpperCase()
                    : null;
            if (!name && !code) continue;
            const key = code || name.toLowerCase();
            if (!byKey.has(key)) {
                byKey.set(key, { name: name || code, code });
            }
        }

        const pi = conn?.pageInfo;
        if (!pi?.hasNextPage || !pi?.endCursor) break;
        after = pi.endCursor;
    }

    const arr = [...byKey.values()].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    marketRegionCountriesCache.set(cacheKey, arr);
    return arr;
}

/**
 * Union of billing-country display names for the given market ids (Shopify Markets region countries).
 * Used with ShopifyQL `WHERE billing_country = '…' OR …`.
 *
 * @param {string} shopDomain
 * @param {string} accessToken
 * @param {string[]} marketNumericIds
 * @returns {Promise<string[]>}
 */
export async function fetchBillingCountryUnionForSelectedMarkets(shopDomain, accessToken, marketNumericIds) {
    const filters = await fetchAdSpendCountryFiltersForSelectedMarkets(
        shopDomain,
        accessToken,
        marketNumericIds
    );
    return filters.billingCountryNames;
}

/**
 * Union of countries for selected markets, mapped for ShopifyQL + paid media APIs.
 * @param {string} shopDomain
 * @param {string} accessToken
 * @param {string[]} marketNumericIds
 * @returns {Promise<{ billingCountryNames: string[], metaCountryCodes: string[], googleCountryNames: string[] }>}
 */
/** @param {string} name */
function normalizeBillingCountryKey(name) {
    return String(name || "")
        .trim()
        .toLowerCase();
}

/**
 * One ShopifyQL query: sales grouped by day + billing_country (markets overview).
 * @param {Record<string, unknown>} settings
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function fetchShopifySalesGroupedByBillingCountryAndDay(
    settings,
    startDate,
    endDate
) {
    if (!settings?.shopifyUrl || !settings?.shopifyApiPassword) return [];

    const fetchCogs = settings.fetchCogsFromStore === true;
    const showFields = fetchCogs
        ? "orders, gross_sales, discounts, returns, shipping_returned, net_sales, shipping_charges, duties, additional_fees, taxes, total_sales, cost_of_goods_sold"
        : "orders, gross_sales, discounts, returns, shipping_returned, net_sales, shipping_charges, duties, additional_fees, taxes, total_sales";

    const escape = escapeShopifyQlString;
    const whereParts = [];
    const parseCountries = (s) =>
        typeof s === "string" ? s.split(",").map((c) => c.trim()).filter(Boolean) : [];
    const includeCountries = parseCountries(settings.changeCurrencyShopifyBillingCountryName);
    const excludeCountries = parseCountries(
        settings.changeCurrencyShopifyBillingCountryExclude
    );
    const hasInclude = includeCountries.length > 0;
    const hasExclude = excludeCountries.length > 0;
    const hasBillingFilter =
        settings.changeCurrency === true &&
        settings.customerStoreValutaCode &&
        (hasInclude || hasExclude);

    if (hasBillingFilter) {
        if (hasInclude) {
            whereParts.push(
                `(${includeCountries.map((c) => `billing_country = '${escape(c)}'`).join(" OR ")})`
            );
        }
        if (hasExclude) {
            whereParts.push(
                `NOT (${excludeCountries.map((c) => `billing_country = '${escape(c)}'`).join(" OR ")})`
            );
        }
    }

    appendShopifyOnlineStoreFilter(whereParts, settings);
    const whereClause = shopifySalesWhereClause(whereParts);

    const shopifyql = `
                    FROM sales
                    SHOW ${showFields}
                    ${whereClause}
                    GROUP BY day, billing_country
                    SINCE ${startDate} UNTIL ${endDate}`;

    const shopifyRes = await shopifyqlQuery(
        settings.shopifyUrl,
        settings.shopifyApiPassword,
        shopifyql
    );
    const rows = shopifyRes?.data?.shopifyqlQuery?.tableData?.rows || [];
    const { data: currencyData } = await getCurrencyConversionTable();
    const fromCode = settings?.customerStoreValutaCode || "DKK";
    const conversionRate = conversionRateToDkk(fromCode, currencyData);

    return rows.map((row) => {
        const base = {
            period: row.day,
            billing_country: row.billing_country != null ? String(row.billing_country) : "",
            gross_sales: (parseFloat(row.gross_sales) || 0) * conversionRate,
            discounts: (parseFloat(row.discounts) || 0) * conversionRate,
            returns: (parseFloat(row.returns) || 0) * conversionRate,
            shipping_returned:
                (parseFloat(row.shipping_returned ?? row.shipping_reversals) || 0) *
                conversionRate,
            net_sales: (parseFloat(row.net_sales) || 0) * conversionRate,
            shipping_charges: (parseFloat(row.shipping_charges) || 0) * conversionRate,
            duties: (parseFloat(row.duties) || 0) * conversionRate,
            additional_fees: (parseFloat(row.additional_fees) || 0) * conversionRate,
            taxes: (parseFloat(row.taxes) || 0) * conversionRate,
            total_sales: (parseFloat(row.total_sales) || 0) * conversionRate,
            custom_1:
                ((parseFloat(row.net_sales) || 0) +
                    (parseFloat(row.returns) || 0) +
                    (parseFloat(row.shipping_charges) || 0)) *
                conversionRate,
            orders: parseInt(row.orders, 10) || 0,
        };
        if (fetchCogs && row.cost_of_goods_sold !== undefined) {
            base.cost_of_goods_sold =
                (parseFloat(row.cost_of_goods_sold) || 0) * conversionRate;
        }
        return base;
    });
}

/**
 * Roll up grouped billing-country rows into daily shopifyDaily for one market.
 * @param {Array<Record<string, unknown>>} groupedRows
 * @param {string[]} billingCountryNames
 */
export function shopifyDailyForBillingCountries(groupedRows, billingCountryNames) {
    const allow = new Set(
        (billingCountryNames || []).map((n) => normalizeBillingCountryKey(n)).filter(Boolean)
    );
    if (allow.size === 0) return [];

    /** @type {Map<string, Record<string, number>>} */
    const byDay = new Map();

    for (const row of groupedRows || []) {
        const bcKey = normalizeBillingCountryKey(row.billing_country);
        if (!bcKey || !allow.has(bcKey)) continue;
        const period = String(row.period || "").slice(0, 10);
        if (!period) continue;
        let agg = byDay.get(period);
        if (!agg) {
            agg = {
                period,
                gross_sales: 0,
                discounts: 0,
                returns: 0,
                shipping_returned: 0,
                net_sales: 0,
                shipping_charges: 0,
                duties: 0,
                additional_fees: 0,
                taxes: 0,
                total_sales: 0,
                custom_1: 0,
                orders: 0,
                cost_of_goods_sold: 0,
            };
            byDay.set(period, agg);
        }
        const num = (v) => Number(v) || 0;
        agg.gross_sales += num(row.gross_sales);
        agg.discounts += num(row.discounts);
        agg.returns += num(row.returns);
        agg.shipping_returned += num(row.shipping_returned);
        agg.net_sales += num(row.net_sales);
        agg.shipping_charges += num(row.shipping_charges);
        agg.duties += num(row.duties);
        agg.additional_fees += num(row.additional_fees);
        agg.taxes += num(row.taxes);
        agg.total_sales += num(row.total_sales);
        agg.custom_1 += num(row.custom_1);
        agg.orders += num(row.orders);
        if (row.cost_of_goods_sold != null) {
            agg.cost_of_goods_sold += num(row.cost_of_goods_sold);
        }
    }

    return [...byDay.values()].sort((a, b) => a.period.localeCompare(b.period));
}

export async function fetchAdSpendCountryFiltersForSelectedMarkets(
    shopDomain,
    accessToken,
    marketNumericIds
) {
    const ids = [...new Set((marketNumericIds || []).map((id) => String(id).trim()).filter(Boolean))];
    if (ids.length === 0) {
        return { billingCountryNames: [], metaCountryCodes: [], googleCountryNames: [] };
    }

    /** @type {Array<{ name: string, code: string|null }>} */
    const all = [];
    await Promise.all(
        ids.map(async (id) => {
            const list = await fetchMarketRegionCountries(shopDomain, accessToken, id);
            all.push(...list);
        })
    );
    return buildAdSpendCountryFiltersFromRegionCountries(all);
}
