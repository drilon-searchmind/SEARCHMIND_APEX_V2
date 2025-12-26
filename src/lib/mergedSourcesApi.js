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
    console.log({FACEBOOK_APP_TOKEN})
    // Shopify daily
    let shopifyDaily = [];
    try {
        if (settings.shopifyUrl && settings.shopifyApiPassword) {
            const shopifyql = `FROM sales SHOW total_sales, orders GROUP BY day SINCE ${startDate} UNTIL ${endDate}`;
            const shopifyRes = await shopifyqlQuery(settings.shopifyUrl, settings.shopifyApiPassword, shopifyql);
            const rows = shopifyRes?.data?.shopifyqlQuery?.tableData?.rows || [];
            shopifyDaily = rows.map(row => ({
                period: row.day,
                total_sales: parseFloat(row.total_sales) || 0,
                orders: parseInt(row.orders) || 0,
            })).sort((a, b) => a.period.localeCompare(b.period));
        }
    } catch (err) {
        console.error('Shopify error:', err);
        shopifyDaily = [];
    }

    // Facebook daily
    let facebookDaily = [];
    try {
        if (settings.facebookAdAccountId && FACEBOOK_APP_TOKEN) {
            const fbRes = await fetchFacebookAdsInsights(
                settings.facebookAdAccountId,
                settings.metaCountryCode,
                FACEBOOK_APP_TOKEN,
                startDate,
                endDate
            );
            const fbRows = fbRes?.data || [];
            facebookDaily = fbRows.map(row => ({
                period: row.date_start,
                spend: parseFloat(row.spend) || 0,
            })).sort((a, b) => a.period.localeCompare(b.period));
        }
    } catch (err) {
        console.error('Facebook error:', err);
        facebookDaily = [];
    }

    // Google daily
    let googleDaily = [];
    try {
        if (settings.googleAdsCustomerId) {
            const googleRows = await fetchGoogleAdsMetrics(
                settings.googleAdsCustomerId,
                startDate,
                endDate
            );
            const daily = {};
            for (const row of googleRows) {
                const date = row.segments?.date;
                const cost = row.metrics?.cost_micros ? row.metrics.cost_micros / 1e6 : 0;
                if (!date) continue;
                if (!daily[date]) daily[date] = 0;
                daily[date] += cost;
            }
            googleDaily = Object.entries(daily)
                .map(([period, spend]) => ({ period, spend }))
                .sort((a, b) => a.period.localeCompare(b.period));
        }
    } catch (err) {
        console.error('Google Ads error:', err);
        googleDaily = [];
    }

    // Calculate aggregates for metrics
    const totalSales = shopifyDaily.reduce((sum, d) => sum + (d.total_sales || 0), 0);
    const orders = shopifyDaily.reduce((sum, d) => sum + (d.orders || 0), 0);
    const cogsPercentage = settings?.CustomerStaticExpenses?.cogsPercentage || 0;
    const fbAdspend = facebookDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    const googleAdspend = googleDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    const grossProfitTotalSales = (totalSales * cogsPercentage) - (fbAdspend + googleAdspend);
    const totalAdspend = fbAdspend + googleAdspend;
    const POASTotalSales = totalAdspend !== 0 ? grossProfitTotalSales / totalAdspend : 0;

    // Calculate number of days in range (inclusive)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const msPerDay = 1000 * 60 * 60 * 24;
    const days = Math.floor((end - start) / msPerDay) + 1;

    // Marketing costs from static expenses (per day)
    const marketingBureauCost = settings?.CustomerStaticExpenses?.marketingBureauCost || 0;
    const marketingToolingCost = settings?.CustomerStaticExpenses?.marketingToolingCost || 0;
    const marketingBureauCostTotal = days > 0 ? marketingBureauCost / days : 0;
    const marketingToolingCostTotal = days > 0 ? marketingToolingCost / days : 0;

    // Total marketing spend
    const marketingSpend = fbAdspend + googleAdspend + marketingBureauCostTotal + marketingToolingCostTotal;
    // CAC = marketingSpend / orders
    const CACTotalSales = orders > 0 ? marketingSpend / orders : 0;

    return {
        shopifyDaily,
        facebookDaily,
        googleDaily,
        grossProfitTotalSales,
        POASTotalSales,
        CACTotalSales,
    };
}
