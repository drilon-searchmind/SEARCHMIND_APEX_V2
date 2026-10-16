import { getCurrencyConversionTable, conversionRateToDkk } from './currencyConversionTable';
import {
    buildShopifySalesWhereParts,
    combineShopifyOrderSearchQuery,
    shopifySalesWhereClause,
} from './shopifyQlFilters';
import { shopifyAdminGraphqlPost } from './shopifyAdminClient';
import { shopifyqlQuery } from './shopifyApi';
import { computeTotalSalesExVat } from './performanceDashboard/totalSalesExVat';
import { displaysTotalSalesWithoutVatDeduction } from './revenueVatDisplay';
import {
    fetchExpectedArrivalByProduct,
    fetchOpenInventoryIncomingArrivals,
    fetchProductsInventoryDetails,
    fetchProductsStockValueDetails,
} from './shopifyInventoryIncoming';
/** Cap inventory GraphQL work per request (products are pre-sorted by revenue on the client). */
export const SHOPIFY_INVENTORY_MAX_PRODUCTS_PER_REQUEST = 400;

export {
    SHOPIFY_INCOMING_INVENTORY_SCOPES,
    fetchShopifyGrantedAccessScopes,
    checkShopifyIncomingInventoryScopes,
    fetchOpenInventoryIncomingArrivals,
    INVENTORY_LEVEL_QUANTITY_NAMES,
} from './shopifyInventoryIncoming';

/** Rolling window for "avg. days to sold out" velocity (calendar days, ending yesterday UTC). */
export const SHOPIFY_PRODUCT_SOLD_OUT_LOOKBACK_DAYS = 90;

/**
 * @param {number|null|undefined} inventoryStock
 * @param {number|null|undefined} unitsSoldInLookback
 * @param {number} [lookbackDays=90]
 * @returns {number|null}
 */
export function computeAvgDaysToSoldOut(
    inventoryStock,
    unitsSoldInLookback,
    lookbackDays = SHOPIFY_PRODUCT_SOLD_OUT_LOOKBACK_DAYS
) {
    if (inventoryStock == null || Number.isNaN(Number(inventoryStock))) return null;
    const stock = Number(inventoryStock);
    const sold = Number(unitsSoldInLookback);
    if (!Number.isFinite(sold) || sold <= 0 || !Number.isFinite(lookbackDays) || lookbackDays <= 0) {
        return null;
    }
    const avgUnitsPerDay = sold / lookbackDays;
    if (avgUnitsPerDay <= 0) return null;
    return stock / avgUnitsPerDay;
}

/**
 * Human-readable sold-out cell from fixed rolling velocity only (never the date-picker range).
 * @returns {{ days: number|null, label: string, title: string }}
 */
export function formatAvgDaysToSoldOutDisplay(
    inventoryStock,
    unitsSold60d,
    lookbackDays = SHOPIFY_PRODUCT_SOLD_OUT_LOOKBACK_DAYS
) {
    if (inventoryStock == null || Number.isNaN(Number(inventoryStock))) {
        return {
            days: null,
            label: '—',
            title: 'Inventory stock is not available yet.',
        };
    }

    const stock = Number(inventoryStock);
    if (stock <= 0) {
        return {
            days: null,
            label: 'Out of stock',
            title:
                'Available inventory is 0 in Shopify. Restock or check that the app token has read_inventory access.',
        };
    }

    const sold60 = Number(unitsSold60d);
    if (!Number.isFinite(sold60) || sold60 <= 0) {
        return {
            days: null,
            label: `No sales (${lookbackDays}d)`,
            title:
                `No units sold in the last ${lookbackDays} days (fixed window, independent of the date picker). ` +
                'Units Sold in the table follows your selected date range.',
        };
    }

    const days = computeAvgDaysToSoldOut(stock, sold60, lookbackDays);
    if (days == null || !Number.isFinite(days)) {
        return { days: null, label: '—', title: 'Could not calculate days to sold out.' };
    }

    const avgPerDay = sold60 / lookbackDays;
    const rounded = days >= 100 ? Math.round(days) : Math.round(days * 10) / 10;
    return {
        days,
        label: `${rounded.toLocaleString()} days`,
        title:
            `${stock.toLocaleString()} in stock ÷ (${sold60.toLocaleString()} sold in ${lookbackDays}d ÷ ${lookbackDays} days) ` +
            `= ${stock.toLocaleString()} ÷ ${avgPerDay.toFixed(2)}/day ≈ ${rounded.toLocaleString()} days`,
    };
}

