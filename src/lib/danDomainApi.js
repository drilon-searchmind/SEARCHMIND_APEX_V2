import {
    normalizeDanDomainSettings,
    normalizeDanDomainShopHost,
} from "./danDomainCustomerSettings";

/**
 * HostedShop / DanDomain GraphQL API client.
 * @see https://help.hostedshop.dk/graphql-api/
 * @see https://help.hostedshop.dk/authentication/
 *
 * Order financial fields live on the experimental schema per HostedShop docs.
 */

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGES = 500;

/** @type {Map<string, { token: string, expiresAt: number }>} */
const tokenCache = new Map();

/** @type {Map<string, string>} */
const orderSelectionCache = new Map();

/** @type {Map<string, string[]>} */
const paginationFieldCache = new Map();

const ALWAYS_ORDER_FIELDS = new Set(["id", "createdAt", "currencyCode"]);

/** Object fields on Order — subfields resolved via introspection when possible. */
const ORDER_NESTED_FIELDS = {
    status: { typeName: "OrderStatus", fallback: ["id", "name"] },
};

const PREFERRED_ORDER_FIELDS = [
    "id",
    "createdAt",
    "currencyCode",
    "totalPriceExVat",
    "totalPriceIncVat",
    "totalExVat",
    "totalIncVat",
    "totalVat",
    "vat",
    "tax",
    "taxAmount",
    "shippingPrice",
    "shippingAmount",
    "shipping",
    "deliveryPrice",
    "freight",
    "discountAmount",
    "discount",
    "rebate",
    "subtotal",
    "subTotal",
    "totalPrice",
    "grandTotal",
    "orderTotal",
    "total",
    "priceTotal",
    "productTotal",
    "lineTotal",
];

function num(v) {
    if (v === undefined || v === null || v === "") return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function dbg(...args) {
    if (process.env.DEBUG_DANDOMAIN === "1" || process.env.NODE_ENV === "development") {
        console.log("[DanDomain]", ...args);
    }
}

function tokenCacheKey(shopHost, clientId) {
    return `${shopHost}::${clientId}`;
}

/**
 * @param {ReturnType<typeof normalizeDanDomainSettings>} dan
 */
export function getDanDomainShopHost(dan) {
    const host = normalizeDanDomainShopHost(dan?.shopHost);
    if (!host) {
        throw new Error(
            "Missing DanDomain shop host — set Config → DanDomain → Shop host (e.g. shop99999.mywebshop.io)"
        );
    }
    return host;
}

/**
 * @param {{ shopHost: string, clientId: string, clientSecret: string }} creds
 */
export async function fetchDanDomainOAuthToken({
    shopHost,
    clientId,
    clientSecret,
    skipCache = false,
}) {
    const host = normalizeDanDomainShopHost(shopHost);
    const id = String(clientId || "").trim();
    const secret = String(clientSecret || "").trim();
    if (!host || !id || !secret) {
        throw new Error("DanDomain OAuth requires shop host, client id, and client secret");
    }

    const cacheKey = tokenCacheKey(host, id);
    if (!skipCache) {
        const cached = tokenCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now() + 60_000) {
            return cached.token;
        }
    }

    const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: id,
        client_secret: secret,
        scope: "",
    });

    const res = await fetch(`https://${host}/auth/oauth/token`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        cache: "no-store",
    });

    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg =
            raw?.error_description ||
            raw?.message ||
            raw?.error ||
            res.statusText ||
            `HTTP ${res.status}`;
        throw new Error(`DanDomain OAuth failed: ${msg}`);
    }

    const token = String(raw.access_token || "").trim();
    if (!token) throw new Error("DanDomain OAuth response missing access_token");

    const expiresIn = Number(raw.expires_in) || 86_400;
    tokenCache.set(cacheKey, {
        token,
        expiresAt: Date.now() + Math.max(300, expiresIn - 120) * 1000,
    });
    dbg("Fetched OAuth token for", host);
    return token;
}

