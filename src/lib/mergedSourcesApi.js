// src/lib/mergedSourcesApi.js
import { shopifyqlQuery } from './shopifyApi';
import { fetchFacebookAdsInsights } from './facebookApi';
import { fetchGoogleAdsMetrics } from './googleAdsApi';

/**
 * Fetches and merges revenue (Shopify), Facebook adspend, and Google Ads adspend for a customer.
 * @param {object} settings - Customer settings object containing all required credentials.
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<object>} - { revenue, facebookAdspend, googleAdspend }
 */
export async function fetchMergedSources(settings, startDate, endDate) {
    const FACEBOOK_APP_TOKEN = process.env.FACEBOOK_APP_TOKEN;
    // Shopify
    let shopifyData = null;
    try {
        if (settings.shopifyUrl && settings.shopifyApiPassword) {
            // Use the same query as in ecommerce/page.jsx (no quotes around dates)
            const shopifyql = `FROM sales SHOW gross_sales, discounts, net_sales, taxes, total_sales, average_order_value SINCE ${startDate} UNTIL ${endDate}`;
            const shopifyRes = await shopifyqlQuery(settings.shopifyUrl, settings.shopifyApiPassword, shopifyql);
            shopifyData = shopifyRes?.data?.shopifyqlQuery?.tableData?.rows || null;
        } else {
            console.log('Shopify branch skipped: missing shopifyUrl or shopifyApiPassword', settings.shopifyUrl, settings.shopifyApiPassword);
        }
    } catch (err) {
        console.error('Shopify error:', err);
        shopifyData = null;
    }

    // Facebook
    let facebookAdspend = null;
    try {
        if (settings.facebookAdAccountId && FACEBOOK_APP_TOKEN) {
            const fbRes = await fetchFacebookAdsInsights(
                settings.facebookAdAccountId,
                settings.metaCountryCode,
                FACEBOOK_APP_TOKEN,
                startDate,
                endDate
            );
            // Extract spend
            const fbRows = fbRes?.data || [];
            facebookAdspend = fbRows.reduce((sum, row) => sum + (parseFloat(row.spend) || 0), 0);
        } else {
            console.log('Facebook branch skipped: missing facebookAdAccountId or FACEBOOK_APP_TOKEN', settings.facebookAdAccountId, FACEBOOK_APP_TOKEN);
        }
    } catch (err) {
        console.error('Facebook error:', err);
        facebookAdspend = null;
    }

    // Google Ads
    let googleAdspend = null;
    try {
        if (settings.googleAdsCustomerId) {
            const googleRows = await fetchGoogleAdsMetrics(
                settings.googleAdsCustomerId,
                startDate,
                endDate
            );

            // Extract cost_micros (convert to standard currency)
            googleAdspend = googleRows.reduce((sum, row) => sum + ((row.metrics?.cost_micros || 0) / 1e6), 0);
        } else {
            console.log('Google Ads branch skipped: missing googleAdsCustomerId', settings.googleAdsCustomerId);
        }
    } catch (err) {
        googleAdspend = null;
    }

    return {
        shopify: shopifyData,
        facebookAdspend,
        googleAdspend,
    };
}