/** @returns {{ startDate: string, endDate: string }} */
export function getRollingProductSoldOutRange(
    lookbackDays = SHOPIFY_PRODUCT_SOLD_OUT_LOOKBACK_DAYS
) {
    const end = new Date();
    end.setUTCDate(end.getUTCDate() - 1);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (lookbackDays - 1));
    return {
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
    };
}

/**
 * Merge multiple order chunk maps into units-sold totals per product.
 * @param {Map<string, object>[]} chunkMaps
 * @returns {Map<string, number>}
 */
function mergeChunkUnitsSold(chunkMaps) {
    const out = new Map();
    for (const chunkMap of chunkMaps) {
        for (const [key, item] of chunkMap) {
            out.set(key, (out.get(key) || 0) + (Number(item.unitsSold) || 0));
        }
    }
    return out;
}

/**
 * Fetch inventory stock, value, incoming quantities, and optional arrival dates.
 * Uses GraphQL InventoryLevel.quantities (incoming is 0 unless transfers/POs exist in Shopify).
 *
 * @param {string} shopUrl
 * @param {string} accessToken
 * @param {string[]} productIds - Product GIDs
 * @param {number} conversionRate
 * @param {{ includeArrivals?: boolean }} [options]
 * @returns {Promise<Record<string, {
 *   inventoryStock: number,
 *   inventoryValue: number,
 *   incomingQuantity: number,
 *   expectedArrivalDate: string|null,
 *   variants: object[],
 * }>>}
 */
async function fetchProductInventory(shopUrl, accessToken, productIds, conversionRate, options = {}) {
    const out = {};
    if (!productIds.length) return out;

    const { includeArrivals = false, includeVariantDetails = false } = options;
    const maxProducts =
        options.maxProducts ?? SHOPIFY_INVENTORY_MAX_PRODUCTS_PER_REQUEST;
    const ids = productIds
        .filter((id) => id && typeof id === 'string')
        .slice(0, maxProducts);

    if (productIds.length > ids.length) {
        console.warn(
            `[Shopify inventory] Capped inventory fetch to ${ids.length} products (${productIds.length} requested).`
        );
    }

    const [stockMap, incomingMap] = await Promise.all([
        fetchProductsStockValueDetails(shopUrl, accessToken, ids),
        fetchProductsInventoryDetails(shopUrl, accessToken, ids, {
            includeVariantDetails,
        }),
    ]);

    let totalIncoming = 0;
    for (const productId of ids) {
        const stock = stockMap.get(productId);
        if (!stock?.fetched) continue;

        const incoming = incomingMap.get(productId);

        const availableFromLevels = incoming?.availableQuantity ?? 0;
        const inventoryStock =
            availableFromLevels > 0
                ? Math.max(stock.inventoryStock, availableFromLevels)
                : stock.inventoryStock;

        if (includeArrivals && incoming?.inventoryItemIds?.length) {
            try {
                const arrivalByItem = await fetchOpenInventoryIncomingArrivals(shopUrl, accessToken);
                applyExpectedArrivalFromItems(incoming, arrivalByItem);
            } catch (err) {
                console.warn('[Shopify inventory] Skipping arrival dates:', err?.message || err);
            }
        }

        delete incoming?.inventoryItemIds;

        const incomingQuantity = incoming?.incomingQuantity ?? 0;
        totalIncoming += incomingQuantity;

        out[productId] = {
            inventoryStock,
            inventoryValue: stock.inventoryValue * conversionRate,
            incomingQuantity,
            expectedArrivalDate: incoming?.expectedArrivalDate ?? null,
            variants: incoming?.variants ?? [],
        };
    }

    if (ids.length > 0 && totalIncoming === 0) {
        console.info(
            '[Shopify inventory] incoming quantity is 0 for all fetched products. ' +
                'Shopify only populates incoming when inventory transfers or purchase orders are active in Admin.'
        );
    }

    return out;
}

/** @param {object} detail @param {Map<string, string>} arrivalByItem */
function applyExpectedArrivalFromItems(detail, arrivalByItem) {
    for (const itemId of detail.inventoryItemIds || []) {
        const at = arrivalByItem.get(itemId);
        if (!at) continue;
        if (!detail.expectedArrivalDate || at < detail.expectedArrivalDate) {
            detail.expectedArrivalDate = at;
        }
    }
}