/**
 * @param {ReturnType<typeof normalizeDanDomainSettings>} dan
 * @param {{ forceRefresh?: boolean }} [opts]
 */
export async function resolveDanDomainAccessToken(dan, opts = {}) {
    const settings = dan || normalizeDanDomainSettings();
    const host = getDanDomainShopHost(settings);
    const clientId = settings.clientId;
    const clientSecret = settings.clientSecret;
    const stored = settings.accessToken;

    if (clientId && clientSecret) {
        return fetchDanDomainOAuthToken({
            shopHost: host,
            clientId,
            clientSecret,
            skipCache: opts.forceRefresh === true,
        });
    }

    if (stored) return stored;

    throw new Error(
        "Missing DanDomain API credentials — add client id + secret or access token in Config"
    );
}

/**
 * @param {string} shopHost
 * @param {string} accessToken
 * @param {string} query
 * @param {"public"|"experimental"} [apiVariant]
 */
export async function danDomainGraphqlRequest(
    shopHost,
    accessToken,
    query,
    apiVariant = "experimental"
) {
    const host = normalizeDanDomainShopHost(shopHost);
    const path =
        apiVariant === "experimental" ? "/api/graphql/experimental" : "/api/graphql";
    const res = await fetch(`https://${host}${path}`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
            query,
            variables: {},
            operationName: null,
        }),
        cache: "no-store",
    });

    const text = await res.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { _raw: text?.slice?.(0, 500) || "" };
    }

    if (!res.ok) {
        const msg =
            data?.errors?.[0]?.message ||
            data?.message ||
            data?._raw ||
            res.statusText ||
            `HTTP ${res.status}`;
        throw new Error(`DanDomain GraphQL ${res.status}: ${msg}`);
    }

    if (Array.isArray(data.errors) && data.errors.length > 0) {
        throw new Error(
            `DanDomain GraphQL error: ${data.errors.map((e) => e.message).join("; ")}`
        );
    }

    return data;
}

function unwrapGraphqlType(type) {
    let t = type;
    while (t && (t.kind === "NON_NULL" || t.kind === "LIST")) {
        t = t.ofType;
    }
    return t;
}

function buildNestedSelection(fieldName, subfields) {
    const inner = subfields.map((f) => `  ${f}`).join("\n");
    return `${fieldName} {\n${inner}\n}`;
}

async function discoverPaginationFields(shopHost, accessToken) {
    const cacheKey = `${shopHost}:pagination-fields`;
    if (paginationFieldCache.has(cacheKey)) {
        return paginationFieldCache.get(cacheKey);
    }

    const introspection = `
        query IntrospectPagination {
            __type(name: "PaginationData") {
                fields { name }
            }
        }
    `;

    let names = [];
    try {
        const res = await danDomainGraphqlRequest(
            shopHost,
            accessToken,
            introspection,
            "experimental"
        );
        names = (res?.data?.__type?.fields || [])
            .map((f) => f?.name)
            .filter(Boolean);
    } catch (e) {
        dbg("Pagination introspection failed:", e?.message);
    }

    const preferred = ["page", "limit", "total", "from", "to"];
    const selected =
        names.length > 0
            ? preferred.filter((n) => names.includes(n))
            : ["page", "limit", "total"];

    paginationFieldCache.set(cacheKey, selected.length ? selected : ["page", "limit", "total"]);
    return paginationFieldCache.get(cacheKey);
}

async function discoverNestedSubfields(shopHost, accessToken, typeName, fallback) {
    const introspection = `
        query IntrospectNestedType {
            __type(name: "${typeName}") {
                fields {
                    name
                    type { kind name ofType { kind name } }
                }
            }
        }
    `;

    try {
        const res = await danDomainGraphqlRequest(
            shopHost,
            accessToken,
            introspection,
            "experimental"
        );
        const names = new Set();
        for (const f of res?.data?.__type?.fields || []) {
            const t = unwrapGraphqlType(f?.type);
            if (t?.kind === "SCALAR" || t?.kind === "ENUM") {
                if (f?.name) names.add(f.name);
            }
        }
        const preferred = ["id", "name", "code", "title", "label"];
        const selected = preferred.filter((n) => names.has(n));
        return selected.length ? selected : fallback;
    } catch {
        return fallback;
    }
}

