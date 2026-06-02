import React from "react";
import { shopifyDeductionMagnitudes } from "@/lib/performanceDashboard/computePerformanceMetrics";
import {
    enrichOverviewDerivedMetrics,
    buildOverviewDerivedMetricCards,
} from "@/lib/performanceDashboard/enrichOverviewDerivedMetrics";
import {
    FiDollarSign,
    FiTrendingUp,
    FiTrendingDown,
    FiShoppingCart,
    FiCreditCard,
    FiBarChart2,
    FiPieChart,
    FiShoppingBag,
    FiUserCheck,
} from "react-icons/fi";

function percentChange(current, prev) {
    if (prev === 0 || prev === null || prev === undefined) return null;
    return ((current - prev) / Math.abs(prev)) * 100;
}
function changeType(val) {
    if (val === null) return undefined;
    return val > 0 ? "up" : val < 0 ? "down" : undefined;
}
function formatDiff(current, prev, type) {
    if (prev === null || prev === undefined) return undefined;
    const diff = (current ?? 0) - (prev ?? 0);
    if (type === "currency") {
        return diff >= 0
            ? `+${diff.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 })}`
            : diff.toLocaleString("da-DK", {
                  style: "currency",
                  currency: "DKK",
                  maximumFractionDigits: 0,
              });
    }
    if (type === "count") return diff >= 0 ? `+${diff}` : `${diff}`;
    if (type === "ratio") return diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
    if (type === "pct") return diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
    return undefined;
}

const fmt = (n, d = 0) =>
    (n ?? 0).toLocaleString("da-DK", { maximumFractionDigits: d });
const fmtCur = (n) =>
    n != null && n !== 0
        ? n.toLocaleString("da-DK", {
              style: "currency",
              currency: "DKK",
              maximumFractionDigits: 0,
          })
        : "-";

/**
 * Build MetricCard config array + apply custom KPI replacement display overrides.
 */
