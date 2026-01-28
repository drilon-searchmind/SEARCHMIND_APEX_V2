// src/lib/wooCommerceApi.js

/**
 * Fetch WooCommerce sales report data
 * Returns the same field structure as Shopify for compatibility
 * @param {string} apiUrl - WooCommerce API URL (e.g., https://yourdomain.com/wp-json/wc/v3/)
 * @param {string} consumerKey - WooCommerce API Consumer Key
 * @param {string} consumerSecret - WooCommerce API Consumer Secret
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string} storeCurrency - Store currency code (default: 'DKK')
 * @returns {Promise<Array>} - Array of daily sales data with Shopify-compatible fields
 */
export async function fetchWooCommerceOrders(apiUrl, consumerKey, consumerSecret, startDate, endDate, storeCurrency = 'DKK') {
    try {
        console.log(`🔍 WOO DEBUG: Fetching ${startDate} to ${endDate} from ${apiUrl}`);

        // Validate date range - don't fetch future dates
        const now = new Date();
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start > now) {
            console.log("⚠️ WOO WARNING: Start date is in the future, returning empty data");
            return [];
        }

        // Limit end date to today if it's in the future
        const effectiveEndDate = end > now ? now.toISOString().split('T')[0] : endDate;

        // First try the traditional v3 reports API
        const v3Data = await tryV3ReportsApi(apiUrl, consumerKey, consumerSecret, startDate, effectiveEndDate);

        // If v3 API returned data, use it
        if (v3Data && v3Data.length > 0) {
            console.log(`✅ WOO SUCCESS: Using v3 reports API (${v3Data.length} days with data)`);
            return v3Data;
        }

        // If v3 API returned empty, try fetching orders directly and calculating analytics
        console.log(`⚠️ WOO FALLBACK: v3 API returned empty data, trying Orders API to calculate analytics...`);
        const ordersData = await tryOrdersApi(apiUrl, consumerKey, consumerSecret, startDate, effectiveEndDate);

        if (ordersData && ordersData.length > 0) {
            console.log(`✅ WOO SUCCESS: Using Orders API calculation (${ordersData.length} days with data)`);
            return ordersData;
        }

        console.log(`❌ WOO EMPTY: All APIs (v3 Reports, Orders) returned empty data`);
        return [];

    } catch (error) {
        console.error('❌ WOO FATAL ERROR:', error);
        throw error;
    }
}

