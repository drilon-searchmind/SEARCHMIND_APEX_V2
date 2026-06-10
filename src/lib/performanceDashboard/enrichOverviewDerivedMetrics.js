import React from "react";
import dayjs from "dayjs";
import { FiDollarSign, FiPieChart } from "react-icons/fi";
import {
    totalSalesVatLabel,
    grossProfitVatLabel,
    revenueVatShortLabel,
    getRevenueDisplayVatMode,
} from "@/lib/revenueVatDisplay";
import { shopifyDeductionMagnitudes } from "@/lib/performanceDashboard/computePerformanceMetrics";
import { computeTotalSalesExVat } from "@/lib/performanceDashboard/totalSalesExVat";
import { getFixedExpensesBreakdownLineItems } from "@/lib/customerStaticExpensesUtils";
import {
    percentChange,
    changeTypeForMetric,
    formatPercentChangeDisplay,
} from "@/lib/performanceDashboard/metricComparisonChange";

const fmtCur = (n) =>
    n != null && n !== 0
        ? n.toLocaleString("da-DK", {
              style: "currency",
              currency: "DKK",
              maximumFractionDigits: 0,
          })
        : "-";

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
    if (type === "pct") return diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
    return undefined;
}

const fmtNum = (n, d = 0) =>
    (n ?? 0).toLocaleString("da-DK", { maximumFractionDigits: d });

function buildTotalSalesExVatCalc(metricsData, customerType, customerSettings = {}) {
    const totalSales = Number(metricsData.total_sales) || 0;
    const tax = Math.abs(Number(metricsData.tax) || 0);
    const grossSales = Number(metricsData.gross_sales) || 0;
    const netSales = Number(metricsData.net_sales) || 0;
    const shippingRevenue = Number(metricsData.shipping_revenue) || 0;
    const exVat = Number(metricsData.total_sales_ex_vat) || 0;
    const type = customerType || "Shopify";
    const vatLabel = revenueVatShortLabel(customerSettings);
    const salesLabel = totalSalesVatLabel(customerSettings);

    let popOverContent;
    if (getRevenueDisplayVatMode(customerSettings) === "incl") {
        popOverContent = `${salesLabel}\n= Store revenue excl. VAT × 1.25\n= ${fmtNum(exVat)}`;
    } else if (type === "Magento") {
        popOverContent = `${salesLabel}\n= Magento order total (product net + shipping)\n= ${fmtNum(exVat)}`;
    } else if (type === "WooCommerce") {
        popOverContent = `${salesLabel}\n= WooCommerce sales total (excl. VAT) for the period\n= ${fmtNum(exVat)}`;
    } else if (type === "DanDomain") {
        popOverContent = `${salesLabel}\n= HostedShop order totals (excl. VAT) for the period\n= ${fmtNum(exVat)}`;
    } else {
        popOverContent = `${salesLabel}\n= total_sales − ${vatLabel}\n= ${fmtNum(totalSales)} − ${fmtNum(tax)}\n= ${fmtNum(exVat)}`;
    }

    return {
        popOverContent,
        calcValueLabels: [
            `Gross sales (catalog / line gross): ${fmtNum(grossSales)}`,
            `Total sales (store field): ${fmtNum(totalSales)}`,
            `VAT / tax: ${fmtNum(tax)}`,
            `Net sales: ${fmtNum(netSales)}`,
            `Shipping (income): ${fmtNum(shippingRevenue)}`,
        ].join("\n"),
    };
}

function buildGrossProfitMinusAdSpendCalc(metricsData) {
    const grossProfit = Number(metricsData.gross_profit) || 0;
    const cost = Number(metricsData.cost) || 0;
    const result = Number(metricsData.gross_profit_minus_ad_spend) || 0;
    return {
        popOverContent: `Gross profit − Ad spend\n= ${fmtNum(grossProfit)} − ${fmtNum(cost)}\n= ${fmtNum(result)}`,
        calcValueLabels: `Gross profit: ${fmtNum(grossProfit)}\nAd spend: ${fmtNum(cost)}`,
    };
}

