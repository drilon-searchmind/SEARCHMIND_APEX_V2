"use client";

import React, { useState, useMemo } from "react";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import GraphCard from "@/components/dashboard/GraphCard";
import CobaltLoader from "@/components/ui/CobaltLoader";
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
import dayjs from "dayjs";
import { getChartColors } from "@/components/dashboard/chartColors";
import ParentChildPropertiesTable from "../components/ParentChildPropertiesTable";
import { parentTotalSpendFromDailyRow } from "@/lib/parentPropertyAdSpend";
import { POAS_BREAK_EVEN } from "@/lib/poasMetrics";

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
            : diff.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 });
    }
    if (type === "count") return diff >= 0 ? `+${diff}` : `${diff}`;
    if (type === "ratio") return diff >= 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
    if (type === "pct") return diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
    return undefined;
}

const fmt = (n, d = 0) => (n ?? 0).toLocaleString("da-DK", { maximumFractionDigits: d });

const CHANNEL_SPEND_METRIC_KEYS = {
    facebook: { cur: "metaSpend", prev: "metaSpendPrev", sectionKey: "meta_spend", label: "- Meta Spend" },
    google: { cur: "googleSpend", prev: "googleSpendPrev", sectionKey: "google_spend", label: "- Google Ads Spend" },
    snapchat: { cur: "snapchatSpend", prev: "snapchatSpendPrev", sectionKey: "snapchat_spend", label: "- Snapchat Ads Spend" },
    reddit: { cur: "redditSpend", prev: "redditSpendPrev", sectionKey: "reddit_spend", label: "- Reddit Ads Spend" },
    pinterest: { cur: "pinterestSpend", prev: "pinterestSpendPrev", sectionKey: "pinterest_spend", label: "- Pinterest Ads Spend" },
    bing: { cur: "bingSpend", prev: "bingSpendPrev", sectionKey: "bing_spend", label: "- Microsoft (Bing) Ads Spend" },
};

function buildChannelSpendMetricRows(channels, metrics, metricsPrev, pct, chgType) {
    const rows = [];
    for (const ch of channels || []) {
        const spec = CHANNEL_SPEND_METRIC_KEYS[ch.id];
        if (!spec) continue;
        const cur = metrics?.[spec.cur] ?? 0;
        const prev = metricsPrev?.[spec.prev] ?? 0;
        rows.push({
            key: spec.sectionKey,
            label: spec.label,
            value: cur
                ? cur.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 })
                : "-",
            change: pct(cur, prev) !== null ? Math.abs(pct(cur, prev)).toFixed(0) : undefined,
            changeType: chgType(pct(cur, prev)),
            popOverContent: null,
        });
    }
    return rows;
}

