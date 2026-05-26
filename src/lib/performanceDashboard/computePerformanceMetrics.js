import { evaluateFormula } from "@/app/(protected)/dashboard/[customerId]/performance-dashboard/components/kpiFormulaUtils";
import { getReturnsOverrideSettings } from "./performanceDashboardConstants";

/**
 * Sum a numeric field across Shopify daily rows.
 */
function sumShopifyField(rows, field) {
    return (rows || []).reduce((sum, d) => sum + (Number(d[field]) || 0), 0);
}

function buildPeriodTotals(shopifyRows, returnsOverride) {
    const grossSales = sumShopifyField(shopifyRows, "gross_sales");
    const discounts = sumShopifyField(shopifyRows, "discounts");
    const orders = sumShopifyField(shopifyRows, "orders");
    const shippingCharges = sumShopifyField(shopifyRows, "shipping_charges");
    const taxes = sumShopifyField(shopifyRows, "taxes");
    const totalSales = sumShopifyField(shopifyRows, "total_sales");
    const cogsFromStore = sumShopifyField(shopifyRows, "cost_of_goods_sold");

    let returns = sumShopifyField(shopifyRows, "returns");
    let netRevenue = sumShopifyField(shopifyRows, "net_sales");

    if (returnsOverride?.enabled) {
        const pct = (returnsOverride.percent ?? 0) / 100;
        returns = grossSales * pct;
        netRevenue = grossSales - discounts - returns;
    }

    return {
        grossSales,
        discounts,
        returns,
        netRevenue,
        orders,
        shippingCharges,
        taxes,
        totalSales,
        cogsFromStore,
    };
}

/**
 * Build base metricsData object (before custom replacements) for formula evaluation.
 */
export function buildBaseMetricsData({
    curr,
    prev,
    cost,
    costPrev,
    channelTotals,
    channelTotalsPrev,
    staticExpenses,
    customerSettings,
    fetchCogs,
    cogsPercentage,
    fixedCosts,
    fixedCostsPrev,
    daysInRange,
    prevDaysInRange,
}) {
    const shippingCostPerOrder = staticExpenses.shippingCostPerOrder ?? 0;
    const pickNPackCostPerOrder = staticExpenses.pickNPackCostPerOrder ?? 0;
    const transactionCostPct = staticExpenses.transactionCostPercentage ?? 0.015;

    const totalCogs = fetchCogs
        ? curr.cogsFromStore
        : curr.netRevenue * cogsPercentage;
    const prevTotalCogs = fetchCogs
        ? prev.cogsFromStore
        : prev.netRevenue * cogsPercentage;

    const shippingCost = shippingCostPerOrder * curr.orders;
    const shippingCostPrev = shippingCostPerOrder * prev.orders;
    const pickPackCost = pickNPackCostPerOrder * curr.orders;
    const pickPackCostPrev = pickNPackCostPerOrder * prev.orders;
    const transactionFee = curr.netRevenue * transactionCostPct;
    const transactionFeePrev = prev.netRevenue * transactionCostPct;
    const variableCosts = shippingCost + pickPackCost;
    const variableCostsPrev = shippingCostPrev + pickPackCostPrev;
    const allCosts =
        totalCogs + fixedCosts + variableCosts + transactionFee + cost;
    const allCostsPrev =
        prevTotalCogs + fixedCostsPrev + variableCostsPrev + transactionFeePrev + costPrev;

    const aov = curr.orders > 0 ? curr.netRevenue / curr.orders : 0;
    const aovPrev = prev.orders > 0 ? prev.netRevenue / prev.orders : 0;
    const roas = cost > 0 ? curr.netRevenue / cost : 0;
    const roasPrev = costPrev > 0 ? prev.netRevenue / costPrev : 0;
    const grossProfit = curr.netRevenue - totalCogs;
    const grossProfitPrev = prev.netRevenue - prevTotalCogs;
    const ebit = curr.netRevenue - allCosts;
    const ebitPrev = prev.netRevenue - allCostsPrev;
    const poas = cost > 0 ? ebit / cost : 0;
    const poasPrev = costPrev > 0 ? ebitPrev / costPrev : 0;

    const metricsData = {
        total_sales: curr.totalSales,
        revenue: curr.netRevenue,
        gross_sales: curr.grossSales,
        discounts: curr.discounts,
        returns: curr.returns,
        orders: curr.orders,
        shipping_revenue: curr.shippingCharges,
        tax: curr.taxes,
        transaction_fee: transactionFee,
        gross_profit: grossProfit,
        total_expenses: allCosts,
        ebit,
        cost,
        marketing_spend: cost,
        roas,
        poas,
        aov,
        cac: 0,
        spendshare: curr.netRevenue > 0 ? cost / curr.netRevenue : 0,
        cogs: totalCogs,
        ebit_pct: curr.netRevenue > 0 ? (ebit / curr.netRevenue) * 100 : 0,
        fixed_costs: fixedCosts,
        variable_costs: variableCosts,
        shipping_cost: shippingCost,
        pick_pack: pickPackCost,
        ...channelTotals,
    };

    const metricsDataPrev = {
        ...metricsData,
        total_sales: prev.totalSales,
        revenue: prev.netRevenue,
        gross_sales: prev.grossSales,
        discounts: prev.discounts,
        returns: prev.returns,
        orders: prev.orders,
        shipping_revenue: prev.shippingCharges,
        tax: prev.taxes,
        transaction_fee: transactionFeePrev,
        gross_profit: grossProfitPrev,
        total_expenses: allCostsPrev,
        ebit: ebitPrev,
        cost: costPrev,
        marketing_spend: costPrev,
        roas: roasPrev,
        poas: poasPrev,
        aov: aovPrev,
        spendshare: prev.netRevenue > 0 ? costPrev / prev.netRevenue : 0,
        cogs: prevTotalCogs,
        ebit_pct: prev.netRevenue > 0 ? (ebitPrev / prev.netRevenue) * 100 : 0,
        fixed_costs: fixedCostsPrev,
        variable_costs: variableCostsPrev,
        shipping_cost: shippingCostPrev,
        pick_pack: pickPackCostPrev,
        ...channelTotalsPrev,
    };

    return {
        metricsData,
        metricsDataPrev,
        derived: {
            totalCogs,
            prevTotalCogs,
            shippingCost,
            shippingCostPrev,
            pickPackCost,
            pickPackCostPrev,
            transactionFee,
            transactionFeePrev,
            variableCosts,
            variableCostsPrev,
            allCosts,
            allCostsPrev,
            aov,
            aovPrev,
            roas,
            roasPrev,
            grossProfit,
            grossProfitPrev,
            ebit,
            ebitPrev,
            poas,
            poasPrev,
        },
        _meta: { daysInRange, prevDaysInRange, transactionCostPct, shippingCostPerOrder, pickNPackCostPerOrder },
    };
}