async function discoverOrderDataSelection(shopHost, accessToken) {
    const cacheKey = `${shopHost}:order-selection`;
    if (orderSelectionCache.has(cacheKey)) {
        return orderSelectionCache.get(cacheKey);
    }

    const introspection = `
        query IntrospectOrder {
            __type(name: "Order") {
                fields {
                    name
                    type {
                        kind
                        name
                        ofType { kind name ofType { kind name } }
                    }
                }
            }
        }
    `;

    let fields = [];
    try {
        const res = await danDomainGraphqlRequest(
            shopHost,
            accessToken,
            introspection,
            "experimental"
        );
        fields = res?.data?.__type?.fields || [];
    } catch (e) {
        dbg("Order introspection failed, using preferred field list:", e?.message);
        const fallbackScalars = PREFERRED_ORDER_FIELDS;
        const fallback = [
            ...fallbackScalars,
            buildNestedSelection("status", ORDER_NESTED_FIELDS.status.fallback),
        ].join("\n              ");
        orderSelectionCache.set(cacheKey, fallback);
        return fallback;
    }

    const scalarNames = new Set();
    const objectNames = new Set();
    for (const f of fields) {
        const name = f?.name;
        if (!name) continue;
        const t = unwrapGraphqlType(f.type);
        const kind = t?.kind;
        if (kind === "SCALAR" || kind === "ENUM") {
            scalarNames.add(name);
        } else if (kind === "OBJECT") {
            objectNames.add(name);
        }
    }

    const selectedScalars = new Set([...ALWAYS_ORDER_FIELDS]);
    for (const name of PREFERRED_ORDER_FIELDS) {
        if (scalarNames.has(name)) selectedScalars.add(name);
    }
    for (const name of scalarNames) {
        if (/total|price|vat|tax|ship|freight|deliver|discount|rebate|subtotal|grand/i.test(name)) {
            selectedScalars.add(name);
        }
    }

    const lines = [...selectedScalars];
    for (const [fieldName, config] of Object.entries(ORDER_NESTED_FIELDS)) {
        if (objectNames.has(fieldName)) {
            const subfields = await discoverNestedSubfields(
                shopHost,
                accessToken,
                config.typeName,
                config.fallback
            );
            lines.push(buildNestedSelection(fieldName, subfields));
        }
    }

    const out = lines.join("\n              ");
    orderSelectionCache.set(cacheKey, out);
    dbg("Order selection for query:\n", out);
    return out;
}