async function tryV3ReportsApi(apiUrl, consumerKey, consumerSecret, startDate, endDate) {
    try {
        // Build WooCommerce v3 API URL with authentication
        const baseUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash
        const salesUrl = `${baseUrl}/reports/sales`;

        // Build query parameters for sales report
        const params = new URLSearchParams({
            consumer_key: consumerKey,
            consumer_secret: consumerSecret,
            date_min: startDate,
            date_max: endDate,
        });

        const fullUrl = `${salesUrl}?${params.toString()}`;

        console.log(`🌐 WOO V3 API: ${fullUrl.replace(/consumer_secret=[^&]*/, 'consumer_secret=***')}`);

        const response = await fetch(fullUrl);

        console.log(`📊 WOO V3 RESPONSE: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            if (response.status === 401) {
                console.error('🔐 V3 AUTH ISSUE: Invalid credentials');
            }
            return null; // Return null to try analytics API
        }

        const salesReport = await response.json();

        console.log(`📋 WOO V3 RAW DATA:`, JSON.stringify(salesReport, null, 2));

        // Convert v3 format to our standardized format
        return convertV3DataToStandardFormat(salesReport);

    } catch (error) {
        console.error('❌ V3 API Error:', error);
        return null;
    }
}

async function tryAnalyticsApi(apiUrl, consumerKey, consumerSecret, startDate, endDate) {
    // Analytics API is not available on this WooCommerce installation
    console.log(`⚠️ WOO ANALYTICS: Skipping - endpoint not available`);
    return null;
}

async function tryOrdersApi(apiUrl, consumerKey, consumerSecret, startDate, endDate) {
    try {
        console.log(`🔄 WOO ORDERS: Fetching orders for ${startDate} to ${endDate}`);

        // Fetch completed and processing orders only
        const orders = await fetchOrders(apiUrl, consumerKey, consumerSecret, startDate, endDate);

        console.log(`📦 WOO DATA: ${orders.length} orders (completed/processing only)`);

        // Convert orders to daily analytics format
        return convertOrdersToAnalytics(orders);

    } catch (error) {
        console.error('❌ Orders API Error:', error);
        return null;
    }
}

async function fetchOrders(apiUrl, consumerKey, consumerSecret, startDate, endDate) {
    const baseUrl = apiUrl.replace(/\/$/, '');
    const ordersUrl = `${baseUrl}/orders`;

    let allOrders = [];
    let page = 1;

    while (true) {
        const params = new URLSearchParams({
            consumer_key: consumerKey,
            consumer_secret: consumerSecret,
            after: `${startDate}T00:00:00`,
            before: `${endDate}T23:59:59`,
            per_page: 100,
            status: 'completed,processing', // Only include completed and processing orders
            orderby: 'date',
            order: 'asc',
            page: page
        });

        const fullUrl = `${ordersUrl}?${params.toString()}`;

        if (page === 1) {
            console.log(`🌐 WOO ORDERS API: ${fullUrl.replace(/consumer_secret=[^&]*/, 'consumer_secret=***')}`);
        }

        const response = await fetch(fullUrl);
        if (!response.ok) break;

        const pageOrders = await response.json();
        if (pageOrders.length === 0) break;

        allOrders = allOrders.concat(pageOrders);

        if (page === 1) {
            const totalOrders = parseInt(response.headers.get('x-wp-total') || pageOrders.length);
            console.log(`📊 WOO ORDERS TOTAL: ${totalOrders} available, fetched ${allOrders.length} so far`);
        }

        console.log(`📄 WOO PAGE ${page}: Fetched ${pageOrders.length} orders (total: ${allOrders.length})`);

        page++;
        if (page > 10) break; // Safety limit
    }

    return allOrders;
}


function convertV3DataToStandardFormat(salesReport) {
    // WooCommerce v3 sales report returns data in this format (as an array):
    // [
    //   {
    //     "total_sales": "9.00",
    //     "net_sales": "9.00",
    //     "average_sales": "9.00",
    //     "total_orders": 1,
    //     "total_items": 1,
    //     "total_tax": "0.00",
    //     "total_shipping": "0.00",
    //     "total_refunds": 0,
    //     "total_discount": "0.00",
    //     "totals_grouped_by": "day",
    //     "totals": {
    //       "2023-05-19": {
    //         "sales": "9.00",
    //         "orders": 1,
    //         "items": 1,
    //         "tax": "0.00",
    //         "shipping": "0.00",
    //         "discount": "0.00",
    //         "customers": 1
    //       }
    //     }
    //   }
    // ]

    // Get the first (and only) report object from the array
    const reportData = salesReport[0] || salesReport;
    const totals = reportData.totals || {};

    // Convert the daily totals to our Shopify-compatible format
    const dailyData = [];

    for (const [date, dayData] of Object.entries(totals)) {
        // Skip if no orders for this day
        if (parseInt(dayData.orders) === 0) continue;

        const sales = parseFloat(dayData.sales || 0);
        const orders = parseInt(dayData.orders || 0);
        const tax = parseFloat(dayData.tax || 0);
        const shipping = parseFloat(dayData.shipping || 0);
        const discount = parseFloat(dayData.discount || 0);

        dailyData.push({
            period: date,
            gross_sales: sales + tax + shipping, // Complete gross sales
            discounts: discount,
            returns: 0, // WooCommerce sales report doesn't track returns separately
            net_sales: sales - tax - shipping, // Net sales (gross sales minus tax and shipping)
            shipping_charges: shipping,
            duties: 0, // Not typically used in WooCommerce
            additional_fees: 0, // Not typically used in WooCommerce
            taxes: tax,
            total_sales: sales, // Gross sales (same as WooCommerce 'sales' field)
            orders: orders,
            custom_1: (sales - tax - shipping) + shipping, // net_sales + shipping_charges
        });
    }

    // Sort by date
    const result = dailyData.sort((a, b) => a.period.localeCompare(b.period));

    return result;
}

function convertAnalyticsDataToStandardFormat(analyticsData) {
    // WooCommerce Analytics API returns data in this format:
    // {
    //   "data": [
    //     {
    //       "date": "2025-12-01",
    //       "orders_count": 5,
    //       "gross_sales": 72726.00,
    //       "net_revenue": 53728.80,
    //       "refunds": 0,
    //       "shipping": 0,
    //       "taxes": 0,
    //       "coupons": 0
    //     }
    //   ],
    //   "total": 1,
    //   "pages": 1,
    //   "page_no": 1
    // }

    const data = analyticsData.data || [];
    const dailyData = [];

    for (const dayData of data) {
        const orders = parseInt(dayData.orders_count || 0);
        // Skip if no orders for this day
        if (orders === 0) continue;

        const grossSales = parseFloat(dayData.gross_sales || 0);
        const netRevenue = parseFloat(dayData.net_revenue || 0);
        const shipping = parseFloat(dayData.shipping || 0);
        const taxes = parseFloat(dayData.taxes || 0);
        const refunds = parseFloat(dayData.refunds || 0);
        const coupons = parseFloat(dayData.coupons || 0);

        dailyData.push({
            period: dayData.date,
            gross_sales: grossSales, // Complete gross sales
            discounts: coupons,
            returns: refunds, // Refunds can be treated as returns
            net_sales: netRevenue, // Net revenue (after taxes, shipping, coupons)
            shipping_charges: shipping,
            duties: 0, // Not typically used in WooCommerce
            additional_fees: 0, // Not typically used in WooCommerce
            taxes: taxes,
            total_sales: grossSales, // Gross sales
            orders: orders,
            custom_1: netRevenue + shipping, // net_revenue + shipping
        });
    }

    // Sort by date
    const result = dailyData.sort((a, b) => a.period.localeCompare(b.period));

    return result;
}

/**
 * Execute a WooCommerce REST API query
 * @param {string} apiUrl - WooCommerce API URL
 * @param {string} consumerKey - WooCommerce API Consumer Key
 * @param {string} consumerSecret - WooCommerce API Consumer Secret
 * @param {string} endpoint - API endpoint (e.g., 'orders', 'products')
 * @param {object} params - Query parameters
 * @returns {Promise<object>} - WooCommerce API response
 */
export async function wooCommerceQuery(apiUrl, consumerKey, consumerSecret, endpoint, params = {}) {
    try {
        const baseUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash
        const fullUrl = `${baseUrl}/${endpoint}`;

        const queryParams = new URLSearchParams({
            consumer_key: consumerKey,
            consumer_secret: consumerSecret,
            ...params
        });

        const response = await fetch(`${fullUrl}?${queryParams.toString()}`);

        if (!response.ok) {
            throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();

    } catch (error) {
        console.error('WooCommerce query error:', error);
        throw error;
    }
}


function convertOrdersToAnalytics(orders) {
    console.log(`🔍 WOO PROCESSING: Analyzing ${orders.length} orders`);

    // Log order status distribution
    const statusCount = {};
    orders.forEach(order => {
        const status = order.status || 'unknown';
        statusCount[status] = (statusCount[status] || 0) + 1;
    });
    console.log(`📊 WOO ORDER STATUSES:`, statusCount);

    // Aggregate orders by date to create daily analytics
    const dailyData = {};

    for (const order of orders) {
        const orderDate = order.date_created?.split('T')[0]; // Extract YYYY-MM-DD from date_created
        if (!orderDate) continue;

        if (!dailyData[orderDate]) {
            dailyData[orderDate] = {
                period: orderDate,
                gross_sales: 0,
                discounts: 0,
                returns: 0, // Refunds within orders
                net_sales: 0,
                shipping_charges: 0,
                duties: 0,
                additional_fees: 0,
                taxes: 0,
                total_sales: 0,
                orders: 0,
                custom_1: 0
            };
        }

        const day = dailyData[orderDate];

        // Count this as an order
        day.orders += 1;

        // Add order totals (this includes refunds already subtracted in WooCommerce)
        const total = parseFloat(order.total || 0);
        const taxTotal = parseFloat(order.total_tax || 0);
        const shippingTotal = parseFloat(order.shipping_total || 0);
        const discountTotal = parseFloat(order.discount_total || 0);

        console.log(`💰 WOO ORDER ${order.id}: ${orderDate} - Status: ${order.status} - Total: ${total} DKK`);

        day.total_sales += total;
        day.taxes += taxTotal;
        day.shipping_charges += shippingTotal;
        day.discounts += discountTotal;
        day.gross_sales += total + taxTotal + shippingTotal; // Total + tax + shipping
        day.net_sales += total - taxTotal - shippingTotal; // Total minus tax and shipping
        day.custom_1 += day.net_sales + shippingTotal; // net_sales + shipping_charges

        // Handle refunds within this order (if any line items are refunds)
        if (order.line_items) {
            for (const item of order.line_items) {
                if (item.refunded_item_id) {
                    // This is a refund line item
                    const refundAmount = Math.abs(parseFloat(item.total || 0));
                    const refundTax = Math.abs(parseFloat(item.total_tax || 0));
                    day.returns += refundAmount + refundTax;
                }
            }
        }
    }

    // Convert to array and sort by date
    const result = Object.values(dailyData).sort((a, b) => a.period.localeCompare(b.period));

    console.log(`📊 WOO ORDERS PROCESSED: ${result.length} days with data`);
    console.log(`💵 WOO DAILY TOTALS:`, result.map(d => `${d.period}: ${d.orders} orders, ${d.total_sales.toFixed(2)} DKK revenue`));

    return result;
}