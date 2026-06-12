import dayjs from "dayjs";
import { totalAdSpendFromMerged, channelSpendTotalsFromMerged } from "@/lib/mergeAdSpendDaily";
import {
    calcFixedCostForSingleDay,
    calcFixedCostsForDateRange,
    calcProratedMonthlyCostForDateRange,
    getMonthlyMarketingBureauTotal,
    getMonthlyMarketingToolingTotal,
    getMonthlyOtherFixedTotal,
} from "@/lib/customerStaticExpensesUtils";
import { applyVatDisplayToShopifyDayRow } from "@/lib/revenueVatDisplay";
import { calcBlendedPoas } from "@/lib/poasMetrics";
import { getReturnsOverrideSettings } from "./performanceDashboardConstants";
import {
    computePerformanceDashboardMetrics,
    netRevenueForShopifyDay,
} from "./computePerformanceMetrics";
import { enrichOverviewDerivedMetrics } from "./enrichOverviewDerivedMetrics";
import {
    periodPrimarySalesRevenue,
    primarySalesRevenueLabel,
} from "./primarySalesRevenue";

/**
 * Per-day profit metrics aligned with performance-dashboard chart logic.
 */
export function calcShopifyDayProfitMetrics({
    shopifyDay,
    marketingSpend = 0,
    customerSettings = {},
    staticExpenses = {},
    returnsOverride = null,
}) {
    const returnsOverrideSettings =
        returnsOverride ?? getReturnsOverrideSettings(customerSettings);
    const fetchCogs = customerSettings?.fetchCogsFromStore === true;
    const cogsPercentage = staticExpenses?.cogsPercentage || 0;
    const shippingCostPerOrder = staticExpenses?.shippingCostPerOrder ?? 0;
    const pickNPackCostPerOrder = staticExpenses?.pickNPackCostPerOrder ?? 0;
    const transactionCostPct = staticExpenses?.transactionCostPercentage ?? 0.015;

    const vatDay = applyVatDisplayToShopifyDayRow(shopifyDay, customerSettings);
    const netRevenue = netRevenueForShopifyDay(
        shopifyDay,
        returnsOverrideSettings,
        customerSettings
    );
    const orders = Number(vatDay.orders) || 0;
    const cogs = fetchCogs
        ? Number(vatDay.cost_of_goods_sold) || 0
        : netRevenue * cogsPercentage;
    const variableExpense =
        shippingCostPerOrder * orders + pickNPackCostPerOrder * orders;
    const ymd = String(shopifyDay.period).slice(0, 10);
    const fixedExpense = calcFixedCostForSingleDay(ymd, staticExpenses);
    const transactionFee = netRevenue * transactionCostPct;
    const cost = Number(marketingSpend) || 0;
    const grossProfit = netRevenue - cogs;
    const allCosts = cogs + fixedExpense + variableExpense + transactionFee + cost;
    const netProfit = netRevenue - allCosts;
    const poas = calcBlendedPoas(grossProfit, cost);
    const roas = cost > 0 ? netRevenue / cost : null;
    const spendshare = netRevenue > 0 ? cost / netRevenue : null;

    return {
        netRevenue,
        orders,
        cogs,
        variableExpense,
        fixedExpense,
        transactionFee,
        totalMarketingSpend: cost,
        netProfit,
        poas,
        roas,
        spendshare,
    };
}

/**
 * Full period metrics via the same pipeline as performance-dashboard overview KPIs.
 */