function buildCreatedAtSearch(startDate, endDate) {
    const startIso = `${startDate}T00:00:00+00:00`;
    const endExclusive = new Date(`${endDate}T00:00:00Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const endIso = endExclusive.toISOString().replace(".000Z", "+00:00");

    return [
        `{ field: createdAt, comparator: GREATER_THAN_OR_EQUAL, value: "${startIso}" }`,
        `{ field: createdAt, comparator: LESS_THAN, value: "${endIso}" }`,
    ].join("\n");
}

function buildCreatedAtSearchFallback(startDate, endDate) {
    const startIso = `${startDate}T00:00:00+00:00`;
    const endExclusive = new Date(`${endDate}T00:00:00Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const endIso = endExclusive.toISOString().replace(".000Z", "+00:00");

    return [
        `{ field: createdAt, comparator: GREATER_THAN, value: "${startIso}" }`,
        `{ field: createdAt, comparator: LESS_THAN, value: "${endIso}" }`,
    ].join("\n");
}

/**
 * @param {string} shopHost
 * @param {string} accessToken
 * @param {string} startDate
 * @param {string} endDate
 */
function buildOrdersQuery({
    page,
    pageSize,
    searchBlock,
    selection,
    paginationFields,
    sortField = "createdAt",
}) {
    const paginationSelection = paginationFields.join("\n                  ");
    return `
            query DanDomainOrders {
              orders(
                pagination: { limit: ${pageSize}, page: ${page} }
                sorting: { field: ${sortField}, direction: ASC }
                search: [
                  ${searchBlock}
                ]
              ) {
                pagination {
                  ${paginationSelection}
                }
                data {
                  ${selection}
                }
              }
            }
        `;
}

async function requestDanDomainOrdersPage(
    shopHost,
    accessToken,
    { page, pageSize, searchBlock, selection, paginationFields }
) {
    const sortFields = ["createdAt", "id"];
    let lastError;

    for (const sortField of sortFields) {
        const query = buildOrdersQuery({
            page,
            pageSize,
            searchBlock,
            selection,
            paginationFields,
            sortField,
        });

        try {
            return await danDomainGraphqlRequest(
                shopHost,
                accessToken,
                query,
                "experimental"
            );
        } catch (e) {
            lastError = e;
            const msg = String(e?.message || "");
            if (msg.includes(sortField) && sortField !== sortFields[sortFields.length - 1]) {
                dbg(`Sort field ${sortField} failed, trying next`);
                continue;
            }
            throw e;
        }
    }

    throw lastError || new Error("DanDomain orders query failed");
}

export async function fetchDanDomainOrdersInRange(
    shopHost,
    accessToken,
    startDate,
    endDate
) {
    const [selection, paginationFields] = await Promise.all([
        discoverOrderDataSelection(shopHost, accessToken),
        discoverPaginationFields(shopHost, accessToken),
    ]);

    /** @type {Record<string, unknown>[]} */
    const all = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
        let searchBlock = buildCreatedAtSearch(startDate, endDate);
        let res;

        try {
            res = await requestDanDomainOrdersPage(shopHost, accessToken, {
                page,
                pageSize: DEFAULT_PAGE_SIZE,
                searchBlock,
                selection,
                paginationFields,
            });
        } catch (e) {
            if (String(e?.message || "").includes("GREATER_THAN_OR_EQUAL")) {
                searchBlock = buildCreatedAtSearchFallback(startDate, endDate);
                res = await requestDanDomainOrdersPage(shopHost, accessToken, {
                    page,
                    pageSize: DEFAULT_PAGE_SIZE,
                    searchBlock,
                    selection,
                    paginationFields,
                });
            } else {
                throw e;
            }
        }

        const block = res?.data?.orders;
        const rows = block?.data || [];
        for (const row of rows) {
            if (row && typeof row === "object") all.push(row);
        }

        const pagination = block?.pagination || {};
        const perPage =
            Number(pagination.limit ?? pagination.perPage) || DEFAULT_PAGE_SIZE;
        const currentPage = Number(pagination.page ?? pagination.currentPage) || page;
        const total = Number(pagination.total) || 0;

        if (!rows.length) break;
        if (rows.length < perPage) break;
        if (total > 0 && currentPage * perPage >= total) break;
    }

    return all;
}

function pickFirstNumber(obj, keys) {
    for (const key of keys) {
        if (obj?.[key] != null) return num(obj[key]);
    }
    return 0;
}

function orderDateYmd(order) {
    const raw = order?.createdAt ?? order?.created_at ?? order?.date;
    if (!raw) return "";
    const s = String(raw).trim();
    if (s.length >= 10) return s.slice(0, 10);
    return "";
}

/**
 * Map a HostedShop order row to Shopify-compatible monetary components (store currency, excl. VAT base).
 * @param {Record<string, unknown>} order
 */
