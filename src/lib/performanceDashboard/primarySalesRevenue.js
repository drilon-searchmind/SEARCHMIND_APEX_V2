import { evaluateFormula } from "@/app/(protected)/dashboard/[customerId]/performance-dashboard/components/kpiFormulaUtils";
import { channelDailyRowsFromMerged } from "@/lib/mergeAdSpendDaily";
import {
    applyVatDisplayToShopifyDayRow,
    displaysTotalSalesWithoutVatDeduction,
    totalSalesVatLabel,
} from "@/lib/revenueVatDisplay";
import { buildShopifyDayFormulaMetrics } from "@/lib/performanceDashboard/dailyOverviewCustomKpis";
import { computeTotalSalesExVat } from "@/lib/performanceDashboard/totalSalesExVat";

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