export function computePeriodMetricsFromMerged({
    shopifyDaily = [],
    merged,
    customerSettings = {},
    customerType = "Shopify",
    staticExpenses = {},
    dateRange,
    shopifyDailyPrev = [],
    mergedPrev = null,
    prevDateRange = null,
    channelTotals = null,
    channelTotalsPrev = null,
    customKpis = [],
}) {
    const startDate = dateRange?.startDate;
    const endDate = dateRange?.endDate;
    const cost = totalAdSpendFromMerged(merged);
    const costPrev = mergedPrev ? totalAdSpendFromMerged(mergedPrev) : 0;
    const chTotals = channelTotals ?? channelSpendTotalsFromMerged(merged);
    const chTotalsPrev =
        channelTotalsPrev ??
        (mergedPrev ? channelSpendTotalsFromMerged(mergedPrev) : chTotals);
    const fetchCogs = customerSettings?.fetchCogsFromStore === true;
    const cogsPercentage = staticExpenses?.cogsPercentage || 0;
    const fixedCosts = calcFixedCostsForDateRange(startDate, endDate, staticExpenses);
    const daysInRange = dayjs(endDate).diff(dayjs(startDate), "day") + 1;

    let fixedCostsPrev = 0;
    let prevDaysInRange = daysInRange;
    if (prevDateRange?.startDate && prevDateRange?.endDate) {
        fixedCostsPrev = calcFixedCostsForDateRange(
            prevDateRange.startDate,
            prevDateRange.endDate,
            staticExpenses
        );
        prevDaysInRange =
            dayjs(prevDateRange.endDate).diff(dayjs(prevDateRange.startDate), "day") + 1;
    }

    const computed = computePerformanceDashboardMetrics({
        shopify: shopifyDaily,
        shopifyPrev: shopifyDailyPrev,
        customerSettings,
        customerType,
        staticExpenses,
        fetchCogs,
        cogsPercentage,
        cost,
        costPrev,
        channelTotals: chTotals,
        channelTotalsPrev: chTotalsPrev,
        fixedCosts,
        fixedCostsPrev,
        customKpis,
        daysInRange,
        prevDaysInRange,
    });

    const replacementByKey = computed.replacementByKey || {};
    enrichOverviewDerivedMetrics({
        metricsData: computed.metricsData,
        metricsDataPrev: computed.metricsDataPrev,
        derived: computed.derived,
        staticExp: staticExpenses,
        rangeStart: startDate,
        rangeEnd: endDate,
        prevRangeStart: prevDateRange?.startDate,
        prevRangeEnd: prevDateRange?.endDate,
        customerType,
        customerSettings,
        replacementByKey,
    });

    const md = computed.metricsData;
    const mdPrev = computed.metricsDataPrev;

    const pnlFixedBreakdown =
        startDate && endDate
            ? {
                  marketingBureau: calcProratedMonthlyCostForDateRange(
                      getMonthlyMarketingBureauTotal(staticExpenses),
                      startDate,
                      endDate
                  ),
                  marketingTooling: calcProratedMonthlyCostForDateRange(
                      getMonthlyMarketingToolingTotal(staticExpenses),
                      startDate,
                      endDate
                  ),
                  fixedExpenses: calcProratedMonthlyCostForDateRange(
                      getMonthlyOtherFixedTotal(staticExpenses),
                      startDate,
                      endDate
                  ),
              }
            : {
                  marketingBureau: 0,
                  marketingTooling: 0,
                  fixedExpenses: 0,
              };

    let pnlFixedBreakdownPrev = {
        marketingBureau: 0,
        marketingTooling: 0,
        fixedExpenses: 0,
    };
    if (prevDateRange?.startDate && prevDateRange?.endDate) {
        pnlFixedBreakdownPrev = {
            marketingBureau: calcProratedMonthlyCostForDateRange(
                getMonthlyMarketingBureauTotal(staticExpenses),
                prevDateRange.startDate,
                prevDateRange.endDate
            ),
            marketingTooling: calcProratedMonthlyCostForDateRange(
                getMonthlyMarketingToolingTotal(staticExpenses),
                prevDateRange.startDate,
                prevDateRange.endDate
            ),
            fixedExpenses: calcProratedMonthlyCostForDateRange(
                getMonthlyOtherFixedTotal(staticExpenses),
                prevDateRange.startDate,
                prevDateRange.endDate
            ),
        };
    }

    return {
        ...computed,
        primarySalesRevenue: periodPrimarySalesRevenue(md),
        primarySalesRevenuePrev: periodPrimarySalesRevenue(mdPrev),
        primarySalesRevenueLabel: primarySalesRevenueLabel(customerSettings, customKpis),
        netProfit: md.ebit,
        netProfitPrev: mdPrev.ebit,
        poas: md.poas,
        poasPrev: mdPrev.poas,
        pnlFixedBreakdown,
        pnlFixedBreakdownPrev,
        shippingAndPickPack: (md.shipping_cost || 0) + (md.pick_pack || 0),
        shippingAndPickPackPrev:
            (mdPrev.shipping_cost || 0) + (mdPrev.pick_pack || 0),
    };
}
