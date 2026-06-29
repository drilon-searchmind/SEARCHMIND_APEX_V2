import { evaluateFormula } from "@/app/(protected)/dashboard/[customerId]/performance-dashboard/components/kpiFormulaUtils";
import { getReturnsOverrideSettings } from "./performanceDashboardConstants";
import {
    applyVatDisplayToShopifyDayRow,
    shopifyDayInclVatRevenue,
    usesShopifyNativeInclVat,
} from "@/lib/revenueVatDisplay";
import { totalSalesExVatFromPeriodTotals } from "@/lib/performanceDashboard/totalSalesExVat";
import { calcBlendedPoasOrZero } from "@/lib/poasMetrics";

/**
 * Sum a numeric field across Shopify daily rows.
 */
function sumShopifyField(rows, field) {
    return (rows || []).reduce((sum, d) => sum + (Number(d[field]) || 0), 0);
}

/**
 * Net revenue from gross sales, discounts, and returns.
 * ShopifyQL typically reports discounts/returns as negative; returns override uses a positive returns estimate.
 */
export function netRevenueFromGrossDiscountsReturns(grossSales, discounts, returns) {
    const gross = Number(grossSales) || 0;
    const disc = Number(discounts) || 0;
    const ret = Number(returns) || 0;
    const discountDeduction = disc < 0 ? -disc : disc;
    const returnDeduction = ret < 0 ? -ret : ret;
    return gross - discountDeduction - returnDeduction;
}

/** Positive magnitudes for display (e.g. formula popovers). */
export function shopifyDeductionMagnitudes(discounts, returns) {
    const disc = Number(discounts) || 0;
    const ret = Number(returns) || 0;
    return {
        discountDeduction: disc < 0 ? -disc : disc,
        returnDeduction: ret < 0 ? -ret : ret,
    };
}

function buildPeriodTotals(shopifyRows, returnsOverride, customerSettings) {
    const rows = (shopifyRows || []).map((d) =>
        applyVatDisplayToShopifyDayRow(d, customerSettings)
    );
    const grossSales = sumShopifyField(rows, "gross_sales");
    const discounts = sumShopifyField(rows, "discounts");
    const orders = sumShopifyField(rows, "orders");
    const shippingCharges = sumShopifyField(rows, "shipping_charges");
    const taxes = sumShopifyField(rows, "taxes");
    const totalSales = sumShopifyField(rows, "total_sales");
    const cogsFromStore = sumShopifyField(rows, "cost_of_goods_sold");

    const duties = sumShopifyField(rows, "duties");
    const additionalFees = sumShopifyField(rows, "additional_fees");
    const netSalesFromStore = sumShopifyField(rows, "net_sales");
    let returns = sumShopifyField(rows, "returns");
    let netRevenue = netSalesFromStore;

    if (returnsOverride?.enabled) {
        const pct = (returnsOverride.percent ?? 0) / 100;
        returns = grossSales * pct;
        netRevenue = netRevenueFromGrossDiscountsReturns(grossSales, discounts, returns);
    } else if (usesShopifyNativeInclVat(customerSettings)) {
        netRevenue =
            totalSales > 0 ? totalSales : netSalesFromStore + Math.abs(taxes);
    }

    return {
        grossSales,
        discounts,
        returns,
        netRevenue,
        netSalesFromStore,
        orders,
        shippingCharges,
        taxes,
        totalSales,
        duties,
        additionalFees,
        cogsFromStore,
    };
}

