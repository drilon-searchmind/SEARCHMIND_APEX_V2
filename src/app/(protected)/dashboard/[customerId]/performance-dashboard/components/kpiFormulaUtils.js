/**
 * Utilities for evaluating custom KPI formulas.
 * Supports both legacy format (metricA, metricB, operator) and new parts format.
 */

import { AD_SPEND_CHANNELS } from "@/lib/mergeAdSpendDaily";

export function toParts(kpi) {
    if (kpi.parts && Array.isArray(kpi.parts) && kpi.parts.length >= 1) {
        return kpi.parts;
    }
    if (kpi.metricA && kpi.metricB && kpi.operator) {
        return [
            { type: "metric", value: kpi.metricA },
            { type: "operator", value: kpi.operator },
            { type: "metric", value: kpi.metricB },
        ];
    }
    if (kpi.metricA) {
        return [{ type: "metric", value: kpi.metricA }];
    }
    return null;
}

/**
 * Evaluate formula on a data object (agg row or metricsData).
 * agg row keys: revenue, totalRevenue, orders, cost, cogs, returns
 * metricsData keys: total_sales, revenue, gross_profit, orders, returns, cost, roas, poas, aov, cac, spendshare
 */
function aggRowToMetrics(v) {
    if (!v) return {};
    const grossProfit = (v.revenue || 0) - (v.cogs || 0);
    const revenue = v.revenue ?? 0;
    const cost = v.cost ?? 0;
    const orders = v.orders ?? 0;
    const totalRevenue = v.totalRevenue ?? revenue;
    const grossSales = v.grossSales ?? totalRevenue;
    const discounts = v.discounts ?? 0;
    /** @type {Record<string, number>} */
    const out = {
        total_sales: totalRevenue,
        revenue,
        gross_sales: grossSales,
        discounts,
        gross_profit: grossProfit,
        orders,
        returns: v.returns ?? 0,
        cost,
        roas: cost > 0 ? revenue / cost : 0,
        poas: cost > 0 ? grossProfit / cost : 0,
        aov: orders > 0 ? revenue / orders : 0,
        cac: orders > 0 ? cost / orders : 0,
        spendshare: revenue > 0 ? cost / revenue : 0,
    };
    for (const c of AD_SPEND_CHANNELS) {
        const bk = c.bucketKey;
        out[c.metricsDataKey] = Number(v[bk] ?? 0);
    }
    return out;
}

export function evaluateFormula(kpi, data) {
    // data may be metricsData (has total_sales, revenue...) or agg row (has totalRevenue, revenue...)
    const metrics = data && "total_sales" in data ? data : aggRowToMetrics(data);
    const parts = toParts(kpi);
    if (!parts || parts.length === 0) {
        return null;
    }
    // Single metric: just return the value
    if (parts.length === 1 && parts[0].type === "metric") {
        return metrics[parts[0].value] ?? 0;
    }

    // Multi-part formula: evaluate left to right
    let result = metrics[parts[0]?.value] ?? 0;
    for (let i = 1; i < parts.length; i += 2) {
        const op = parts[i];
        const nextMetric = parts[i + 1];
        if (op?.type !== "operator" || nextMetric?.type !== "metric") break;
        const nextVal = metrics[nextMetric.value] ?? 0;
        result = applyOperator(result, nextVal, op.value);
        if (result === null) break;
    }
    return result;
}

function applyOperator(a, b, op) {
    switch (op) {
        case "/":
            return b !== 0 ? a / b : null;
        case "*":
            return a * b;
        case "+":
            return a + b;
        case "-":
            return a - b;
        default:
            return null;
    }
}

/** Get first metric key from KPI (for icon/format hints) */
export function getFirstMetricKey(kpi) {
    const parts = toParts(kpi);
    if (parts?.length) {
        const first = parts.find((p) => p.type === "metric");
        return first?.value || kpi.metricA;
    }
    return kpi.metricA;
}