export function mapDanDomainOrderToMetrics(order) {
    const discount = Math.abs(
        pickFirstNumber(order, [
            "discountAmount",
            "discount",
            "rebate",
            "totalDiscount",
            "discountTotal",
        ])
    );
    const shipping = pickFirstNumber(order, [
        "shippingPrice",
        "shippingAmount",
        "shipping",
        "deliveryPrice",
        "freight",
        "shippingTotal",
    ]);
    const tax = pickFirstNumber(order, [
        "totalVat",
        "vat",
        "tax",
        "taxAmount",
        "totalTax",
    ]);

    let totalExcl = pickFirstNumber(order, [
        "totalPriceExVat",
        "totalExVat",
        "totalExclVat",
        "priceExVat",
    ]);
    let totalIncl = pickFirstNumber(order, [
        "totalPriceIncVat",
        "totalIncVat",
        "totalInclVat",
        "priceIncVat",
        "grandTotal",
        "totalPrice",
        "orderTotal",
        "total",
    ]);

    let gross = pickFirstNumber(order, [
        "subtotal",
        "subTotal",
        "productTotal",
        "lineTotal",
        "grossSales",
    ]);

    if (!gross && totalExcl > 0) {
        gross = totalExcl + discount;
    }
    if (!gross && totalIncl > 0 && tax > 0) {
        gross = totalIncl - tax - shipping + discount;
    }
    if (!totalExcl && totalIncl > 0) {
        totalExcl = Math.max(0, totalIncl - tax);
    }
    if (!totalIncl && totalExcl > 0) {
        totalIncl = totalExcl + tax;
    }

    const netSales = totalExcl > 0 ? totalExcl : Math.max(0, gross - discount);
    const totalSales = totalIncl > 0 ? totalIncl : netSales + tax;

    return {
        gross_sales: gross || netSales + discount,
        discounts: discount,
        returns: 0,
        net_sales: netSales,
        shipping_charges: shipping,
        duties: 0,
        additional_fees: 0,
        taxes: tax,
        total_sales: totalSales,
        custom_1: netSales + shipping,
        orders: 1,
    };
}

/**
 * @param {Record<string, unknown>[]} orders
 * @param {string} startDate
 * @param {string} endDate
 */
export function aggregateDanDomainOrdersToDaily(orders, startDate, endDate) {
    /** @type {Record<string, Record<string, number>>} */
    const byDay = {};

    for (const order of orders || []) {
        const ymd = orderDateYmd(order);
        if (!ymd || ymd < startDate || ymd > endDate) continue;

        const m = mapDanDomainOrderToMetrics(order);
        if (!byDay[ymd]) {
            byDay[ymd] = {
                period: ymd,
                gross_sales: 0,
                discounts: 0,
                returns: 0,
                net_sales: 0,
                shipping_charges: 0,
                duties: 0,
                additional_fees: 0,
                taxes: 0,
                total_sales: 0,
                custom_1: 0,
                orders: 0,
            };
        }
        const d = byDay[ymd];
        d.gross_sales += m.gross_sales;
        d.discounts += m.discounts;
        d.returns += m.returns;
        d.net_sales += m.net_sales;
        d.shipping_charges += m.shipping_charges;
        d.taxes += m.taxes;
        d.total_sales += m.total_sales;
        d.custom_1 += m.custom_1;
        d.orders += 1;
    }

    return Object.values(byDay).sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Daily revenue rows compatible with Shopify/WooCommerce/Magento merged-sources shape.
 * @param {Record<string, unknown>} customerSettings - CustomerSettings (flat or nested danDomain)
 * @param {string} startDate YYYY-MM-DD
 * @param {string} endDate YYYY-MM-DD
 */
export async function fetchDanDomainPerformanceDaily(
    customerSettings,
    startDate,
    endDate
) {
    const dan = normalizeDanDomainSettings(customerSettings);
    const shopHost = getDanDomainShopHost(dan);

    async function run(forceRefresh = false) {
        const token = await resolveDanDomainAccessToken(dan, { forceRefresh });
        const orders = await fetchDanDomainOrdersInRange(
            shopHost,
            token,
            startDate,
            endDate
        );
        return aggregateDanDomainOrdersToDaily(orders, startDate, endDate);
    }

    try {
        return await run(false);
    } catch (e) {
        const msg = String(e?.message || "");
        if (msg.includes("401") && dan.clientId && dan.clientSecret) {
            dbg("401 — retrying with fresh OAuth token");
            return run(true);
        }
        throw e;
    }
}
