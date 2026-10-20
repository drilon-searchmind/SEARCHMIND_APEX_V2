import { evaluateFormula } from "@/app/(protected)/dashboard/[customerId]/performance-dashboard/components/kpiFormulaUtils";
import { channelDailyRowsFromMerged, channelSpendTotalsFromMerged } from "@/lib/mergeAdSpendDaily";
import {
    applyVatDisplayToShopifyDayRow,
    displaysTotalSalesWithoutVatDeduction,
    totalSalesVatLabel,
} from "@/lib/revenueVatDisplay";
import { buildShopifyDayFormulaMetrics } from "@/lib/performanceDashboard/dailyOverviewCustomKpis";
import { computeTotalSalesExVat, totalSalesExVatFromPeriodTotals } from "@/lib/performanceDashboard/totalSalesExVat";
import { getReturnsOverrideSettings } from "@/lib/performanceDashboard/performanceDashboardConstants";
import {
    aggregateShopifyDailyRows,
    computePerformanceDashboardMetrics,
} from "@/lib/performanceDashboard/computePerformanceMetrics";

export function getTotalSalesReplacementKpi(customKpis = []) {
    return (customKpis || []).find((k) => k.replacesStandardMetricKey === "total_sales") || null;
}

/** Spend per channel keyed by YYYY-MM-DD (for custom KPI formulas). */
export function buildChannelSpendMapsFromMerged(merged) {
    const chRows = channelDailyRowsFromMerged(merged);
    return Object.fromEntries(
        Object.entries(chRows).map(([id, arr]) => [
            id,
            Object.fromEntries(
                (arr || []).map((d) => [
                    String(d.period).slice(0, 10),
                    Number(d.spend) || 0,
                ])
            ),
        ])
    );
}

/**
 * Per-day primary sales revenue — matches performance-dashboard Total Sales column
 * (VAT display + optional custom KPI replacing total_sales).
 */
export function shopifyDayPrimarySalesRevenue(
    shopifyDay,
    {
        customerSettings = {},
        customerType = "Shopify",
        customKpis = [],
        channelMaps = {},
    } = {}
) {
    const ymd = String(shopifyDay?.period ?? "").slice(0, 10);
    const replacementKpi = getTotalSalesReplacementKpi(customKpis);
    if (replacementKpi) {
        const formulaMetrics = buildShopifyDayFormulaMetrics(
            shopifyDay,
            channelMaps,
            ymd,
            customerSettings
        );
        const value = evaluateFormula(replacementKpi, formulaMetrics);
        if (value != null && !Number.isNaN(value)) {
            return Number(value);
        }
    }

    const day = applyVatDisplayToShopifyDayRow(shopifyDay, customerSettings);
    const totalSales = Number(day.total_sales) || 0;
    if (displaysTotalSalesWithoutVatDeduction(customerSettings)) {
        return totalSales;
    }
    return computeTotalSalesExVat({
        totalSales,
        taxes: day.taxes,
        grossSales: day.gross_sales,
        netSales: day.net_sales,
        shippingRevenue: day.shipping_charges,
        customerType,
    });
}

/** Period total from metrics pipeline (metricsData after replacements + derived enrich). */
export function periodPrimarySalesRevenue(metricsData) {
    return Number(metricsData?.total_sales_ex_vat) || Number(metricsData?.total_sales) || 0;
}

/** Human-readable label for pace / P&L (custom KPI name or Total sales excl/incl VAT). */
export function primarySalesRevenueLabel(customerSettings = {}, customKpis = []) {
    const kpi = getTotalSalesReplacementKpi(customKpis);
    if (kpi?.name) return kpi.name;
    return totalSalesVatLabel(customerSettings);
}

/** Shopify daily rows with `period` in [startYmd, endYmd] (inclusive). */
export function shopifyDailyRowsInRange(shopifyDaily, startYmd, endYmd) {
    const start = String(startYmd || "").slice(0, 10);
    const end = String(endYmd || "").slice(0, 10);
    if (!start || !end) return [];
    return (shopifyDaily || []).filter((r) => {
        const ymd = String(r?.period ?? "").slice(0, 10);
        return ymd && ymd >= start && ymd <= end;
    });
}

/**
 * Trim merged-sources daily arrays to dates ≤ endYmd (for custom KPI formulas that use ad spend).
 * @param {Record<string, unknown>} merged
 * @param {string} endYmd
 */
export function mergedSourcesThroughDate(merged, endYmd) {
    const end = String(endYmd || "").slice(0, 10);
    if (!merged || !end) return merged;
    const out = { ...merged };
    for (const key of Object.keys(merged)) {
        const val = merged[key];
        if (!Array.isArray(val) || val.length === 0) continue;
        if (val[0]?.period == null && val[0]?.date == null) continue;
        out[key] = val.filter((d) => {
            const ymd = String(d?.period ?? d?.date ?? "").slice(0, 10);
            return ymd && ymd <= end;
        });
    }
    return out;
}

/**
 * Primary sales revenue for a date-bounded slice — same pipeline as performance-dashboard
 * Total sales (period aggregation + VAT + custom KPI replacing total_sales).
 */
export function computePrimarySalesRevenueForShopifyRows(
    shopifyRows,
    {
        customerSettings = {},
        customerType = "Shopify",
        customKpis = [],
        merged = null,
        staticExpenses = {},
        daysInRange = 1,
    } = {}
) {
    const rows = shopifyRows || [];
    const mergedSlice = merged || {};
    const channelTotals = channelSpendTotalsFromMerged(mergedSlice);
    const usesCustomReplacements = (customKpis || []).some((k) => k.replacesStandardMetricKey);

    if (getTotalSalesReplacementKpi(customKpis) || usesCustomReplacements) {
        const computed = computePerformanceDashboardMetrics({
            shopify: rows,
            shopifyPrev: [],
            customerSettings,
            customerType,
            staticExpenses: staticExpenses || {},
            fetchCogs: customerSettings?.fetchCogsFromStore === true,
            cogsPercentage: staticExpenses?.cogsPercentage || 0,
            cost: 0,
            costPrev: 0,
            channelTotals,
            channelTotalsPrev: channelTotals,
            fixedCosts: 0,
            fixedCostsPrev: 0,
            customKpis: customKpis || [],
            daysInRange: Math.max(1, daysInRange),
            prevDaysInRange: 1,
        });
        return periodPrimarySalesRevenue(computed.metricsData);
    }

    const returnsOverride = getReturnsOverrideSettings(customerSettings);
    const curr = aggregateShopifyDailyRows(rows, returnsOverride, customerSettings);
    if (displaysTotalSalesWithoutVatDeduction(customerSettings)) {
        return Number(curr.totalSales) || 0;
    }
    return totalSalesExVatFromPeriodTotals(curr, customerType, customerSettings);
}
