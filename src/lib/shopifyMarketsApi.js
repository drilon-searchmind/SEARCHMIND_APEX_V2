/**
 * Shopify Markets catalog via Admin GraphQL (`markets` query).
 * Custom apps need the `read_markets` scope in addition to existing Admin API scopes.
 */

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
 * @returns {string} numeric id for ShopifyQL dimensions like market_id
 */
export function gidToNumericMarketId(gid) {
    if (!gid) return "";
    const s = String(gid);
    const m = s.match(/(\d+)\s*$/);
    return m ? m[1] : s;
}

/**
 * @param {string} shopDomain - myshopify.com hostname (no protocol)
 * @param {string} accessToken - Admin API access token
 * @returns {Promise<{ markets: Array<{ gid: string, shopifyqlMarketId: string, name: string, handle: string }>, graphqlErrors?: string[] }>}
 */
export async function fetchShopifyMarketsCatalog(shopDomain, accessToken) {
    const domain = String(shopDomain || "")
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
    if (!domain || !accessToken) {
        return { markets: [] };
    }

    const endpoint = `https://${domain}/admin/api/2025-10/graphql.json`;

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
            const res = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": accessToken,
                },
                body: JSON.stringify({
                    query,
                    variables: { first: 100, after },
                }),
            });
            const json = await res.json().catch(() => ({}));
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

    const endpoint = `https://${domain}/admin/api/2025-10/graphql.json`;
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
        const res = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token": accessToken,
            },
            body: JSON.stringify({
                query,
                variables: { id: marketGid, after },
            }),
        });
        const json = await res.json().catch(() => ({}));
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
