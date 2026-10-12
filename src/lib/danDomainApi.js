import {
    normalizeDanDomainSettings,
    normalizeDanDomainShopHost,
    normalizeDanDomainOrderStatusIds,
    resolveDanDomainReportingRules,
} from "./danDomainCustomerSettings.js";

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
    status: { typeName: "OrderStatus", fallback: ["id"] },
    orderLines: {
        typeName: "OrderLine",
        fallback: [
            "id",
            "unit",
            "amount",
            "unitRevenue",
            "totalRevenue",
            "vatRate",
            "unitCost",
            "totalCost",
            "productTitle",
        ],
    },
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
        const fromFallback = fallback.filter((n) => names.has(n));
        const costLike = [...names].filter((n) =>
            /unit|quantity|cost|cogs|purchase|buy|total/i.test(n)
        );
        const merged = [...new Set([...selected, ...fromFallback, ...costLike])];
        return merged.length ? merged : fallback;
    } catch {
        return fallback;
    }
}

/**
 * @param {string} shopHost
 * @param {string} accessToken
 * @param {{ includeOrderLines?: boolean }} [opts]
 */
async function discoverOrderDataSelection(shopHost, accessToken, opts = {}) {
    const includeOrderLines = opts.includeOrderLines === true;
    const cacheKey = `${shopHost}:order-selection:${includeOrderLines ? "lines" : "base"}`;
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
                        ofType {
                            kind
                            name
                            ofType {
                                kind
                                name
                                ofType { kind name ofType { kind name } }
                            }
                        }
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
        const fallbackParts = [
            ...PREFERRED_ORDER_FIELDS,
            buildNestedSelection("status", ORDER_NESTED_FIELDS.status.fallback),
        ];
        if (includeOrderLines) {
            fallbackParts.push(
                buildNestedSelection("orderLines", ORDER_NESTED_FIELDS.orderLines.fallback)
            );
        }
        const fallback = fallbackParts.join("\n              ");
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
        if (
            /total|price|vat|tax|ship|freight|deliver|discount|rebate|subtotal|grand|sent|paid|updated/i.test(
                name
            )
        ) {
            selectedScalars.add(name);
        }
    }

    const orderFieldNames = new Set(fields.map((f) => f?.name).filter(Boolean));
    const lines = [...selectedScalars];
    for (const [fieldName, config] of Object.entries(ORDER_NESTED_FIELDS)) {
        if (fieldName === "orderLines" && !includeOrderLines) continue;
        const present =
            objectNames.has(fieldName) ||
            (orderFieldNames.has(fieldName) && config.typeName);
        if (present) {
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

function buildDateRangeIso(startDate, endDate) {
    const startIso = `${startDate}T00:00:00+00:00`;
    const endExclusive = new Date(`${endDate}T00:00:00Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    const endIso = endExclusive.toISOString().replace(".000Z", "+00:00");
    return { startIso, endIso };
}

function buildDateFieldSearch(startDate, endDate, fieldName, { gteComparator = "GREATER_THAN_OR_EQUAL" } = {}) {
    const { startIso, endIso } = buildDateRangeIso(startDate, endDate);
    return [
        `{ field: ${fieldName}, comparator: ${gteComparator}, value: "${startIso}" }`,
        `{ field: ${fieldName}, comparator: LESS_THAN, value: "${endIso}" }`,
    ].join("\n");
}

function buildCreatedAtSearch(startDate, endDate) {
    return buildDateFieldSearch(startDate, endDate, "createdAt");
}

function buildCreatedAtSearchFallback(startDate, endDate) {
    return buildDateFieldSearch(startDate, endDate, "createdAt", {
        gteComparator: "GREATER_THAN",
    });
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

/**
 * @param {Record<string, unknown>} order
 */
export function getDanDomainOrderStatusId(order) {
    const status = order?.status;
    if (status && typeof status === "object") {
        return String(/** @type {{ id?: string }} */ (status).id ?? "").trim();
    }
    return String(status ?? "").trim();
}

/**
 * @param {Record<string, unknown>} order
 * @param {{ statusIds?: string[]|null, excludeStatusIds?: string[] }} [opts]
 */
export function isDanDomainOrderIncludedForRevenue(order, opts = {}) {
    const statusIds = Array.isArray(opts) ? opts : opts.statusIds;
    const excludeStatusIds = Array.isArray(opts) ? [] : opts.excludeStatusIds || [];
    const id = getDanDomainOrderStatusId(order);
    if (excludeStatusIds.length && excludeStatusIds.includes(id)) return false;
    if (!statusIds || statusIds.length === 0) return true;
    return statusIds.includes(id);
}

/**
 * DanDomain Rapporter → Salg “Omsætning (ex moms)” for the order-created period.
 * HostedShop GraphQL often exposes inc-VAT `total` while line/subTotal sums do not match admin.
 * Empirically matches admin when ex-VAT = total / 1.25 (DK standard rate). Credit notes negative.
 */
export function danDomainSalgsstatistikOmsExclVat(order, metrics) {
    const id = getDanDomainOrderStatusId(order);
    const sign = id === "100" ? -1 : 1;

    const totalIncl =
        num(order.total) ||
        num(order.totalPriceIncVat) ||
        num(order.totalIncVat) ||
        num(metrics.total_sales);

    const exVatField =
        num(order.totalPriceExVat) ||
        num(order.totalExVat) ||
        num(order.totalExclVat) ||
        num(order.priceExVat);
    if (exVatField > 0) {
        return sign * exVatField;
    }

    if (totalIncl > 0) {
        return sign * (totalIncl / 1.25);
    }

    const net = Number(metrics.net_sales) || 0;
    const ship = Number(metrics.shipping_charges) || 0;
    return sign * (net + ship);
}

/**
 * @param {string} shopHost
 * @param {string} accessToken
 * @param {string} searchBlock
 * @param {string} selection
 * @param {string[]} paginationFields
 * @param {{ fallbackSearchBlock?: string }} [searchOpts]
 */
async function fetchDanDomainOrdersForSearchBlock(
    shopHost,
    accessToken,
    searchBlock,
    selection,
    paginationFields,
    searchOpts = {}
) {
    /** @type {Record<string, unknown>[]} */
    const all = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
        let blockToUse = searchBlock;
        let res;

        try {
            res = await requestDanDomainOrdersPage(shopHost, accessToken, {
                page,
                pageSize: DEFAULT_PAGE_SIZE,
                searchBlock: blockToUse,
                selection,
                paginationFields,
            });
        } catch (e) {
            const msg = String(e?.message || "");
            if (msg.includes("GREATER_THAN_OR_EQUAL") && searchOpts.fallbackSearchBlock) {
                blockToUse = searchOpts.fallbackSearchBlock;
                res = await requestDanDomainOrdersPage(shopHost, accessToken, {
                    page,
                    pageSize: DEFAULT_PAGE_SIZE,
                    searchBlock: blockToUse,
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

/**
 * @param {string} shopHost
 * @param {string} accessToken
 * @param {string} startDate
 * @param {string} endDate
 * @param {{ includeOrderLines?: boolean, revenueDateField?: "sentAt"|"createdAt" }} [opts]
 */
export async function fetchDanDomainOrdersInRange(
    shopHost,
    accessToken,
    startDate,
    endDate,
    opts = {}
) {
    const [selection, paginationFields] = await Promise.all([
        discoverOrderDataSelection(shopHost, accessToken, {
            includeOrderLines: opts.includeOrderLines === true,
        }),
        discoverPaginationFields(shopHost, accessToken),
    ]);

    const createdAtSearch = buildCreatedAtSearch(startDate, endDate);
    const createdAtFallback = buildCreatedAtSearchFallback(startDate, endDate);

    // Fetch by createdAt window; aggregate may bucket by sentAt (DanDomain admin “Omsætning”).
    return fetchDanDomainOrdersForSearchBlock(
        shopHost,
        accessToken,
        createdAtSearch,
        selection,
        paginationFields,
        { fallbackSearchBlock: createdAtFallback }
    );
}

function pickFirstNumber(obj, keys) {
    for (const key of keys) {
        if (obj?.[key] != null) return num(obj[key]);
    }
    return 0;
}

/**
 * @param {Record<string, unknown>} order
 * @param {"sentAt"|"createdAt"} [revenueDateField]
 */
export function getDanDomainOrderReportingYmd(order, revenueDateField = "sentAt") {
    const field = revenueDateField === "createdAt" ? "createdAt" : "sentAt";
    let raw = order?.[field];
    if (field === "sentAt" && !raw) {
        raw = order?.createdAt ?? order?.created_at ?? order?.date;
    } else if (field === "createdAt") {
        raw = order?.createdAt ?? order?.created_at ?? order?.date;
    }
    if (!raw) return "";
    const s = String(raw).trim();
    if (s.length >= 10) return s.slice(0, 10);
    return "";
}

/**
 * @param {Record<string, unknown>} order
 */
function danDomainOrderLines(order) {
    return Array.isArray(order?.orderLines)
        ? order.orderLines
        : Array.isArray(order?.lines)
          ? order.lines
          : [];
}

function isGiftCardLine(line) {
    if (!line || typeof line !== "object") return false;
    const row = /** @type {Record<string, unknown>} */ (line);
    if (row.giftCard != null) return true;
    const title = String(row.productTitle ?? row.additionalTitle ?? "").toLowerCase();
    return title.includes("gift card") || title.includes("gavekort");
}

/**
 * Product line revenue excl. VAT (matches DanDomain admin “Omsætning” when lines are present).
 * @param {Record<string, unknown>} order
 */
export function sumDanDomainOrderLineRevenue(order) {
    const lines = danDomainOrderLines(order);
    if (!lines.length) return 0;
    let sum = 0;
    for (const line of lines) {
        if (!line || typeof line !== "object" || isGiftCardLine(line)) continue;
        const row = /** @type {Record<string, unknown>} */ (line);
        const totalRev = num(row.totalRevenue);
        if (totalRev > 0) {
            sum += totalRev;
            continue;
        }
        const unitRev = num(row.unitRevenue);
        const units = num(row.amount ?? row.quantity ?? 1) || 1;
        if (unitRev > 0) sum += unitRev * units;
    }
    return sum;
}

export function sumDanDomainOrderLineCogs(order) {
    const lines = danDomainOrderLines(order);
    let sum = 0;
    for (const line of lines) {
        if (!line || typeof line !== "object" || isGiftCardLine(line)) continue;
        const row = /** @type {Record<string, unknown>} */ (line);
        const totalCost = num(row.totalCost);
        if (totalCost > 0) {
            sum += totalCost;
            continue;
        }
        const unitCost = num(row.unitCost);
        const unitsRaw = row.amount ?? row.quantity ?? row.unit;
        const units = num(unitsRaw) > 0 ? num(unitsRaw) : 1;
        if (unitCost > 0) sum += unitCost * units;
    }
    return sum;
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

    const subTotal = pickFirstNumber(order, ["subTotal", "subtotal"]);
    const orderTotal = pickFirstNumber(order, [
        "total",
        "totalPriceIncVat",
        "totalIncVat",
        "totalInclVat",
        "priceIncVat",
        "grandTotal",
        "totalPrice",
        "orderTotal",
    ]);

    const costOfGoodsSold = sumDanDomainOrderLineCogs(order);
    const lineRevenue = sumDanDomainOrderLineRevenue(order);

    if (subTotal > 0 && orderTotal > 0) {
        let tax = pickFirstNumber(order, [
            "totalVat",
            "vat",
            "tax",
            "taxAmount",
            "totalTax",
        ]);
        if (!tax) {
            tax = Math.max(0, orderTotal - subTotal - shipping);
        }
        const netSales = lineRevenue > 0 ? lineRevenue : subTotal;
        const gross = netSales + discount;
        return {
            gross_sales: gross,
            discounts: discount,
            returns: 0,
            net_sales: netSales,
            shipping_charges: shipping,
            duties: 0,
            additional_fees: 0,
            taxes: tax,
            total_sales: orderTotal,
            custom_1: netSales + shipping,
            cost_of_goods_sold: costOfGoodsSold,
            orders: 1,
        };
    }

    let tax = pickFirstNumber(order, [
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
    let totalIncl = orderTotal;

    let gross = subTotal || pickFirstNumber(order, ["productTotal", "lineTotal", "grossSales"]);

    if (!gross && totalExcl > 0) {
        gross = totalExcl + discount;
    }
    if (!gross && totalIncl > 0 && tax > 0) {
        gross = totalIncl - tax - shipping + discount;
    }
    if (!totalExcl && subTotal > 0) {
        totalExcl = subTotal;
    }
    if (!totalExcl && totalIncl > 0 && tax > 0) {
        totalExcl = Math.max(0, totalIncl - tax);
    } else if (!totalExcl && totalIncl > 0 && subTotal > 0) {
        totalExcl = subTotal;
        if (!tax) tax = Math.max(0, totalIncl - subTotal - shipping);
    } else if (!totalExcl && totalIncl > 0 && !tax) {
        totalExcl = Math.max(0, totalIncl - shipping);
    }
    if (!totalIncl && totalExcl > 0) {
        totalIncl = totalExcl + tax;
    }

    let netSales = totalExcl > 0 ? totalExcl : Math.max(0, gross - discount);
    if (lineRevenue > 0) netSales = lineRevenue;
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
        cost_of_goods_sold: costOfGoodsSold,
        orders: 1,
    };
}

/**
 * @param {Record<string, unknown>[]} orders
 * @param {string} startDate
 * @param {string} endDate
 * @param {{
 *   reportingRules?: ReturnType<typeof resolveDanDomainReportingRules>,
 *   statusIds?: string[]|null,
 *   revenueDateField?: "sentAt"|"createdAt",
 *   orderCountDateField?: "sentAt"|"createdAt",
 *   orderCountStatusIds?: string[]|null,
 * }} [opts]
 */
export function aggregateDanDomainOrdersToDaily(orders, startDate, endDate, opts = {}) {
    const rules =
        opts.reportingRules ||
        resolveDanDomainReportingRules({
            revenueReporting: "orderSent",
            orderStatusIds: opts.statusIds,
            excludeOrderStatusIds: [],
            revenueDateField: opts.revenueDateField,
            orderCountDateField: opts.orderCountDateField,
            orderCountStatusIds: opts.orderCountStatusIds,
        });

    const revenueDateField =
        rules.revenueDateField === "sentAt" ? "sentAt" : "createdAt";
    const orderCountDateField =
        rules.orderCountDateField === "sentAt" ? "sentAt" : "createdAt";
    const useSalgsstatistik = rules.revenueReporting === "salgsstatistik";

    /** @type {Record<string, Record<string, number>>} */
    const byDay = {};

    function ensureDay(ymd) {
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
                cost_of_goods_sold: 0,
                orders: 0,
            };
        }
        return byDay[ymd];
    }

    for (const order of orders || []) {
        if (
            !isDanDomainOrderIncludedForRevenue(order, {
                statusIds: rules.revenueStatusIds,
                excludeStatusIds: rules.excludeOrderStatusIds,
            })
        ) {
            continue;
        }

        const ymd = getDanDomainOrderReportingYmd(order, revenueDateField);
        if (!ymd || ymd < startDate || ymd > endDate) continue;
        if (revenueDateField === "sentAt" && !order?.sentAt) continue;

        const m = mapDanDomainOrderToMetrics(order);
        const omsExVat = useSalgsstatistik
            ? danDomainSalgsstatistikOmsExclVat(order, m)
            : m.net_sales;
        const cogsSign = getDanDomainOrderStatusId(order) === "100" ? -1 : 1;

        const d = ensureDay(ymd);
        d.gross_sales += useSalgsstatistik ? omsExVat : m.gross_sales;
        d.discounts += m.discounts;
        d.returns += m.returns;
        d.net_sales += omsExVat;
        d.shipping_charges += useSalgsstatistik ? 0 : m.shipping_charges;
        d.taxes += m.taxes;
        d.total_sales += m.total_sales;
        d.custom_1 += omsExVat;
        d.cost_of_goods_sold += cogsSign * (m.cost_of_goods_sold || 0);
    }

    for (const order of orders || []) {
        if (
            !isDanDomainOrderIncludedForRevenue(order, {
                statusIds: rules.orderCountStatusIds,
                excludeStatusIds: rules.orderCountExcludeStatusIds,
            })
        ) {
            continue;
        }
        const countYmd = getDanDomainOrderReportingYmd(order, orderCountDateField);
        if (!countYmd || countYmd < startDate || countYmd > endDate) continue;
        if (orderCountDateField === "sentAt" && !order?.sentAt) continue;
        ensureDay(countYmd).orders += 1;
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

    const includeOrderLines = customerSettings?.fetchCogsFromStore === true;
    const reportingRules = resolveDanDomainReportingRules(dan);

    async function run(forceRefresh = false) {
        const token = await resolveDanDomainAccessToken(dan, { forceRefresh });
        const orders = await fetchDanDomainOrdersInRange(
            shopHost,
            token,
            startDate,
            endDate,
            { includeOrderLines, revenueDateField: reportingRules.revenueDateField }
        );
        return aggregateDanDomainOrdersToDaily(orders, startDate, endDate, {
            reportingRules,
        });
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