/**
 * Apply custom KPI replacements and recompute derived metrics that depend on replaced values.
 */
export function applyCustomKpiReplacements(base, customKpis = []) {
    const { metricsData, metricsDataPrev, derived, _meta } = base;
    const effective = { ...metricsData };
    const effectivePrev = { ...metricsDataPrev };
    const replacementByKey = {};

    for (const kpi of customKpis) {
        const key = kpi.replacesStandardMetricKey;
        if (!key) continue;
        const value = evaluateFormula(kpi, metricsData);
        const valuePrev = evaluateFormula(kpi, metricsDataPrev);
        if (value == null || Number.isNaN(value)) continue;
        replacementByKey[key] = {
            kpiId: kpi.id || kpi._id?.toString(),
            kpiName: kpi.name,
            value: Number(value),
            valuePrev: valuePrev != null && !Number.isNaN(valuePrev) ? Number(valuePrev) : null,
        };
        effective[key] = Number(value);
        if (replacementByKey[key].valuePrev != null) {
            effectivePrev[key] = replacementByKey[key].valuePrev;
        }
    }

    // Recompute net revenue when components change (unless revenue itself is replaced)
    if (!replacementByKey.revenue) {
        const gross = effective.gross_sales ?? metricsData.gross_sales;
        const disc = effective.discounts ?? metricsData.discounts;
        const ret = effective.returns ?? metricsData.returns;
        effective.revenue = gross - disc - ret;
        if (!replacementByKey.gross_sales && !replacementByKey.discounts && !replacementByKey.returns) {
            // keep prev in sync only when derived from same components
        } else {
            const grossP = effectivePrev.gross_sales ?? metricsDataPrev.gross_sales;
            const discP = effectivePrev.discounts ?? metricsDataPrev.discounts;
            const retP = effectivePrev.returns ?? metricsDataPrev.returns;
            effectivePrev.revenue = grossP - discP - retP;
        }
    }

    // Recompute AOV when orders or revenue change
    if (!replacementByKey.aov) {
        effective.aov =
            effective.orders > 0 ? effective.revenue / effective.orders : 0;
        effectivePrev.aov =
            effectivePrev.orders > 0
                ? effectivePrev.revenue / effectivePrev.orders
                : 0;
    }

    const transactionCostPct = _meta.transactionCostPct;
    const fetchCogs = derived._fetchCogs;
    const cogsPercentage = derived._cogsPercentage;

    let totalCogs = derived.totalCogs;
    let prevTotalCogs = derived.prevTotalCogs;
    if (!fetchCogs && (replacementByKey.revenue || replacementByKey.returns || replacementByKey.gross_sales || replacementByKey.discounts)) {
        totalCogs = effective.revenue * (cogsPercentage ?? 0);
        prevTotalCogs = effectivePrev.revenue * (cogsPercentage ?? 0);
    }
    effective.cogs = totalCogs;
    effectivePrev.cogs = prevTotalCogs;

    let transactionFee = effective.revenue * transactionCostPct;
    let transactionFeePrev = effectivePrev.revenue * transactionCostPct;
    if (replacementByKey.transaction_fee) {
        transactionFee = effective.transaction_fee;
        transactionFeePrev = effectivePrev.transaction_fee;
    } else {
        effective.transaction_fee = transactionFee;
        effectivePrev.transaction_fee = transactionFeePrev;
    }

    const shippingCost = effective.shipping_cost;
    const shippingCostPrev = effectivePrev.shipping_cost;
    const pickPackCost = effective.pick_pack;
    const pickPackCostPrev = effectivePrev.pick_pack;
    const variableCosts = shippingCost + pickPackCost;
    const variableCostsPrev = shippingCostPrev + pickPackCostPrev;
    const cost = effective.cost;
    const costPrev = effectivePrev.cost;
    const fixedCosts = effective.fixed_costs;
    const fixedCostsPrev = effectivePrev.fixed_costs;

    const allCosts =
        totalCogs + fixedCosts + variableCosts + transactionFee + cost;
    const allCostsPrev =
        prevTotalCogs + fixedCostsPrev + variableCostsPrev + transactionFeePrev + costPrev;

    effective.gross_profit = effective.revenue - totalCogs;
    effectivePrev.gross_profit = effectivePrev.revenue - prevTotalCogs;
    effective.total_expenses = allCosts;
    effectivePrev.total_expenses = allCostsPrev;
    effective.ebit = effective.revenue - allCosts;
    effectivePrev.ebit = effectivePrev.revenue - allCostsPrev;
    effective.roas = cost > 0 ? effective.revenue / cost : 0;
    effectivePrev.roas = costPrev > 0 ? effectivePrev.revenue / costPrev : 0;
    effective.poas = cost > 0 ? effective.ebit / cost : 0;
    effectivePrev.poas = costPrev > 0 ? effectivePrev.ebit / costPrev : 0;
    effective.ebit_pct =
        effective.revenue > 0 ? (effective.ebit / effective.revenue) * 100 : 0;
    effectivePrev.ebit_pct =
        effectivePrev.revenue > 0
            ? (effectivePrev.ebit / effectivePrev.revenue) * 100
            : 0;
    effective.spendshare =
        effective.revenue > 0 ? cost / effective.revenue : 0;
    effectivePrev.spendshare =
        effectivePrev.revenue > 0 ? costPrev / effectivePrev.revenue : 0;

    return {
        metricsData: effective,
        metricsDataPrev: effectivePrev,
        replacementByKey,
        derived: {
            ...derived,
            totalCogs,
            prevTotalCogs,
            transactionFee,
            transactionFeePrev,
            variableCosts,
            variableCostsPrev,
            allCosts,
            allCostsPrev,
            aov: effective.aov,
            aovPrev: effectivePrev.aov,
            roas: effective.roas,
            roasPrev: effectivePrev.roas,
            grossProfit: effective.gross_profit,
            grossProfitPrev: effectivePrev.gross_profit,
            ebit: effective.ebit,
            ebitPrev: effectivePrev.ebit,
            poas: effective.poas,
            poasPrev: effectivePrev.poas,
        },
    };
}

