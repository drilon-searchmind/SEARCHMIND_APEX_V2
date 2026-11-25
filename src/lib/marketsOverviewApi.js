import dayjs from "dayjs";
import { fetchMergedSources } from "./mergedSourcesApi";
import {
    fetchShopifyMarketsCatalog,
    fetchAdSpendCountryFiltersForSelectedMarkets,
    fetchShopifySalesGroupedByBillingCountryAndDay,
    shopifyDailyForBillingCountries,
} from "./shopifyMarketsApi";
import {
    AD_SPEND_CHANNELS,
    channelSpendTotalsFromMerged,
    totalAdSpendFromMerged,
} from "./mergeAdSpendDaily";
import {
    computePerformanceDashboardMetrics,
    aggregateShopifyDailyRows,
} from "./performanceDashboard/computePerformanceMetrics";
import { getReturnsOverrideSettings } from "./performanceDashboard/performanceDashboardConstants";
import {
    calcFixedCostsForDateRange,
    withResolvedPerOrderRates,
} from "./customerStaticExpensesUtils";
import {
    fetchAdSpendByIso2Country,
    channelSpendTotalsForMarket,
    buildSyntheticMergedFromChannelTotals,
} from "./marketAdSpendByCountry";
import {
    computeShippingCostFromMethodCounts,
    fetchShopifyOrdersByShippingMethodAndCountry,
    hasShippingMethodCosts,
    shippingMethodCountsForBillingCountries,
    shippingMethodCountsForPeriod,
} from "./shippingMethodCosts";

/**
 * Same metrics pipeline as performance-dashboard (buildPeriodTotals + computePerformanceDashboardMetrics).
 * @param {Array<Record<string, unknown>>} shopifyDaily
 * @param {Record<string, unknown>} merged
 * @param {{ CustomerSettings?: Record<string, unknown>, CustomerStaticExpenses?: Record<string, unknown> }} customer
 * @param {{ startDate: string, endDate: string }} dateRange
 */
export function aggregateMetricsLikePerformanceDashboard(
    shopifyDaily,
    merged,
    customer,
    dateRange,
    {
        fixedCosts: fixedCostsOverride,
        marketId = null,
        marketCount = 1,
        shippingCostOverride = null,
    } = {}
) {
    const shopify = shopifyDaily || [];
    const cs = customer?.CustomerSettings || customer || {};
    const staticExpensesRaw = customer?.CustomerStaticExpenses || {};
    const staticExpenses = marketId
        ? withResolvedPerOrderRates(staticExpensesRaw, marketId)
        : staticExpensesRaw;

    const cost = totalAdSpendFromMerged(merged);
    const channelTotals = channelSpendTotalsFromMerged(merged);
    const fetchCogs = cs.fetchCogsFromStore === true;
    const cogsPercentage =
        typeof staticExpenses.cogsPercentage === "number"
            ? staticExpenses.cogsPercentage
            : 0;
    const fixedCosts =
        fixedCostsOverride !== undefined
            ? Number(fixedCostsOverride) || 0
            : calcFixedCostsForDateRange(
                  dateRange.startDate,
                  dateRange.endDate,
                  staticExpensesRaw,
                  marketId
                      ? { mode: "market", marketId, marketCount }
                      : { mode: "all" }
              );
    const daysInRange =
        dayjs(dateRange.endDate).diff(dayjs(dateRange.startDate), "day") + 1;

    let resolvedShippingOverride = shippingCostOverride;
    if (
        resolvedShippingOverride == null &&
        hasShippingMethodCosts(staticExpenses) &&
        Array.isArray(merged?.shippingOrdersByMethodDaily) &&
        merged.shippingOrdersByMethodDaily.length > 0
    ) {
        const orders = shopify.reduce((s, d) => s + (Number(d.orders) || 0), 0);
        resolvedShippingOverride = computeShippingCostFromMethodCounts(
            shippingMethodCountsForPeriod(merged.shippingOrdersByMethodDaily),
            staticExpenses.shippingMethodCosts,
            staticExpenses.shippingCostPerOrder ?? 0,
            orders
        );
    }

    const computed = computePerformanceDashboardMetrics({
        shopify,
        shopifyPrev: [],
        customerSettings: cs,
        customerType: customer?.customerType || "Shopify",
        staticExpenses,
        fetchCogs,
        cogsPercentage,
        cost,
        costPrev: 0,
        channelTotals,
        channelTotalsPrev: channelTotals,
        fixedCosts,
        fixedCostsPrev: 0,
        customKpis: [],
        daysInRange,
        prevDaysInRange: daysInRange,
        shippingCostOverride: resolvedShippingOverride,
        shippingCostOverridePrev: null,
    });

    const md = computed.metricsData;
    const curr = computed.curr;

    return {
        orders: md.orders,
        totalSales: md.total_sales,
        netRevenue: md.revenue,
        discounts: md.discounts,
        returns: md.returns,
        taxes: md.tax,
        shippingCharges: md.shipping_revenue,
        cogs: md.cogs,
        aov: md.aov,
        ppcCost: Number(channelTotals.google_spend) || 0,
        psCost: Number(channelTotals.meta_spend) || 0,
        pinterestCost: Number(channelTotals.pinterest_spend) || 0,
        snapchatCost: Number(channelTotals.snapchat_spend) || 0,
        bingCost: Number(channelTotals.bing_spend) || 0,
        redditCost: Number(channelTotals.reddit_spend) || 0,
        totalMarketingSpend: cost,
        roas: md.roas,
        poas: md.poas,
        variableExpense: md.variable_costs,
        fixedExpense: md.fixed_costs,
        transactionFee: md.transaction_fee,
        netProfit: md.ebit,
    };
}

