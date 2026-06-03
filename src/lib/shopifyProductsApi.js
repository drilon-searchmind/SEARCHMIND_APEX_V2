import { getCurrencyConversionTable, conversionRateToDkk } from './currencyConversionTable';
import { combineShopifyOrderSearchQuery } from './shopifyQlFilters';
import { shopifyAdminGraphqlPost } from './shopifyAdminClient';

/**
 * Fetch inventory stock and value for a list of Shopify product IDs.
 * @param {string} shopUrl - Shopify shop hostname
 * @param {string} accessToken - Shopify access token
 * @param {string[]} productIds - Array of product GIDs (e.g. gid://shopify/Product/123)
 * @param {number} conversionRate - Currency conversion rate to DKK
 * @returns {Promise<Record<string, { inventoryStock: number, inventoryValue: number }>>}
 */
async function fetchProductInventory(shopUrl, accessToken, productIds, conversionRate) {
    const out = {};
    if (!productIds.length) return out;

    // Shopify allows up to 250 IDs per products query
    const BATCH = 100;
    for (let i = 0; i < productIds.length; i += BATCH) {
        const batch = productIds.slice(i, i + BATCH);
        const query = `query getProductInventory($ids: [ID!]!) {
            nodes(ids: $ids) {
                ... on Product {
                    id
                    variants(first: 100) {
                        nodes {
                            sellableOnlineQuantity
                            inventoryItem {
                                unitCost {
                                    amount
                                }
                            }
                        }
                    }
                }
            }
        }`;

        try {
            const { res, json } = await shopifyAdminGraphqlPost(shopUrl, accessToken, {
                query,
                variables: { ids: batch },
            });
            if (!res.ok) continue;
            const nodes = json?.data?.nodes || [];
            for (const node of nodes) {
                if (!node?.id) continue;
                const variants = node.variants?.nodes || [];
                let inventoryStock = 0;
                let inventoryValue = 0;
                for (const v of variants) {
                    const qty = parseInt(v.sellableOnlineQuantity, 10) || 0;
                    const unitCost = parseFloat(v.inventoryItem?.unitCost?.amount) || 0;
                    inventoryStock += qty;
                    inventoryValue += qty * unitCost;
                }
                out[node.id] = {
                    inventoryStock,
                    inventoryValue: inventoryValue * conversionRate,
                };
            }
        } catch (err) {
            console.error('fetchProductInventory batch error:', err);
        }
    }
    return out;
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

/**
 * Fetch Shopify orders and aggregate product-level metrics between dates.
 * Uses parallel date chunks for faster loading. Supports fast mode to skip inventory.
 * @param {object} settings - customer settings containing shopifyUrl and shopifyApiPassword and customerStoreValutaCode
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @param {object} options - { fast?: boolean } - if true, skip inventory fetch
 * @returns {Promise<object[]>} - [{ productId, title, handle, vendor, image, productType, unitsSold, ordersCount, totalRevenue, inventoryStock?, inventoryValue? }]
 */
export async function fetchShopifyProductMetrics(settings, startDate, endDate, options = {}) {
    if (!settings?.shopifyUrl || !settings?.shopifyApiPassword) return [];
    const shopUrl = settings.shopifyUrl;
    const accessToken = settings.shopifyApiPassword;
    const { fast = false } = options;

    const fromCode = settings?.customerStoreValutaCode || 'DKK';
    const currencyData = (await getCurrencyConversionTable()).data;
    const conversionRate = conversionRateToDkk(fromCode, currencyData);

    const billingFilter = parseBillingCountryFilter(settings);
    const hasBillingFilter = billingFilter.include.length > 0 || billingFilter.exclude.length > 0;

    try {
        // Fetch ALL products from the store first
        const allProductsMap = await fetchAllProducts(shopUrl, accessToken);

        // Fetch order data for the date range (products that sold)
        const chunks = getDateChunks(startDate, endDate, 6);
        const chunkResults = await Promise.all(
            chunks.map(({ start: chunkStart, end: chunkEnd }) =>
                fetchOrdersChunk(
                    shopUrl,
                    accessToken,
                    chunkStart,
                    chunkEnd,
                    conversionRate,
                    hasBillingFilter ? billingFilter : { include: [], exclude: [] },
                    settings
                )
            )
        );

        // Merge order metrics into all products
        for (const chunkMap of chunkResults) {
            for (const [key, item] of chunkMap) {
                const existing = allProductsMap.get(key);
                if (existing) {
                    existing.unitsSold += item.unitsSold;
                    existing.ordersCount += item.ordersCount;
                    existing.totalRevenue += item.totalRevenue;
                    // Prefer order data for title/vendor/image if we have it (more complete)
                    if (item.title) existing.title = item.title;
                    if (item.vendor !== undefined) existing.vendor = item.vendor;
                    if (item.productType !== undefined) existing.productType = item.productType;
                    if (item.image) existing.image = item.image;
                } else {
                    // Product in order but not in allProducts (e.g. deleted product) - add it
                    allProductsMap.set(key, { ...item });
                }
            }
        }

        let result = Array.from(allProductsMap.values()).map(p => ({
            ...p,
            avgPrice: p.unitsSold > 0 ? p.totalRevenue / p.unitsSold : 0,
        })).sort((a, b) => b.totalRevenue - a.totalRevenue);

        if (!fast) {
            const productIds = result
                .map(p => p.productId)
                .filter(id => id && typeof id === 'string' && id.includes('Product'));
            const inventoryByProduct = await fetchProductInventory(shopUrl, accessToken, productIds, conversionRate);
            result = result.map(p => ({
                ...p,
                inventoryStock: inventoryByProduct[p.productId]?.inventoryStock ?? null,
                inventoryValue: inventoryByProduct[p.productId]?.inventoryValue ?? null,
            }));
        } else {
            result = result.map(p => ({
                ...p,
                inventoryStock: null,
                inventoryValue: null,
            }));
        }

        return result;
    } catch (err) {
        console.error('fetchShopifyProductMetrics error:', err);
        return [];
    }
}

/**
 * Fetch inventory only for given product IDs.
 * @param {object} settings - customer settings
 * @param {string[]} productIds - Shopify product GIDs
 * @returns {Promise<Record<string, { inventoryStock: number, inventoryValue: number }>>}
 */
export async function fetchProductInventoryOnly(settings, productIds) {
    if (!settings?.shopifyUrl || !settings?.shopifyApiPassword || !productIds?.length) return {};
    const fromCode = settings?.customerStoreValutaCode || 'DKK';
    const currencyData = (await getCurrencyConversionTable()).data;
    const conversionRate = conversionRateToDkk(fromCode, currencyData);
    return fetchProductInventory(settings.shopifyUrl, settings.shopifyApiPassword, productIds, conversionRate);
}