export default function ParentOverviewView({ sharedData }) {
    const {
        parentCustomer,
        parentCustomerId,
        filteredTableRows,
        filteredDailyData,
        metrics,
        metricsPrev,
        aggregatedMetrics,
        aggregatedMetricsPrev,
        appliedDateRange,
        comparisonMethod,
        dateRangePickerProps,
        predominantMetricPreference,
        loading,
        chartLoading,
        pageBusy,
        chartBusy,
        campaignFilterBusy,
        childCustomers,
        childPropertyRowsForUi,
        parentVisibleAdSpendChannels,
        error,
        groupMarketExcludedDraft,
        groupMarketFilterAdSpendDraft,
        groupSpendExcludedDraft,
        handleGroupMarketToggleDraft,
        handleGroupMarketFilterAdSpendDraft,
        handleGroupMarketCatalogLoaded,
        handleApplyMarketsForChild,
        handleMarketsMenuOpen,
        handleGroupSpendToggleDraft,
        handleApplySpendForChild,
        handleSpendMenuOpen,
        googleCampaignFilterEnabled,
        handleGoogleCampaignFilterEnabledChange,
        groupGoogleCampaignExcludedDraft,
        groupGoogleCampaignKeywordsDraft,
        handleApplyGoogleCampaignsForChild,
        handleGoogleCampaignsMenuOpen,
        metaCampaignFilterEnabled,
        handleMetaCampaignFilterEnabledChange,
        groupMetaCampaignExcludedDraft,
        groupMetaCampaignKeywordsDraft,
        handleApplyMetaCampaignsForChild,
        handleMetaCampaignsMenuOpen,
    } = sharedData || {};

    const [viewMode, setViewMode] = useState("standard");
    const [showCalcs, setShowCalcs] = useState(false);
    const [selectedMetrics, setSelectedMetrics] = useState(["revenue"]);
    const [chartColors] = useState(() => getChartColors());

    // Use aggregated metrics when available (full metrics from API), otherwise fallback to basic metrics
    const shopifyRevenueField = sharedData?.shopifyRevenueField ?? "net_sales";

    const m = aggregatedMetrics || metrics;
    const prev = aggregatedMetricsPrev || metricsPrev;
    const revenue = m?.reportingRevenue ?? m?.netRevenue ?? m?.revenue ?? 0;
    const orders = m?.orders ?? 0;
    const adspend = m?.cost ?? m?.adspend ?? 0;
    const roas = m?.roas ?? null;
    const spendshare = m?.spendshare ?? null;
    const aov = m?.aov ?? (orders > 0 ? revenue / orders : 0);
    const metaSpend = m?.metaSpend ?? filteredTableRows?.reduce((s, r) => s + (r.facebookAdspend ?? 0), 0) ?? 0;
    const googleSpend = m?.googleSpend ?? filteredTableRows?.reduce((s, r) => s + (r.googleAdspend ?? 0), 0) ?? 0;
    const extraChannelMetrics = buildChannelSpendMetricRows(
        (parentVisibleAdSpendChannels || []).filter((c) => c.id !== "facebook" && c.id !== "google"),
        m,
        prev,
        percentChange,
        changeType
    );

    const revenuePrev = prev?.reportingRevenue ?? prev?.netRevenue ?? prev?.revenue ?? 0;
    const ordersPrev = prev?.orders ?? 0;
    const adspendPrev = prev?.cost ?? prev?.adspend ?? 0;
    const roasPrev = prev?.roas ?? null;
    const spendsharePrev = prev?.spendshare ?? null;
    const aovPrev = prev?.aov ?? (ordersPrev > 0 ? revenuePrev / ordersPrev : 0);
    const metaSpendPrev = prev?.metaSpend ?? filteredTableRows?.reduce((s, r) => s + (r.prevData?.facebookAdspend ?? 0), 0) ?? 0;
    const googleSpendPrev = prev?.googleSpend ?? filteredTableRows?.reduce((s, r) => s + (r.prevData?.googleAdspend ?? 0), 0) ?? 0;

    const hasFullMetrics = !!aggregatedMetrics;
    const primaryRevenueLabel =
        shopifyRevenueField === "gross_sales" ? "Reporting revenue (gross)" : "Net Revenue";
    const reportingAovLabel = shopifyRevenueField === "gross_sales" ? "Reporting AOV" : "NET AOV";

    const STANDARD_SECTIONS = [
        {
            key: "net_revenue",
            title: primaryRevenueLabel,
            metricKeys: hasFullMetrics ? ["revenue", "orders", "aov", "gross_sales", "discounts", "returns", "shipping_revenue", "transaction_fee", "tax"] : ["revenue", "orders", "aov"],
        },
        {
            key: "total_expenses",
            title: "Total Expenses",
            metricKeys: hasFullMetrics
                ? [
                      "total_expenses",
                      "marketing_spend",
                      "meta_spend",
                      "google_spend",
                      ...extraChannelMetrics.map((x) => x.key),
                      "variable_costs",
                      "cogs",
                      "shipping_cost",
                      "pick_pack",
                      "fixed_costs",
                  ]
                : ["adspend", "meta_spend", "google_spend", ...extraChannelMetrics.map((x) => x.key)],
        },
        {
            key: "net_profit",
            title: "Net Profit",
            metricKeys: hasFullMetrics ? ["ebit", "roas", "cac", "poas", "ebit_pct"] : predominantMetricPreference === "Spendshare" ? ["spendshare"] : ["roas"],
        },
    ];

    const metricsArray = useMemo(() => {
        const head = [
            {
                key: "revenue",
                label: primaryRevenueLabel,
                value: revenue ? revenue.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-",
                change:
                    percentChange(revenue, revenuePrev) !== null
                        ? Math.abs(percentChange(revenue, revenuePrev)).toFixed(0)
                        : undefined,
                changeType: changeType(percentChange(revenue, revenuePrev)),
                changeAbsolute: formatDiff(revenue, revenuePrev, "currency"),
                changePrevValue:
                    revenuePrev != null
                        ? revenuePrev.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 })
                        : undefined,
                popOverContent: `${primaryRevenueLabel}: ${fmt(revenue)}`,
                calcValueLabels: `${primaryRevenueLabel} (aggregated): ${fmt(revenue)}`,
            },
            {
                key: "orders",
                label: "Orders",
                value: orders != null ? orders.toLocaleString("da-DK", { maximumFractionDigits: 0 }) : "-",
                change:
                    percentChange(orders, ordersPrev) !== null ? Math.abs(percentChange(orders, ordersPrev)).toFixed(0) : undefined,
                changeType: changeType(percentChange(orders, ordersPrev)),
                changeAbsolute: formatDiff(orders, ordersPrev, "count"),
                popOverContent: null,
            },
            {
                key: "aov",
                label: reportingAovLabel,
                value: aov != null ? aov.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-",
                change: percentChange(aov, aovPrev) !== null ? Math.abs(percentChange(aov, aovPrev)).toFixed(0) : undefined,
                changeType: changeType(percentChange(aov, aovPrev)),
                popOverContent:
                    orders > 0
                        ? `${reportingAovLabel} = ${primaryRevenueLabel} / Orders\n= ${fmt(revenue)} / ${orders}\n= ${fmt(aov)}`
                        : null,
                calcValueLabels: `${primaryRevenueLabel}: ${fmt(revenue)}\nOrders: ${orders}`,
            },
        ];

        if (!hasFullMetrics) {
            return [
                ...head,
                { key: "adspend", label: "Spend", value: adspend ? adspend.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(adspend, adspendPrev) !== null ? Math.abs(percentChange(adspend, adspendPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(adspend, adspendPrev)), popOverContent: `Total Adspend: ${fmt(adspend)}` },
                { key: "meta_spend", label: "- Meta Spend", value: metaSpend ? metaSpend.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(metaSpend, metaSpendPrev) !== null ? Math.abs(percentChange(metaSpend, metaSpendPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(metaSpend, metaSpendPrev)), popOverContent: null },
                { key: "google_spend", label: "- Google Ads Spend", value: googleSpend ? googleSpend.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(googleSpend, googleSpendPrev) !== null ? Math.abs(percentChange(googleSpend, googleSpendPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(googleSpend, googleSpendPrev)), popOverContent: null },
                ...extraChannelMetrics,
                { key: "roas", label: "Blended ROAS", value: roas !== null ? roas.toFixed(2) : "-", change: percentChange(roas, roasPrev) !== null ? Math.abs(percentChange(roas, roasPrev)).toFixed(1) : undefined, changeType: changeType(percentChange(roas, roasPrev)), popOverContent: adspend > 0 ? `ROAS = Net Revenue / Spend\n= ${fmt(revenue)} / ${fmt(adspend)}\n= ${roas?.toFixed(2) ?? "N/A"}` : null, calcValueLabels: `Net Revenue: ${fmt(revenue)}\nSpend: ${fmt(adspend)}` },
                { key: "spendshare", label: "Spendshare", value: spendshare !== null ? (spendshare * 100).toFixed(2) + "%" : "-", change: percentChange(spendshare, spendsharePrev) !== null ? Math.abs(percentChange(spendshare, spendsharePrev)).toFixed(1) : undefined, changeType: changeType(percentChange(spendshare, spendsharePrev)), popOverContent: revenue > 0 ? `Spendshare = Spend / Net Revenue\n= ${fmt(adspend)} / ${fmt(revenue)}\n= ${(spendshare * 100).toFixed(2)}%` : null },
            ];
        }

        const grossSales = aggregatedMetrics.grossSales ?? 0;
        const discounts = aggregatedMetrics.discounts ?? 0;
        const returns = aggregatedMetrics.returns ?? 0;
        const shippingCharges = aggregatedMetrics.shippingCharges ?? 0;
        const taxes = aggregatedMetrics.taxes ?? 0;
        const transactionFee = aggregatedMetrics.transactionFee ?? 0;
        const totalCogs = aggregatedMetrics.totalCogs ?? 0;
        const fixedCosts = aggregatedMetrics.fixedCosts ?? 0;
        const variableCosts = aggregatedMetrics.variableCosts ?? 0;
        const shippingCost = aggregatedMetrics.shippingCost ?? 0;
        const pickPackCost = aggregatedMetrics.pickPackCost ?? 0;
        const allCosts = aggregatedMetrics.allCosts ?? 0;
        const ebit = aggregatedMetrics.ebit ?? 0;
        const cost = aggregatedMetrics.cost ?? 0;
        const grossProfit = aggregatedMetrics.grossProfit ?? 0;

        const grossSalesPrev = aggregatedMetricsPrev?.grossSales ?? 0;
        const discountsPrev = aggregatedMetricsPrev?.discounts ?? 0;
        const returnsPrev = aggregatedMetricsPrev?.returns ?? 0;
        const shippingChargesPrev = aggregatedMetricsPrev?.shippingCharges ?? 0;
        const taxesPrev = aggregatedMetricsPrev?.taxes ?? 0;
        const transactionFeePrev = aggregatedMetricsPrev?.transactionFee ?? 0;
        const prevTotalCogs = aggregatedMetricsPrev?.totalCogs ?? 0;
        const fixedCostsPrev = aggregatedMetricsPrev?.fixedCosts ?? 0;
        const variableCostsPrev = aggregatedMetricsPrev?.variableCosts ?? 0;
        const shippingCostPrev = aggregatedMetricsPrev?.shippingCost ?? 0;
        const pickPackCostPrev = aggregatedMetricsPrev?.pickPackCost ?? 0;
        const allCostsPrev = aggregatedMetricsPrev?.allCosts ?? 0;
        const ebitPrev = aggregatedMetricsPrev?.ebit ?? 0;
        const costPrev = aggregatedMetricsPrev?.cost ?? 0;

        const roasFull = aggregatedMetrics.roas ?? null;
        const roasPrevFull = aggregatedMetricsPrev?.roas ?? null;
        const poas = aggregatedMetrics.poas ?? null;
        const poasPrev = aggregatedMetricsPrev?.poas ?? null;
        const cac = aggregatedMetrics.cac ?? null;
        const cacPrev = aggregatedMetricsPrev?.cac ?? null;
        const ebitPct = aggregatedMetrics.ebitPct ?? null;
        const ebitPctPrev = aggregatedMetricsPrev?.ebitPct ?? null;

        const fullTail = [
            { key: "gross_sales", label: "Gross Sales", value: grossSales ? grossSales.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(grossSales, grossSalesPrev) !== null ? Math.abs(percentChange(grossSales, grossSalesPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(grossSales, grossSalesPrev)), popOverContent: null },
            { key: "discounts", label: "Discount", value: discounts ? discounts.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(discounts, discountsPrev) !== null ? Math.abs(percentChange(discounts, discountsPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(discounts, discountsPrev)), popOverContent: null },
            { key: "returns", label: "Returns", value: returns ? returns.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(returns, returnsPrev) !== null ? Math.abs(percentChange(returns, returnsPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(returns, returnsPrev)), popOverContent: null },
            { key: "shipping_revenue", label: "Shipping Charges", value: shippingCharges ? shippingCharges.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(shippingCharges, shippingChargesPrev) !== null ? Math.abs(percentChange(shippingCharges, shippingChargesPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(shippingCharges, shippingChargesPrev)), popOverContent: null },
            { key: "transaction_fee", label: "Transaction Fee", value: transactionFee ? transactionFee.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(transactionFee, transactionFeePrev) !== null ? Math.abs(percentChange(transactionFee, transactionFeePrev)).toFixed(0) : undefined, changeType: changeType(percentChange(transactionFee, transactionFeePrev)), popOverContent: `Transaction Fee = Net Revenue × ${(0.015 * 100).toFixed(2)}%\n= ${fmt(revenue)} × 1.5%\n= ${fmt(transactionFee)}`, calcValueLabels: `Net Revenue: ${fmt(revenue)}\nTransaction %: 1.5%` },
            { key: "tax", label: "Taxes", value: taxes ? taxes.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(taxes, taxesPrev) !== null ? Math.abs(percentChange(taxes, taxesPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(taxes, taxesPrev)), popOverContent: null },
            { key: "total_expenses", label: "Total Expenses", value: allCosts ? allCosts.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(allCosts, allCostsPrev) !== null ? Math.abs(percentChange(allCosts, allCostsPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(allCosts, allCostsPrev)), popOverContent: `Total Expenses = COGS + Marketing + Variable + Fixed + Transaction Fee\n= ${fmt(totalCogs)} + ${fmt(cost)} + ${fmt(variableCosts)} + ${fmt(fixedCosts)} + ${fmt(transactionFee)}\n= ${fmt(allCosts)}`, calcValueLabels: `COGS: ${fmt(totalCogs)}\nMarketing Spend: ${fmt(cost)}\nVariable Expenses: ${fmt(variableCosts)}\nFixed Expenses: ${fmt(fixedCosts)}\nTransaction Fee: ${fmt(transactionFee)}` },
            { key: "marketing_spend", label: "Marketing Spend", value: cost ? cost.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(cost, costPrev) !== null ? Math.abs(percentChange(cost, costPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(cost, costPrev)), popOverContent: `Total Adspend: ${fmt(cost)}` },
            { key: "meta_spend", label: "- Meta Spend", value: metaSpend ? metaSpend.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(metaSpend, metaSpendPrev) !== null ? Math.abs(percentChange(metaSpend, metaSpendPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(metaSpend, metaSpendPrev)), popOverContent: null },
            { key: "google_spend", label: "- Google Ads Spend", value: googleSpend ? googleSpend.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(googleSpend, googleSpendPrev) !== null ? Math.abs(percentChange(googleSpend, googleSpendPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(googleSpend, googleSpendPrev)), popOverContent: null },
            ...extraChannelMetrics,
            { key: "variable_costs", label: "Variable Expenses", value: variableCosts ? variableCosts.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(variableCosts, variableCostsPrev) !== null ? Math.abs(percentChange(variableCosts, variableCostsPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(variableCosts, variableCostsPrev)), popOverContent: null },
            { key: "cogs", label: "- COGS", value: totalCogs ? totalCogs.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(totalCogs, prevTotalCogs) !== null ? Math.abs(percentChange(totalCogs, prevTotalCogs)).toFixed(0) : undefined, changeType: changeType(percentChange(totalCogs, prevTotalCogs)), popOverContent: null },
            { key: "shipping_cost", label: "- Shipping Cost", value: shippingCost ? shippingCost.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(shippingCost, shippingCostPrev) !== null ? Math.abs(percentChange(shippingCost, shippingCostPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(shippingCost, shippingCostPrev)), popOverContent: null },
            { key: "pick_pack", label: "- Pick & Pack", value: pickPackCost ? pickPackCost.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(pickPackCost, pickPackCostPrev) !== null ? Math.abs(percentChange(pickPackCost, pickPackCostPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(pickPackCost, pickPackCostPrev)), popOverContent: null },
            { key: "fixed_costs", label: "Fixed Expenses", value: fixedCosts ? fixedCosts.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(fixedCosts, fixedCostsPrev) !== null ? Math.abs(percentChange(fixedCosts, fixedCostsPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(fixedCosts, fixedCostsPrev)), popOverContent: null },
            { key: "ebit", label: "Net Profit", value: ebit != null ? ebit.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(ebit, ebitPrev) !== null ? Math.abs(percentChange(ebit, ebitPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(ebit, ebitPrev)), popOverContent: `Net Profit = Net Revenue - All Spend\n= ${fmt(revenue)} - ${fmt(allCosts)}\n= ${fmt(ebit)}`, calcValueLabels: `Net Revenue: ${fmt(revenue)}\nAll Spend: ${fmt(allCosts)}` },
            { key: "roas", label: "Blended ROAS", value: roasFull !== null ? roasFull.toFixed(2) : "-", change: percentChange(roasFull, roasPrevFull) !== null ? Math.abs(percentChange(roasFull, roasPrevFull)).toFixed(1) : undefined, changeType: changeType(percentChange(roasFull, roasPrevFull)), popOverContent: cost > 0 ? `ROAS = Net Revenue / Spend\n= ${fmt(revenue)} / ${fmt(cost)}\n= ${roasFull?.toFixed(2) ?? "N/A"}` : null, calcValueLabels: `Net Revenue: ${fmt(revenue)}\nSpend: ${fmt(cost)}` },
            { key: "cac", label: "Blended CAC", value: cac !== null ? cac.toLocaleString("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }) : "-", change: percentChange(cac, cacPrev) !== null ? Math.abs(percentChange(cac, cacPrev)).toFixed(0) : undefined, changeType: changeType(percentChange(cac, cacPrev)), popOverContent: orders > 0 ? `CAC = Marketing Spend / Orders\n= ${fmt(cost)} / ${orders}\n= ${fmt(cac)}` : null, calcValueLabels: `Marketing Spend: ${fmt(cost)}\nOrders: ${orders}` },
            { key: "poas", label: "Blended POAS", value: poas !== null ? poas.toFixed(2) : "-", change: percentChange(poas, poasPrev) !== null ? Math.abs(percentChange(poas, poasPrev)).toFixed(1) : undefined, changeType: changeType(percentChange(poas, poasPrev)), popOverContent: cost > 0 ? `POAS = Gross Profit / Ad Spend (break-even ${POAS_BREAK_EVEN})\n= ${fmt(grossProfit)} / ${fmt(cost)}\n= ${poas?.toFixed(2) ?? "N/A"}` : null, calcValueLabels: `Gross Profit: ${fmt(grossProfit)}\nAd Spend: ${fmt(cost)}` },
            { key: "ebit_pct", label: "EBIT%", value: ebitPct !== null ? `${ebitPct.toFixed(1)}%` : "-", change: percentChange(ebitPct, ebitPctPrev) !== null ? Math.abs(percentChange(ebitPct, ebitPctPrev)).toFixed(1) : undefined, changeType: changeType(percentChange(ebitPct, ebitPctPrev)), changeAbsolute: formatDiff(ebitPct, ebitPctPrev, "pct"), popOverContent: `EBIT% = (EBIT / Net Revenue) × 100\n= (${fmt(ebit)} / ${fmt(revenue)}) × 100\n= ${ebitPct != null ? ebitPct.toFixed(1) : "N/A"}%`, calcValueLabels: `Net Revenue: ${fmt(revenue)}\nEBIT: ${fmt(ebit)}` },
        ];

        return [...head, ...fullTail];
    }, [aggregatedMetrics, aggregatedMetricsPrev, hasFullMetrics, revenue, revenuePrev, orders, ordersPrev, aov, aovPrev, adspend, adspendPrev, metaSpend, metaSpendPrev, googleSpend, googleSpendPrev, roas, roasPrev, spendshare, spendsharePrev, primaryRevenueLabel, reportingAovLabel, extraChannelMetrics]);

    const METRIC_OPTIONS = [
        {
            key: "revenue",
            label:
                shopifyRevenueField === "gross_sales" ? "Reporting revenue (gross)" : "Net Revenue",
            icon: FiDollarSign,
        },
        { key: "orders", label: "Orders", icon: FiShoppingCart },
        {
            key: "aov",
            label: shopifyRevenueField === "gross_sales" ? "Reporting AOV" : "Net AOV",
            icon: FiShoppingBag,
        },
        { key: "cost", label: "Marketing Spend", icon: FiCreditCard },
        { key: "roas", label: "Blended ROAS", icon: FiBarChart2 },
        { key: "spendshare", label: "Spendshare", icon: FiPieChart },
    ];

    const buildSeriesFromSelected = () => {
        const daily = filteredDailyData || [];
        const categories = daily.map((d) => d.period).sort();

        const currMap = Object.fromEntries(
            daily.map((d) => [
                d.period,
                {
                    revenue: d.revenue || 0,
                    orders: d.orders || 0,
                    cost: parentTotalSpendFromDailyRow(d),
                },
            ])
        );

        const series = [];
        selectedMetrics.forEach((metric) => {
            if (metric === "cost") {
                const currData = categories.map((k) => {
                    const v = currMap[k];
                    return v ? Number((v.cost || 0).toFixed(0)) : null;
                });
                series.push({ name: "Marketing Spend (Current)", data: currData });
                return;
            }
            const currData = categories.map((k) => {
                const v = currMap[k];
                if (!v) return null;
                if (metric === "revenue") return Number(v.revenue.toFixed(0));
                if (metric === "orders") return Number(v.orders || 0);
                if (metric === "aov") return v.orders > 0 ? Number((v.revenue / v.orders).toFixed(0)) : null;
                if (metric === "roas") return v.cost > 0 ? Number((v.revenue / v.cost).toFixed(2)) : null;
                if (metric === "spendshare") return v.revenue > 0 ? Number(((v.cost / v.revenue) * 100).toFixed(0)) : null;
                return null;
            });
            series.push({ name: `${METRIC_OPTIONS.find((o) => o.key === metric)?.label || metric} (Current)`, data: currData });
        });

        const formatChartValue = (v) =>
            typeof v === "number" && !isNaN(v) ? v.toLocaleString("da-DK", { maximumFractionDigits: 2, minimumFractionDigits: 0 }) : v;
        const isCurrentSeries = (s) => s.name && s.name.includes("(Current)");
        const options = {
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "Outfit, sans-serif" },
            xaxis: {
                categories,
                labels: { style: { colors: chartColors.primaryLighter || "#406969" } },
                axisTicks: { show: true },
                axisBorder: { show: true },
            },
            yaxis: { labels: { style: { colors: chartColors.primary || "#1E2B2B" }, formatter: formatChartValue } },
            tooltip: { theme: "light", y: { formatter: formatChartValue } },
            colors: [chartColors.primaryLighter || "#406969", chartColors.lime || "#C6ED62", "#94a3b8", "#cbd5e1"],
            stroke: {
                width: series.map((s) => (isCurrentSeries(s) ? 2 : 1)),
                curve: "smooth",
                dashArray: series.map((s) => (isCurrentSeries(s) ? 0 : 5)),
            },
            fill: { type: "solid", opacity: series.map((s) => (isCurrentSeries(s) ? 1 : 0.5)) },
            grid: { borderColor: "#e5e7eb", strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
            dataLabels: { enabled: false },
            legend: { show: true, position: "top", labels: { colors: chartColors.primary || "#1E2B2B" } },
        };
        return { series, options };
    };

    const { series: combinedSeries, options: combinedOptions } = buildSeriesFromSelected();

    const metricsData = {
        revenue,
        orders,
        cost: adspend,
        roas: roas ?? 0,
        spendshare: revenue > 0 ? adspend / revenue : 0,
        aov,
    };

    return (
        <div id="ParentOverviewView" className="cobalt-perf w-full apex-parent-stack" data-theme="cobalt">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Performance Dashboard"
                label={parentCustomer?.name || "Parent Property"}
                customerId={parentCustomerId}
                dateRange={appliedDateRange}
                comparisonMethod={comparisonMethod}
                loading={pageBusy ?? loading}
                dashboardType="parent-property"
                dataSnapshot={{
                    metrics: metricsArray,
                    metricsData,
                    dailyData: {
                        shopify: filteredDailyData,
                        facebook: [],
                        google: [],
                    },
                    aggregates: { revenue, orders, cost: adspend },
                    metricPreference: predominantMetricPreference,
                }}
                right={
                    <DateRangePicker
                        variant="cobalt"
                        {...dateRangePickerProps}
                        loading={pageBusy ?? loading}
                    />
                }
            />

            <div className="apex-perf-segment">
                <button
                    type="button"
                    disabled={pageBusy ?? loading}
                    className={`apex-perf-segment__btn${viewMode === "standard" ? " is-active" : ""}`}
                    onClick={() => setViewMode("standard")}
                >
                    Standard
                </button>
                <button
                    type="button"
                    disabled={pageBusy ?? loading}
                    className={`apex-perf-segment__btn${viewMode === "custom" ? " is-active" : ""}`}
                    onClick={() => setViewMode("custom")}
                >
                    Custom
                </button>
            </div>

            {viewMode === "standard" ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                        {loading ? (
                            <div className="col-span-full apex-parent-loader-panel">
                                <CobaltLoader variant="block" title="Loading performance metrics" />
                            </div>
                        ) : (
                            STANDARD_SECTIONS.map((section) => {
                                const breakdownKeys = section.metricKeys;
                                const sectionMetrics = metricsArray.filter((m) => breakdownKeys.includes(m.key));
                                const primaryMetric = sectionMetrics[0] || metricsArray.find((m) => m.key === breakdownKeys[0]);
                                const primaryValue = primaryMetric?.key === "revenue" ? revenue
                                    : primaryMetric?.key === "adspend" ? adspend
                                    : primaryMetric?.key === "total_expenses" ? (aggregatedMetrics?.allCosts ?? 0)
                                    : primaryMetric?.key === "ebit" ? (aggregatedMetrics?.ebit ?? 0)
                                    : primaryMetric?.key === "roas" ? roas
                                    : primaryMetric?.key === "spendshare" ? spendshare
                                    : 0;
                                const pctOfTotal = revenue > 0 ? ((primaryValue / revenue) * 100).toFixed(1) : "0";

                                return (
                                    <div key={section.key} className="apex-perf-section">
                                        <div className="apex-perf-section__head">
                                            <div className="apex-perf-section__eyebrow">{section.title}</div>
                                            <div className="apex-perf-section__value-row">
                                                <span className="apex-perf-section__value">
                                                    {primaryMetric?.value ?? "-"}
                                                </span>
                                                {revenue > 0 &&
                                                (primaryMetric?.key === "revenue" ||
                                                    primaryMetric?.key === "total_expenses" ||
                                                    primaryMetric?.key === "ebit") ? (
                                                    <span className="apex-perf-section__sub tabular-nums">
                                                        {primaryMetric?.key === "revenue"
                                                            ? `${pctOfTotal}% of total sales`
                                                            : primaryMetric?.key === "total_expenses"
                                                              ? `${pctOfTotal}% spend of revenue`
                                                              : primaryMetric?.key === "ebit"
                                                                ? `${pctOfTotal}% margin`
                                                                : ""}
                                                    </span>
                                                ) : null}
                                            </div>
                                            {primaryMetric?.change !== undefined ? (
                                                <div className="mt-2">
                                                    <span
                                                        className={`apex-perf-change${primaryMetric.changeType === "up" ? " is-up" : primaryMetric.changeType === "down" ? " is-down" : ""}`}
                                                    >
                                                        {primaryMetric.changeType === "up" ? (
                                                            <FiTrendingUp aria-hidden />
                                                        ) : primaryMetric.changeType === "down" ? (
                                                            <FiTrendingDown aria-hidden />
                                                        ) : null}
                                                        {primaryMetric.change}%
                                                    </span>
                                                </div>
                                            ) : null}
                                        </div>

                                        {showCalcs && primaryMetric?.popOverContent && (
                                            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/30">
                                                <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-[10px] font-mono text-gray-600 leading-tight">
                                                    {primaryMetric.calcValueLabels && (
                                                        <div className="mb-1.5 pb-1.5 border-b border-gray-200 space-y-0.5">
                                                            {primaryMetric.calcValueLabels
                                                                .split("\n")
                                                                .filter(Boolean)
                                                                .map((line, i) => {
                                                                    const colonIdx = line.indexOf(":");
                                                                    const label = colonIdx >= 0 ? line.slice(0, colonIdx).trim() : line;
                                                                    const val = colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : "";
                                                                    return (
                                                                        <div key={i} className="flex justify-between gap-4">
                                                                            <span className="text-gray-500">{label}</span>
                                                                            <span className="tabular-nums">{val}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col items-end gap-0.5">
                                                        {primaryMetric.popOverContent
                                                            .split("\n")
                                                            .map((l) => l.trim())
                                                            .filter((l) => l && l.startsWith("=") && /\d/.test(l))
                                                            .map((line, i) => (
                                                                <span key={i} className={i === 0 ? "font-bold text-[var(--color-primary-searchmind)]" : ""}>
                                                                    {line}
                                                                </span>
                                                            ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="apex-perf-section__rows">
                                            {sectionMetrics.slice(1).map((metric) => (
                                                <div key={metric.key} className="apex-perf-section__row">
                                                    <div className="apex-perf-section__row-inner">
                                                        <span className="apex-perf-section__row-label">
                                                            {metric.label}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="apex-perf-section__row-value">
                                                                {metric.value}
                                                            </span>
                                                            <span
                                                                className={`apex-perf-change${metric.changeType === "up" ? " is-up" : metric.changeType === "down" ? " is-down" : ""}`}
                                                            >
                                                                {metric.changeType === "up" ? (
                                                                    <FiTrendingUp aria-hidden />
                                                                ) : metric.changeType === "down" ? (
                                                                    <FiTrendingDown aria-hidden />
                                                                ) : null}
                                                                {(metric.change ?? 0)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="w-full">
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            {METRIC_OPTIONS.map((opt) => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    disabled={pageBusy ?? loading}
                                    className={`apex-perf-chip${selectedMetrics.includes(opt.key) ? " is-active" : ""}`}
                                    onClick={() =>
                                        setSelectedMetrics((prev) =>
                                            prev.includes(opt.key)
                                                ? prev.length > 1
                                                    ? prev.filter((k) => k !== opt.key)
                                                    : prev
                                                : [...prev, opt.key]
                                        )
                                    }
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {(chartBusy ?? chartLoading) ? (
                            <div className="apex-parent-loader-panel h-64">
                                <CobaltLoader variant="block" title="Updating chart" />
                            </div>
                        ) : (
                            <GraphCard
                                variant="cobalt"
                                title={
                                    selectedMetrics.length === 1
                                        ? `${METRIC_OPTIONS.find((o) => o.key === selectedMetrics[0])?.label} Over Time`
                                        : "Performance Metrics Over Time"
                                }
                                chartOptions={combinedOptions}
                                chartSeries={combinedSeries}
                            />
                        )}
                    </div>

                    <ParentChildPropertiesTable
                        parentCustomerId={parentCustomerId}
                        loading={pageBusy ?? loading}
                        error={error}
                        rows={childPropertyRowsForUi || filteredTableRows}
                        childCustomers={childCustomers}
                        visibleAdSpendChannels={parentVisibleAdSpendChannels}
                        shopifyRevenueField={shopifyRevenueField}
                        predominantMetricPreference={predominantMetricPreference}
                        groupMarketExcludedDraft={groupMarketExcludedDraft}
                        groupMarketFilterAdSpendDraft={groupMarketFilterAdSpendDraft}
                        groupSpendExcludedDraft={groupSpendExcludedDraft}
                        onToggleMarket={handleGroupMarketToggleDraft}
                        onCatalogLoaded={handleGroupMarketCatalogLoaded}
                        onFilterAdSpendByMarketChange={handleGroupMarketFilterAdSpendDraft}
                        onApplyMarketsForChild={handleApplyMarketsForChild}
                        onMarketsMenuOpen={handleMarketsMenuOpen}
                        onToggleSpendPlatform={handleGroupSpendToggleDraft}
                        onApplySpendForChild={handleApplySpendForChild}
                        onSpendMenuOpen={handleSpendMenuOpen}
                        fetchDisabled={pageBusy ?? loading}
                        googleCampaignFilterEnabled={googleCampaignFilterEnabled}
                        onGoogleCampaignFilterEnabledChange={handleGoogleCampaignFilterEnabledChange}
                        groupGoogleCampaignExcludedDraft={groupGoogleCampaignExcludedDraft}
                        groupGoogleCampaignKeywordsDraft={groupGoogleCampaignKeywordsDraft}
                        appliedDateRange={appliedDateRange}
                        onApplyGoogleCampaignsForChild={handleApplyGoogleCampaignsForChild}
                        onGoogleCampaignsMenuOpen={handleGoogleCampaignsMenuOpen}
                        metaCampaignFilterEnabled={metaCampaignFilterEnabled}
                        onMetaCampaignFilterEnabledChange={handleMetaCampaignFilterEnabledChange}
                        groupMetaCampaignExcludedDraft={groupMetaCampaignExcludedDraft}
                        groupMetaCampaignKeywordsDraft={groupMetaCampaignKeywordsDraft}
                        onApplyMetaCampaignsForChild={handleApplyMetaCampaignsForChild}
                        onMetaCampaignsMenuOpen={handleMetaCampaignsMenuOpen}
                    />
                </>
            ) : (
                <div className="apex-parent-stub">
                    <h2 className="apex-parent-stub__title">Custom view</h2>
                    <p className="apex-parent-stub__text">
                        Custom KPIs are available for single-property dashboards.
                    </p>
                </div>
            )}
        </div>
    );
}
