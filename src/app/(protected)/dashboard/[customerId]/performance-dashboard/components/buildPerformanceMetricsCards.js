import React from "react";
import { shopifyDeductionMagnitudes } from "@/lib/performanceDashboard/computePerformanceMetrics";
import {
    enrichOverviewDerivedMetrics,
    buildOverviewDerivedMetricCards,
    attachOverviewPrimaryMetricCalcs,
} from "@/lib/performanceDashboard/enrichOverviewDerivedMetrics";
import { getMonthlyFixedExpensesTotal } from "@/lib/customerStaticExpensesUtils";
import {
    revenueVatShortLabel,
    totalSalesVatLabel,
    grossProfitVatLabel,
} from "@/lib/revenueVatDisplay";
import { calcBlendedPoasOrZero } from "@/lib/poasMetrics";
import {
    percentChange,
    changeTypeForMetric,
    formatPercentChangeDisplay,
} from "@/lib/performanceDashboard/metricComparisonChange";
import { getReplacementForDisplayKey } from "@/lib/performanceDashboard/performanceDashboardConstants";
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

function chg(metricKey, current, prev) {
    return changeTypeForMetric(metricKey, percentChange(current, prev));
}
function pctDisplay(current, prev, decimals = 0) {
    return formatPercentChangeDisplay(percentChange(current, prev), decimals);
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
    customerSettings = {},
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
    const fixedExpensesMonthly = getMonthlyFixedExpensesTotal(staticExp);

    const cac = merged.CACTotalSales ?? null;
    const cacPrev = mergedPrev.CACTotalSales ?? null;
    const vatLabel = revenueVatShortLabel(customerSettings);
    const totalSalesExVatLabel = totalSalesVatLabel(customerSettings);
    const grossProfitLabel = grossProfitVatLabel(customerSettings);
    const totalSalesExVat = Number(metricsData.total_sales_ex_vat) || 0;
    const costsBelowGrossProfit = allCosts - totalCogs;
    const grossProfitCalculation = fetchCogs
        ? `${totalSalesExVatLabel} - COGS (from Store) \n
        = ${fmt(totalSalesExVat)} - ${fmt(totalCogs)} \n
        = ${fmt(grossProfit)}
    `
        : `${totalSalesExVatLabel} - (COGS % × ${totalSalesExVatLabel}) \n
        = ${fmt(totalSalesExVat)} - (${(cogsPercentage * 100).toFixed(1)}% × ${fmt(totalSalesExVat)}) \n
        = ${fmt(totalSalesExVat)} - ${fmt(totalCogs)} \n
        = ${fmt(grossProfit)}
    `;
    const totalAdspendCalculation = merged.calculationsData?.totalAdspendCalculation || "";
    const apiValueLabels = {
        ...(merged.calculationsData?.valueLabels || {}),
        grossProfit: `${totalSalesExVatLabel}: ${fmt(totalSalesExVat)}\nCOGS: ${fmt(totalCogs)}`,
    };

    const roasCalculation = `Net Revenue / Cost \n
                    = ${fmt(netRevenue)} / ${fmt(cost)} \n
                    = ${roas !== null ? roas.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "N/A"}
                `;
    const poasCalculation =
        cost > 0
            ? `(Gross Profit / Ad Spend) \n
                    = ${fmt(grossProfit)} / ${fmt(cost)} \n
                    = ${cost > 0 && grossProfit !== null ? calcBlendedPoasOrZero(grossProfit, cost).toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "N/A"}
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
            change: pctDisplay(orders, ordersPrev, 0),
            changeType: chg("orders", orders, ordersPrev),
            changeAbsolute: formatDiff(orders, ordersPrev, "count"),
            changePrevValue: ordersPrev != null ? ordersPrev.toLocaleString("da-DK", { maximumFractionDigits: 0 }) : undefined,
            popOverContent: null,
        },
        {
            key: "total_sales",
            label: "Total Sales",
            value: fmtCur(totalSales),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: pctDisplay(totalSales, totalSalesPrev, 0),
            changeType: chg("total_sales", totalSales, totalSalesPrev),
            changeAbsolute: formatDiff(totalSales, totalSalesPrev, "currency"),
            changePrevValue: fmtCur(totalSalesPrev),
            popOverContent: null,
        },
        {
            key: "gross_sales",
            label: "Gross Sales",
            value: fmtCur(grossSales),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: pctDisplay(grossSales, grossSalesPrev, 0),
            changeType: chg("gross_sales", grossSales, grossSalesPrev),
            changeAbsolute: formatDiff(grossSales, grossSalesPrev, "currency"),
            changePrevValue: fmtCur(grossSalesPrev),
            popOverContent: null,
        },
        {
            key: "discounts",
            label: "Discount",
            value: fmtCur(discounts),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: pctDisplay(discounts, discountsPrev, 0),
            changeType: chg("discounts", discounts, discountsPrev),
            changeAbsolute: formatDiff(discounts, discountsPrev, "currency"),
            changePrevValue: fmtCur(discountsPrev),
            popOverContent: null,
        },
        {
            key: "revenue",
            label: "Net Revenue",
            value: fmtCur(netRevenue),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: pctDisplay(netRevenue, netRevenuePrev, 0),
            changeType: chg("revenue", netRevenue, netRevenuePrev),
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
            key: "duties",
            label: "Duties",
            value: fmtCur(duties),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: pctDisplay(duties, dutiesPrev, 0),
            changeType: chg("duties", duties, dutiesPrev),
            changeAbsolute: formatDiff(duties, dutiesPrev, "currency"),
            changePrevValue: fmtCur(dutiesPrev),
            popOverContent: null,
        },
        {
            key: "additional_fees",
            label: "Additional Fees",
            value: fmtCur(additionalFees),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: pctDisplay(additionalFees, additionalFeesPrev, 0),
            changeType: chg("additional_fees", additionalFees, additionalFeesPrev),
            changeAbsolute: formatDiff(additionalFees, additionalFeesPrev, "currency"),
            changePrevValue: fmtCur(additionalFeesPrev),
            popOverContent: null,
        },
        {
            key: "cogs",
            label: "- COGS",
            value: fmtCur(totalCogs),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: pctDisplay(totalCogs, prevTotalCogs, 0),
            changeType: chg("cogs", totalCogs, prevTotalCogs),
            changeAbsolute: formatDiff(totalCogs, prevTotalCogs, "currency"),
            changePrevValue: fmtCur(prevTotalCogs),
            popOverContent: fetchCogs
                ? `COGS (from Shopify store)\n= Sum of cost_of_goods_sold per day\n= ${fmt(totalCogs)}`
                : `COGS = ${totalSalesExVatLabel} × COGS %\n= ${fmt(totalSalesExVat)} × ${(cogsPercentage * 100).toFixed(1)}%\n= ${fmt(totalCogs)}`,
            calcValueLabels: fetchCogs
                ? `Cost of goods sold (from Shopify): ${fmt(totalCogs)}`
                : `${totalSalesExVatLabel}: ${fmt(totalSalesExVat)}\nCOGS %: ${(cogsPercentage * 100).toFixed(1)}%`,
            cogsSettingsHighlight:
                fetchCogs === true ||
                (!fetchCogs && Number(cogsPercentage) > 0),
        },
        {
            key: "aov",
            label: "NET AOV",
            value: aov != null ? fmtCur(aov) : "-",
            icon: <FiShoppingBag className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: pctDisplay(aov, aovPrev, 0),
            changeType: chg("aov", aov, aovPrev),
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
            change: pctDisplay(cost, costPrev, 0),
            changeType: chg("cost", cost, costPrev),
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
            change: pctDisplay(cost, costPrev, 0),
            changeType: chg("cost", cost, costPrev),
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
                change: pctDisplay(metaSpend, metaSpendPrev, 0),
                changeType: chg("meta_spend", metaSpend, metaSpendPrev),
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
                change: pctDisplay(googleSpend, googleSpendPrev, 0),
                changeType: chg("google_spend", googleSpend, googleSpendPrev),
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
                    change: pctDisplay(cur, prevSpend, 0),
                    changeType: chg(spec.metricsDataKey, cur, prevSpend),
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
            change: pctDisplay(shippingCost, shippingCostPrev, 0),
            changeType: chg("shipping_cost", shippingCost, shippingCostPrev),
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
            change: pctDisplay(pickPackCost, pickPackCostPrev, 0),
            changeType: chg("pick_pack", pickPackCost, pickPackCostPrev),
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
            change: pctDisplay(allCosts, allCostsPrev, 0),
            changeType: chg("total_expenses", allCosts, allCostsPrev),
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
            change: pctDisplay(roas, roasPrev, 1),
            changeType: chg("roas", roas, roasPrev),
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
            change: pctDisplay(variableCosts, variableCostsPrev, 0),
            changeType: chg("variable_costs", variableCosts, variableCostsPrev),
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
            change: pctDisplay(metricsData.fixed_costs, metricsDataPrev.fixed_costs, 0),
            changeType: chg(
                "fixed_costs",
                metricsData.fixed_costs,
                metricsDataPrev.fixed_costs
            ),
            changeAbsolute: formatDiff(metricsData.fixed_costs, metricsDataPrev.fixed_costs, "currency"),
            changePrevValue: fmtCur(metricsDataPrev.fixed_costs),
            popOverContent: `Fixed Spend (prorated for period):\nfixedExpenses (monthly) × sum over each day of (1 / days in that month)\n= ${fmt(fixedExpensesMonthly)} prorated over ${daysInRange} days\n= ${fmt(metricsData.fixed_costs)}`,
            calcValueLabels: `Fixed expenses (monthly): ${fmt(fixedExpensesMonthly)}\nDays in range: ${daysInRange}`,
            fixedExpensesSettingsActive: fixedExpensesMonthly > 0,
        },
        {
            key: "poas",
            label: "Blended POAS",
            value: poas != null ? poas.toFixed(2) : "-",
            icon: <FiPieChart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: pctDisplay(poas, poasPrev, 1),
            changeType: chg("poas", poas, poasPrev),
            changeAbsolute: formatDiff(poas, poasPrev, "ratio"),
            changePrevValue: poasPrev != null ? poasPrev.toFixed(2) : undefined,
            popOverContent: poasCalculation,
            calcValueLabels: `Gross Profit: ${fmt(grossProfit)}\nAd Spend: ${fmt(cost)}`,
        },
        {
            key: "gross_profit",
            label: "Gross Profit",
            value: fmtCur(grossProfit),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: pctDisplay(grossProfit, grossProfitPrev, 0),
            changeType: chg("gross_profit", grossProfit, grossProfitPrev),
            changeAbsolute: formatDiff(grossProfit, grossProfitPrev, "currency"),
            changePrevValue: fmtCur(grossProfitPrev),
            tooltip: `${totalSalesExVatLabel} - COGS`,
            popOverContent: grossProfitCalculation,
            calcValueLabels: apiValueLabels.grossProfit,
        },
        {
            key: "returns",
            label: "Returns",
            value: fmtCur(returns),
            icon: <FiTrendingUp className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: pctDisplay(returns, returnsPrev, 0),
            changeType: chg("returns", returns, returnsPrev),
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
            change: pctDisplay(shippingCharges, shippingChargesPrev, 0),
            changeType: chg("shipping_revenue", shippingCharges, shippingChargesPrev),
            changeAbsolute: formatDiff(shippingCharges, shippingChargesPrev, "currency"),
            changePrevValue: fmtCur(shippingChargesPrev),
            popOverContent: null,
        },
        {
            key: "transaction_fee",
            label: "Transaction Fee",
            value: fmtCur(transactionFee),
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: pctDisplay(transactionFee, transactionFeePrev, 0),
            changeType: chg("transaction_fee", transactionFee, transactionFeePrev),
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
            change: pctDisplay(taxes, taxesPrev, 0),
            changeType: chg("tax", taxes, taxesPrev),
            changeAbsolute: formatDiff(taxes, taxesPrev, "currency"),
            changePrevValue: fmtCur(taxesPrev),
            popOverContent: null,
        },
        {
            key: "ebit",
            label: "Net Profit",
            value: ebit != null ? fmtCur(ebit) : "-",
            icon: <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: pctDisplay(ebit, ebitPrev, 0),
            changeType: chg("ebit", ebit, ebitPrev),
            changeAbsolute: formatDiff(ebit, ebitPrev, "currency"),
            changePrevValue: fmtCur(ebitPrev),
            popOverContent: `Net Profit = ${grossProfitLabel} - Remaining costs\n= ${fmt(grossProfit)} - ${fmt(costsBelowGrossProfit)}\n= ${fmt(ebit)}`,
            calcValueLabels: `${grossProfitLabel}: ${fmt(grossProfit)}\nRemaining costs (Fixed + Variable + Transaction Fee + Spend): ${fmt(costsBelowGrossProfit)}`,
        },
        {
            key: "ebit_pct",
            label: "EBIT%",
            value: ebitPct != null ? `${ebitPct.toFixed(1)}%` : "-",
            icon: <FiPieChart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: pctDisplay(ebitPct, ebitPctPrev, 1),
            changeType: chg("ebit_pct", ebitPct, ebitPctPrev),
            changeAbsolute: formatDiff(ebitPct, ebitPctPrev, "pct"),
            changePrevValue: ebitPctPrev != null ? `${ebitPctPrev.toFixed(1)}%` : undefined,
            popOverContent: `EBIT = ${grossProfitLabel} - Remaining costs\n= ${fmt(grossProfit)} - ${fmt(costsBelowGrossProfit)}\n= ${fmt(ebit)}\nEBIT% = (EBIT / ${totalSalesExVatLabel}) × 100\n= (${fmt(ebit)} / ${fmt(totalSalesExVat)}) × 100\n= ${ebitPct != null ? ebitPct.toFixed(1) : "N/A"}%`,
            calcValueLabels: `${grossProfitLabel}: ${fmt(grossProfit)}\nRemaining costs (Fixed + Variable + Transaction Fee + Spend): ${fmt(costsBelowGrossProfit)}`,
        },
        {
            key: "cac",
            label: "Blended CAC",
            value: cac != null ? fmtCur(cac) : "-",
            icon: <FiUserCheck className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />,
            change: pctDisplay(cac, cacPrev, 0),
            changeType: chg("cac", cac, cacPrev),
            changeAbsolute: formatDiff(cac, cacPrev, "currency"),
            changePrevValue: cacPrev != null ? fmtCur(cacPrev) : undefined,
            popOverContent: cacCalculation,
            calcValueLabels: apiValueLabels.cac,
        },
    ];

    const { fixedBreakdownRows } = enrichOverviewDerivedMetrics({
        metricsData,
        metricsDataPrev,
        derived,
        staticExp,
        rangeStart,
        rangeEnd,
        prevRangeStart,
        prevRangeEnd,
        customerType,
        customerSettings,
        replacementByKey,
    });
    const derivedCards = buildOverviewDerivedMetricCards(
        metricsData,
        metricsDataPrev,
        fixedBreakdownRows,
        customerSettings
    );
    let metricsWithDerived = [...metricsArray, ...derivedCards];
    metricsWithDerived = attachOverviewPrimaryMetricCalcs(
        metricsWithDerived,
        metricsData,
        customerType,
        { fetchCogs, cogsPercentage, customerSettings }
    );

    const withReplacements = metricsWithDerived.map((m) => {
        const rep = getReplacementForDisplayKey(m.key, replacementByKey);
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
            change: formatPercentChangeDisplay(pct, isRatio || isPctDerived ? 1 : 0),
            changeType: changeTypeForMetric(m.key, pct),
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
