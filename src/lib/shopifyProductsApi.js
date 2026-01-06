import currencyApiValues from './static-data/currencyApiValues.json';

/**
 * Fetch Shopify orders and aggregate product-level metrics between dates.
 * @param {object} settings - customer settings containing shopifyUrl and shopifyApiPassword and customerStoreValutaCode
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<object[]>} - [{ productId, title, handle, vendor, image, productType, unitsSold, ordersCount, totalRevenue }]
 */
export async function fetchShopifyProductMetrics(settings, startDate, endDate) {
    if (!settings?.shopifyUrl || !settings?.shopifyApiPassword) return [];
    const shopUrl = settings.shopifyUrl;
    const accessToken = settings.shopifyApiPassword;

    // Currency conversion similar to mergedSourcesApi: convert from store currency to DKK
    const fromCode = settings?.customerStoreValutaCode || 'DKK';
    const toCode = 'DKK';
    const currencyData = currencyApiValues.data;
    let conversionRate = 1;
    if (fromCode !== toCode && currencyData[fromCode] && currencyData[toCode]) {
        conversionRate = currencyData[toCode].value / currencyData[fromCode].value;
    }

    const endpoint = `https://${shopUrl}/admin/api/2025-10/graphql.json`;

    const query = `query getOrders($query: String!, $cursor: String) {
        orders(first: 250, query: $query, after: $cursor) {
            edges {
                node {
                    id
                    name
                    createdAt
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
            pageInfo { hasNextPage endCursor }
        }
    }`;

    const q = `created_at:>="${startDate}" AND created_at:<="${endDate}"`;

    // Aggregate map: productId -> metrics
    const products = new Map();

    let cursor = null;
    let hasNext = true;
    try {
        while (hasNext) {
            const body = JSON.stringify({ query, variables: { query: q, cursor } });
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': accessToken,
                },
                body,
            });
            if (!res.ok) throw new Error(`Shopify GraphQL error: ${res.status}`);
            const json = await res.json();
            const edges = json?.data?.orders?.edges || [];
            for (const edge of edges) {
                const orderNode = edge.node;
                const orderId = orderNode.id;
                const lineItems = orderNode.lineItems?.edges || [];
                // Track which products appeared in this order to count orders per product
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

                    // Use discounted total if available (total for that line), else unit*qty
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
            if (!hasNext) break;
        }

        // Convert map to array and compute average price
        const result = Array.from(products.values()).map(p => ({
            ...p,
            avgPrice: p.unitsSold > 0 ? p.totalRevenue / p.unitsSold : 0,
        })).sort((a, b) => b.totalRevenue - a.totalRevenue);

        return result;
    } catch (err) {
        console.error('fetchShopifyProductMetrics error:', err);
        return [];
    }
}
