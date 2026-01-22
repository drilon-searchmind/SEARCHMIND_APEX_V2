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
    console.log("::: FETCHING WOOCCOMMERCE SALES REPORT :::");
    console.log({ apiUrl, startDate, endDate });

    try {
        // Build WooCommerce API URL with authentication
        const baseUrl = apiUrl.replace(/\/$/, ''); // Remove trailing slash
        const salesUrl = `${baseUrl}/reports/sales`;

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

        // Build query parameters for sales report
        const params = new URLSearchParams({
            consumer_key: consumerKey,
            consumer_secret: consumerSecret,
            date_min: startDate,  // WooCommerce sales report uses date_min/date_max
            date_max: effectiveEndDate,
        });

        const fullUrl = `${salesUrl}?${params.toString()}`;
        console.log(`Fetching WooCommerce sales report...`);
        console.log({ fullUrl });

        const response = await fetch(fullUrl);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('WooCommerce Sales Report API Error Response:', errorText);
            throw new Error(`WooCommerce API error: ${response.status} ${response.statusText}`);
        }

        const salesReport = await response.json();
        console.log('WooCommerce sales report response:', salesReport);

        // WooCommerce sales report returns data in this format (as an array):
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

        console.log(`Processing ${Object.keys(totals).length} days of sales data...`);

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
                gross_sales: sales + tax + shipping, // sales already includes line items + shipping, add tax
                discounts: discount,
                returns: 0, // WooCommerce sales report doesn't track returns separately
                net_sales: sales, // WooCommerce sales report already provides net sales
                shipping_charges: shipping,
                duties: 0, // Not typically used in WooCommerce
                additional_fees: 0, // Not typically used in WooCommerce
                taxes: tax,
                total_sales: sales, // Use the sales figure which is net sales
                orders: orders,
                custom_1: sales + shipping, // net_sales + shipping_charges (same as Shopify calculation)
            });
        }

        // Sort by date
        const result = dailyData.sort((a, b) => a.period.localeCompare(b.period));
        console.log(`Processed ${result.length} days of sales data`);

        return result;

    } catch (error) {
        console.error('WooCommerce Sales Report API error:', error);
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