/**
 * Parse billing country filter from settings.
 * @param {object} settings - Customer settings
 * @returns {{ include: string[], exclude: string[] }}
 */
function parseBillingCountryFilter(settings) {
    const parse = (s) => (typeof s === 'string' ? s.split(',').map((c) => c.trim()).filter(Boolean) : []);
    return {
        include: parse(settings?.changeCurrencyShopifyBillingCountryName),
        exclude: parse(settings?.changeCurrencyShopifyBillingCountryExclude),
    };
}

/**
 * Check if order passes billing country filter (include/exclude).
 * @param {string|null} billingCountry - Order billing country name
 * @param {{ include: string[], exclude: string[] }} filter
 * @returns {boolean}
 */
function orderMatchesBillingFilter(billingCountry, filter) {
    const country = (billingCountry || '').trim();
    const hasInclude = filter.include.length > 0;
    const hasExclude = filter.exclude.length > 0;
    if (!hasInclude && !hasExclude) return true;
    const inInclude = hasInclude && filter.include.some((c) => c.toLowerCase() === country.toLowerCase());
    const inExclude = hasExclude && filter.exclude.some((c) => c.toLowerCase() === country.toLowerCase());
    if (hasInclude && hasExclude) return inInclude && !inExclude;
    if (hasInclude) return inInclude;
    return !inExclude;
}

/**
 * Fetch orders for a single date-range chunk and aggregate into a product map.
 * @param {string} shopUrl - Shopify shop hostname
 * @param {string} accessToken - Shopify access token
 * @param {string} chunkStart - YYYY-MM-DD
 * @param {string} chunkEnd - YYYY-MM-DD
 * @param {number} conversionRate - Currency conversion rate
 * @param {{ include: string[], exclude: string[] }} [billingFilter] - Optional billing country filter
 * @returns {Promise<Map<string, object>>}
 */
async function fetchOrdersChunk(shopUrl, accessToken, chunkStart, chunkEnd, conversionRate, billingFilter = { include: [], exclude: [] }, settings = null) {
    const query = `query getOrders($query: String!, $cursor: String) {
        orders(first: 250, query: $query, after: $cursor) {
            edges {
                node {
                    id
                    billingAddress { country }
                    lineItems(first: 100) {
                        edges {
                            node {
                                quantity
                                originalUnitPriceSet { shopMoney { amount } }
                                discountedTotalSet { shopMoney { amount } }
                                product {
                                    id
                                    title
                                    vendor
                                    productType
                                    handle
                                    featuredImage { url }
                                }
                            }
                        }
                    }
                }
                cursor
            }
            pageInfo {
                hasNextPage
                endCursor
            }
        }
    }`;

    const q = combineShopifyOrderSearchQuery(
        `created_at:>="${chunkStart}" AND created_at:<="${chunkEnd}"`,
        settings
    );
    const products = new Map();
    let cursor = null;
    let hasNext = true;

    while (hasNext) {
        const { res, json } = await shopifyAdminGraphqlPost(shopUrl, accessToken, {
            query,
            variables: { query: q, cursor },
        });
        if (!res.ok) throw new Error(`Shopify GraphQL error: ${res.status}`);
        const edges = json?.data?.orders?.edges || [];

        for (const edge of edges) {
            const orderNode = edge.node;
            const billingCountry = orderNode.billingAddress?.country;
            if (!orderMatchesBillingFilter(billingCountry, billingFilter)) continue;
            const lineItems = orderNode.lineItems?.edges || [];
            const productsSeenInOrder = new Set();
            for (const li of lineItems) {
                const node = li.node;
                const qty = parseInt(node.quantity) || 0;
                const discounted = parseFloat(node.discountedTotalSet?.shopMoney?.amount) || 0;
                const unit = parseFloat(node.originalUnitPriceSet?.shopMoney?.amount) || 0;
                const product = node.product;
                const productId = product?.id || node.id || 'unknown';
                const key = productId;
                const image = product?.featuredImage?.url || null;
                const title = product?.title || node.title || 'Unknown product';
                const vendor = product?.vendor || '';
                const productType = product?.productType || '';

                const revenueRaw = discounted || (unit * qty);
                const revenue = revenueRaw * conversionRate;

                if (!products.has(key)) {
                    products.set(key, {
                        productId: key,
                        title,
                        handle: product?.handle || null,
                        vendor,
                        productType,
                        image,
                        unitsSold: 0,
                        ordersCount: 0,
                        totalRevenue: 0,
                    });
                }
                const item = products.get(key);
                item.unitsSold += qty;
                item.totalRevenue += revenue;
                if (!productsSeenInOrder.has(key)) {
                    item.ordersCount += 1;
                    productsSeenInOrder.add(key);
                }
            }
        }

        const pageInfo = json?.data?.orders?.pageInfo || {};
        hasNext = !!pageInfo.hasNextPage;
        cursor = pageInfo.endCursor || null;
    }
    return products;
}

