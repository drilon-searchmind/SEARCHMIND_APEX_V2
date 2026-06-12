import { evaluateFormula } from "@/app/(protected)/dashboard/[customerId]/performance-dashboard/components/kpiFormulaUtils";
import { AD_SPEND_CHANNELS } from "@/lib/mergeAdSpendDaily";
import { applyVatDisplayToShopifyDayRow } from "@/lib/revenueVatDisplay";
import { calcBlendedPoas, calcBlendedPoasOrZero } from "@/lib/poasMetrics";

/** Standard metric keys replaced by a custom KPI → daily-overview row field. */
export const DAILY_OVERVIEW_REPLACEMENT_FIELDS = {
    revenue: "netRevenue",
    net_sales: "netRevenue",
    total_sales: "netRevenue",
    gross_sales: "netRevenue",
    orders: "orders",
    aov: "aov",
    cogs: "cogs",
    roas: "roas",
    poas: "poas",
};

const REVENUE_REPLACEMENT_PRIORITY = ["total_sales", "gross_sales", "net_sales", "revenue"];

export function getNetRevenueReplacementKpi(customKpis = []) {
    for (const key of REVENUE_REPLACEMENT_PRIORITY) {
        const kpi = customKpis.find((k) => k.replacesStandardMetricKey === key);
        if (kpi) return kpi;
    }
    return null;
}

/**
 * Store-reported Shopify day metrics for custom KPI formulas (no returns % override).
 */
export function buildShopifyDayFormulaMetrics(shopifyDay, channelMaps, ymd, customerSettings = {}) {
    const day = applyVatDisplayToShopifyDayRow(shopifyDay, customerSettings);
    const grossSales = Number(day.gross_sales) || 0;
    const discounts = Number(day.discounts) || 0;
    const returns = Number(day.returns) || 0;
    const netSales = Number(day.net_sales) || 0;
    const totalSales = Number(day.total_sales) || 0;
    const revenue = netSales || totalSales;
    const orders = Number(day.orders) || 0;

    /** @type {Record<string, number>} */
    const out = {
        total_sales: totalSales,
        revenue,
        net_sales: netSales,
        gross_sales: grossSales,
        discounts,
        returns,
        shipping_revenue: Number(day.shipping_charges) || 0,
        tax: Number(day.taxes) || 0,
        duties: Number(day.duties) || 0,
        additional_fees: Number(day.additional_fees) || 0,
        orders,
        cost: 0,
    };

    for (const c of AD_SPEND_CHANNELS) {
        const spend = Number(channelMaps[c.id]?.[ymd]) || 0;
        out[c.metricsDataKey] = spend;
        out.cost += spend;
    }

    const cost = out.cost;
    out.roas = cost > 0 ? revenue / cost : 0;
    out.poas = calcBlendedPoasOrZero(revenue - (out.cogs || 0), cost);
    out.aov = orders > 0 ? revenue / orders : 0;
    out.spendshare = revenue > 0 ? cost / revenue : 0;
    out.cac = orders > 0 ? cost / orders : 0;

    return out;
}

function recalcDailyResultMetrics(row, { customerSettings, staticExpenses, replacedKeys }) {
    const fetchCogs = customerSettings?.fetchCogsFromStore === true;
    const cogsPercentage = staticExpenses?.cogsPercentage || 0;
    const transactionCostPct = staticExpenses?.transactionCostPercentage ?? 0.015;
    const orders = row.orders;
    const netRevenue = row.netRevenue;
    const cost = row.totalMarketingSpend ?? 0;

    if (!replacedKeys.has("aov")) {
        row.aov = orders > 0 ? netRevenue / orders : null;
    }

    if (!replacedKeys.has("cogs") && !fetchCogs) {
        row.cogs = netRevenue * cogsPercentage;
    }

    const transactionFee = replacedKeys.has("transaction_fee")
        ? row.transactionFee
        : netRevenue * transactionCostPct;
    row.transactionFee = transactionFee;

    const allCosts =
        (row.cogs || 0) +
        (row.fixedExpense || 0) +
        (row.variableExpense || 0) +
        transactionFee +
        cost;

    if (!replacedKeys.has("poas") && !replacedKeys.has("gross_profit")) {
        row.netProfit = netRevenue - allCosts;
    }

    if (!replacedKeys.has("roas")) {
        row.roas = cost > 0 ? netRevenue / cost : null;
    }
    if (!replacedKeys.has("poas")) {
        const grossProfit = netRevenue - (row.cogs || 0);
        row.poas = calcBlendedPoas(grossProfit, cost);
    }
    if (!replacedKeys.has("spendshare")) {
        row.spendshare = netRevenue > 0 ? cost / netRevenue : null;
    }
}

/**
 * Apply custom KPI replacements to a single daily-overview row and recalc dependent metrics.
 */
export function applyCustomKpiReplacementsToDailyRow(
    row,
    formulaMetrics,
    customKpis = [],
    { customerSettings = {}, staticExpenses = {} } = {}
) {
    const active = (customKpis || []).filter((k) => k.replacesStandardMetricKey);
    if (!active.length) return row;

    const replacedKeys = new Set();

    const netRevenueKpi = getNetRevenueReplacementKpi(active);
    if (netRevenueKpi) {
        const value = evaluateFormula(netRevenueKpi, formulaMetrics);
        if (value != null && !Number.isNaN(value)) {
            row.netRevenue = Number(value);
            replacedKeys.add(netRevenueKpi.replacesStandardMetricKey);
        }
    }

    for (const kpi of active) {
        const key = kpi.replacesStandardMetricKey;
        const field = DAILY_OVERVIEW_REPLACEMENT_FIELDS[key];
        if (!field || field === "netRevenue") continue;

        const value = evaluateFormula(kpi, formulaMetrics);
        if (value == null || Number.isNaN(value)) continue;

        row[field] = Number(value);
        replacedKeys.add(key);
    }

    const affectsResults =
        replacedKeys.has("revenue") ||
        replacedKeys.has("net_sales") ||
        replacedKeys.has("total_sales") ||
        replacedKeys.has("gross_sales") ||
        replacedKeys.has("orders") ||
        replacedKeys.has("cogs") ||
        replacedKeys.has("transaction_fee");

    if (affectsResults) {
        recalcDailyResultMetrics(row, { customerSettings, staticExpenses, replacedKeys });
    }

    return row;
}

/** Rename daily-overview column headers when a custom KPI replaces that metric. */
export function applyCustomKpiLabelsToMetricColumns(metricColumns, customKpis = []) {
    const active = (customKpis || []).filter((k) => k.replacesStandardMetricKey);
    if (!active.length) return metricColumns;

    /** @type {Record<string, string>} */
    const labelByField = {};

    const netRevenueKpi = getNetRevenueReplacementKpi(active);
    if (netRevenueKpi) {
        labelByField.netRevenue = netRevenueKpi.name;
    }

    for (const kpi of active) {
        const field = DAILY_OVERVIEW_REPLACEMENT_FIELDS[kpi.replacesStandardMetricKey];
        if (!field || field === "netRevenue") continue;
        labelByField[field] = kpi.name;
    }

    return metricColumns.map((col) =>
        labelByField[col.key] ? { ...col, label: labelByField[col.key] } : col
    );
}
