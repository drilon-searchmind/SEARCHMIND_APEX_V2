import {
    channelSpendTotalsFromMerged,
    totalAdSpendFromMerged,
} from "@/lib/mergeAdSpendDaily";
import { applyVatDisplayToShopifyDayRow } from "@/lib/revenueVatDisplay";
import { getReturnsOverrideSettings } from "@/lib/performanceDashboard/performanceDashboardConstants";
import {
    netRevenueForShopifyDay,
    shopifyDayRevenueByType,
} from "@/lib/performanceDashboard/computePerformanceMetrics";
import { computePeriodMetricsFromMerged } from "@/lib/performanceDashboard/profitMetrics";

/** Sum child revenue using the same rules as the single-property performance dashboard. */
export function sumChildShopifyRevenue(shopifyRows, revenueType, customerSettings = {}) {
    const returnsOverride = getReturnsOverrideSettings(customerSettings);
    return (shopifyRows || []).reduce(
        (sum, d) =>
            sum +
            shopifyDayRevenueByType(d, revenueType, returnsOverride, customerSettings),
        0
    );
}

/**
 * Display revenue for a Shopify daily row in parent group views.
 * @param {Record<string, unknown>} d
 * @param {"net_sales"|"gross_sales"} shopifyRevenueField
 * @param {Record<string, unknown>} customerSettings
 */
export function parentChildDayDisplayRevenue(d, shopifyRevenueField, customerSettings = {}) {
    if (shopifyRevenueField === "gross_sales") {
        const day = applyVatDisplayToShopifyDayRow(d, customerSettings);
        return Number(day.gross_sales) || 0;
    }
    const returnsOverride = getReturnsOverrideSettings(customerSettings);
    return netRevenueForShopifyDay(d, returnsOverride, customerSettings);
}

/**
 * Full performance-dashboard metrics for one child (parent aggregated API + overview).
 * Uses the same pipeline as single-property dashboards (returns override, VAT display, fixed costs).
 */
export function computeChildFullMetricsForParent(
    customer,
    merged,
    mergedPrev,
    startStr,
    endStr,
    prevStartStr,
    prevEndStr
) {
    const customerSettings = customer?.CustomerSettings || {};
    const staticExpenses = customer?.CustomerStaticExpenses || {};
    const channelSpend = channelSpendTotalsFromMerged(merged);
    const channelSpendPrev = channelSpendTotalsFromMerged(mergedPrev);

    const computed = computePeriodMetricsFromMerged({
        shopifyDaily: merged?.shopifyDaily || [],
        merged,
        customerSettings,
        customerType: customer?.customerType || "Shopify",
        staticExpenses,
        dateRange: { startDate: startStr, endDate: endStr },
        shopifyDailyPrev: mergedPrev?.shopifyDaily || [],
        mergedPrev,
        prevDateRange: { startDate: prevStartStr, endDate: prevEndStr },
        channelTotals: channelSpend,
        channelTotalsPrev: channelSpendPrev,
    });

    const md = computed.metricsData;
    const mdPrev = computed.metricsDataPrev;
    const curr = computed.curr;
    const prev = computed.prev;
    const derived = computed.derived || {};

    const orders = curr.orders;
    const ordersPrev = prev.orders;
    const cost = Number(md.cost) || totalAdSpendFromMerged(merged);
    const costPrev = Number(mdPrev.cost) || totalAdSpendFromMerged(mergedPrev);

    return {
        totalSales: curr.totalSales,
        grossSales: curr.grossSales,
        discounts: curr.discounts,
        returns: curr.returns,
        netRevenue: curr.netRevenue,
        orders,
        shippingCharges: curr.shippingCharges,
        taxes: curr.taxes,
        metaSpend: Number(channelSpend.meta_spend) || 0,
        googleSpend: Number(channelSpend.google_spend) || 0,
        snapchatSpend: Number(channelSpend.snapchat_spend) || 0,
        redditSpend: Number(channelSpend.reddit_spend) || 0,
        pinterestSpend: Number(channelSpend.pinterest_spend) || 0,
        bingSpend: Number(channelSpend.bing_spend) || 0,
        channelSpend,
        channelSpendPrev,
        cost,
        totalCogs: derived.totalCogs ?? md.cogs ?? 0,
        prevTotalCogs: derived.prevTotalCogs ?? mdPrev.cogs ?? 0,
        fixedCosts: md.fixed_costs ?? 0,
        fixedCostsPrev: mdPrev.fixed_costs ?? 0,
        variableCosts: md.variable_costs ?? 0,
        variableCostsPrev: mdPrev.variable_costs ?? 0,
        shippingCost: md.shipping_cost ?? 0,
        shippingCostPrev: mdPrev.shipping_cost ?? 0,
        pickPackCost: md.pick_pack ?? 0,
        pickPackCostPrev: mdPrev.pick_pack ?? 0,
        transactionFee: md.transaction_fee ?? 0,
        transactionFeePrev: mdPrev.transaction_fee ?? 0,
        allCosts: derived.allCosts ?? md.total_expenses ?? 0,
        allCostsPrev: derived.allCostsPrev ?? mdPrev.total_expenses ?? 0,
        ebit: md.ebit ?? 0,
        ebitPrev: mdPrev.ebit ?? 0,
        grossProfit: md.gross_profit ?? 0,
        grossProfitPrev: mdPrev.gross_profit ?? 0,
        cac: orders > 0 ? cost / orders : null,
        cacPrev: ordersPrev > 0 ? costPrev / ordersPrev : null,
        totalSalesPrev: prev.totalSales,
        grossSalesPrev: prev.grossSales,
        discountsPrev: prev.discounts,
        returnsPrev: prev.returns,
        netRevenuePrev: prev.netRevenue,
        ordersPrev,
        shippingChargesPrev: prev.shippingCharges,
        taxesPrev: prev.taxes,
        metaSpendPrev: Number(channelSpendPrev.meta_spend) || 0,
        googleSpendPrev: Number(channelSpendPrev.google_spend) || 0,
        snapchatSpendPrev: Number(channelSpendPrev.snapchat_spend) || 0,
        redditSpendPrev: Number(channelSpendPrev.reddit_spend) || 0,
        pinterestSpendPrev: Number(channelSpendPrev.pinterest_spend) || 0,
        bingSpendPrev: Number(channelSpendPrev.bing_spend) || 0,
        costPrev,
    };
}