/**
 * Fetch all products from Shopify (paginated).
 * @param {string} shopUrl - Shopify shop hostname
 * @param {string} accessToken - Shopify access token
 * @returns {Promise<Map<string, object>>} - Map of productId -> { productId, title, handle, vendor, productType, image }
 */
async function fetchAllProducts(shopUrl, accessToken) {
    const products = new Map();
    let cursor = null;
    let hasNext = true;

    const query = `query getProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
            edges {
                node {
                    id
                    title
                    handle
                    vendor
                    productType
                    featuredImage { url }
                }
            }
            pageInfo {
                hasNextPage
                endCursor
            }
        }
    }`;

    while (hasNext) {
        const { res, json } = await shopifyAdminGraphqlPost(shopUrl, accessToken, {
            query,
            variables: { first: 250, after: cursor },
        });
        if (!res.ok) throw new Error(`Shopify GraphQL products error: ${res.status}`);
        const edges = json?.data?.products?.edges || [];

        for (const edge of edges) {
            const node = edge.node;
            const productId = node?.id;
            if (!productId) continue;
            products.set(productId, {
                productId,
                title: node.title || 'Untitled',
                handle: node.handle || null,
                vendor: node.vendor || '',
                productType: node.productType || '',
                image: node.featuredImage?.url || null,
                unitsSold: 0,
                ordersCount: 0,
                totalRevenue: 0,
            });
        }

        const pageInfo = json?.data?.products?.pageInfo || {};
        hasNext = !!pageInfo.hasNextPage;
        cursor = pageInfo.endCursor || null;
    }
    return products;
}

/**
 * Split date range into chunks (by month) for parallel fetching.
 */
function getDateChunks(startDate, endDate, maxChunks = 6) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const chunks = [];
    const msPerDay = 1000 * 60 * 60 * 24;
    const totalDays = Math.ceil((end - start) / msPerDay) + 1;
    const daysPerChunk = Math.max(1, Math.ceil(totalDays / maxChunks));

    let current = new Date(start);
    while (current <= end) {
        const chunkEnd = new Date(current);
        chunkEnd.setDate(chunkEnd.getDate() + daysPerChunk - 1);
        if (chunkEnd > end) chunkEnd.setTime(end.getTime());
        chunks.push({
            start: current.toISOString().slice(0, 10),
            end: chunkEnd.toISOString().slice(0, 10),
        });
        current.setDate(current.getDate() + daysPerChunk);
    }
    return chunks;
}

/** @param {string|number|null|undefined} productId */
export function shopifyProductGid(productId) {
    if (productId == null || productId === '') return null;
    const s = String(productId).trim();
    if (s.startsWith('gid://shopify/Product/')) return s;
    const digits = s.replace(/\D/g, '');
    if (!digits) return null;
    return `gid://shopify/Product/${digits}`;
}

async function runShopifyql(settings, shopifyql) {
    const json = await shopifyqlQuery(settings.shopifyUrl, settings.shopifyApiPassword, shopifyql);
    const parseErrors = json?.data?.shopifyqlQuery?.parseErrors || [];
    if (parseErrors.length) {
        throw new Error(`ShopifyQL: ${parseErrors.join('; ')}`);
    }
    return json?.data?.shopifyqlQuery?.tableData?.rows || [];
}

/**
 * Period totals from ShopifyQL (same sales dataset as Overview).
 * @param {object} settings
 * @param {string} startDate
 * @param {string} endDate
 * @param {number} conversionRate
 * @param {string} [customerType]
 */
export async function fetchShopifySalesPeriodSummary(
    settings,
    startDate,
    endDate,
    customerType = 'Shopify'
) {
    if (!settings?.shopifyUrl || !settings?.shopifyApiPassword) return null;
    const fromCode = settings?.customerStoreValutaCode || 'DKK';
    const currencyData = (await getCurrencyConversionTable()).data;
    const conversionRate = conversionRateToDkk(fromCode, currencyData);
    return fetchProductPerformancePeriodSummary(
        settings,
        startDate,
        endDate,
        conversionRate,
        customerType
    );
}

