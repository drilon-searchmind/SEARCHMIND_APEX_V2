import { getDemoMergedSourcesForRange } from "./demoMergedSources";
import { getDemoShopifyMarkets } from "./demoCustomer";
import { channelSpendTotalsFromMerged } from "./mergeAdSpendDaily";
import { calcFixedCostsForDateRange } from "./customerStaticExpensesUtils";
import { aggregateMetricsLikePerformanceDashboard } from "./marketsOverviewApi";
import { buildSyntheticMergedFromChannelTotals } from "./marketAdSpendByCountry";

/**
 * Demo split per market (illustrative only): share of store sales and share of ad spend.
 * Different revenue vs spend shares give each market its own ROAS / POAS profile.
 */
const DEMO_MARKET_WEIGHTS = [
    { revenue: 0.58, spend: 0.42 },
    { revenue: 0.27, spend: 0.28 },
    { revenue: 0.15, spend: 0.3 },
    { revenue: 0.06, spend: 0.1 },
    { revenue: 0.04, spend: 0.08 },
];

/** Count fields stay whole numbers when a demo day is split across markets. */
const COUNT_KEYS = new Set(["orders", "orders_count", "customers", "new_customers", "returning_customers", "sessions"]);

function scaleShopifyDay(day, factor) {
    const out = {};
    for (const [k, v] of Object.entries(day || {})) {
        if (typeof v !== "number" || k === "period") {
            out[k] = v;
        } else {
            out[k] = COUNT_KEYS.has(k) ? Math.round(v * factor) : v * factor;
        }
    }
    return out;
}

function normalizedWeights(count) {
    const base = DEMO_MARKET_WEIGHTS.slice(0, Math.max(1, count));
    while (base.length < count) base.push({ revenue: 0.04, spend: 0.05 });
    const rev = base.reduce((s, w) => s + w.revenue, 0);
    const sp = base.reduce((s, w) => s + w.spend, 0);
    return base.map((w) => ({ revenue: w.revenue / rev, spend: w.spend / sp }));
}

/**
 * Markets overview payload for demo customer ids, built from the demo merged sources so the
 * store total matches the rest of the demo dashboard.
 * @param {string} startDate
 * @param {string} endDate
 * @param {Record<string, unknown>} customer merged demo customer document
 * @param {{ excludeAdSpendPlatforms?: string[] }} [options]
 */
export function getDemoMarketsOverview(startDate, endDate, customer, options = {}) {
    const settings = {
        customerName: customer?.customerName,
        customerType: "Shopify",
        ...(customer?.CustomerSettings || {}),
        CustomerStaticExpenses: customer?.CustomerStaticExpenses || {},
        CustomerSettings: customer?.CustomerSettings || {},
    };
    const dateRange = { startDate, endDate };
    const storeMerged = getDemoMergedSourcesForRange(startDate, endDate, customer, options);
    const storeDaily = storeMerged.shopifyDaily || [];
    const storeChannels = channelSpendTotalsFromMerged(storeMerged);

    const markets = getDemoShopifyMarkets();
    const weights = normalizedWeights(markets.length);
    const fixedPerMarket =
        calcFixedCostsForDateRange(startDate, endDate, settings.CustomerStaticExpenses) /
        Math.max(markets.length, 1);

    const rows = markets.map((market, i) => {
        const w = weights[i];
        const channelTotals = Object.fromEntries(
            Object.entries(storeChannels).map(([k, v]) => [k, (Number(v) || 0) * w.spend])
        );
        const merged = buildSyntheticMergedFromChannelTotals(channelTotals, startDate);
        return {
            marketId: String(market.shopifyqlMarketId),
            marketName: market.name || market.handle,
            handle: market.handle || "",
            isStoreTotal: false,
            ...aggregateMetricsLikePerformanceDashboard(
                storeDaily.map((d) => scaleShopifyDay(d, w.revenue)),
                merged,
                settings,
                dateRange,
                { fixedCosts: fixedPerMarket }
            ),
        };
    });

    rows.sort((a, b) => (Number(b.netRevenue) || 0) - (Number(a.netRevenue) || 0));

    return {
        rows,
        storeTotalRow: {
            marketId: "__store_total__",
            marketName: "Store total",
            handle: "",
            isStoreTotal: true,
            ...aggregateMetricsLikePerformanceDashboard(storeDaily, storeMerged, settings, dateRange),
        },
        marketsCount: markets.length,
        isDemo: true,
    };
}
