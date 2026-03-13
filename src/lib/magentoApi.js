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
 */
export async function fetchMagentoOrders(baseUrl, accessToken, startDate, endDate, currencyFilter) {
    try {
        console.log('::: FETCHING MAGENTO DATA :::');
        console.log('Date range:', { startDate, endDate });
        if (currencyFilter && String(currencyFilter).trim()) {
            console.log('Currency filter:', currencyFilter.trim().toUpperCase());
        }

        const now = new Date();
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start > now) {
            console.log('⚠️ MAGENTO WARNING: Start date is in the future, returning empty data');
            return [];
        }

        const effectiveEndDate = end > now ? now.toISOString().split('T')[0] : endDate;

        let orders = await fetchAllOrders(baseUrl, accessToken, startDate, effectiveEndDate);

        // Filter by currency when magentoStoreCode is set (e.g. "DKK" for DK store only)
        const filterCurrency = currencyFilter && String(currencyFilter).trim();
        if (filterCurrency) {
            const targetCurrency = filterCurrency.trim().toUpperCase();
            const before = orders.length;
            orders = orders.filter((o) => {
                const orderCurrency = (o.order_currency_code || o.base_currency_code || '').toUpperCase();
                return orderCurrency === targetCurrency;
            });
            console.log(`📋 MAGENTO: Filtered to ${targetCurrency} only — ${orders.length} of ${before} orders included`);
        }

        return aggregateOrdersByDay(orders);
    } catch (error) {
        console.error('❌ MAGENTO FATAL ERROR:', error);
        throw error;
    }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Paginate through the Magento orders REST endpoint using Bearer token auth.
 * Filters by created_at date range; only includes 'complete' and 'processing' orders.
 */
async function fetchAllOrders(baseUrl, accessToken, startDate, endDate) {
    const cleanBase = baseUrl.replace(/\/$/, '');
    const endpoint = `${cleanBase}/rest/V1/orders`;

    let allOrders = [];
    let currentPage = 1;
    const pageSize = 100;

    while (true) {
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

        params.append('searchCriteria[pageSize]', String(pageSize));
        params.append('searchCriteria[currentPage]', String(currentPage));
        params.append('searchCriteria[sortOrders][0][field]', 'created_at');
        params.append('searchCriteria[sortOrders][0][direction]', 'ASC');

        const fullUrl = `${endpoint}?${params.toString()}`;

        if (currentPage === 1) {
            console.log(`🌐 MAGENTO API: ${fullUrl}`);
        }

        const response = await fetch(fullUrl, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ MAGENTO API ERROR ${response.status}:`, errorText);
            throw new Error(`Magento API error: ${response.status} ${response.statusText} — ${errorText}`);
        }

        const data = await response.json();
        const items = data.items || [];
        const totalCount = data.total_count || 0;

        allOrders = allOrders.concat(items);

        if (items.length < pageSize || allOrders.length >= totalCount) break;

        currentPage++;
        if (currentPage > 50) {
            console.warn('⚠️ MAGENTO: Safety page limit (50) reached');
            break;
        }
    }

    return allOrders;
}

/**
 * Aggregate raw Magento orders into daily totals using Shopify-compatible field names.
 */
function aggregateOrdersByDay(orders) {
    const statusCount = {};
    orders.forEach(order => {
        const s = order.status || 'unknown';
        statusCount[s] = (statusCount[s] || 0) + 1;
    });

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