async function fetchProductPerformancePeriodSummary(
    settings,
    startDate,
    endDate,
    conversionRate,
    customerType = 'Shopify'
) {
    const whereParts = buildShopifySalesWhereParts(settings);
    const whereClause = shopifySalesWhereClause(whereParts);
    const shopifyql = `FROM sales
SHOW net_sales, orders, net_items_sold, gross_sales, total_sales, taxes, shipping_charges
${whereClause}
SINCE ${startDate} UNTIL ${endDate}`;

    const rows = await runShopifyql(settings, shopifyql);
    const row = rows[0] || {};
    const num = (k) => (parseFloat(row[k]) || 0) * conversionRate;
    const netSales = num('net_sales');
    const shippingCharges = num('shipping_charges');
    const totalSales = num('total_sales');
    const taxes = num('taxes');
    const grossSales = num('gross_sales');

    let totalSalesExVat = totalSales;
    if (!displaysTotalSalesWithoutVatDeduction(settings)) {
        totalSalesExVat = computeTotalSalesExVat({
            totalSales,
            taxes,
            grossSales,
            netSales,
            shippingRevenue: shippingCharges,
            customerType,
        });
    }

    return {
        netSales,
        shippingCharges,
        totalSales,
        taxes,
        grossSales,
        orders: parseInt(row.orders, 10) || 0,
        netItemsSold: parseInt(row.net_items_sold, 10) || 0,
        totalSalesExVat,
    };
}

/**
 * @returns {Promise<Map<string, { netSales: number, orders: number, unitsSold: number, title: string }>>}
 */
async function fetchProductSalesMapShopifyql(settings, startDate, endDate, conversionRate) {
    const whereParts = [...buildShopifySalesWhereParts(settings), 'product_id IS NOT NULL'];
    const whereClause = shopifySalesWhereClause(whereParts);
    const shopifyql = `FROM sales
SHOW net_sales, orders, net_items_sold, product_title
${whereClause}
GROUP BY product_id, product_title
SINCE ${startDate} UNTIL ${endDate}
ORDER BY net_sales DESC
LIMIT 5000`;

    const rows = await runShopifyql(settings, shopifyql);
    const map = new Map();
    for (const row of rows) {
        const gid = shopifyProductGid(row.product_id);
        if (!gid) continue;
        map.set(gid, {
            netSales: (parseFloat(row.net_sales) || 0) * conversionRate,
            orders: parseInt(row.orders, 10) || 0,
            unitsSold: parseInt(row.net_items_sold, 10) || 0,
            title: row.product_title ? String(row.product_title) : '',
        });
    }
    return map;
}

/** @returns {Promise<Map<string, number>>} product GID → units */
async function fetchProductUnitsSoldRollingShopifyql(
    settings,
    startDate,
    endDate,
    conversionRate
) {
    const whereParts = [...buildShopifySalesWhereParts(settings), 'product_id IS NOT NULL'];
    const whereClause = shopifySalesWhereClause(whereParts);
    const shopifyql = `FROM sales
SHOW net_items_sold
${whereClause}
GROUP BY product_id
SINCE ${startDate} UNTIL ${endDate}
LIMIT 5000`;

    const rows = await runShopifyql(settings, shopifyql);
    const map = new Map();
    for (const row of rows) {
        const gid = shopifyProductGid(row.product_id);
        if (!gid) continue;
        map.set(gid, parseInt(row.net_items_sold, 10) || 0);
    }
    return map;
}

const PRODUCT_CATALOG_NODES_BATCH = 50;

export function sortProductsByNetSales(products) {
    return products.slice().sort((a, b) => {
        const diff = (Number(b.totalRevenue) || 0) - (Number(a.totalRevenue) || 0);
        if (diff !== 0) return diff;
        return String(a.title || '').localeCompare(String(b.title || ''));
    });
}

