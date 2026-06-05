// src/lib/mergedSourcesApi.js
import { shopifyqlQuery } from './shopifyApi';
import {
    appendShopifyOnlineStoreFilter,
    escapeShopifyQlString,
    shopifySalesWhereClause,
} from './shopifyQlFilters';
import {
    fetchBillingCountryUnionForSelectedMarkets,
    fetchAdSpendCountryFiltersForSelectedMarkets,
    appendShopifyMarketBillingCountryFilter,
} from './shopifyMarketsApi';
import { metricsByDateToSpendDaily } from './mergeAdSpendDaily';
import { fetchPinterestDashboardMetrics } from './pinterestApi';
import { fetchSnapchatDashboardMetrics, resolveSnapchatAccessTokenForCustomer } from './snapchatApi';
import { normalizeSnapchatSettings } from './snapchatCustomerSettings';
import { fetchBingAdsDashboardMetrics, isMicrosoftAdvertisingConfigured } from './microsoftAdvertisingApi';
import { fetchRedditDashboardMetrics, resolveRedditAccessTokenForCustomer } from './redditApi';
import { normalizeRedditSettings } from './redditCustomerSettings';
import { fetchWooCommerceOrders } from './wooCommerceApi';
import { fetchMagentoPerformanceDaily } from './magentoPerformanceDashboardApi';
import { fetchDanDomainPerformanceDaily } from './danDomainApi';
import { normalizeDanDomainSettings } from './danDomainCustomerSettings';
import { fetchFacebookAdsInsights } from './facebookApi';
import { adCampaignFilterActive, normalizeCampaignNameKeywords } from './adCampaignFilterUtils';
import { fetchGoogleAdsMetrics } from './googleAdsApi';
import { getCurrencyConversionTable, conversionRateToDkk } from './currencyConversionTable';
import { isAdSpendPlatformConfigured } from './customerServiceIntegrations';
import { AD_SPEND_CHANNELS } from './mergeAdSpendDaily';

/**
 * Fetches and merges revenue (Shopify/WooCommerce/Magento/DanDomain), Facebook, Google, and optional Pinterest, Snapchat, Microsoft, Reddit adspend for a customer.
 * @param {object} settings - Customer settings object containing all required credentials and customerType.
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {object} [options] - Optional settings
 * @param {boolean} [options.dailyBreakdown] - If true, Facebook uses time_increment for daily rows (parent-property)
 * @param {string} [options.source] - Caller id (e.g. merged-sources query); does not change Magento fetch path
 * @param {boolean} [options.shopifyMarketNoSelection] - When true (no markets selected in UI), skip ShopifyQL and return empty revenue rows.
 * @param {Array<{ shopifyqlMarketId: string, handle?: string }>} [options.shopifyMarketsSelection] - When set and shopifyMarketsEnabled: restrict sales to the union of each market's region countries via ShopifyQL `billing_country`. Omit for all markets.
 * @param {boolean} [options.shopifyMarketFilterAdSpend] - When true and `shopifyMarketsSelection` is set: filter Meta, Google, Snapchat, and Reddit spend to the same market countries. When false/omitted (default), ad spend ignores market filter.
 * @param {{ billingCountryNames: string[], metaCountryCodes: string[], googleCountryNames: string[] }} [options.preresolvedMarketAdSpendFilters] - Skip Markets region lookup when already resolved (markets overview).
 * @param {string[]} [options.excludeAdSpendPlatforms] - e.g. `['facebook','google']` — skip fetching those platforms (empty daily rows).
 * @param {string[]} [options.googleAdsExcludedCampaignIds] - Campaign ids to omit from Google Ads spend (parent group view).
 * @param {string[]} [options.googleAdsExcludedCampaignNameKeywords] - Google campaign name substrings to omit (case-insensitive).
 * @param {string[]} [options.metaAdsExcludedCampaignIds] - Meta campaign ids to omit from spend (parent group view).
 * @param {string[]} [options.metaAdsExcludedCampaignNameKeywords] - Meta campaign name substrings to omit (case-insensitive).
 * @param {boolean} [options.skipShopifyFetch] - When true, skip Shopify/WooCommerce/Magento revenue (ad platforms only; used by markets overview).
 * @returns {Promise<object>} - { shopifyDaily, facebookDaily, googleDaily, ... }
 */