export function buildPerformanceMetricsCards({
    metricsData,
    metricsDataPrev,
    derived,
    curr,
    prev,
    returnsOverride,
    replacementByKey,
    fetchCogs,
    cogsPercentage,
    visibleAdSpendChannels,
    chTotals,
    chTotalsPrev,
    merged,
    mergedPrev,
    staticExp,
    daysInRange,
    rangeStart,
    rangeEnd,
    prevRangeStart,
    prevRangeEnd,
    customerType = "Shopify",
}) {
    const {
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
    } = derived;

    const netRevenue = metricsData.revenue;
    const netRevenuePrev = metricsDataPrev.revenue;
    const netSales = metricsData.net_sales;
    const netSalesPrev = metricsDataPrev.net_sales;
    const duties = metricsData.duties;
    const dutiesPrev = metricsDataPrev.duties;
    const additionalFees = metricsData.additional_fees;
    const additionalFeesPrev = metricsDataPrev.additional_fees;
    const orders = metricsData.orders;
    const ordersPrev = metricsDataPrev.orders;
    const returns = metricsData.returns;
    const returnsPrev = metricsDataPrev.returns;
    const grossSales = metricsData.gross_sales;
    const grossSalesPrev = metricsDataPrev.gross_sales;
    const discounts = metricsData.discounts;
    const discountsPrev = metricsDataPrev.discounts;
    const totalSales = metricsData.total_sales;
    const totalSalesPrev = metricsDataPrev.total_sales;
    const shippingCharges = metricsData.shipping_revenue;
    const shippingChargesPrev = metricsDataPrev.shipping_revenue;
    const taxes = metricsData.tax;
    const taxesPrev = metricsDataPrev.tax;
    const cost = metricsData.cost;
    const costPrev = metricsDataPrev.cost;
    const metaSpend = chTotals.meta_spend;
    const metaSpendPrev = chTotalsPrev.meta_spend;
    const googleSpend = chTotals.google_spend;
    const googleSpendPrev = chTotalsPrev.google_spend;
    const ebitPct = metricsData.ebit_pct;
    const ebitPctPrev = metricsDataPrev.ebit_pct;
    const transactionCostPct = staticExp.transactionCostPercentage ?? 0.015;
    const shippingCostPerOrder = staticExp.shippingCostPerOrder ?? 0;
    const pickNPackCostPerOrder = staticExp.pickNPackCostPerOrder ?? 0;
    const fixedExpensesMonthly = Number(staticExp.fixedExpenses) || 0;

    const cac = merged.CACTotalSales ?? null;
    const cacPrev = mergedPrev.CACTotalSales ?? null;
    const grossProfitCalculation = merged.calculationsData?.grossProfitCalculation || "";
    const totalAdspendCalculation = merged.calculationsData?.totalAdspendCalculation || "";
    const apiValueLabels = merged.calculationsData?.valueLabels || {};

    const roasCalculation = `Net Revenue / Cost \n
                    = ${fmt(netRevenue)} / ${fmt(cost)} \n
                    = ${roas !== null ? roas.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "N/A"}
                `;
    const poasCalculation =
        cost > 0
            ? `(Net Profit / Spend) \n
                    = ${fmt(ebit)} / ${fmt(cost)} \n
                    = ${cost > 0 && ebit !== null ? (ebit / cost).toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "N/A"}
                `
            : merged.calculationsData?.poasCalculation || "";
    const cacCalculation = merged.calculationsData?.cacCalculation || "";

    const returnsPopOver = returnsOverride?.enabled
        ? `Returns = Gross sales × ${returnsOverride.percent}%\n= ${fmt(grossSales)} × ${returnsOverride.percent}%\n= ${fmt(returns)}`
        : null;

    const metricsArray = [
        {
            key: "orders",
            label: "Orders",
            value: orders != null ? orders.toLocaleString("da-DK", { maximumFractionDigits: 0 }) : "-",
            icon: <FiShoppingCart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(orders, ordersPrev) !== null ? Math.abs(percentChange(orders, ordersPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(orders, ordersPrev)),
            changeAbsolute: formatDiff(orders, ordersPrev, "count"),
            changePrevValue: ordersPrev != null ? ordersPrev.toLocaleString("da-DK", { maximumFractionDigits: 0 }) : undefined,
            popOverContent: null,
        },
        {
            key: "total_sales",
            label: "Total Sales",
            value: fmtCur(totalSales),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(totalSales, totalSalesPrev) !== null ? Math.abs(percentChange(totalSales, totalSalesPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(totalSales, totalSalesPrev)),
            changeAbsolute: formatDiff(totalSales, totalSalesPrev, "currency"),
            changePrevValue: fmtCur(totalSalesPrev),
            popOverContent: null,
        },
        {
            key: "gross_sales",
            label: "Gross Sales",
            value: fmtCur(grossSales),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(grossSales, grossSalesPrev) !== null ? Math.abs(percentChange(grossSales, grossSalesPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(grossSales, grossSalesPrev)),
            changeAbsolute: formatDiff(grossSales, grossSalesPrev, "currency"),
            changePrevValue: fmtCur(grossSalesPrev),
            popOverContent: null,
        },
        {
            key: "discounts",
            label: "Discount",
            value: fmtCur(discounts),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(discounts, discountsPrev) !== null ? Math.abs(percentChange(discounts, discountsPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(discounts, discountsPrev)),
            changeAbsolute: formatDiff(discounts, discountsPrev, "currency"),
            changePrevValue: fmtCur(discountsPrev),
            popOverContent: null,
        },
        {
            key: "revenue",
            label: "Net Revenue",
            value: fmtCur(netRevenue),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(netRevenue, netRevenuePrev) !== null ? Math.abs(percentChange(netRevenue, netRevenuePrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(netRevenue, netRevenuePrev)),
            changeAbsolute: formatDiff(netRevenue, netRevenuePrev, "currency"),
            changePrevValue: fmtCur(netRevenuePrev),
            tooltip: "Net sales (after discounts, returns, etc.)",
            popOverContent: (() => {
                const { discountDeduction, returnDeduction } = shopifyDeductionMagnitudes(
                    discounts,
                    returns
                );
                const deductions = discountDeduction + returnDeduction;
                return `Net sales = Gross sales - Discounts - Returns\n= ${fmt(grossSales)} - ${fmt(discountDeduction)} - ${fmt(returnDeduction)}\n= ${fmt(grossSales)} - ${fmt(deductions)}\n= ${fmt(netRevenue)}`;
            })(),
            calcValueLabels: `Gross sales: ${fmt(grossSales)}\nDiscounts: ${fmt(discounts)}\nReturns: ${fmt(returns)}`,
        },
        {
            key: "net_sales",
            label: "Net Sales",
            value: fmtCur(netSales),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(netSales, netSalesPrev) !== null ? Math.abs(percentChange(netSales, netSalesPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(netSales, netSalesPrev)),
            changeAbsolute: formatDiff(netSales, netSalesPrev, "currency"),
            changePrevValue: fmtCur(netSalesPrev),
            tooltip: "Shopify net sales from store (not adjusted by returns % override)",
            popOverContent: null,
        },
        {
            key: "duties",
            label: "Duties",
            value: fmtCur(duties),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(duties, dutiesPrev) !== null ? Math.abs(percentChange(duties, dutiesPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(duties, dutiesPrev)),
            changeAbsolute: formatDiff(duties, dutiesPrev, "currency"),
            changePrevValue: fmtCur(dutiesPrev),
            popOverContent: null,
        },
        {
            key: "additional_fees",
            label: "Additional Fees",
            value: fmtCur(additionalFees),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(additionalFees, additionalFeesPrev) !== null ? Math.abs(percentChange(additionalFees, additionalFeesPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(additionalFees, additionalFeesPrev)),
            changeAbsolute: formatDiff(additionalFees, additionalFeesPrev, "currency"),
            changePrevValue: fmtCur(additionalFeesPrev),
            popOverContent: null,
        },
        {
            key: "cogs",
            label: "- COGS",
            value: fmtCur(totalCogs),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(totalCogs, prevTotalCogs) !== null ? Math.abs(percentChange(totalCogs, prevTotalCogs)).toFixed(0) : undefined,
            changeType: changeType(percentChange(totalCogs, prevTotalCogs)),
            changeAbsolute: formatDiff(totalCogs, prevTotalCogs, "currency"),
            changePrevValue: fmtCur(prevTotalCogs),
            popOverContent: fetchCogs
                ? `COGS (from Shopify store)\n= Sum of cost_of_goods_sold per day\n= ${fmt(totalCogs)}`
                : `COGS = Net Revenue × COGS %\n= ${fmt(netRevenue)} × ${(cogsPercentage * 100).toFixed(1)}%\n= ${fmt(totalCogs)}`,
            calcValueLabels: fetchCogs
                ? `Cost of goods sold (from Shopify): ${fmt(totalCogs)}`
                : `Net Revenue: ${fmt(netRevenue)}\nCOGS %: ${(cogsPercentage * 100).toFixed(1)}%`,
        },
        {
            key: "aov",
            label: "NET AOV",
            value: aov != null ? fmtCur(aov) : "-",
            icon: <FiShoppingBag className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(aov, aovPrev) !== null ? Math.abs(percentChange(aov, aovPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(aov, aovPrev)),
            changeAbsolute: formatDiff(aov, aovPrev, "currency"),
            changePrevValue: aovPrev != null ? fmtCur(aovPrev) : undefined,
            popOverContent: orders > 0 ? `Net AOV = Net Revenue / Orders\n= ${fmt(netRevenue)} / ${orders}\n= ${fmt(aov)}` : null,
            calcValueLabels: `Net Revenue: ${fmt(netRevenue)}\nOrders: ${orders}`,
        },
        {
            key: "cost",
            label: "Spend",
            value: fmtCur(cost),
            icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(cost, costPrev) !== null ? Math.abs(percentChange(cost, costPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(cost, costPrev)),
            changeAbsolute: formatDiff(cost, costPrev, "currency"),
            changePrevValue: fmtCur(costPrev),
            popOverContent: totalAdspendCalculation,
            calcValueLabels: apiValueLabels.spend,
        },
        {
            key: "marketing_spend",
            label: "Marketing Spend",
            value: fmtCur(cost),
            icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(cost, costPrev) !== null ? Math.abs(percentChange(cost, costPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(cost, costPrev)),
            changeAbsolute: formatDiff(cost, costPrev, "currency"),
            changePrevValue: fmtCur(costPrev),
            popOverContent: totalAdspendCalculation,
            calcValueLabels: apiValueLabels.spend,
        },
        ...visibleAdSpendChannels
            .filter((c) => c.id === "facebook")
            .map(() => ({
                key: "meta_spend",
                label: "- Meta Spend",
                value: fmtCur(metaSpend),
                icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                change: percentChange(metaSpend, metaSpendPrev) !== null ? Math.abs(percentChange(metaSpend, metaSpendPrev)).toFixed(0) : undefined,
                changeType: changeType(percentChange(metaSpend, metaSpendPrev)),
                changeAbsolute: formatDiff(metaSpend, metaSpendPrev, "currency"),
                changePrevValue: fmtCur(metaSpendPrev),
                popOverContent: null,
            })),
        ...visibleAdSpendChannels
            .filter((c) => c.id === "google")
            .map(() => ({
                key: "google_spend",
                label: "- Google Ads Spend",
                value: fmtCur(googleSpend),
                icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                change: percentChange(googleSpend, googleSpendPrev) !== null ? Math.abs(percentChange(googleSpend, googleSpendPrev)).toFixed(0) : undefined,
                changeType: changeType(percentChange(googleSpend, googleSpendPrev)),
                changeAbsolute: formatDiff(googleSpend, googleSpendPrev, "currency"),
                changePrevValue: fmtCur(googleSpendPrev),
                popOverContent: null,
            })),
        ...visibleAdSpendChannels
            .filter((c) => c.id !== "facebook" && c.id !== "google")
            .map((spec) => {
                const cur = chTotals[spec.metricsDataKey];
                const prevSpend = chTotalsPrev[spec.metricsDataKey];
                return {
                    key: spec.metricsDataKey,
                    label: `- ${spec.label}`,
                    value: fmtCur(cur),
                    icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
                    change: percentChange(cur, prevSpend) !== null ? Math.abs(percentChange(cur, prevSpend)).toFixed(0) : undefined,
                    changeType: changeType(percentChange(cur, prevSpend)),
                    changeAbsolute: formatDiff(cur, prevSpend, "currency"),
                    changePrevValue: fmtCur(prevSpend),
                    popOverContent: null,
                };
            }),
        {
            key: "shipping_cost",
            label: "- Shipping Cost",
            value: fmtCur(shippingCost),
            icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(shippingCost, shippingCostPrev) !== null ? Math.abs(percentChange(shippingCost, shippingCostPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(shippingCost, shippingCostPrev)),
            changeAbsolute: formatDiff(shippingCost, shippingCostPrev, "currency"),
            changePrevValue: fmtCur(shippingCostPrev),
            popOverContent: `Shipping Cost = Shipping per order × Orders\n= ${fmt(shippingCostPerOrder)} × ${orders}\n= ${fmt(shippingCost)}`,
            calcValueLabels: `Shipping per order: ${fmt(shippingCostPerOrder)}\nOrders: ${orders}`,
        },
        {
            key: "pick_pack",
            label: "- Pick & Pack",
            value: fmtCur(pickPackCost),
            icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(pickPackCost, pickPackCostPrev) !== null ? Math.abs(percentChange(pickPackCost, pickPackCostPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(pickPackCost, pickPackCostPrev)),
            changeAbsolute: formatDiff(pickPackCost, pickPackCostPrev, "currency"),
            changePrevValue: fmtCur(pickPackCostPrev),
            popOverContent: `Pick & Pack = Pick & pack per order × Orders\n= ${fmt(pickNPackCostPerOrder)} × ${orders}\n= ${fmt(pickPackCost)}`,
            calcValueLabels: `Pick & pack per order: ${fmt(pickNPackCostPerOrder)}\nOrders: ${orders}`,
        },
        {
            key: "total_expenses",
            label: "Total Expenses",
            value: fmtCur(allCosts),
            icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(allCosts, allCostsPrev) !== null ? Math.abs(percentChange(allCosts, allCostsPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(allCosts, allCostsPrev)),
            changeAbsolute: formatDiff(allCosts, allCostsPrev, "currency"),
            changePrevValue: fmtCur(allCostsPrev),
            popOverContent: `Total Expenses = COGS + Marketing + Variable + Fixed + Transaction Fee\n= ${fmt(totalCogs)} + ${fmt(cost)} + ${fmt(variableCosts)} + ${fmt(metricsData.fixed_costs)} + ${fmt(transactionFee)}\n= ${fmt(allCosts)}`,
            calcValueLabels: `COGS: ${fmt(totalCogs)}\nMarketing Spend: ${fmt(cost)}\nVariable Expenses: ${fmt(variableCosts)}\nFixed Expenses: ${fmt(metricsData.fixed_costs)}\nTransaction Fee: ${fmt(transactionFee)}`,
        },
        {
            key: "roas",
            label: "Blended ROAS",
            value: roas != null ? roas.toFixed(2) : "-",
            icon: <FiBarChart2 className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(roas, roasPrev) !== null ? Math.abs(percentChange(roas, roasPrev)).toFixed(1) : undefined,
            changeType: changeType(percentChange(roas, roasPrev)),
            changeAbsolute: formatDiff(roas, roasPrev, "ratio"),
            changePrevValue: roasPrev != null ? roasPrev.toFixed(2) : undefined,
            popOverContent: roasCalculation,
            calcValueLabels: `Net Revenue: ${fmt(netRevenue)}\nSpend: ${fmt(cost)}`,
        },
        {
            key: "variable_costs",
            label: "Variable Expenses",
            value: fmtCur(variableCosts),
            icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(variableCosts, variableCostsPrev) !== null ? Math.abs(percentChange(variableCosts, variableCostsPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(variableCosts, variableCostsPrev)),
            changeAbsolute: formatDiff(variableCosts, variableCostsPrev, "currency"),
            changePrevValue: fmtCur(variableCostsPrev),
            popOverContent: `Variable Spend (scale with volume):\n(shipping + pick & pack) × orders\n= (${fmt(shippingCostPerOrder)} + ${fmt(pickNPackCostPerOrder)}) × ${orders}\n= ${fmt(variableCosts)}`,
            calcValueLabels: `Shipping per order: ${fmt(shippingCostPerOrder)}\nPick & pack per order: ${fmt(pickNPackCostPerOrder)}\nOrders: ${orders}`,
        },
        {
            key: "fixed_costs",
            label: "Fixed Expenses",
            value: fmtCur(metricsData.fixed_costs),
            icon: <FiCreditCard className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(metricsData.fixed_costs, metricsDataPrev.fixed_costs) !== null ? Math.abs(percentChange(metricsData.fixed_costs, metricsDataPrev.fixed_costs)).toFixed(0) : undefined,
            changeType: changeType(percentChange(metricsData.fixed_costs, metricsDataPrev.fixed_costs)),
            changeAbsolute: formatDiff(metricsData.fixed_costs, metricsDataPrev.fixed_costs, "currency"),
            changePrevValue: fmtCur(metricsDataPrev.fixed_costs),
            popOverContent: `Fixed Spend (prorated for period):\nfixedExpenses (monthly) × sum over each day of (1 / days in that month)\n= ${fmt(fixedExpensesMonthly)} prorated over ${daysInRange} days\n= ${fmt(metricsData.fixed_costs)}`,
            calcValueLabels: `Fixed expenses (monthly): ${fmt(fixedExpensesMonthly)}\nDays in range: ${daysInRange}`,
        },
        {
            key: "poas",
            label: "Blended POAS",
            value: poas != null ? poas.toFixed(2) : "-",
            icon: <FiPieChart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(poas, poasPrev) !== null ? Math.abs(percentChange(poas, poasPrev)).toFixed(1) : undefined,
            changeType: changeType(percentChange(poas, poasPrev)),
            changeAbsolute: formatDiff(poas, poasPrev, "ratio"),
            changePrevValue: poasPrev != null ? poasPrev.toFixed(2) : undefined,
            popOverContent: poasCalculation,
            calcValueLabels: `Net Profit: ${fmt(ebit)}\nSpend: ${fmt(cost)}`,
        },
        {
            key: "gross_profit",
            label: "Gross Profit",
            value: fmtCur(grossProfit),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(grossProfit, grossProfitPrev) !== null ? Math.abs(percentChange(grossProfit, grossProfitPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(grossProfit, grossProfitPrev)),
            changeAbsolute: formatDiff(grossProfit, grossProfitPrev, "currency"),
            changePrevValue: fmtCur(grossProfitPrev),
            tooltip: "Net Revenue - COGS",
            popOverContent: grossProfitCalculation,
            calcValueLabels: apiValueLabels.grossProfit,
        },
        {
            key: "returns",
            label: "Returns",
            value: fmtCur(returns),
            icon: <FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(returns, returnsPrev) !== null ? Math.abs(percentChange(returns, returnsPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(returns, returnsPrev)),
            changeAbsolute: formatDiff(returns, returnsPrev, "currency"),
            changePrevValue: fmtCur(returnsPrev),
            popOverContent: returnsPopOver,
            returnsOverrideActive: returnsOverride?.enabled === true,
        },
        {
            key: "shipping_revenue",
            label: "Shipping Charges",
            value: fmtCur(shippingCharges),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(shippingCharges, shippingChargesPrev) !== null ? Math.abs(percentChange(shippingCharges, shippingChargesPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(shippingCharges, shippingChargesPrev)),
            changeAbsolute: formatDiff(shippingCharges, shippingChargesPrev, "currency"),
            changePrevValue: fmtCur(shippingChargesPrev),
            popOverContent: null,
        },
        {
            key: "transaction_fee",
            label: "Transaction Fee",
            value: fmtCur(transactionFee),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(transactionFee, transactionFeePrev) !== null ? Math.abs(percentChange(transactionFee, transactionFeePrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(transactionFee, transactionFeePrev)),
            changeAbsolute: formatDiff(transactionFee, transactionFeePrev, "currency"),
            changePrevValue: fmtCur(transactionFeePrev),
            popOverContent: `Transaction Fee = Net Revenue × ${(transactionCostPct * 100).toFixed(2)}%\n= ${fmt(netRevenue)} × ${(transactionCostPct * 100).toFixed(2)}%\n= ${fmt(transactionFee)}`,
            calcValueLabels: `Net Revenue: ${fmt(netRevenue)}\nTransaction %: ${(transactionCostPct * 100).toFixed(2)}%`,
        },
        {
            key: "tax",
            label: "Taxes",
            value: fmtCur(taxes),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(taxes, taxesPrev) !== null ? Math.abs(percentChange(taxes, taxesPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(taxes, taxesPrev)),
            changeAbsolute: formatDiff(taxes, taxesPrev, "currency"),
            changePrevValue: fmtCur(taxesPrev),
            popOverContent: null,
        },
        {
            key: "ebit",
            label: "Net Profit",
            value: ebit != null ? fmtCur(ebit) : "-",
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(ebit, ebitPrev) !== null ? Math.abs(percentChange(ebit, ebitPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(ebit, ebitPrev)),
            changeAbsolute: formatDiff(ebit, ebitPrev, "currency"),
            changePrevValue: fmtCur(ebitPrev),
            popOverContent: `Net Profit = Net Revenue - All Spend\n= ${fmt(netRevenue)} - ${fmt(allCosts)}\n= ${fmt(ebit)}`,
            calcValueLabels: `Net Revenue: ${fmt(netRevenue)}\nAll Spend (COGS + Fixed + Variable + Transaction Fee + Spend): ${fmt(allCosts)}`,
        },
        {
            key: "ebit_pct",
            label: "EBIT%",
            value: ebitPct != null ? `${ebitPct.toFixed(1)}%` : "-",
            icon: <FiPieChart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(ebitPct, ebitPctPrev) !== null ? Math.abs(percentChange(ebitPct, ebitPctPrev)).toFixed(1) : undefined,
            changeType: changeType(percentChange(ebitPct, ebitPctPrev)),
            changeAbsolute: formatDiff(ebitPct, ebitPctPrev, "pct"),
            changePrevValue: ebitPctPrev != null ? `${ebitPctPrev.toFixed(1)}%` : undefined,
            popOverContent: `EBIT = Net Revenue - All Spend\n= ${fmt(netRevenue)} - ${fmt(allCosts)}\n= ${fmt(ebit)}\nEBIT% = (EBIT / Net Revenue) × 100\n= (${fmt(ebit)} / ${fmt(netRevenue)}) × 100\n= ${ebitPct != null ? ebitPct.toFixed(1) : "N/A"}%`,
            calcValueLabels: `Net Revenue: ${fmt(netRevenue)}\nAll Spend (COGS + Fixed + Variable + Transaction Fee + Spend): ${fmt(allCosts)}`,
        },
        {
            key: "cac",
            label: "Blended CAC",
            value: cac != null ? fmtCur(cac) : "-",
            icon: <FiUserCheck className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: percentChange(cac, cacPrev) !== null ? Math.abs(percentChange(cac, cacPrev)).toFixed(0) : undefined,
            changeType: changeType(percentChange(cac, cacPrev)),
            changeAbsolute: formatDiff(cac, cacPrev, "currency"),
            changePrevValue: cacPrev != null ? fmtCur(cacPrev) : undefined,
            popOverContent: cacCalculation,
            calcValueLabels: apiValueLabels.cac,
        },
    ];

    const { fixedLineItems } = enrichOverviewDerivedMetrics({
        metricsData,
        metricsDataPrev,
        derived,
        staticExp,
        rangeStart,
        rangeEnd,
        prevRangeStart,
        prevRangeEnd,
        customerType,
    });
    const derivedCards = buildOverviewDerivedMetricCards(
        metricsData,
        metricsDataPrev,
        fixedLineItems
    );
    const metricsWithDerived = [...metricsArray, ...derivedCards];

    const withReplacements = metricsWithDerived.map((m) => {
        const rep = replacementByKey?.[m.key];
        if (!rep) return m;
        const pct =
            rep.valuePrev != null && rep.valuePrev !== 0
                ? percentChange(rep.value, rep.valuePrev)
                : null;
        const isRatio = ["roas", "poas", "spendshare", "ebit_pct"].includes(m.key);
        const isPctDerived = [
            "discount_pct_gross",
            "refunds_rate",
            "cogs_pct_total_sales",
            "shipping_cost_pct_total_sales",
            "ad_spend_pct_total_sales",
        ].includes(m.key);
        const isCount = m.key === "orders";
        return {
            ...m,
            label: rep.kpiName,
            value: isRatio
                ? rep.value.toFixed(2)
                : isPctDerived
                  ? `${rep.value.toLocaleString("da-DK", { maximumFractionDigits: 2 })} %`
                  : isCount
                    ? rep.value.toLocaleString("da-DK", { maximumFractionDigits: 0 })
                    : fmtCur(rep.value),
            change: pct !== null ? Math.abs(pct).toFixed(isRatio || isPctDerived ? 1 : 0) : undefined,
            changeType: changeType(pct),
            changeAbsolute: formatDiff(
                rep.value,
                rep.valuePrev,
                isRatio ? "ratio" : isCount ? "count" : "currency"
            ),
            changePrevValue: isRatio
                ? rep.valuePrev?.toFixed(2)
                : isCount
                  ? rep.valuePrev?.toLocaleString("da-DK", { maximumFractionDigits: 0 })
                  : fmtCur(rep.valuePrev),
            isCustomReplacement: true,
            customKpiId: rep.kpiId,
        };
    });

    return { metricsArray: withReplacements, metricsData };
}