function buildProductPerformanceRow(productId, node, salesByProduct, unitsSold60dByProduct) {
    const sales = salesByProduct.get(productId);
    const unitsSold = sales?.unitsSold ?? 0;
    const totalRevenue = sales?.netSales ?? 0;
    const unitsSold60d = unitsSold60dByProduct.get(productId) ?? 0;
    return {
        productId,
        title: node?.title || sales?.title || 'Untitled',
        handle: node?.handle || null,
        vendor: node?.vendor || '',
        productType: node?.productType || '',
        image: node?.featuredImage?.url || null,
        unitsSold,
        ordersCount: sales?.orders ?? 0,
        totalRevenue,
        avgPrice: unitsSold > 0 ? totalRevenue / unitsSold : 0,
        unitsSold60d,
        inventoryStock: null,
        inventoryValue: null,
        incomingQuantity: null,
        expectedArrivalDate: null,
        avgDaysToSoldOut: null,
    };
}

async function fetchProductCatalogNodesByIds(shopUrl, accessToken, productIds) {
    /** @type {Map<string, object>} */
    const byId = new Map();
    const ids = productIds.filter(Boolean);
    if (!ids.length) return byId;

    const query = `query ProductCatalogNodes($ids: [ID!]!) {
        nodes(ids: $ids) {
            ... on Product {
                id
                title
                handle
                vendor
                productType
                featuredImage { url }
            }
        }
    }`;

    for (let i = 0; i < ids.length; i += PRODUCT_CATALOG_NODES_BATCH) {
        const batch = ids.slice(i, i + PRODUCT_CATALOG_NODES_BATCH);
        const { res, json } = await shopifyAdminGraphqlPost(shopUrl, accessToken, {
            query,
            variables: { ids: batch },
        });
        if (!res.ok) continue;
        for (const node of json?.data?.nodes || []) {
            if (node?.id) byId.set(node.id, node);
        }
    }
    return byId;
}

async function fetchProductsCatalogPage(shopUrl, accessToken, { first = 100, after = null } = {}) {
    const query = `query CatalogProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
            nodes {
                id
                title
                handle
                vendor
                productType
                featuredImage { url }
            }
            pageInfo { hasNextPage endCursor }
        }
        productsCount {
            count
        }
    }`;

    const { res, json } = await shopifyAdminGraphqlPost(shopUrl, accessToken, {
        query,
        variables: { first, after },
    });
    if (!res.ok) throw new Error(`Shopify GraphQL products error: ${res.status}`);
    return {
        nodes: json?.data?.products?.nodes || [],
        pageInfo: json?.data?.products?.pageInfo || { hasNextPage: false, endCursor: null },
        totalCount: json?.data?.productsCount?.count ?? null,
    };
}

/**
 * Product performance page: ShopifyQL sales (Overview-aligned) + paginated full catalog.
 */
