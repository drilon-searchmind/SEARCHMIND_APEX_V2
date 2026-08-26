import { AD_SPEND_CHANNELS } from "@/lib/mergeAdSpendDaily";
import { calcBlendedPoasOrZero } from "@/lib/poasMetrics";
import { netRevenueFromGrossDiscountsReturns } from "@/lib/performanceDashboard/computePerformanceMetrics";

const CHANNEL_SPEND_BY_METRIC_KEY = Object.fromEntries(
    AD_SPEND_CHANNELS.map((c) => [c.metricsDataKey, c.bucketKey])
);

/**
 * Resolve one overview chart point for a metric key and aggregated period bucket.
 * @param {string} metric
 * @param {Record<string, number>|null|undefined} v
 * @param {{
 *   periodKey: string,
 *   returnsOverride: { enabled: boolean, percent: number },
 *   fetchCogsChart: boolean,
 *   cogsPctChart: number,
 *   shippingPerOrder: number,
 *   pickPerOrder: number,
 *   txCostPct: number,
 *   returnsCostPct?: number,
 *   getFixedForPeriod: (key: string) => number,
 * }} ctx
 * @returns {number|null}
 */
export function resolveOverviewChartMetricValue(metric, v, ctx) {
    if (!v) return null;

    const {
        periodKey,
        returnsOverride,
        fetchCogsChart,
        cogsPctChart,
        shippingPerOrder,
        pickPerOrder,
        txCostPct,
        returnsCostPct = 0,
        getFixedForPeriod,
    } = ctx;

    const effectiveRevenue = () => {
        if (returnsOverride.enabled) {
            const pct = (returnsOverride.percent ?? 0) / 100;
            const ret = (v.grossSales || 0) * pct;
            return netRevenueFromGrossDiscountsReturns(
                v.grossSales || 0,
                v.discounts || 0,
                ret
            );
        }
        return v.revenue || 0;
    };

    const effectiveReturns = () => {
        if (returnsOverride.enabled) {
            return (v.grossSales || 0) * ((returnsOverride.percent ?? 0) / 100);
        }
        return v.returns || 0;
    };

    const effectiveCogs = (rev) => {
        if (fetchCogsChart) return v.cogs || 0;
        return rev * cogsPctChart;
    };

    const rev = effectiveRevenue();
    const cogs = effectiveCogs(rev);
    const fixed = getFixedForPeriod(periodKey);
    const variable = (shippingPerOrder + pickPerOrder) * (v.orders || 0);
    const shippingCost = shippingPerOrder * (v.orders || 0);
    const pickPack = (pickPerOrder || 0) * (v.orders || 0);
    const txFee = rev * txCostPct;
    const returnsCost = rev * returnsCostPct;
    const allCosts = cogs + fixed + variable + txFee + (v.cost || 0);

    const channelBucket = CHANNEL_SPEND_BY_METRIC_KEY[metric];
    if (channelBucket) {
        return Number((v[channelBucket] || 0).toFixed(0));
    }

    if (metric === "marketing_spend") {
        return Number((v.cost || 0).toFixed(0));
    }
    if (metric === "revenue" || metric === "total_sales_ex_vat" || metric === "revenue_after_discounts") {
        return Number(rev.toFixed(0));
    }
    if (metric === "net_sales" || metric === "product_sales") {
        return Number((v.net_sales || rev).toFixed(0));
    }
    if (metric === "total_sales") {
        return Number(v.totalRevenue.toFixed(0));
    }
    if (metric === "gross_sales") {
        return Number((v.grossSales || 0).toFixed(0));
    }
    if (metric === "discounts") {
        return Number((v.discounts || 0).toFixed(0));
    }
    if (metric === "returns" || metric === "returns_goods") {
        return Number(effectiveReturns().toFixed(0));
    }
    if (metric === "returns_shipping") {
        return Number((v.shipping_returned || 0).toFixed(0));
    }
    if (metric === "duties") {
        return Number((v.duties || 0).toFixed(0));
    }
    if (metric === "additional_fees") {
        return Number((v.additional_fees || 0).toFixed(0));
    }
    if (metric === "shipping_revenue") {
        return Number((v.shipping_revenue || 0).toFixed(0));
    }
    if (metric === "tax") {
        return Number((v.tax || 0).toFixed(0));
    }
    if (metric === "gross_profit") {
        return Number((rev - cogs).toFixed(0));
    }
    if (metric === "gross_profit_minus_ad_spend") {
        return Number((rev - cogs - (v.cost || 0)).toFixed(0));
    }
    if (metric === "cogs") {
        return Number(cogs.toFixed(0));
    }
    if (metric === "fixed_costs") {
        return Number(fixed.toFixed(0));
    }
    if (metric === "variable_costs") {
        return Number(variable.toFixed(0));
    }
    if (metric === "pick_pack") {
        return Number(pickPack.toFixed(0));
    }
    if (metric === "shipping_cost") {
        return Number(shippingCost.toFixed(0));
    }
    if (metric === "transaction_fee") {
        return Number(txFee.toFixed(0));
    }
    if (metric === "returns_cost") {
        return Number(returnsCost.toFixed(0));
    }
    if (metric === "total_expenses" || metric === "total_order_costs") {
        return Number(allCosts.toFixed(0));
    }
    if (metric === "ebit_pct" || metric === "net_profit_pct_total_sales") {
        return rev > 0 ? Number(((rev - allCosts) / rev * 100).toFixed(1)) : null;
    }
    if (metric === "ebit") {
        return Number((rev - allCosts).toFixed(0));
    }
    if (metric === "orders") {
        return Number(v.orders || 0);
    }
    if (metric === "roas") {
        return (v.cost || 0) > 0 ? Number((rev / v.cost).toFixed(2)) : null;
    }
    if (metric === "poas") {
        const grossProfit = rev - cogs;
        return (v.cost || 0) > 0
            ? Number(calcBlendedPoasOrZero(grossProfit, v.cost).toFixed(2))
            : null;
    }
    if (metric === "aov") {
        return (v.orders || 0) > 0 ? Number((rev / v.orders).toFixed(0)) : null;
    }
    if (metric === "spendshare" || metric === "ad_spend_pct_total_sales") {
        return rev > 0 ? Number((((v.cost || 0) / rev) * 100).toFixed(0)) : null;
    }
    if (metric === "cac") {
        return (v.orders || 0) > 0 ? Number(((v.cost || 0) / v.orders).toFixed(0)) : null;
    }
    if (metric === "discount_pct_gross") {
        return (v.grossSales || 0) > 0
            ? Number((((v.discounts || 0) / v.grossSales) * 100).toFixed(1))
            : null;
    }
    if (metric === "cogs_pct_total_sales") {
        const sales = v.totalRevenue || 0;
        return sales > 0 ? Number(((cogs / sales) * 100).toFixed(1)) : null;
    }
    if (metric === "shipping_cost_pct_total_sales") {
        const sales = v.totalRevenue || 0;
        return sales > 0 ? Number(((shippingCost / sales) * 100).toFixed(1)) : null;
    }
    if (metric === "refunds_rate") {
        return rev > 0 ? Number(((effectiveReturns() / rev) * 100).toFixed(1)) : null;
    }

    return null;
}

/** Label for chart series when metric is not in METRIC_OPTIONS (e.g. channel spend rows). */
export function overviewChartMetricLabel(metric, visibleAdSpendChannels = []) {
    const channel = visibleAdSpendChannels.find((c) => c.metricsDataKey === metric);
    if (channel) return `${channel.label} spend`;
    const spec = AD_SPEND_CHANNELS.find((c) => c.metricsDataKey === metric);
    if (spec) return `${spec.label} spend`;
    return metric;
}