/** Period totals from Shopify daily rows (same logic as performance dashboard). */
export function aggregateShopifyDailyRows(shopifyRows, returnsOverride, customerSettings) {
    return buildPeriodTotals(shopifyRows, returnsOverride ?? null, customerSettings);
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
    customerType = "Shopify",
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
    const returnsCostPct = staticExpenses.returnsCostPercentage ?? 0;

    const totalSalesExVat = totalSalesExVatFromPeriodTotals(
        curr,
        customerType,
        customerSettings
    );
    const totalSalesExVatPrev = totalSalesExVatFromPeriodTotals(
        prev,
        customerType,
        customerSettings
    );

    const totalCogs = fetchCogs
        ? curr.cogsFromStore
        : totalSalesExVat * cogsPercentage;
    const prevTotalCogs = fetchCogs
        ? prev.cogsFromStore
        : totalSalesExVatPrev * cogsPercentage;

    const shippingCost = shippingCostPerOrder * curr.orders;
    const shippingCostPrev = shippingCostPerOrder * prev.orders;
    const pickPackCost = pickNPackCostPerOrder * curr.orders;
    const pickPackCostPrev = pickNPackCostPerOrder * prev.orders;
    const transactionFee = curr.netRevenue * transactionCostPct;
    const transactionFeePrev = prev.netRevenue * transactionCostPct;
    const { returnDeduction: returnDeductionCurr } = shopifyDeductionMagnitudes(
        curr.discounts,
        curr.returns
    );
    const { returnDeduction: returnDeductionPrev } = shopifyDeductionMagnitudes(
        prev.discounts,
        prev.returns
    );
    const returnsCost = returnDeductionCurr * returnsCostPct;
    const returnsCostPrev = returnDeductionPrev * returnsCostPct;
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
    const grossProfit = totalSalesExVat - totalCogs;
    const grossProfitPrev = totalSalesExVatPrev - prevTotalCogs;
    const costsBelowGrossProfit =
        fixedCosts + variableCosts + transactionFee + cost;
    const costsBelowGrossProfitPrev =
        fixedCostsPrev + variableCostsPrev + transactionFeePrev + costPrev;
    const ebit = grossProfit - costsBelowGrossProfit;
    const ebitPrev = grossProfitPrev - costsBelowGrossProfitPrev;
    const poas = calcBlendedPoasOrZero(grossProfit, cost);
    const poasPrev = calcBlendedPoasOrZero(grossProfitPrev, costPrev);

    const metricsData = {
        total_sales: curr.totalSales,
        revenue: curr.netRevenue,
        net_sales: curr.netSalesFromStore,
        gross_sales: curr.grossSales,
        discounts: curr.discounts,
        returns: curr.returns,
        orders: curr.orders,
        shipping_revenue: curr.shippingCharges,
        duties: curr.duties,
        additional_fees: curr.additionalFees,
        tax: curr.taxes,
        transaction_fee: transactionFee,
        gross_profit: grossProfit,
        total_sales_ex_vat: totalSalesExVat,
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
        ebit_pct: totalSalesExVat !== 0 ? (ebit / totalSalesExVat) * 100 : 0,
        fixed_costs: fixedCosts,
        variable_costs: variableCosts,
        shipping_cost: shippingCost,
        pick_pack: pickPackCost,
        returns_cost: returnsCost,
        ...channelTotals,
    };

    const metricsDataPrev = {
        ...metricsData,
        total_sales: prev.totalSales,
        revenue: prev.netRevenue,
        net_sales: prev.netSalesFromStore,
        gross_sales: prev.grossSales,
        discounts: prev.discounts,
        returns: prev.returns,
        orders: prev.orders,
        shipping_revenue: prev.shippingCharges,
        duties: prev.duties,
        additional_fees: prev.additionalFees,
        tax: prev.taxes,
        transaction_fee: transactionFeePrev,
        gross_profit: grossProfitPrev,
        total_sales_ex_vat: totalSalesExVatPrev,
        total_expenses: allCostsPrev,
        ebit: ebitPrev,
        cost: costPrev,
        marketing_spend: costPrev,
        roas: roasPrev,
        poas: poasPrev,
        aov: aovPrev,
        spendshare: prev.netRevenue > 0 ? costPrev / prev.netRevenue : 0,
        cogs: prevTotalCogs,
        ebit_pct: totalSalesExVatPrev !== 0 ? (ebitPrev / totalSalesExVatPrev) * 100 : 0,
        fixed_costs: fixedCostsPrev,
        variable_costs: variableCostsPrev,
        shipping_cost: shippingCostPrev,
        pick_pack: pickPackCostPrev,
        returns_cost: returnsCostPrev,
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
            returnsCost,
            returnsCostPrev,
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
        _meta: {
            daysInRange,
            prevDaysInRange,
            transactionCostPct,
            shippingCostPerOrder,
            pickNPackCostPerOrder,
            returnsCostPct,
        },
    };
}