export async function fetchShopifyProductPerformancePage(
    settings,
    startDate,
    endDate,
    options = {}
) {
    const empty = {
        products: [],
        periodSummary: null,
        catalogPageInfo: { hasNextPage: false, endCursor: null },
        catalogTotalCount: null,
    };
    if (!settings?.shopifyUrl || !settings?.shopifyApiPassword) return empty;

    const shopUrl = settings.shopifyUrl;
    const accessToken = settings.shopifyApiPassword;
    const pageSize = Math.min(Math.max(options.pageSize ?? 100, 25), 250);
    const catalogCursor = options.catalogCursor ?? null;
    const salesOffset = Math.max(parseInt(String(options.salesOffset ?? 0), 10) || 0, 0);
    const customerType = options.customerType || 'Shopify';

    const fromCode = settings?.customerStoreValutaCode || 'DKK';
    const currencyData = (await getCurrencyConversionTable()).data;
    const conversionRate = conversionRateToDkk(fromCode, currencyData);

    try {
        const rolling = getRollingProductSoldOutRange();
        const salesMapPromise = fetchProductSalesMapShopifyql(
            settings,
            startDate,
            endDate,
            conversionRate
        );
        const isFirstCatalogPage = salesOffset === 0 && !catalogCursor;
        const periodPromise = isFirstCatalogPage
            ? fetchProductPerformancePeriodSummary(
                  settings,
                  startDate,
                  endDate,
                  conversionRate,
                  customerType
              )
            : Promise.resolve(null);
        const units60Promise = fetchProductUnitsSoldRollingShopifyql(
            settings,
            rolling.startDate,
            rolling.endDate,
            conversionRate
        );

        const [salesByProduct, periodSummary, unitsSold60dByProduct] = await Promise.all([
            salesMapPromise,
            periodPromise,
            units60Promise,
        ]);

        const salesSortedIds = [...salesByProduct.entries()]
            .sort((a, b) => b[1].netSales - a[1].netSales)
            .map(([id]) => id);

        const products = [];
        let nextSalesOffset = salesOffset;
        let walkCatalogCursor = catalogCursor;
        let catalogTotalCount = null;
        let catalogHasNextPage = false;

        const salesPageIds = salesSortedIds.slice(salesOffset, salesOffset + pageSize);
        if (salesPageIds.length) {
            const nodesById = await fetchProductCatalogNodesByIds(
                shopUrl,
                accessToken,
                salesPageIds
            );
            for (const productId of salesPageIds) {
                products.push(
                    buildProductPerformanceRow(
                        productId,
                        nodesById.get(productId),
                        salesByProduct,
                        unitsSold60dByProduct
                    )
                );
            }
            nextSalesOffset = salesOffset + salesPageIds.length;
        }

        let slotsLeft = pageSize - products.length;
        if (slotsLeft > 0) {
            let scanningCatalog = true;
            while (slotsLeft > 0 && scanningCatalog) {
                const catalog = await fetchProductsCatalogPage(shopUrl, accessToken, {
                    first: Math.min(Math.max(slotsLeft * 3, 50), 250),
                    after: walkCatalogCursor,
                });
                if (catalogTotalCount == null && catalog.totalCount != null) {
                    catalogTotalCount = catalog.totalCount;
                }
                for (const node of catalog.nodes) {
                    if (salesByProduct.has(node.id)) continue;
                    products.push(
                        buildProductPerformanceRow(
                            node.id,
                            node,
                            salesByProduct,
                            unitsSold60dByProduct
                        )
                    );
                    slotsLeft -= 1;
                    if (slotsLeft <= 0) break;
                }
                walkCatalogCursor = catalog.pageInfo?.endCursor ?? null;
                catalogHasNextPage = Boolean(catalog.pageInfo?.hasNextPage);
                if (!catalogHasNextPage) scanningCatalog = false;
                if (!catalog.nodes.length) scanningCatalog = false;
            }
        } else if (catalogTotalCount == null) {
            const countProbe = await fetchProductsCatalogPage(shopUrl, accessToken, {
                first: 1,
                after: null,
            });
            catalogTotalCount = countProbe.totalCount;
        }

        const hasMoreSales = nextSalesOffset < salesSortedIds.length;
        let hasNextPage = hasMoreSales || catalogHasNextPage;
        if (
            !hasNextPage &&
            catalogTotalCount != null &&
            nextSalesOffset >= salesSortedIds.length &&
            catalogTotalCount > salesSortedIds.length
        ) {
            hasNextPage = true;
        }

        if (catalogTotalCount == null && isFirstCatalogPage) {
            const countProbe = await fetchProductsCatalogPage(shopUrl, accessToken, {
                first: 1,
                after: null,
            });
            catalogTotalCount = countProbe.totalCount;
        }

        return {
            products: sortProductsByNetSales(products),
            periodSummary,
            catalogPageInfo: {
                hasNextPage,
                endCursor: walkCatalogCursor,
                salesOffset: nextSalesOffset,
            },
            catalogTotalCount,
        };
    } catch (err) {
        console.error('fetchShopifyProductPerformancePage error:', err);
        throw err;
    }
}

/** @deprecated Prefer fetchShopifyProductPerformancePage */
export async function fetchShopifyProductMetrics(settings, startDate, endDate, options = {}) {
    const { fast = false, ...pageOpts } = options;
    const page = await fetchShopifyProductPerformancePage(settings, startDate, endDate, pageOpts);
    let products = page.products;
    if (!fast && products.length) {
        const fromCode = settings?.customerStoreValutaCode || 'DKK';
        const currencyData = (await getCurrencyConversionTable()).data;
        const conversionRate = conversionRateToDkk(fromCode, currencyData);
        const productIds = products.map((p) => p.productId).filter(Boolean);
        const inventoryByProduct = await fetchProductInventory(
            settings.shopifyUrl,
            settings.shopifyApiPassword,
            productIds,
            conversionRate
        );
        products = products.map((p) => {
            const inv = inventoryByProduct[p.productId];
            const inventoryStock = inv?.inventoryStock ?? null;
            return {
                ...p,
                inventoryStock,
                inventoryValue: inv?.inventoryValue ?? null,
                incomingQuantity: inv?.incomingQuantity ?? null,
                expectedArrivalDate: inv?.expectedArrivalDate ?? null,
                avgDaysToSoldOut: computeAvgDaysToSoldOut(inventoryStock, p.unitsSold60d),
            };
        });
    }
    return products;
}

