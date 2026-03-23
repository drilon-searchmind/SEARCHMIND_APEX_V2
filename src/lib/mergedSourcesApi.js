// src/lib/mergedSourcesApi.js
import { shopifyqlQuery, discoverSalesFields } from './shopifyApi';
import { fetchWooCommerceOrders } from './wooCommerceApi';
import { fetchMagentoOrders } from './magentoApi';
import { fetchFacebookAdsInsights } from './facebookApi';
import { fetchGoogleAdsMetrics } from './googleAdsApi';
import currencyApiValues from './static-data/currencyApiValues.json';

/**
 * Fetches and merges revenue (Shopify/WooCommerce), Facebook adspend, and Google Ads adspend for a customer.
 * @param {object} settings - Customer settings object containing all required credentials and customerType.
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {object} [options] - Optional settings
 * @param {boolean} [options.dailyBreakdown] - If true, Facebook uses time_increment for daily rows (parent-property)
 * @returns {Promise<object>} - { shopifyDaily, facebookDaily, googleDaily, ... }
 */

export async function fetchMergedSources(settings, startDate, endDate, options = {}) {
    const FACEBOOK_APP_TOKEN = process.env.FACEBOOK_APP_TOKEN;

    // Determine customer type and fetch appropriate e-commerce data
    let shopifyDaily = [];
    const customerType = settings.customerType || 'Shopify'; // Default to Shopify for backward compatibility

    try {
        if (customerType === 'Shopify' && settings.shopifyUrl && settings.shopifyApiPassword) {
            // Build ShopifyQL query with optional currency grouping for multi-domain Shopify stores
            let shopifyql;
            
            // Check if fetchCogsFromStore is enabled
            const fetchCogs = settings.fetchCogsFromStore === true;
            
            // Build the SHOW clause - include cost_of_goods_sold if fetchCogs is enabled
            const showFields = fetchCogs 
                ? 'orders, gross_sales, discounts, returns, net_sales, shipping_charges, duties, additional_fees, taxes, total_sales, cost_of_goods_sold'
                : 'orders, gross_sales, discounts, returns, net_sales, shipping_charges, duties, additional_fees, taxes, total_sales';
            
            // Billing country filter: include and/or exclude (optional, only when changeCurrency)
            const parseCountries = (s) => (typeof s === 'string' ? s.split(',').map((c) => c.trim()).filter(Boolean) : []);
            const includeCountries = parseCountries(settings.changeCurrencyShopifyBillingCountryName);
            const excludeCountries = parseCountries(settings.changeCurrencyShopifyBillingCountryExclude);
            const hasInclude = includeCountries.length > 0;
            const hasExclude = excludeCountries.length > 0;
            const hasBillingFilter = settings.changeCurrency === true && settings.customerStoreValutaCode && (hasInclude || hasExclude);

            if (hasBillingFilter) {
                const escape = (c) => String(c).replace(/'/g, "''");
                const includeClause = hasInclude
                    ? `(${includeCountries.map((c) => `billing_country = '${escape(c)}'`).join(' OR ')})`
                    : null;
                const excludeClause = hasExclude
                    ? `NOT (${excludeCountries.map((c) => `billing_country = '${escape(c)}'`).join(' OR ')})`
                    : null;
                const whereParts = [includeClause, excludeClause].filter(Boolean);
                const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
                shopifyql = `
                    FROM sales 
                    SHOW ${showFields}
                    ${whereClause}
                    GROUP BY day SINCE ${startDate} UNTIL ${endDate}`;
            } else {
                shopifyql = `
                    FROM sales 
                    SHOW ${showFields}
                    GROUP BY day SINCE ${startDate} UNTIL ${endDate}`;
            }
            
            console.log(`[Shopify] Fetching for customer: ${settings.customerName || 'Unknown'}, shop: ${settings.shopifyUrl}`);
            const shopifyRes = await shopifyqlQuery(settings.shopifyUrl, settings.shopifyApiPassword, shopifyql);
            let rows = shopifyRes?.data?.shopifyqlQuery?.tableData?.rows || [];
            const parseErrors = shopifyRes?.data?.shopifyqlQuery?.parseErrors || [];
            const gqlErrors = shopifyRes?.errors || [];
            if (rows.length === 0) {
                console.warn(`[Shopify] Empty shopifyDaily for ${settings.shopifyUrl}. parseErrors:`, parseErrors, 'gqlErrors:', gqlErrors);
                if (parseErrors.length === 0 && gqlErrors.length === 0) {
                    console.warn(`[Shopify] No errors returned. Likely cause: token missing read_reports scope (OAuth needs read_reports, not unauthenticated_read_*). Or no sales in range.`);
                }
            }
            
            // Currency conversion logic
            const fromCode = settings?.customerStoreValutaCode || 'DKK';
            const toCode = 'DKK';
            const currencyData = currencyApiValues.data;
            let conversionRate = 1;
            if (fromCode !== toCode && currencyData[fromCode] && currencyData[toCode]) {
                // Convert from source currency to USD, then USD to DKK
                // All values are relative to USD, so: value_in_DKK = value_in_fromCode / fromCode.value * toCode.value
                // But since value is "1 USD = value_in_currency", so to convert from X currency to DKK:
                // value_in_DKK = value_in_fromCode / fromCode.value * toCode.value
                // Or, more simply: value_in_DKK = value_in_fromCode * (toCode.value / fromCode.value)
                conversionRate = currencyData[toCode].value / currencyData[fromCode].value;
            }
            shopifyDaily = rows.map(row => {
                const baseData = {
                    period: row.day,
                    gross_sales: (parseFloat(row.gross_sales) || 0) * conversionRate,
                    discounts: (parseFloat(row.discounts) || 0) * conversionRate,
                    returns: (parseFloat(row.returns) || 0) * conversionRate,
                    net_sales: (parseFloat(row.net_sales) || 0) * conversionRate,
                    shipping_charges: (parseFloat(row.shipping_charges) || 0) * conversionRate,
                    duties: (parseFloat(row.duties) || 0) * conversionRate,
                    additional_fees: (parseFloat(row.additional_fees) || 0) * conversionRate,
                    taxes: (parseFloat(row.taxes) || 0) * conversionRate,
                    total_sales: (parseFloat(row.total_sales) || 0) * conversionRate,
                    custom_1: ((parseFloat(row.net_sales) || 0) + (parseFloat(row.returns) || 0) + (parseFloat(row.shipping_charges) || 0)) * conversionRate,
                    orders: parseInt(row.orders) || 0,
                };
                
                // Add cost_of_goods_sold if fetchCogsFromStore is enabled
                if (fetchCogs && row.cost_of_goods_sold !== undefined) {
                    baseData.cost_of_goods_sold = (parseFloat(row.cost_of_goods_sold) || 0) * conversionRate;
                }
                
                return baseData;
            }).sort((a, b) => a.period.localeCompare(b.period));
        } else if (customerType === 'WooCommerce' && settings.wooCommerceApiKey && settings.wooCommerceApiSecret) {
            console.log("::: FETCHING WOOCOMMERCE DATA :::");
            console.log("Customer:", settings.customerName || 'Unknown', "- Date range:", { startDate, endDate });

            // Fetch WooCommerce data
            const wooCommerceData = await fetchWooCommerceOrders(
                settings.wooCommerceApiUrl,
                settings.wooCommerceApiKey,
                settings.wooCommerceApiSecret,
                startDate,
                endDate,
                settings.customerStoreValutaCode || 'DKK'
            );

            console.log("::: WOOCOMMERCE RESULT :::", wooCommerceData.length, "days with data");

            // Currency conversion logic (same as Shopify)
            const fromCode = settings?.customerStoreValutaCode || 'DKK';
            const toCode = 'DKK';
            const currencyData = currencyApiValues.data;
            let conversionRate = 1;
            if (fromCode !== toCode && currencyData[fromCode] && currencyData[toCode]) {
                conversionRate = currencyData[toCode].value / currencyData[fromCode].value;
            }

            // Apply currency conversion to WooCommerce data
            shopifyDaily = wooCommerceData.map(row => ({
                period: row.period,
                gross_sales: (parseFloat(row.gross_sales) || 0) * conversionRate,
                discounts: (parseFloat(row.discounts) || 0) * conversionRate,
                returns: (parseFloat(row.returns) || 0) * conversionRate, // Will be 0 for WooCommerce
                net_sales: (parseFloat(row.net_sales) || 0) * conversionRate,
                shipping_charges: (parseFloat(row.shipping_charges) || 0) * conversionRate,
                duties: (parseFloat(row.duties) || 0) * conversionRate, // Will be 0 for WooCommerce
                additional_fees: (parseFloat(row.additional_fees) || 0) * conversionRate, // Will be 0 for WooCommerce
                taxes: (parseFloat(row.taxes) || 0) * conversionRate,
                total_sales: (parseFloat(row.total_sales) || 0) * conversionRate,
                custom_1: (parseFloat(row.custom_1) || 0) * conversionRate,
                orders: parseInt(row.orders) || 0,
            })).sort((a, b) => a.period.localeCompare(b.period));
        } else if (customerType === 'Magento' && settings.magentoBaseUrl && settings.magentoAccessToken) {
            console.log("::: FETCHING MAGENTO DATA :::");
            console.log("Customer:", settings.customerName || 'Unknown', "- Date range:", { startDate, endDate });

            const magentoData = await fetchMagentoOrders(
                settings.magentoBaseUrl,
                settings.magentoAccessToken,
                startDate,
                endDate,
                settings.magentoStoreCode
            );

            console.log("::: MAGENTO RESULT :::", magentoData.length, "days with data");

            // Currency conversion logic (same as Shopify/WooCommerce)
            const fromCode = settings?.customerStoreValutaCode || 'DKK';
            const toCode = 'DKK';
            const currencyData = currencyApiValues.data;
            let conversionRate = 1;
            if (fromCode !== toCode && currencyData[fromCode] && currencyData[toCode]) {
                conversionRate = currencyData[toCode].value / currencyData[fromCode].value;
            }

            shopifyDaily = magentoData.map(row => ({
                period: row.period,
                gross_sales: (parseFloat(row.gross_sales) || 0) * conversionRate,
                discounts: (parseFloat(row.discounts) || 0) * conversionRate,
                returns: (parseFloat(row.returns) || 0) * conversionRate,
                net_sales: (parseFloat(row.net_sales) || 0) * conversionRate,
                shipping_charges: (parseFloat(row.shipping_charges) || 0) * conversionRate,
                duties: (parseFloat(row.duties) || 0) * conversionRate,
                additional_fees: (parseFloat(row.additional_fees) || 0) * conversionRate,
                taxes: (parseFloat(row.taxes) || 0) * conversionRate,
                total_sales: (parseFloat(row.total_sales) || 0) * conversionRate,
                custom_1: (parseFloat(row.custom_1) || 0) * conversionRate,
                orders: parseInt(row.orders) || 0,
            })).sort((a, b) => a.period.localeCompare(b.period));
        }
    } catch (err) {
        console.error(`${customerType} error:`, err);
        shopifyDaily = [];
    }

    // Facebook daily
    let facebookDaily = [];
    try {
        if (settings.facebookAdAccountId && FACEBOOK_APP_TOKEN) {
            const fbRes = await fetchFacebookAdsInsights(
                settings.facebookAdAccountId,
                settings.customerMetaID,
                settings.customerMetaIDExclude,
                FACEBOOK_APP_TOKEN,
                startDate,
                endDate,
                { dailyBreakdown: options.dailyBreakdown }
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
            const googleResponse = await fetchGoogleAdsMetrics(
                settings.googleAdsCustomerId,
                startDate,
                endDate,
                settings.googleAdsCountryFilter || undefined,
                settings.googleAdsCountryExclude || undefined
            );
            // Destructure metrics and currency code from response
            const googleRows = googleResponse.metrics;
            const googleCurrencyCode = googleResponse.currencyCode;
            
            // Currency conversion logic for Google Ads using Google Ads native currency
            const fromCode = googleCurrencyCode;
            const toCode = 'DKK';
            const currencyData = currencyApiValues.data;
            let conversionRate = 1;
            if (fromCode !== toCode && currencyData[fromCode] && currencyData[toCode]) {
                conversionRate = currencyData[toCode].value / currencyData[fromCode].value;
            }
            const daily = {};
            for (const row of googleRows) {
                const date = row.segments?.date;
                const cost = row.metrics?.cost_micros ? row.metrics.cost_micros / 1e6 : 0;
                if (!date) continue;
                if (!daily[date]) daily[date] = 0;
                daily[date] += cost * conversionRate;
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
    const netRevenue = shopifyDaily.reduce((sum, d) => sum + (d.net_sales || 0), 0);
    const orders = shopifyDaily.reduce((sum, d) => sum + (d.orders || 0), 0);
    const cogsPercentage = settings?.CustomerStaticExpenses?.cogsPercentage || 0;
    const fetchCogs = settings.fetchCogsFromStore === true;
    
    // Calculate COGS: use fetched cost_of_goods_sold if enabled, otherwise use percentage
    let totalCogs = 0;
    if (fetchCogs) {
        totalCogs = shopifyDaily.reduce((sum, d) => sum + (d.cost_of_goods_sold || 0), 0);
    } else {
        totalCogs = totalSales * cogsPercentage;
    }

    // For net-based calculations: Net Profit = Net Revenue - COGS
    const totalCogsForNet = fetchCogs
        ? shopifyDaily.reduce((sum, d) => sum + (d.cost_of_goods_sold || 0), 0)
        : netRevenue * cogsPercentage;
    
    const fbAdspend = facebookDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    const googleAdspend = googleDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    // Gross Profit (Net Profit) = Net Revenue - COGS
    const grossProfitTotalSales = totalSales - totalCogs;
    const grossProfitNetSales = netRevenue - totalCogsForNet;
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

    // CAC = ad spend (FB + Google) / orders - aligned with Marketing Spend in Total Expenses
    const CACTotalSales = orders > 0 ? totalAdspend / orders : 0;

    // Calculated metrics (Net Profit = Net Revenue Ex Tax - COGS)
    const fmt = (n, d = 0) => (n ?? 0).toLocaleString('da-DK', { maximumFractionDigits: d });
    const grossProfitCalculation = fetchCogs
        ? `Net Revenue Ex Tax - COGS (from Store) \n
        = ${fmt(netRevenue)} - ${fmt(totalCogsForNet)} \n
        = ${fmt(grossProfitNetSales)}
    `
        : `Net Revenue - (Cogs % × Net Revenue) \n
        = ${fmt(netRevenue)} - (${cogsPercentage} × ${fmt(netRevenue)}) \n
        = ${fmt(netRevenue)} - ${fmt(totalCogsForNet)} \n
        = ${fmt(grossProfitNetSales)}
    `;
    const totalAdspendCalculation = `Facebook Adspend + Google Adspend \n
        = ${fmt(fbAdspend)} + ${fmt(googleAdspend)} \n
        = ${fmt(totalAdspend)}
    `;
    const POASNetProfit = totalAdspend !== 0 ? grossProfitNetSales / totalAdspend : 0;
    const poasCalculation = totalAdspend !== 0 ? `(Net Profit / Cost) \n
        = ${fmt(grossProfitNetSales)} / ${fmt(totalAdspend)} \n
        = ${POASNetProfit.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    ` : 'N/A';
    const cacCalculation = orders > 0 ? `(Marketing Spend / Orders) \n
        = (${fmt(fbAdspend)} + ${fmt(googleAdspend)}) / ${orders} \n
        = ${fmt(totalAdspend)} / ${orders} \n
        = ${fmt(CACTotalSales)}
    ` : 'N/A';

    const calculationsValueLabels = {
        grossProfit: `Net Revenue: ${fmt(netRevenue)}\nCOGS: ${fmt(totalCogsForNet)}`,
        spend: `Google Adspend: ${fmt(googleAdspend)}\nFB Adspend: ${fmt(fbAdspend)}`,
        poas: `Net Profit: ${fmt(grossProfitNetSales)}\nCost: ${fmt(totalAdspend)}`,
        cac: `Google Adspend: ${fmt(googleAdspend)}\nFB Adspend: ${fmt(fbAdspend)}\nOrders: ${orders}`,
    };

    return {
        shopifyDaily,
        facebookDaily,
        googleDaily,
        grossProfitTotalSales,
        grossProfitNetSales,
        POASTotalSales,
        CACTotalSales,
        calculationsData: {
            grossProfitCalculation,
            totalAdspendCalculation,
            poasCalculation,
            cacCalculation,
            valueLabels: calculationsValueLabels,
        }
    };
}
