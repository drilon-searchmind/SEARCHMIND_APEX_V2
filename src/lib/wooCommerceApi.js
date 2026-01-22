// src/lib/wooCommerceApi.js

/**
 * Fetch WooCommerce orders and aggregate them into daily sales data
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
    console.log("::: FETCHING WOOCCOMMERCE ORDERS :::");
    console.log({ apiUrl, startDate, endDate });

    try {
        // Build WooCommerce API URL with authentication
        const baseUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash
        const ordersUrl = `${baseUrl}/orders`;

        // Validate date range - don't fetch future dates
        const now = new Date();
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start > now) {
            console.log("Start date is in the future, returning empty data");
            return [];
        }

        // Limit end date to today if it's in the future
        const effectiveEndDate = end > now ? now.toISOString().split('T')[0] : endDate;

        console.log({ effectiveEndDate });

        // Add date filters - WooCommerce expects ISO 8601 format
        const params = new URLSearchParams({
            consumer_key: consumerKey,
            consumer_secret: consumerSecret,
            after: `${startDate}T00:00:00`,
            before: `${effectiveEndDate}T23:59:59`,
            per_page: '50', // Reduce to avoid timeouts
            // Remove status filter initially to see all orders
        });

        const fullUrl = `${ordersUrl}?${params.toString()}`;
        console.log({fullUrl})

        const response = await fetch(fullUrl);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('WooCommerce API Error Response:', errorText);
            throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
        }

        const orders = await response.json();
        console.log(`Fetched ${orders.length} orders from WooCommerce`);

        // If no orders found, try again with all statuses (not just completed)
        if (orders.length === 0) {
            console.log("No completed orders found, trying with all order statuses...");
            const paramsAll = new URLSearchParams({
                consumer_key: consumerKey,
                consumer_secret: consumerSecret,
                after: `${startDate}T00:00:00`,
                before: `${effectiveEndDate}T23:59:59`,
                per_page: '50',
            });

            const fullUrlAll = `${ordersUrl}?${paramsAll.toString()}`;
            console.log({fullUrlAll});

            const responseAll = await fetch(fullUrlAll);
            if (responseAll.ok) {
                const ordersAll = await responseAll.json();
                console.log(`Fetched ${ordersAll.length} orders with all statuses`);
                orders.push(...ordersAll);
            }
        }

        // Group orders by date and aggregate
        const dailyData = {};

        console.log(`Processing ${orders.length} orders...`);

        for (const order of orders) {
            console.log(`Processing order ${order.id}, status: ${order.status}, date: ${order.date_created}`);
            const orderDate = new Date(order.date_created).toISOString().split('T')[0]; // YYYY-MM-DD format

            if (!dailyData[orderDate]) {
                dailyData[orderDate] = {
                    period: orderDate,
                    gross_sales: 0,
                    discounts: 0,
                    returns: 0, // WooCommerce doesn't have returns in the same way
                    net_sales: 0,
                    shipping_charges: 0,
                    duties: 0, // Not typically used in WooCommerce
                    additional_fees: 0, // Not typically used in WooCommerce
                    taxes: 0,
                    total_sales: 0,
                    orders: 0,
                };
            }

            // Aggregate order data
            const lineItemsTotal = order.line_items.reduce((sum, item) => sum + parseFloat(item.total || 0), 0);
            const shippingTotal = parseFloat(order.shipping_total || 0);
            const taxTotal = parseFloat(order.total_tax || 0);
            const discountTotal = parseFloat(order.discount_total || 0);
            const total = parseFloat(order.total || 0);

            console.log(`Order ${order.id}: lineItems=${lineItemsTotal}, shipping=${shippingTotal}, tax=${taxTotal}, discount=${discountTotal}, total=${total}`);

            dailyData[orderDate].gross_sales += lineItemsTotal + shippingTotal + taxTotal;
            dailyData[orderDate].discounts += discountTotal;
            dailyData[orderDate].net_sales += lineItemsTotal - discountTotal;
            dailyData[orderDate].shipping_charges += shippingTotal;
            dailyData[orderDate].taxes += taxTotal;
            dailyData[orderDate].total_sales += total;
            dailyData[orderDate].orders += 1;
        }

        console.log('Daily data aggregated:', dailyData);

        // Convert to array and calculate custom_1 (net_sales + returns + shipping_charges)
        const result = Object.values(dailyData).map(day => ({
            ...day,
            custom_1: day.net_sales + day.returns + day.shipping_charges, // Same calculation as Shopify
        }));

        // Sort by date
        return result.sort((a, b) => a.period.localeCompare(b.period));

    } catch (error) {
        console.error('WooCommerce API error:', error);
        throw error;
    }
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