function buildGrossProfitExVatCalc(metricsData, fetchCogs, cogsPercentage, customerSettings = {}) {
    const totalSalesExVat = Number(metricsData.total_sales_ex_vat) || 0;
    const cogs = Number(metricsData.cogs) || 0;
    const grossProfit = Number(metricsData.gross_profit) || 0;
    const profitLabel = grossProfitVatLabel(customerSettings);
    const salesLabel = totalSalesVatLabel(customerSettings);
    const popOverContent = fetchCogs
        ? `${profitLabel}\n= ${salesLabel} − COGS (from store)\n= ${fmtNum(totalSalesExVat)} − ${fmtNum(cogs)}\n= ${fmtNum(grossProfit)}`
        : `${profitLabel}\n= ${salesLabel} − (COGS % × ${salesLabel})\n= ${fmtNum(totalSalesExVat)} − (${(cogsPercentage * 100).toFixed(1)}% × ${fmtNum(totalSalesExVat)})\n= ${fmtNum(totalSalesExVat)} − ${fmtNum(cogs)}\n= ${fmtNum(grossProfit)}`;
    return {
        popOverContent,
        calcValueLabels: `${salesLabel}: ${fmtNum(totalSalesExVat)}\nCOGS: ${fmtNum(cogs)}`,
    };
}

function buildNetProfitCalc(metricsData, customerSettings = {}) {
    const grossProfit = Number(metricsData.gross_profit) || 0;
    const cogs = Number(metricsData.cogs) || 0;
    const allCosts = Number(metricsData.total_expenses) || 0;
    const costsBelowGrossProfit = allCosts - cogs;
    const ebit = Number(metricsData.ebit) || 0;
    const profitLabel = grossProfitVatLabel(customerSettings);
    return {
        popOverContent: `Net profit\n= ${profitLabel} − Remaining costs\n= ${fmtNum(grossProfit)} − ${fmtNum(costsBelowGrossProfit)}\n= ${fmtNum(ebit)}`,
        calcValueLabels: `${profitLabel}: ${fmtNum(grossProfit)}\nRemaining costs: ${fmtNum(costsBelowGrossProfit)}`,
    };
}

/** Attach Show calcs content to overview column primary metrics. */
export function attachOverviewPrimaryMetricCalcs(
    metricsCards,
    metricsData,
    customerType,
    { fetchCogs = false, cogsPercentage = 0, customerSettings = {} } = {}
) {
    const patches = {
        total_sales_ex_vat: buildTotalSalesExVatCalc(metricsData, customerType, customerSettings),
        gross_profit_minus_ad_spend: buildGrossProfitMinusAdSpendCalc(metricsData),
        gross_profit: buildGrossProfitExVatCalc(metricsData, fetchCogs, cogsPercentage, customerSettings),
        ebit: buildNetProfitCalc(metricsData, customerSettings),
    };
    return metricsCards.map((card) => {
        const patch = patches[card.key];
        if (!patch) return card;
        return { ...card, ...patch };
    });
}

function cardFromValues(key, label, curr, prev, { valueType = "currency" } = {}) {
    const isPct = valueType === "pct";
    const display = isPct
        ? `${(curr ?? 0).toLocaleString("da-DK", { maximumFractionDigits: 2 })} %`
        : fmtCur(curr);
    const displayPrev = isPct
        ? `${(prev ?? 0).toLocaleString("da-DK", { maximumFractionDigits: 2 })} %`
        : fmtCur(prev);
    const pct = percentChange(curr, prev);
    return {
        key,
        label,
        value: display,
        icon: (
            <FiDollarSign className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />
        ),
        change: formatPercentChangeDisplay(pct, isPct ? 1 : 0),
        changeType: changeTypeForMetric(key, pct),
        changeAbsolute: formatDiff(curr, prev, isPct ? "pct" : "currency"),
        changePrevValue: displayPrev,
        popOverContent: null,
    };
}

function prorateMonthlyForRange(monthlyAmount, rangeStart, rangeEnd) {
    const amount = Number(monthlyAmount) || 0;
    if (!rangeStart || !rangeEnd || amount === 0) return 0;
    let total = 0;
    let d = dayjs(rangeStart);
    const endDay = dayjs(rangeEnd);
    while (!d.isAfter(endDay)) {
        total += amount / d.daysInMonth();
        d = d.add(1, "day");
    }
    return total;
}

