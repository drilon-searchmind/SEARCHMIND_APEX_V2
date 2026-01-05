// src/lib/googleAdsApi.js
import { GoogleAdsApi } from 'google-ads-api';

/**
 * Fetches Google Ads metrics for a given customer ID and date range.
 * @param {string} customerId - Google Ads customer ID (from CustomerSettings)
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<{metrics: object[], currencyCode: string}>} - Raw rows from Google Ads API and customer currency code
 */
export async function fetchGoogleAdsMetrics(customerId, startDate, endDate) {
        if (!customerId) {
                console.error('Google Ads customerId is missing or undefined:', customerId);
                throw new Error('Google Ads customerId is missing or undefined');
        }
        const customerIdStr = String(customerId);

        // Use all credentials from .env
        const client = new GoogleAdsApi({
                client_id: process.env.GOOGLE_ADS_CLIENT_ID,
                client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
                developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        });
        const refresh_token = process.env.GOOGLE_ADS_REFRESH_TOKEN;
        const managerCustomerId = process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID;

        // Support MCC (login_customer_id)
        const customer = client.Customer({
                customer_id: customerIdStr,
                refresh_token,
                login_customer_id: managerCustomerId || undefined,
        });

        // First, fetch the customer's currency code
        let currencyCode = 'DKK'; // Default fallback
        try {
                const customerQuery = `
                        SELECT 
                        customer.currency_code
                        FROM customer
                        LIMIT 1
                `;
                const customerRes = await customer.query(customerQuery);
                const customerData = Array.isArray(customerRes) ? customerRes[0] : (customerRes.results?.[0]);
                if (customerData?.customer?.currency_code) {
                        currencyCode = customerData.customer.currency_code;
                }
        } catch (err) {
                console.warn('Could not fetch customer currency code, using default USD:', err.message);
        }

        const metricsQuery = `
                SELECT 
                campaign.id,
                campaign.name,
                segments.date,
                metrics.clicks,
                metrics.impressions,
                metrics.conversions,
                metrics.conversions_value,
                metrics.cost_micros
                FROM campaign
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                ORDER BY segments.date ASC
        `;

        try {
                const res = await customer.query(metricsQuery);
                const metrics = Array.isArray(res) ? res : (res.results || []);
                // Return both metrics and currency code
                return { metrics, currencyCode };
        } catch (err) {
                console.error('Google Ads API error:', err);
                throw err;
        }
}
