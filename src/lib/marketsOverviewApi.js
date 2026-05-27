import dayjs from "dayjs";
import { fetchMergedSources } from "./mergedSourcesApi";
import { fetchShopifyMarketsCatalog } from "./shopifyMarketsApi";
import {
    AD_SPEND_CHANNELS,
    channelSpendTotalsFromMerged,
    totalAdSpendFromMerged,
} from "./mergeAdSpendDaily";
import { computePerformanceDashboardMetrics } from "./performanceDashboard/computePerformanceMetrics";

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

/** @param {{ netRevenue?: number, totalMarketingSpend?: number }} metrics */
export function marketHasActivity(metrics) {
    return (
        (Number(metrics?.netRevenue) || 0) > 0 ||
        (Number(metrics?.totalMarketingSpend) || 0) > 0
    );
}

/**
 * @param {Record<string, unknown>} settings
 * @param {string} startDate
 * @param {string} endDate
 * @param {Array<{ shopifyqlMarketId: string, name?: string, handle?: string }>} markets
 * @param {{ excludeAdSpendPlatforms?: string[], shopifyMarketFilterAdSpend?: boolean, concurrency?: number }} [options]
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
    const filterAdSpendByMarket = options.shopifyMarketFilterAdSpend !== false;
    const concurrency = Math.max(1, Math.min(options.concurrency ?? 6, 10));
    const dateRange = { startDate, endDate };

    const storeMerged = await fetchMergedSources(settings, startDate, endDate, {
        dailyBreakdown: true,
        source: "markets-overview",
        excludeAdSpendPlatforms,
        shopifyMarketFilterAdSpend: false,
    });

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

    async function fetchMarketRow(market) {
        const shopifyqlMarketId = String(market.shopifyqlMarketId || "").trim();
        if (!shopifyqlMarketId) return null;

        const merged = await fetchMergedSources(settings, startDate, endDate, {
            dailyBreakdown: true,
            source: "markets-overview",
            shopifyMarketsSelection: [
                { shopifyqlMarketId, handle: market.handle || undefined },
            ],
            shopifyMarketFilterAdSpend: filterAdSpendByMarket,
            excludeAdSpendPlatforms,
        });

        const metrics = aggregateMetricsLikePerformanceDashboard(
            merged.shopifyDaily || [],
            merged,
            settings,
            dateRange
        );

        if (!marketHasActivity(metrics)) return null;

        return {
            marketId: shopifyqlMarketId,
            marketName: market.name || market.handle || shopifyqlMarketId,
            handle: market.handle || "",
            isStoreTotal: false,
            ...metrics,
        };
    }

    /** @type {Array<Record<string, unknown>>} */
    const marketRows = [];

    for (let i = 0; i < list.length; i += concurrency) {
        const batch = list.slice(i, i + concurrency);
        const batchRows = await Promise.all(batch.map((m) => fetchMarketRow(m)));
        for (const row of batchRows) {
            if (row) marketRows.push(row);
        }
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