export async function fetchMergedSources(settings, startDate, endDate, options = {}) {
    const FACEBOOK_APP_TOKEN = process.env.FACEBOOK_APP_TOKEN;
    /** @type {Set<string>} */
    const excludedSpend = new Set(
        Array.isArray(options.excludeAdSpendPlatforms)
            ? options.excludeAdSpendPlatforms.filter((id) =>
                  AD_SPEND_CHANNELS.some((c) => c.id === id)
              )
            : []
    );
    const includeSpend = (platformId) =>
        excludedSpend.size === 0 || !excludedSpend.has(platformId);

    const { data: currencyData } = await getCurrencyConversionTable();

    // Determine customer type and fetch appropriate e-commerce data
    let shopifyDaily = [];
    const customerType = settings.customerType || 'Shopify'; // Default to Shopify for backward compatibility

    try {
        if (
            !options.skipShopifyFetch &&
            customerType === 'Shopify' &&
            settings.shopifyUrl &&
            settings.shopifyApiPassword
        ) {
            const fetchCogs = settings.fetchCogsFromStore === true;
            const showFields = fetchCogs 
                ? 'orders, gross_sales, discounts, returns, net_sales, shipping_charges, duties, additional_fees, taxes, total_sales, cost_of_goods_sold'
                : 'orders, gross_sales, discounts, returns, net_sales, shipping_charges, duties, additional_fees, taxes, total_sales';

            // Billing-country filter is disabled when Shopify Markets mode is on (full-store rollup; optional subset via shopifyMarketsSelection).
            const shopifyMarketsOn = settings.shopifyMarketsEnabled === true;
            const marketNoSelection =
                shopifyMarketsOn && options.shopifyMarketNoSelection === true;
            const marketsSelection = Array.isArray(options.shopifyMarketsSelection)
                ? options.shopifyMarketsSelection.filter(
                      (m) => m && String(m.shopifyqlMarketId || "").trim() !== ""
                  )
                : [];

            if (marketNoSelection) {
                shopifyDaily = [];
            } else {
            const parseCountries = (s) => (typeof s === 'string' ? s.split(',').map((c) => c.trim()).filter(Boolean) : []);
            const includeCountries = parseCountries(settings.changeCurrencyShopifyBillingCountryName);
            const excludeCountries = parseCountries(settings.changeCurrencyShopifyBillingCountryExclude);
            const hasInclude = includeCountries.length > 0;
            const hasExclude = excludeCountries.length > 0;
            const hasBillingFilter =
                !shopifyMarketsOn &&
                settings.changeCurrency === true &&
                settings.customerStoreValutaCode &&
                (hasInclude || hasExclude);

            const escape = escapeShopifyQlString;
            const whereParts = [];
            if (hasBillingFilter) {
                const includeClause = hasInclude
                    ? `(${includeCountries.map((c) => `billing_country = '${escape(c)}'`).join(' OR ')})`
                    : null;
                const excludeClause = hasExclude
                    ? `NOT (${excludeCountries.map((c) => `billing_country = '${escape(c)}'`).join(' OR ')})`
                    : null;
                if (includeClause) whereParts.push(includeClause);
                if (excludeClause) whereParts.push(excludeClause);
            }

            /** No region countries for selected markets — skip ShopifyQL for market-scoped revenue */
            let emptyShopifyNoMarketCountries = false;
            if (shopifyMarketsOn && marketsSelection.length > 0) {
                try {
                    const pre = options.preresolvedMarketAdSpendFilters;
                    let marketCountryNames =
                        pre?.billingCountryNames?.length > 0
                            ? pre.billingCountryNames
                            : await fetchBillingCountryUnionForSelectedMarkets(
                                  settings.shopifyUrl,
                                  settings.shopifyApiPassword,
                                  marketsSelection.map((m) => m.shopifyqlMarketId)
                              );
                    if (marketCountryNames.length === 0) {
                        emptyShopifyNoMarketCountries = true;
                        console.warn(
                            `[Shopify] Markets filter: no region countries from Admin API for selected market(s).`
                        );
                    } else if (
                        !appendShopifyMarketBillingCountryFilter(
                            whereParts,
                            marketCountryNames,
                            escape
                        )
                    ) {
                        emptyShopifyNoMarketCountries = true;
                    }
                } catch (e) {
                    console.error("[Shopify] Markets filter: failed to load region countries:", e);
                    emptyShopifyNoMarketCountries = true;
                }
            }

            appendShopifyOnlineStoreFilter(whereParts, settings);

            if (emptyShopifyNoMarketCountries) {
                shopifyDaily = [];
            } else {
            const whereClause = shopifySalesWhereClause(whereParts);

            const shopifyql = `
                    FROM sales 
                    SHOW ${showFields}
                    ${whereClause}
                    GROUP BY day SINCE ${startDate} UNTIL ${endDate}`;
            
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
            
            // Currency conversion logic — live DKK-based rates (see currencyConversionTable.js)
            const fromCode = settings?.customerStoreValutaCode || 'DKK';
            const conversionRate = conversionRateToDkk(fromCode, currencyData);
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
            }
            }
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
            const conversionRate = conversionRateToDkk(fromCode, currencyData);

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
            console.log('::: FETCHING MAGENTO DATA (invoices + creditmemos) :::');
            console.log("Customer:", settings.customerName || 'Unknown', "- Date range:", { startDate, endDate });

            const magentoData = await fetchMagentoPerformanceDaily(
                settings.magentoBaseUrl,
                settings.magentoAccessToken,
                startDate,
                endDate,
                settings.magentoStoreCode
            );

            console.log("::: MAGENTO RESULT :::", magentoData.length, "days with data");

            // Currency conversion logic (same as Shopify/WooCommerce)
            const fromCode = settings?.customerStoreValutaCode || 'DKK';
            const conversionRate = conversionRateToDkk(fromCode, currencyData);

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
        } else if (customerType === 'DanDomain') {
            const dan = normalizeDanDomainSettings(settings);
            const hasCreds =
                (dan.shopHost && dan.clientId && dan.clientSecret) ||
                (dan.shopHost && dan.accessToken);

            if (hasCreds) {
                console.log('::: FETCHING DANDOMAIN / HOSTEDSHOP DATA :::');
                console.log(
                    'Customer:',
                    settings.customerName || 'Unknown',
                    '- Date range:',
                    { startDate, endDate }
                );

                const danDomainData = await fetchDanDomainPerformanceDaily(
                    settings,
                    startDate,
                    endDate
                );

                console.log('::: DANDOMAIN RESULT :::', danDomainData.length, 'days with data');

                const fromCode = settings?.customerStoreValutaCode || 'DKK';
                const conversionRate = conversionRateToDkk(fromCode, currencyData);
                const fetchCogs = settings.fetchCogsFromStore === true;

                shopifyDaily = danDomainData.map((row) => {
                    const baseData = {
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
                    };
                    if (fetchCogs && row.cost_of_goods_sold !== undefined) {
                        baseData.cost_of_goods_sold =
                            (parseFloat(row.cost_of_goods_sold) || 0) * conversionRate;
                    }
                    return baseData;
                }).sort((a, b) => a.period.localeCompare(b.period));
            }
        }
    } catch (err) {
        console.error(`${customerType} error:`, err);
        shopifyDaily = [];
    }

    const shopifyMarketsOn = settings.shopifyMarketsEnabled === true;
    const marketsSelectionForSpend = Array.isArray(options.shopifyMarketsSelection)
        ? options.shopifyMarketsSelection.filter(
              (m) => m && String(m.shopifyqlMarketId || "").trim() !== ""
          )
        : [];
    const filterAdSpendByMarketEnabled = options.shopifyMarketFilterAdSpend === true && shopifyMarketsOn;
    const zeroAdSpendForNoMarketSelection =
        filterAdSpendByMarketEnabled && options.shopifyMarketNoSelection === true;
    const filterAdSpendByMarket =
        filterAdSpendByMarketEnabled &&
        marketsSelectionForSpend.length > 0 &&
        options.shopifyMarketNoSelection !== true;

    /** @type {{ metaCountryCodes: string[], googleCountryNames: string[] }|null} */
    let marketAdSpendFilters = null;
    if (filterAdSpendByMarket && marketsSelectionForSpend.length > 0) {
        const pre = options.preresolvedMarketAdSpendFilters;
        if (
            pre &&
            (pre.metaCountryCodes?.length > 0 || pre.googleCountryNames?.length > 0)
        ) {
            marketAdSpendFilters = pre;
        } else if (settings.shopifyUrl && settings.shopifyApiPassword) {
            try {
                const resolved = await fetchAdSpendCountryFiltersForSelectedMarkets(
                    settings.shopifyUrl,
                    settings.shopifyApiPassword,
                    marketsSelectionForSpend.map((m) => m.shopifyqlMarketId)
                );
                if (
                    resolved.metaCountryCodes.length > 0 ||
                    resolved.googleCountryNames.length > 0
                ) {
                    marketAdSpendFilters = resolved;
                } else {
                    console.warn(
                        `[Shopify Markets] Ad spend country filter: no countries resolved for selected market(s) (${settings.customerName || "customer"}).`
                    );
                }
            } catch (e) {
                console.error("[Shopify Markets] Ad spend country filter failed:", e);
            }
        }
    }

    const metaIncludeForFetch = marketAdSpendFilters?.metaCountryCodes?.length
        ? marketAdSpendFilters.metaCountryCodes.join(",")
        : settings.customerMetaID;
    const metaExcludeForFetch = marketAdSpendFilters ? "" : settings.customerMetaIDExclude;
    const googleIncludeForFetch = marketAdSpendFilters?.metaCountryCodes?.length
        ? marketAdSpendFilters.metaCountryCodes.join(",")
        : marketAdSpendFilters?.googleCountryNames?.length
          ? marketAdSpendFilters.googleCountryNames.join(",")
          : settings.googleAdsCountryFilter || undefined;
    const googleExcludeForFetch = marketAdSpendFilters
        ? undefined
        : settings.googleAdsCountryExclude || undefined;

    // Facebook daily
    let facebookDaily = [];
    try {
        if (
            includeSpend("facebook") &&
            isAdSpendPlatformConfigured(settings, "facebook") &&
            FACEBOOK_APP_TOKEN
        ) {
            if (
                zeroAdSpendForNoMarketSelection ||
                (filterAdSpendByMarket &&
                    marketAdSpendFilters &&
                    marketAdSpendFilters.metaCountryCodes.length === 0)
            ) {
                facebookDaily = [];
            } else {
            const metaExcludedCampaigns = Array.isArray(options.metaAdsExcludedCampaignIds)
                ? options.metaAdsExcludedCampaignIds.filter((id) => String(id || "").trim())
                : [];
            const metaExcludedKeywords = normalizeCampaignNameKeywords(
                options.metaAdsExcludedCampaignNameKeywords
            );
            const metaCampaignFilterActive = adCampaignFilterActive(
                metaExcludedCampaigns.length > 0,
                metaExcludedKeywords
            );
            const fbRes = await fetchFacebookAdsInsights(
                settings.facebookAdAccountId,
                metaIncludeForFetch,
                metaExcludeForFetch,
                FACEBOOK_APP_TOKEN,
                startDate,
                endDate,
                {
                    dailyBreakdown: options.dailyBreakdown,
                    excludedCampaignIds:
                        metaExcludedCampaigns.length > 0 ? metaExcludedCampaigns : undefined,
                    excludedCampaignNameKeywords:
                        metaExcludedKeywords.length > 0 ? metaExcludedKeywords : undefined,
                    forceCampaignQuery: metaCampaignFilterActive,
                }
            );
            const fbRows = fbRes?.data || [];
            facebookDaily = fbRows.map(row => ({
                period: row.date_start,
                spend: parseFloat(row.spend) || 0,
            })).sort((a, b) => a.period.localeCompare(b.period));
            }
        }
    } catch (err) {
        console.error('Facebook error:', err);
        facebookDaily = [];
    }

    // Google daily
    let googleDaily = [];
    try {
        if (includeSpend("google") && isAdSpendPlatformConfigured(settings, "google")) {
            if (
                zeroAdSpendForNoMarketSelection ||
                (filterAdSpendByMarket &&
                    marketAdSpendFilters &&
                    marketAdSpendFilters.googleCountryNames.length === 0)
            ) {
                googleDaily = [];
            } else {
            const googleExcludedCampaigns = Array.isArray(options.googleAdsExcludedCampaignIds)
                ? options.googleAdsExcludedCampaignIds.filter((id) => String(id || "").trim())
                : [];
            const googleExcludedKeywords = normalizeCampaignNameKeywords(
                options.googleAdsExcludedCampaignNameKeywords
            );
            const googleCampaignFilterActive = adCampaignFilterActive(
                googleExcludedCampaigns.length > 0,
                googleExcludedKeywords
            );
            const googleResponse = await fetchGoogleAdsMetrics(
                settings.googleAdsCustomerId,
                startDate,
                endDate,
                googleIncludeForFetch,
                googleExcludeForFetch,
                {
                    excludedCampaignIds:
                        googleExcludedCampaigns.length > 0 ? googleExcludedCampaigns : undefined,
                    excludedCampaignNameKeywords:
                        googleExcludedKeywords.length > 0 ? googleExcludedKeywords : undefined,
                    forceCampaignQuery: googleCampaignFilterActive,
                    quietLog: Boolean(marketAdSpendFilters),
                }
            );
            // Destructure metrics and currency code from response
            const googleRows = googleResponse.metrics;
            const googleCurrencyCode = googleResponse.currencyCode;
            
            // Currency conversion logic for Google Ads using Google Ads native currency
            const fromCode = googleCurrencyCode;
            const conversionRate = conversionRateToDkk(fromCode, currencyData);
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
        }
    } catch (err) {
        console.error('Google Ads error:', err);
        googleDaily = [];
    }

    let pinterestDaily = [];
    try {
        const pinAccountId = (settings.pinterestAdAccountId || '').trim();
        const pinToken = (process.env.PINTEREST_ACCESS_TOKEN || '').trim();
        if (
            includeSpend("pinterest") &&
            pinAccountId &&
            pinToken &&
            isAdSpendPlatformConfigured(settings, "pinterest")
        ) {
            const pinDash = await fetchPinterestDashboardMetrics({
                accessToken: pinToken,
                adAccountId: pinAccountId,
                startDate,
                endDate,
            });
            pinterestDaily = metricsByDateToSpendDaily(pinDash.metrics_by_date);
        }
    } catch (err) {
        console.error('Pinterest Ads error:', err);
        pinterestDaily = [];
    }

    let snapchatDaily = [];
    try {
        const snap = normalizeSnapchatSettings(settings);
        const snapAdId = (snap.adAccountId || '').trim();
        if (includeSpend("snapchat") && snapAdId && isAdSpendPlatformConfigured(settings, "snapchat")) {
            if (
                zeroAdSpendForNoMarketSelection ||
                (filterAdSpendByMarket &&
                    marketAdSpendFilters &&
                    marketAdSpendFilters.metaCountryCodes.length === 0)
            ) {
                snapchatDaily = [];
            } else {
            const snapToken = await resolveSnapchatAccessTokenForCustomer(snap);
            if (snapToken) {
                const snapDash = await fetchSnapchatDashboardMetrics({
                    accessToken: snapToken,
                    adAccountId: snapAdId,
                    startDate,
                    endDate,
                    snapCredentials: snap,
                    countryIsoCodes: marketAdSpendFilters?.metaCountryCodes,
                });
                snapchatDaily = metricsByDateToSpendDaily(snapDash.metrics_by_date);
            }
            }
        }
    } catch (err) {
        console.error('Snapchat Ads error:', err);
        snapchatDaily = [];
    }

    let bingDaily = [];
    try {
        const msCustomerId = (settings.bingAdsCustomerId || '').trim();
        const msAccountId = (settings.bingAdsAccountId || '').trim();
        if (
            msCustomerId &&
            msAccountId &&
            isMicrosoftAdvertisingConfigured() &&
            isAdSpendPlatformConfigured(settings, "bing") &&
            includeSpend("bing")
        ) {
            const bingDash = await fetchBingAdsDashboardMetrics({
                customerId: msCustomerId,
                accountId: msAccountId,
                startDate,
                endDate,
            });
            bingDaily = metricsByDateToSpendDaily(bingDash.metrics_by_date);
        }
    } catch (err) {
        console.error('Microsoft Advertising error:', err);
        bingDaily = [];
    }

    let redditDaily = [];
    try {
        const red = normalizeRedditSettings(settings);
        const redditAcc = (red.accountId || '').trim();
        if (includeSpend("reddit") && redditAcc && isAdSpendPlatformConfigured(settings, "reddit")) {
            if (
                zeroAdSpendForNoMarketSelection ||
                (filterAdSpendByMarket &&
                    marketAdSpendFilters &&
                    marketAdSpendFilters.metaCountryCodes.length === 0)
            ) {
                redditDaily = [];
            } else {
            const redditToken = await resolveRedditAccessTokenForCustomer(red);
            if (redditToken) {
                const redditDash = await fetchRedditDashboardMetrics({
                    accessToken: redditToken,
                    accountId: redditAcc,
                    startDate,
                    endDate,
                    redditUsername: red.redditUsername,
                    redditCredentials: red,
                    countryIsoCodes: marketAdSpendFilters?.metaCountryCodes,
                });
                // redditApi converts USD spend → DKK (same FX table as Google Ads)
                redditDaily = metricsByDateToSpendDaily(redditDash.metrics_by_date);
            }
            }
        }
    } catch (err) {
        console.error('Reddit Ads error:', err);
        redditDaily = [];
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
    const pinterestAdspend = pinterestDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    const snapchatAdspend = snapchatDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    const bingAdspend = bingDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    const redditAdspend = redditDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    const otherPaidAdspend = pinterestAdspend + snapchatAdspend + bingAdspend + redditAdspend;
    // Gross Profit (Net Profit) = Net Revenue - COGS
    const grossProfitTotalSales = totalSales - totalCogs;
    const grossProfitNetSales = netRevenue - totalCogsForNet;
    const totalAdspend = fbAdspend + googleAdspend + otherPaidAdspend;
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
    const totalAdspendCalculation = `Facebook + Google + Pinterest + Snapchat + Microsoft + Reddit \n
        = ${fmt(fbAdspend)} + ${fmt(googleAdspend)} + ${fmt(otherPaidAdspend)} \n
        = ${fmt(totalAdspend)}
    `;
    const POASNetProfit = totalAdspend !== 0 ? grossProfitNetSales / totalAdspend : 0;
    const poasCalculation = totalAdspend !== 0 ? `(Net Profit / Cost) \n
        = ${fmt(grossProfitNetSales)} / ${fmt(totalAdspend)} \n
        = ${POASNetProfit.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    ` : 'N/A';
    const cacCalculation = orders > 0 ? `(Marketing Spend / Orders) \n
        = ${fmt(totalAdspend)} / ${orders} \n
        = ${fmt(CACTotalSales)}
    ` : 'N/A';

    const calculationsValueLabels = {
        grossProfit: `Net Revenue: ${fmt(netRevenue)}\nCOGS: ${fmt(totalCogsForNet)}`,
        spend: `Google: ${fmt(googleAdspend)}\nFacebook: ${fmt(fbAdspend)}\nOther paid: ${fmt(otherPaidAdspend)}`,
        poas: `Net Profit: ${fmt(grossProfitNetSales)}\nCost: ${fmt(totalAdspend)}`,
        cac: `Paid media total: ${fmt(totalAdspend)}\nOrders: ${orders}`,
    };

    return {
        shopifyDaily,
        facebookDaily,
        googleDaily,
        pinterestDaily,
        snapchatDaily,
        bingDaily,
        redditDaily,
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