/**
 * Prefetch region countries for all markets (parallel).
 * @returns {Promise<Map<string, { billingCountryNames: string[], metaCountryCodes: string[], googleCountryNames: string[] }>>}
 */
async function prefetchMarketFiltersByMarketId(settings, markets) {
    /** @type {Map<string, { billingCountryNames: string[], metaCountryCodes: string[], googleCountryNames: string[] }>} */
    const map = new Map();
    const shop = settings.shopifyUrl;
    const token = settings.shopifyApiPassword;
    if (!shop || !token) return map;

    await Promise.all(
        (markets || []).map(async (market) => {
            const mid = String(market.shopifyqlMarketId || "").trim();
            if (!mid) return;
            try {
                const filters = await fetchAdSpendCountryFiltersForSelectedMarkets(
                    shop,
                    token,
                    [mid]
                );
                map.set(mid, filters);
            } catch (e) {
                console.error(`[Markets overview] Countries for market ${mid}:`, e);
            }
        })
    );
    return map;
}

/**
 * @param {Record<string, unknown>} settings
 * @param {string} startDate
 * @param {string} endDate
 * @param {Array<{ shopifyqlMarketId: string, name?: string, handle?: string }>} markets
 * @param {{ excludeAdSpendPlatforms?: string[] }} [options]
 */