/**
 * Apply custom KPI replacements and recompute derived metrics that depend on replaced values.
 * @param {object} base — from buildBaseMetricsData
 * @param {object[]} customKpis
 */
export function applyCustomKpiReplacements(
    base,
    customKpis = [],
    { formulaMetricsData, formulaMetricsDataPrev } = {}
) {
    const { metricsData, metricsDataPrev, derived, _meta } = base;
    const effective = { ...metricsData };
    const effectivePrev = { ...metricsDataPrev };
    const replacementByKey = {};
    const evalCurr = formulaMetricsData ?? metricsData;
    const evalPrev = formulaMetricsDataPrev ?? metricsDataPrev;

    for (const kpi of customKpis) {
        const key = kpi.replacesStandardMetricKey;
        if (!key) continue;
        const value = evaluateFormula(kpi, evalCurr);
        const valuePrev = evaluateFormula(kpi, evalPrev);
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

    // Recompute net revenue only when a component KPI was replaced (unless revenue itself is replaced)
    const componentsReplaced =
        replacementByKey.gross_sales ||
        replacementByKey.discounts ||
        replacementByKey.returns;
    if (!replacementByKey.revenue && componentsReplaced) {
        const gross = effective.gross_sales ?? metricsData.gross_sales;
        const disc = effective.discounts ?? metricsData.discounts;
        const ret = effective.returns ?? metricsData.returns;
        effective.revenue = netRevenueFromGrossDiscountsReturns(gross, disc, ret);
        const grossP = effectivePrev.gross_sales ?? metricsDataPrev.gross_sales;
        const discP = effectivePrev.discounts ?? metricsDataPrev.discounts;
        const retP = effectivePrev.returns ?? metricsDataPrev.returns;
        effectivePrev.revenue = netRevenueFromGrossDiscountsReturns(grossP, discP, retP);
    }

    // Custom total sales is already ex-VAT (or a bespoke formula); do not re-derive ex-VAT from tax.
    if (replacementByKey.total_sales) {
        effective.total_sales_ex_vat = Number(effective.total_sales) || 0;
        effectivePrev.total_sales_ex_vat = Number(effectivePrev.total_sales) || 0;
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
    const salesExVat = Number(effective.total_sales_ex_vat) || 0;
    const salesExVatPrev = Number(effectivePrev.total_sales_ex_vat) || 0;
    if (
        !fetchCogs &&
        (replacementByKey.total_sales_ex_vat ||
            replacementByKey.total_sales ||
            replacementByKey.tax ||
            replacementByKey.revenue ||
            replacementByKey.returns ||
            replacementByKey.gross_sales ||
            replacementByKey.discounts)
    ) {
        totalCogs = salesExVat * (cogsPercentage ?? 0);
        prevTotalCogs = salesExVatPrev * (cogsPercentage ?? 0);
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

    const grossProfitEffective = salesExVat - totalCogs;
    const grossProfitEffectivePrev = salesExVatPrev - prevTotalCogs;
    effective.gross_profit = grossProfitEffective;
    effectivePrev.gross_profit = grossProfitEffectivePrev;
    effective.total_expenses = allCosts;
    effectivePrev.total_expenses = allCostsPrev;
    const costsBelowGrossProfit =
        fixedCosts + variableCosts + transactionFee + cost;
    const costsBelowGrossProfitPrev =
        fixedCostsPrev + variableCostsPrev + transactionFeePrev + costPrev;
    effective.ebit = grossProfitEffective - costsBelowGrossProfit;
    effectivePrev.ebit = grossProfitEffectivePrev - costsBelowGrossProfitPrev;
    effective.roas = cost > 0 ? effective.revenue / cost : 0;
    effectivePrev.roas = costPrev > 0 ? effectivePrev.revenue / costPrev : 0;
    effective.poas = calcBlendedPoasOrZero(grossProfitEffective, cost);
    effectivePrev.poas = calcBlendedPoasOrZero(grossProfitEffectivePrev, costPrev);
    effective.ebit_pct =
        salesExVat !== 0 ? (effective.ebit / salesExVat) * 100 : 0;
    effectivePrev.ebit_pct =
        salesExVatPrev !== 0
            ? (effectivePrev.ebit / salesExVatPrev) * 100
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
    customerType = "Shopify",
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
    const curr = buildPeriodTotals(shopify, returnsOverride, customerSettings);
    const prev = buildPeriodTotals(shopifyPrev, returnsOverride, customerSettings);

    const base = buildBaseMetricsData({
        curr,
        prev,
        cost,
        costPrev,
        channelTotals,
        channelTotalsPrev,
        staticExpenses,
        customerSettings,
        customerType,
        fetchCogs,
        cogsPercentage,
        fixedCosts,
        fixedCostsPrev,
        daysInRange,
        prevDaysInRange,
    });
    base.derived._fetchCogs = fetchCogs;
    base.derived._cogsPercentage = cogsPercentage;

    /** Custom KPI tab + formula evaluation: store-reported Shopify (no returns % override). */
    const currStore = buildPeriodTotals(shopify, null, customerSettings);
    const prevStore = buildPeriodTotals(shopifyPrev, null, customerSettings);
    const baseForCustomKpis = buildBaseMetricsData({
        curr: currStore,
        prev: prevStore,
        cost,
        costPrev,
        channelTotals,
        channelTotalsPrev,
        staticExpenses,
        customerSettings,
        customerType,
        fetchCogs,
        cogsPercentage,
        fixedCosts,
        fixedCostsPrev,
        daysInRange,
        prevDaysInRange,
    });
    const withReplacements = applyCustomKpiReplacements(base, customKpis, {
        formulaMetricsData: baseForCustomKpis.metricsData,
        formulaMetricsDataPrev: baseForCustomKpis.metricsDataPrev,
    });

    return {
        curr,
        prev,
        returnsOverride,
        ...withReplacements,
        metricsDataForCustomKpis: baseForCustomKpis.metricsData,
        metricsDataPrevForCustomKpis: baseForCustomKpis.metricsDataPrev,
        raw: base,
    };
}

/** Per-day net revenue with optional returns override (for charts). */
export function netRevenueForShopifyDay(d, returnsOverride, customerSettings) {
    const day = applyVatDisplayToShopifyDayRow(d, customerSettings);
    const gross = Number(day.gross_sales) || 0;
    const discounts = Number(day.discounts) || 0;
    if (returnsOverride?.enabled) {
        const pct = (returnsOverride.percent ?? 0) / 100;
        const returns = gross * pct;
        return netRevenueFromGrossDiscountsReturns(gross, discounts, returns);
    }
    if (usesShopifyNativeInclVat(customerSettings)) {
        return shopifyDayInclVatRevenue(day);
    }
    return Number(day.net_sales || day.total_sales || 0);
}

/**
 * Revenue for a Shopify daily row using customer revenue type preference.
 * When returns override is enabled, always uses adjusted net revenue (matches performance dashboard).
 */
export function shopifyDayRevenueByType(d, revenueType, returnsOverride, customerSettings) {
    if (returnsOverride?.enabled) {
        return netRevenueForShopifyDay(d, returnsOverride, customerSettings);
    }
    const day = applyVatDisplayToShopifyDayRow(d, customerSettings);
    if (usesShopifyNativeInclVat(customerSettings)) {
        return shopifyDayInclVatRevenue(day, revenueType);
    }
    const type = revenueType || "net_sales";
    if (type === "gross_sales") return Number(day.gross_sales) || 0;
    if (type === "total_sales") return Number(day.total_sales) || 0;
    return Number(day.net_sales || day.total_sales || 0);
}
