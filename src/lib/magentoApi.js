// src/lib/magentoApi.js

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch Magento 2 orders via REST API and return daily aggregated sales data.
 * Authenticates using the Integration Access Token as a Bearer token.
 * (Requires the Magento Integration to have Resource Access set to "All".)
 * Returns the same field structure as Shopify/WooCommerce for compatibility.
 *
 * Magento field → Shopify-equivalent mapping:
 *   grand_total           → gross_sales   (Sales Total — full order value)
 *   abs(discount_amount)  → discounts
 *   total_refunded        → returns
 *   subtotal - discount - refunded → net_sales
 *   shipping_amount       → shipping_charges (Shipping Sales)
 *   tax_amount            → taxes
 *   net_sales + shipping  → total_sales   (mirrors Shopify: excludes tax)
 *   net_sales + returns + shipping → custom_1
 *
 * @param {string} baseUrl       - Magento base URL (e.g. https://yourdomain.com)
 * @param {string} accessToken   - Integration Access Token
 * @param {string} startDate     - Start date (YYYY-MM-DD)
 * @param {string} endDate       - End date (YYYY-MM-DD)
 * @param {string} [currencyFilter] - Optional currency code (e.g. "DKK") to include only orders in that currency
 * @returns {Promise<Array>}       - Array of daily sales objects
 *
 * Note: Magento 2 (OSS) has no REST equivalent to ShopifyQL daily aggregates; we must use
 * GET /V1/orders with date/status filters. Throughput is improved via larger pages, parallel
 * page fetches, optional order_currency_code filter, and avoiding per-order logging unless
 * MAGENTO_API_DEBUG=1.
 */
export async function fetchMagentoOrders(baseUrl, accessToken, startDate, endDate, currencyFilter) {
    try {
        const debug = process.env.MAGENTO_API_DEBUG === '1';
        if (debug) {
            console.log('::: FETCHING MAGENTO DATA :::');
            console.log('Date range:', { startDate, endDate });
            if (currencyFilter && String(currencyFilter).trim()) {
                console.log('Currency filter:', currencyFilter.trim().toUpperCase());
            }
        }

        const now = new Date();
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start > now) {
            console.log('⚠️ MAGENTO WARNING: Start date is in the future, returning empty data');
            return [];
        }

        const effectiveEndDate = end > now ? now.toISOString().split('T')[0] : endDate;

        let orders = await fetchAllOrders(
            baseUrl,
            accessToken,
            startDate,
            effectiveEndDate,
            currencyFilter
        );

        // Safety net if API ignored order_currency_code filter (older / custom Magento builds)
        const filterCurrency = currencyFilter && String(currencyFilter).trim();
        if (filterCurrency) {
            const targetCurrency = filterCurrency.trim().toUpperCase();
            const before = orders.length;
            orders = orders.filter((o) => {
                const orderCurrency = (o.order_currency_code || o.base_currency_code || '').toUpperCase();
                return orderCurrency === targetCurrency;
            });
            if (debug && before !== orders.length) {
                console.log(
                    `📋 MAGENTO: Client currency filter removed ${before - orders.length} orders (target ${targetCurrency})`
                );
            }
        }

        return aggregateOrdersByDay(orders, debug);
    } catch (error) {
        console.error('❌ MAGENTO FATAL ERROR:', error);
        throw error;
    }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const MAGENTO_ORDER_PAGE_SIZE = 200;
const MAGENTO_MAX_PAGES = 250;
const MAGENTO_PAGE_FETCH_CONCURRENCY = 6;

function buildOrderListParams(startDate, endDate, currentPage, pageSize, currencyFilter) {
    const params = new URLSearchParams();

    // Filter group 0: created_at >= startDate
    params.append('searchCriteria[filter_groups][0][filters][0][field]', 'created_at');
    params.append('searchCriteria[filter_groups][0][filters][0][value]', `${startDate} 00:00:00`);
    params.append('searchCriteria[filter_groups][0][filters][0][condition_type]', 'gteq');

    // Filter group 1: created_at <= endDate
    params.append('searchCriteria[filter_groups][1][filters][0][field]', 'created_at');
    params.append('searchCriteria[filter_groups][1][filters][0][value]', `${endDate} 23:59:59`);
    params.append('searchCriteria[filter_groups][1][filters][0][condition_type]', 'lteq');

    // Filter group 2: status in (complete, processing)
    params.append('searchCriteria[filter_groups][2][filters][0][field]', 'status');
    params.append('searchCriteria[filter_groups][2][filters][0][value]', 'complete,processing');
    params.append('searchCriteria[filter_groups][2][filters][0][condition_type]', 'in');

    const trimmedCurrency = currencyFilter && String(currencyFilter).trim();
    if (trimmedCurrency) {
        params.append('searchCriteria[filter_groups][3][filters][0][field]', 'order_currency_code');
        params.append('searchCriteria[filter_groups][3][filters][0][value]', trimmedCurrency.toUpperCase());
        params.append('searchCriteria[filter_groups][3][filters][0][condition_type]', 'eq');
    }

    params.append('searchCriteria[pageSize]', String(pageSize));
    params.append('searchCriteria[currentPage]', String(currentPage));
    params.append('searchCriteria[sortOrders][0][field]', 'created_at');
    params.append('searchCriteria[sortOrders][0][direction]', 'ASC');

    return params;
}

/**
 * Paginate through GET /rest/V1/orders (Magento has no public daily-sales aggregate REST API).
 * Uses parallel page requests to reduce wall-clock time.
 */
async function fetchAllOrders(baseUrl, accessToken, startDate, endDate, currencyFilter) {
    const cleanBase = baseUrl.replace(/\/$/, '');
    const endpoint = `${cleanBase}/rest/V1/orders`;
    const pageSize = MAGENTO_ORDER_PAGE_SIZE;
    const debug = process.env.MAGENTO_API_DEBUG === '1';

    const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };

    const fetchPage = async (page) => {
        const params = buildOrderListParams(startDate, endDate, page, pageSize, currencyFilter);
        const fullUrl = `${endpoint}?${params.toString()}`;

        if (page === 1 && debug) {
            console.log(`🌐 MAGENTO API: ${fullUrl}`);
        }

        const response = await fetch(fullUrl, { headers });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ MAGENTO API ERROR ${response.status}:`, errorText);
            throw new Error(`Magento API error: ${response.status} ${response.statusText} — ${errorText}`);
        }

        return response.json();
    };

    const first = await fetchPage(1);
    const firstItems = first.items || [];
    const totalCount = first.total_count ?? 0;

    // Magento usually returns total_count; if missing/zero but page is full, keep paging sequentially.
    if (totalCount <= 0) {
        if (firstItems.length < pageSize) {
            return firstItems;
        }
        const allOrders = [...firstItems];
        let page = 2;
        let lastChunkLen = firstItems.length;
        while (page <= MAGENTO_MAX_PAGES) {
            const data = await fetchPage(page);
            const chunk = data.items || [];
            lastChunkLen = chunk.length;
            allOrders.push(...chunk);
            if (chunk.length < pageSize) {
                break;
            }
            page++;
        }
        if (lastChunkLen === pageSize && page > MAGENTO_MAX_PAGES) {
            console.warn(
                `⚠️ MAGENTO: Hit page cap ${MAGENTO_MAX_PAGES} without short page; totals may be incomplete`
            );
        }
        return allOrders;
    }

    const totalPagesRaw = Math.ceil(totalCount / pageSize);
    const totalPages = Math.min(Math.max(totalPagesRaw, 1), MAGENTO_MAX_PAGES);

    if (totalPagesRaw > MAGENTO_MAX_PAGES) {
        console.warn(
            `⚠️ MAGENTO: ${totalPagesRaw} pages exceed cap ${MAGENTO_MAX_PAGES} (~${MAGENTO_MAX_PAGES * pageSize} orders); truncating`
        );
    }

    if (totalPages <= 1) {
        return firstItems;
    }

    const allOrders = [...firstItems];
    const remaining = [];
    for (let p = 2; p <= totalPages; p++) {
        remaining.push(p);
    }

    for (let i = 0; i < remaining.length; i += MAGENTO_PAGE_FETCH_CONCURRENCY) {
        const batch = remaining.slice(i, i + MAGENTO_PAGE_FETCH_CONCURRENCY);
        const results = await Promise.all(batch.map((p) => fetchPage(p)));
        for (const data of results) {
            allOrders.push(...(data.items || []));
        }
    }

    if (allOrders.length > totalCount) {
        return allOrders.slice(0, totalCount);
    }
    return allOrders;
}

/**
 * Aggregate raw Magento orders into daily totals using Shopify-compatible field names.
 */
function aggregateOrdersByDay(orders, debug = false) {
    const dailyData = {};

    for (const order of orders) {
        // created_at can be "2024-01-15 10:30:00" or "2024-01-15T10:30:00"
        const rawDate = order.created_at || '';
        const orderDate = rawDate.split('T')[0].split(' ')[0];
        if (!orderDate) continue;

        if (!dailyData[orderDate]) {
            dailyData[orderDate] = {
                period: orderDate,
                gross_sales: 0,
                discounts: 0,
                returns: 0,
                net_sales: 0,
                shipping_charges: 0,
                duties: 0,
                additional_fees: 0,
                taxes: 0,
                total_sales: 0,
                orders: 0,
                custom_1: 0,
            };
        }

        const day = dailyData[orderDate];
        day.orders += 1;

        const subtotal = parseFloat(order.subtotal || 0);
        // discount_amount is negative in Magento (it's a deduction); take abs
        const discountAmount = Math.abs(parseFloat(order.discount_amount || 0));
        const taxAmount = parseFloat(order.tax_amount || 0);
        const shippingAmount = parseFloat(order.shipping_amount || 0);
        const grandTotal = parseFloat(order.grand_total || 0);
        const totalRefunded = parseFloat(order.total_refunded || 0);

        if (debug) {
            const currency = order.order_currency_code || order.base_currency_code || 'unknown';
            console.log(
                `💰 MAGENTO ORDER ${order.increment_id}: ${orderDate}` +
                    ` - Currency: ${currency}` +
                    ` - Status: ${order.status}` +
                    ` - Grand Total: ${grandTotal}` +
                    ` - Tax: ${taxAmount}` +
                    ` - Shipping: ${shippingAmount}` +
                    ` - Refunded: ${totalRefunded}`
            );
        }

        // net_sales: product revenue after discounts and returns (no tax, no shipping)
        const netSales = subtotal - discountAmount - totalRefunded;

        // total_sales: mirrors Shopify — net_sales + shipping, taxes excluded
        const totalSales = netSales + shippingAmount;

        // custom_1: mirrors Shopify — net_sales + returns + shipping = gross - discount + shipping
        const custom1 = netSales + totalRefunded + shippingAmount;

        // gross_sales: Magento "Sales Total" = grand_total (full order value)
        day.gross_sales += grandTotal;
        day.discounts += discountAmount;
        day.returns += totalRefunded;
        day.net_sales += netSales;
        day.shipping_charges += shippingAmount;
        day.taxes += taxAmount;
        day.total_sales += totalSales;
        day.custom_1 += custom1;
    }

    const result = Object.values(dailyData).sort((a, b) => a.period.localeCompare(b.period));

    return result;
}