function pctOfTotal(value, total) {
    return total > 0 ? (value / total) * 100 : 0;
}

function computeProductSales({
    revenueAfterDiscounts,
    shippingRevenue,
    netSales,
    customerType,
}) {
    const fromComponents = Math.max(0, revenueAfterDiscounts - shippingRevenue);
    if (
        customerType === "Magento" ||
        customerType === "WooCommerce" ||
        customerType === "DanDomain"
    ) {
        return Math.max(fromComponents, Math.max(0, netSales));
    }
    return fromComponents;
}

function buildDerivedSnapshot(
    md,
    derived,
    customerType = "Shopify",
    customerSettings = {},
    replacementByKey = {}
) {
    const grossSales = Number(md.gross_sales) || 0;
    const discounts = Number(md.discounts) || 0;
    const returns = Number(md.returns) || 0;
    const totalSales = Number(md.total_sales) || 0;
    const taxes = Math.abs(Number(md.tax) || 0);
    const netSales = Number(md.net_sales) || 0;
    const shippingRevenue = Number(md.shipping_revenue) || 0;
    const { discountDeduction, returnDeduction } = shopifyDeductionMagnitudes(
        discounts,
        returns
    );

    const totalSalesExVat = replacementByKey.total_sales
        ? totalSales
        : getRevenueDisplayVatMode(customerSettings) === "incl"
          ? totalSales
          : computeTotalSalesExVat({
                totalSales,
                taxes,
                grossSales,
                netSales,
                shippingRevenue,
                customerType,
            });
    const revenueAfterDiscounts = replacementByKey.revenue
        ? Number(md.revenue) || 0
        : replacementByKey.net_sales
          ? Number(md.net_sales) || 0
          : grossSales - discountDeduction;
    const productSales = computeProductSales({
        revenueAfterDiscounts,
        shippingRevenue,
        netSales,
        customerType,
    });
    const returnsGoods = -returnDeduction;
    const returnsShipping = 0;
    const refundsRate = grossSales > 0 ? (returnDeduction / grossSales) * 100 : 0;
    const discountPctGross =
        grossSales > 0 ? (discountDeduction / grossSales) * 100 : 0;

    const totalCogs = Number(derived.totalCogs) || Number(md.cogs) || 0;
    const shippingCost = Number(derived.shippingCost) || Number(md.shipping_cost) || 0;
    const pickPack = Number(derived.pickPackCost) || Number(md.pick_pack) || 0;
    const transactionFee = Number(derived.transactionFee) || Number(md.transaction_fee) || 0;
    const grossProfit = Number(derived.grossProfit) || Number(md.gross_profit) || 0;
    const cost = Number(md.cost) || 0;
    const returnsCost = 0;
    const totalOrderCosts = totalCogs + shippingCost + pickPack + transactionFee + returnsCost;
    const grossProfitMinusAdSpend = grossProfit - cost;

    return {
        total_sales_ex_vat: totalSalesExVat,
        discount_codes: discounts,
        discount_pct_gross: discountPctGross,
        revenue_after_discounts: revenueAfterDiscounts,
        product_sales: productSales,
        returns_goods: returnsGoods,
        returns_shipping: returnsShipping,
        refunds_rate: refundsRate,
        cogs_pct_total_sales: pctOfTotal(totalCogs, totalSalesExVat),
        shipping_cost_pct_total_sales: pctOfTotal(shippingCost, totalSalesExVat),
        gross_profit_pct_total_sales: pctOfTotal(grossProfit, totalSalesExVat),
        gross_profit_minus_ad_spend: grossProfitMinusAdSpend,
        ad_spend_pct_total_sales: pctOfTotal(cost, totalSalesExVat),
        returns_cost: returnsCost,
        total_order_costs: totalOrderCosts,
        net_profit_pct_total_sales: pctOfTotal(Number(md.ebit) || 0, totalSalesExVat),
    };
}

