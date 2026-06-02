import React from "react";
import dayjs from "dayjs";
import { FiDollarSign, FiPieChart } from "react-icons/fi";
import { shopifyDeductionMagnitudes } from "@/lib/performanceDashboard/computePerformanceMetrics";

const fmtCur = (n) =>
    n != null && n !== 0
        ? n.toLocaleString("da-DK", {
              style: "currency",
              currency: "DKK",
              maximumFractionDigits: 0,
          })
        : "-";

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
    if (type === "pct") return diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
    return undefined;
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
        change: pct !== null ? Math.abs(pct).toFixed(isPct ? 1 : 0) : undefined,
        changeType: changeType(pct),
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

/**
 * Total sales excluding VAT — aligned across Shopify, WooCommerce, and Magento daily rows.
 */
export function computeTotalSalesExVat({
    totalSales = 0,
    taxes = 0,
    grossSales = 0,
    netSales = 0,
    shippingRevenue = 0,
    customerType = "Shopify",
}) {
    const tax = Math.abs(Number(taxes) || 0);
    const total = Number(totalSales) || 0;
    const gross = Number(grossSales) || 0;
    const net = Number(netSales) || 0;
    const shipping = Number(shippingRevenue) || 0;
    const type = customerType || "Shopify";

    if (type === "Magento") {
        // Magento total_sales is net product + shipping (tax tracked separately).
        if (total > 0) return total;
        return Math.max(0, net + shipping);
    }

    if (type === "WooCommerce") {
        // Sales report: total_sales = sales (ex-VAT), gross ≈ sales + tax + shipping
        if (
            total > 0 &&
            gross > 0 &&
            tax > 0 &&
            Math.abs(total + tax + shipping - gross) <= Math.max(1, gross * 0.02)
        ) {
            return total;
        }
        // Orders / analytics: total often includes tax
        if (tax > 0 && total > tax) return total - tax;
        if (tax > 0 && gross > tax) return gross - tax;
        return Math.max(0, net + shipping);
    }

    // Shopify: total_sales includes tax
    if (total > tax) return total - tax;
    if (gross > tax) return gross - tax;
    return Math.max(0, net + shipping);
}

function computeProductSales({
    revenueAfterDiscounts,
    shippingRevenue,
    netSales,
    customerType,
}) {
    const fromComponents = Math.max(0, revenueAfterDiscounts - shippingRevenue);
    if (customerType === "Magento" || customerType === "WooCommerce") {
        return Math.max(fromComponents, Math.max(0, netSales));
    }
    return fromComponents;
}

function buildDerivedSnapshot(md, derived, customerType = "Shopify") {
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

    const totalSalesExVat = computeTotalSalesExVat({
        totalSales,
        taxes,
        grossSales,
        netSales,
        shippingRevenue,
        customerType,
    });
    const revenueAfterDiscounts = grossSales - discountDeduction;
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
}) {
    const currDerived = buildDerivedSnapshot(metricsData, derived, customerType);
    const prevDerived = buildDerivedSnapshot(metricsDataPrev, derived, customerType);

    const lineItems = staticExp.fixedExpensesLineItems || [];
    const fixedLineCurr = {};
    const fixedLinePrev = {};
    lineItems.forEach((item, i) => {
        const key = `fixed_line_${i}`;
        fixedLineCurr[key] = prorateMonthlyForRange(item.amount, rangeStart, rangeEnd);
        fixedLinePrev[key] = prorateMonthlyForRange(
            item.amount,
            prevRangeStart,
            prevRangeEnd
        );
    });

    Object.assign(metricsData, currDerived, fixedLineCurr);
    Object.assign(metricsDataPrev, prevDerived, fixedLinePrev);

    return { fixedLineItems: lineItems };
}

const DERIVED_CARD_DEFS = [
    { key: "total_sales_ex_vat", label: "Total sales excl. VAT" },
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
export function buildOverviewDerivedMetricCards(metricsData, metricsDataPrev, lineItems = []) {
    const cards = DERIVED_CARD_DEFS.map((def) =>
        cardFromValues(
            def.key,
            def.label,
            metricsData[def.key],
            metricsDataPrev[def.key],
            { valueType: def.valueType }
        )
    );

    lineItems.forEach((item, i) => {
        const key = `fixed_line_${i}`;
        cards.push(
            cardFromValues(key, item.name, metricsData[key], metricsDataPrev[key])
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
        change: spendPct !== null ? Math.abs(spendPct).toFixed(1) : undefined,
        changeType: changeType(spendPct),
        changeAbsolute: formatDiff(spendshare * 100, spendsharePrev * 100, "pct"),
        changePrevValue:
            spendsharePrev != null ? `${(spendsharePrev * 100).toFixed(1)}%` : undefined,
        popOverContent: null,
    });

    return cards;
}