/**
 * Fetch inventory only for given product IDs.
 * @param {object} settings - customer settings
 * @param {string[]} productIds - Shopify product GIDs
 * @returns {Promise<Record<string, {
 *   inventoryStock: number,
 *   inventoryValue: number,
 *   incomingQuantity: number,
 *   expectedArrivalDate: string|null,
 *   variants: object[],
 * }>>}
 */
/** Paginate entire catalog — product GIDs only (for store-wide inventory totals). */
async function fetchAllShopifyProductIds(shopUrl, accessToken) {
    const ids = [];
    let cursor = null;
    let hasNext = true;
    const query = `query AllProductIds($first: Int!, $after: String) {
        products(first: $first, after: $after) {
            nodes { id }
            pageInfo { hasNextPage endCursor }
        }
    }`;

    while (hasNext) {
        const { res, json } = await shopifyAdminGraphqlPost(shopUrl, accessToken, {
            query,
            variables: { first: 250, after: cursor },
        });
        if (!res.ok) {
            console.warn(`[Shopify products] list ids HTTP ${res.status}`);
            break;
        }
        const connection = json?.data?.products;
        for (const node of connection?.nodes || []) {
            if (node?.id) ids.push(node.id);
        }
        hasNext = Boolean(connection?.pageInfo?.hasNextPage);
        cursor = connection?.pageInfo?.endCursor || null;
        if (!hasNext) break;
    }
    return ids;
}

/**
 * Aggregate inventory stock, value (DKK), and incoming units across the full catalog.
 */
export async function fetchStoreInventoryTotals(settings) {
    const empty = {
        inventoryStock: 0,
        inventoryValue: 0,
        incomingQuantity: 0,
        productCount: 0,
    };
    if (!settings?.shopifyUrl || !settings?.shopifyApiPassword) return empty;

    const shopUrl = settings.shopifyUrl;
    const accessToken = settings.shopifyApiPassword;
    const fromCode = settings?.customerStoreValutaCode || 'DKK';
    const currencyData = (await getCurrencyConversionTable()).data;
    const conversionRate = conversionRateToDkk(fromCode, currencyData);

    const productIds = await fetchAllShopifyProductIds(shopUrl, accessToken);
    if (!productIds.length) return empty;

    let inventoryStock = 0;
    let inventoryValue = 0;
    let incomingQuantity = 0;
    const chunkSize = 400;

    for (let i = 0; i < productIds.length; i += chunkSize) {
        const ids = productIds.slice(i, i + chunkSize);
        const [stockMap, incomingMap] = await Promise.all([
            fetchProductsStockValueDetails(shopUrl, accessToken, ids),
            fetchProductsInventoryDetails(shopUrl, accessToken, ids, {
                includeVariantDetails: false,
            }),
        ]);

        for (const productId of ids) {
            const stock = stockMap.get(productId);
            if (!stock?.fetched) continue;
            const incoming = incomingMap.get(productId);
            const availableFromLevels = incoming?.availableQuantity ?? 0;
            const productStock =
                availableFromLevels > 0
                    ? Math.max(stock.inventoryStock, availableFromLevels)
                    : stock.inventoryStock;
            inventoryStock += productStock;
            inventoryValue += stock.inventoryValue * conversionRate;
            incomingQuantity += incoming?.incomingQuantity ?? 0;
        }
    }

    return {
        inventoryStock,
        inventoryValue,
        incomingQuantity,
        productCount: productIds.length,
    };
}

export async function fetchProductInventoryOnly(settings, productIds, options = {}) {
    if (!settings?.shopifyUrl || !settings?.shopifyApiPassword || !productIds?.length) return {};
    const shopUrl = settings.shopifyUrl;
    const accessToken = settings.shopifyApiPassword;

    if (options.arrivalsOnly) {
        const maxProducts =
            options.maxProducts ?? SHOPIFY_INVENTORY_MAX_PRODUCTS_PER_REQUEST;
        const ids = productIds.filter(Boolean).slice(0, maxProducts);
        return fetchExpectedArrivalByProduct(shopUrl, accessToken, ids);
    }

    const fromCode = settings?.customerStoreValutaCode || 'DKK';
    const currencyData = (await getCurrencyConversionTable()).data;
    const conversionRate = conversionRateToDkk(fromCode, currencyData);
    return fetchProductInventory(shopUrl, accessToken, productIds, conversionRate, options);
}