/**
 * Full pipeline: Shopify rows + settings → effective metrics for dashboard.
 */
export function computePerformanceDashboardMetrics({
    shopify,
    shopifyPrev,
    customerSettings,
    staticExpenses,
    fetchCogs,
    cogsPercentage,
    cost,
    costPrev,
    channelTotals,
    channelTotalsPrev,
    fixedCosts,
    fixedCostsPrev,
    customKpis = [],
    daysInRange,
    prevDaysInRange,
}) {
    const returnsOverride = getReturnsOverrideSettings(customerSettings);
    const curr = buildPeriodTotals(shopify, returnsOverride);
    const prev = buildPeriodTotals(shopifyPrev, returnsOverride);

    const base = buildBaseMetricsData({
        curr,
        prev,
        cost,
        costPrev,
        channelTotals,
        channelTotalsPrev,
        staticExpenses,
        customerSettings,
        fetchCogs,
        cogsPercentage,
        fixedCosts,
        fixedCostsPrev,
        daysInRange,
        prevDaysInRange,
    });
    base.derived._fetchCogs = fetchCogs;
    base.derived._cogsPercentage = cogsPercentage;

    const withReplacements = applyCustomKpiReplacements(base, customKpis);

    return {
        curr,
        prev,
        returnsOverride,
        ...withReplacements,
        raw: base,
    };
}

/** Per-day net revenue with optional returns override (for charts). */
export function netRevenueForShopifyDay(d, returnsOverride) {
    const gross = Number(d.gross_sales) || 0;
    const discounts = Number(d.discounts) || 0;
    if (returnsOverride?.enabled) {
        const pct = (returnsOverride.percent ?? 0) / 100;
        const returns = gross * pct;
        return gross - discounts - returns;
    }
    return Number(d.net_sales || d.total_sales || 0);
}