export async function fetchMarketsOverviewRows(
    settings,
    startDate,
    endDate,
    markets,
    options = {}
) {
    const list = Array.isArray(markets) ? markets : [];
    const excludeAdSpendPlatforms = options.excludeAdSpendPlatforms || [];
    const dateRange = { startDate, endDate };

    const staticExpensesEarly = settings?.CustomerStaticExpenses || {};
    const needShippingByCountry = hasShippingMethodCosts(staticExpensesEarly);

    const [storeMerged, shopifyByCountry, adSpendByIso, filtersByMarketId, shippingByCountry] =
        await Promise.all([
            fetchMergedSources(settings, startDate, endDate, {
                dailyBreakdown: true,
                source: "markets-overview",
                excludeAdSpendPlatforms,
            }),
            fetchShopifySalesGroupedByBillingCountryAndDay(
                settings,
                startDate,
                endDate
            ),
            fetchAdSpendByIso2Country(settings, startDate, endDate, {
                excludeAdSpendPlatforms,
            }),
            prefetchMarketFiltersByMarketId(settings, list),
            needShippingByCountry && settings.shopifyUrl && settings.shopifyApiPassword
                ? fetchShopifyOrdersByShippingMethodAndCountry(
                      settings.shopifyUrl,
                      settings.shopifyApiPassword,
                      startDate,
                      endDate,
                      settings
                  )
                : Promise.resolve([]),
        ]);

    const storeChannelTotals = channelSpendTotalsFromMerged(storeMerged);
    const customerSettings = settings?.CustomerSettings || settings || {};
    const staticExpenses = settings?.CustomerStaticExpenses || {};
    const activeMarketCount = Math.max(
        list.filter((m) => String(m.shopifyqlMarketId || "").trim()).length,
        1
    );
    const returnsOverride = getReturnsOverrideSettings(customerSettings);
    const storeRevenue = aggregateShopifyDailyRows(
        storeMerged.shopifyDaily || [],
        returnsOverride,
        customerSettings
    ).netRevenue;

    const storeTotalRow = {
        marketId: "__store_total__",
        marketName: "Store total",
        handle: "",
        isStoreTotal: true,
        ...aggregateMetricsLikePerformanceDashboard(
            storeMerged.shopifyDaily || [],
            storeMerged,
            settings,
            dateRange
        ),
    };

    /** @type {Array<Record<string, unknown>>} */
    const marketRows = [];

    for (const market of list) {
        const shopifyqlMarketId = String(market.shopifyqlMarketId || "").trim();
        if (!shopifyqlMarketId) continue;

        const filters = filtersByMarketId.get(shopifyqlMarketId) || {
            billingCountryNames: [],
            metaCountryCodes: [],
            googleCountryNames: [],
        };

        const shopifyDaily = shopifyDailyForBillingCountries(
            shopifyByCountry,
            filters.billingCountryNames
        );

        const channelTotals = channelSpendTotalsForMarket(
            adSpendByIso,
            filters.metaCountryCodes
        );

        // Pinterest / Bing lack country breakdown — allocate by revenue share vs store total
        const marketRevenue = aggregateShopifyDailyRows(
            shopifyDaily,
            returnsOverride,
            customerSettings
        ).netRevenue;
        const share =
            storeRevenue > 0 && marketRevenue > 0 ? marketRevenue / storeRevenue : 0;

        if (share > 0) {
            for (const key of ["pinterest_spend", "bing_spend"]) {
                const storeVal = Number(storeChannelTotals[key] || 0);
                if (storeVal > 0) {
                    channelTotals[key] = storeVal * share;
                }
            }
        }

        const merged = buildSyntheticMergedFromChannelTotals(
            channelTotals,
            startDate
        );

        let shippingCostOverride = null;
        if (needShippingByCountry && Array.isArray(shippingByCountry)) {
            const orders = shopifyDaily.reduce(
                (s, d) => s + (Number(d.orders) || 0),
                0
            );
            const rates = withResolvedPerOrderRates(
                staticExpenses,
                shopifyqlMarketId
            );
            shippingCostOverride = computeShippingCostFromMethodCounts(
                shippingMethodCountsForBillingCountries(
                    shippingByCountry,
                    filters.billingCountryNames
                ),
                rates.shippingMethodCosts || staticExpenses.shippingMethodCosts,
                rates.shippingCostPerOrder ?? 0,
                orders
            );
        }

        const metrics = aggregateMetricsLikePerformanceDashboard(
            shopifyDaily,
            merged,
            settings,
            dateRange,
            {
                marketId: shopifyqlMarketId,
                marketCount: activeMarketCount,
                shippingCostOverride,
            }
        );

        marketRows.push({
            marketId: shopifyqlMarketId,
            marketName: market.name || market.handle || shopifyqlMarketId,
            handle: market.handle || "",
            isStoreTotal: false,
            ...metrics,
        });
    }

    marketRows.sort(
        (a, b) =>
            (Number(b.netRevenue) || 0) - (Number(a.netRevenue) || 0) ||
            String(a.marketName).localeCompare(String(b.marketName))
    );

    // When market-specific shipping / fixed costs exist, roll store totals up from market rows
    // so overrides are not flattened to the global rate.
    const hasMarketCostOverrides =
        (staticExpenses.marketVariableCosts || []).some(
            (r) => r?.shippingCostPerOrder != null || r?.pickNPackCostPerOrder != null
        ) ||
        [
            ...(staticExpenses.marketingBureauCostLineItems || []),
            ...(staticExpenses.marketingToolingCostLineItems || []),
            ...(staticExpenses.fixedExpensesLineItems || []),
        ].some((item) => item?.marketId && String(item.marketId).trim());

    if (hasMarketCostOverrides && marketRows.length > 0 && storeTotalRow) {
        const sumVar = marketRows.reduce((s, r) => s + (Number(r.variableExpense) || 0), 0);
        const sumFixed = marketRows.reduce((s, r) => s + (Number(r.fixedExpense) || 0), 0);
        const sumTx = marketRows.reduce((s, r) => s + (Number(r.transactionFee) || 0), 0);
        const sumCogs = marketRows.reduce((s, r) => s + (Number(r.cogs) || 0), 0);
        const revenue = Number(storeTotalRow.netRevenue) || 0;
        const spend = Number(storeTotalRow.totalMarketingSpend) || 0;
        storeTotalRow.variableExpense = sumVar;
        storeTotalRow.fixedExpense = sumFixed;
        storeTotalRow.transactionFee = sumTx;
        storeTotalRow.cogs = sumCogs;
        storeTotalRow.netProfit =
            revenue - sumCogs - sumFixed - sumVar - sumTx - spend;
    }

    return {
        rows: marketRows,
        storeTotalRow,
    };
}

/**
 * @param {string} shopDomain
 * @param {string} accessToken
 */
export async function loadShopifyMarketsForOverview(shopDomain, accessToken) {
    const { markets } = await fetchShopifyMarketsCatalog(shopDomain, accessToken);
    return (markets || []).map((m) => ({
        shopifyqlMarketId: m.shopifyqlMarketId,
        name: m.name,
        handle: m.handle,
    }));
}

/** Channel column keys visible for markets table (respects spend exclusions). */
export function visibleMarketingColumnKeysForMarkets(settings, excludeAdSpendPlatforms = []) {
    const excluded = new Set(excludeAdSpendPlatforms || []);
    return AD_SPEND_CHANNELS.filter((c) => !excluded.has(c.id)).map(
        (c) => c.dailyOverviewColumnKey
    );
}