/**
 * Add overview layout metrics to metricsData and optional MetricCard entries.
 */
export function enrichOverviewDerivedMetrics({
    metricsData,
    metricsDataPrev,
    derived,
    staticExp = {},
    rangeStart,
    rangeEnd,
    prevRangeStart,
    prevRangeEnd,
    customerType = "Shopify",
    customerSettings = {},
    replacementByKey = {},
}) {
    const currDerived = buildDerivedSnapshot(
        metricsData,
        derived,
        customerType,
        customerSettings,
        replacementByKey
    );
    const prevDerived = buildDerivedSnapshot(
        metricsDataPrev,
        derived,
        customerType,
        customerSettings,
        replacementByKey
    );

    const breakdownRows = getFixedExpensesBreakdownLineItems(staticExp);
    const fixedLineCurr = {};
    const fixedLinePrev = {};
    breakdownRows.forEach((row) => {
        fixedLineCurr[row.metricKey] = prorateMonthlyForRange(
            row.amount,
            rangeStart,
            rangeEnd
        );
        fixedLinePrev[row.metricKey] = prorateMonthlyForRange(
            row.amount,
            prevRangeStart,
            prevRangeEnd
        );
    });

    Object.assign(metricsData, currDerived, fixedLineCurr);
    Object.assign(metricsDataPrev, prevDerived, fixedLinePrev);

    return { fixedBreakdownRows: breakdownRows };
}

const DERIVED_CARD_DEFS = (customerSettings = {}) => [
    { key: "total_sales_ex_vat", label: totalSalesVatLabel(customerSettings) },
    { key: "discount_codes", label: "Discount Codes" },
    { key: "discount_pct_gross", label: "% of gross sales", valueType: "pct" },
    { key: "revenue_after_discounts", label: "Revenue after Discounts" },
    { key: "product_sales", label: "Product Sales" },
    { key: "returns_goods", label: "Returns (Goods)" },
    { key: "returns_shipping", label: "Returns (Shipping)" },
    { key: "refunds_rate", label: "Refunds rate", valueType: "pct" },
    { key: "cogs_pct_total_sales", label: "% of total sales", valueType: "pct" },
    { key: "shipping_cost_pct_total_sales", label: "% of total sales (shipping)", valueType: "pct" },
    { key: "gross_profit_minus_ad_spend", label: "Gross profit - Ad Spend" },
    { key: "ad_spend_pct_total_sales", label: "% of total sales", valueType: "pct" },
    { key: "returns_cost", label: "Returns cost" },
    { key: "total_order_costs", label: "Total Order Costs" },
];

/** MetricCard entries for keys added by enrichOverviewDerivedMetrics. */
export function buildOverviewDerivedMetricCards(
    metricsData,
    metricsDataPrev,
    fixedBreakdownRows = [],
    customerSettings = {}
) {
    const cards = DERIVED_CARD_DEFS(customerSettings).map((def) =>
        cardFromValues(
            def.key,
            def.label,
            metricsData[def.key],
            metricsDataPrev[def.key],
            { valueType: def.valueType }
        )
    );

    fixedBreakdownRows.forEach((row) => {
        cards.push(
            cardFromValues(
                row.metricKey,
                row.label,
                metricsData[row.metricKey],
                metricsDataPrev[row.metricKey]
            )
        );
    });

    const spendshare = metricsData.spendshare;
    const spendsharePrev = metricsDataPrev.spendshare;
    const spendPct = percentChange(spendshare, spendsharePrev);
    cards.push({
        key: "spendshare",
        label: "Spendshare",
        value: spendshare != null ? `${(spendshare * 100).toFixed(1)}%` : "-",
        icon: (
            <FiPieChart className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />
        ),
        change: formatPercentChangeDisplay(spendPct, 1),
        changeType: changeTypeForMetric("spendshare", spendPct),
        changeAbsolute: formatDiff(spendshare * 100, spendsharePrev * 100, "pct"),
        changePrevValue:
            spendsharePrev != null ? `${(spendsharePrev * 100).toFixed(1)}%` : undefined,
        popOverContent: null,
    });

    return cards;
}
