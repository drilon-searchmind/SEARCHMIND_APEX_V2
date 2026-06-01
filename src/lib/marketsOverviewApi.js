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
import { computePerformanceDashboardMetrics } from "./performanceDashboard/computePerformanceMetrics";
import {
    fetchAdSpendByIso2Country,
    channelSpendTotalsForMarket,
    buildSyntheticMergedFromChannelTotals,
} from "./marketAdSpendByCountry";

function calcFixedForRange(rangeStart, rangeEnd, fixedExpensesMonthly) {
    let total = 0;
    let d = dayjs(rangeStart);
    const endDay = dayjs(rangeEnd);
    while (!d.isAfter(endDay)) {
        total += fixedExpensesMonthly / d.daysInMonth();
        d = d.add(1, "day");
    }
    return total;
}

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
    dateRange
) {
    const shopify = shopifyDaily || [];
    const cs = customer?.CustomerSettings || customer || {};
    const staticExpenses = customer?.CustomerStaticExpenses || {};

    const cost = totalAdSpendFromMerged(merged);
    const channelTotals = channelSpendTotalsFromMerged(merged);
    const fetchCogs = cs.fetchCogsFromStore === true;
    const cogsPercentage =
        typeof staticExpenses.cogsPercentage === "number"
            ? staticExpenses.cogsPercentage
            : 0;
    const fixedExpensesMonthly = Number(staticExpenses.fixedExpenses) || 0;
    const fixedCosts = calcFixedForRange(
        dateRange.startDate,
        dateRange.endDate,
        fixedExpensesMonthly
    );
    const daysInRange =
        dayjs(dateRange.endDate).diff(dayjs(dateRange.startDate), "day") + 1;

    const computed = computePerformanceDashboardMetrics({
        shopify,
        shopifyPrev: [],
        customerSettings: cs,
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

    const [storeMerged, shopifyByCountry, adSpendByIso, filtersByMarketId] =
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
        ]);

    const storeChannelTotals = channelSpendTotalsFromMerged(storeMerged);

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
        const marketRevenue = shopifyDaily.reduce(
            (s, d) => s + (Number(d.net_sales) || 0),
            0
        );
        const storeRevenue = (storeMerged.shopifyDaily || []).reduce(
            (s, d) => s + (Number(d.net_sales) || 0),
            0
        );
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

        const metrics = aggregateMetricsLikePerformanceDashboard(
            shopifyDaily,
            merged,
            settings,
            dateRange
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
