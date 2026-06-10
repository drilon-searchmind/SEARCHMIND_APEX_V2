"use client";

import { useEffect, useState } from "react";
import {
    channelSpendTotalsFromMerged,
    adSpendChannelsForSpendTotals,
    adSpendChannelsForShopifyMarketsFilterUi,
} from "@/lib/mergeAdSpendDaily";
import { formatComparisonPeriodDates } from "@/lib/dateRangeComparison";
import { computePeriodMetricsFromMerged } from "@/lib/performanceDashboard/profitMetrics";

async function fetchCustomKpis(customerId) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    try {
        const res = await fetch(`${baseUrl}/api/custom-kpis/${customerId}`);
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

/**
 * Fetches merged data (current + previous period) and computes all P&L metrics.
 * Net profit / ROAS use the same pipeline as performance-dashboard overview KPIs.
 */
export function usePnlData(
    customer,
    appliedDateRange,
    comparisonMethod,
    mergedSourcesQuerySuffix = "",
    pnlMarketsSpend = null,
    appliedCompareRange = { startDate: "", endDate: "" }
) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [merged, setMerged] = useState(null);
    const [mergedPrev, setMergedPrev] = useState(null);
    const [customKpis, setCustomKpis] = useState([]);

    const staticExpenses = customer?.CustomerStaticExpenses || {};
    const customerSettings = customer?.CustomerSettings || {};
    const fetchCogs = customerSettings?.fetchCogsFromStore === true;

    const start = new Date(appliedDateRange?.startDate || 0);
    const end = new Date(appliedDateRange?.endDate || 0);
    const days = appliedDateRange
        ? Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1
        : 0;

    useEffect(() => {
        if (!customer || !appliedDateRange?.startDate || !appliedDateRange?.endDate) return;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
                const comparisonDates = formatComparisonPeriodDates({
                    comparisonMethod,
                    startDate: appliedDateRange.startDate,
                    endDate: appliedDateRange.endDate,
                    compareStartDate: appliedCompareRange.startDate,
                    compareEndDate: appliedCompareRange.endDate,
                });

                const fetches = [
                    fetch(
                        `${baseUrl}/api/merged-sources/${customer._id}?startDate=${appliedDateRange.startDate}&endDate=${appliedDateRange.endDate}&source=pnl${mergedSourcesQuerySuffix}`
                    ),
                    fetchCustomKpis(customer._id),
                ];
                if (!comparisonDates.skip && comparisonDates.startDate && comparisonDates.endDate) {
                    fetches.push(
                        fetch(
                            `${baseUrl}/api/merged-sources/${customer._id}?startDate=${comparisonDates.startDate}&endDate=${comparisonDates.endDate}&source=pnl${mergedSourcesQuerySuffix}`
                        )
                    );
                }
                const results = await Promise.all(fetches);
                const res = results[0];
                const kpis = results[1];
                const resPrev = results[2];
                setCustomKpis(Array.isArray(kpis) ? kpis : []);

                if (!res.ok) throw new Error("Failed to fetch merged data");
                const mergedData = await res.json();
                setMerged(mergedData);
                if (resPrev?.ok) {
                    setMergedPrev(await resPrev.json());
                } else {
                    setMergedPrev(null);
                }
            } catch (err) {
                setError(err?.message || "Failed to fetch");
            } finally {
                setLoading(false);
            }
        })();
    }, [customer, appliedDateRange, appliedCompareRange, comparisonMethod, mergedSourcesQuerySuffix]);

    let channelSpendTotals = {};
    let channelSpendTotalsPrev = {};

    let totalSales = 0,
        orders = 0,
        cogs = 0,
        db1 = 0,
        shipping = 0,
        transactionCosts = 0,
        db2 = 0;
    let grossSales = 0,
        totalSalesDisplay = 0,
        discounts = 0,
        refunds = 0,
        deliveryFees = 0,
        taxes = 0;
    let marketingSpend = 0,
        marketingBureau = 0,
        marketingTooling = 0,
        db3 = 0,
        fixedExpenses = 0,
        result = 0;
    let realizedROAS = 0,
        breakEvenROAS = 0,
        totalCosts = 0,
        db1Pct = 0,
        db2Pct = 0,
        db3Pct = 0,
        blendedPoas = 0;

    let grossSalesPrev = 0,
        totalSalesDisplayPrev = 0,
        discountsPrev = 0,
        refundsPrev = 0,
        deliveryFeesPrev = 0,
        taxesPrev = 0,
        totalSalesPrev = 0,
        cogsPrev = 0,
        db1Prev = 0,
        shippingPrev = 0,
        transactionCostsPrev = 0,
        db2Prev = 0;
    let marketingSpendPrev = 0,
        marketingBureauPrev = 0,
        marketingToolingPrev = 0,
        db3Prev = 0,
        fixedExpensesPrev = 0,
        resultPrev = 0,
        blendedPoasPrev = 0;
    let primarySalesRevenueLabel = "Net Sales";

    const compDates = formatComparisonPeriodDates({
        comparisonMethod,
        startDate: appliedDateRange?.startDate,
        endDate: appliedDateRange?.endDate,
        compareStartDate: appliedCompareRange.startDate,
        compareEndDate: appliedCompareRange.endDate,
    });

    if (merged && days > 0) {
        const period = computePeriodMetricsFromMerged({
            shopifyDaily: merged.shopifyDaily || [],
            merged,
            customerSettings,
            customerType: customer?.customerType || "Shopify",
            staticExpenses,
            dateRange: appliedDateRange,
            shopifyDailyPrev: mergedPrev?.shopifyDaily || [],
            mergedPrev,
            prevDateRange:
                !compDates.skip && compDates.startDate && compDates.endDate
                    ? { startDate: compDates.startDate, endDate: compDates.endDate }
                    : null,
            customKpis,
        });

        const md = period.metricsData;
        const mdPrev = period.metricsDataPrev;
        const curr = period.curr;
        const prev = period.prev;
        const fixed = period.pnlFixedBreakdown;
        const fixedPrev = period.pnlFixedBreakdownPrev;

        totalSales = period.primarySalesRevenue;
        primarySalesRevenueLabel = period.primarySalesRevenueLabel;
        grossSales = curr.grossSales;
        totalSalesDisplay = period.primarySalesRevenue;
        discounts = curr.discounts;
        refunds = curr.returns;
        deliveryFees = curr.shippingCharges;
        taxes = curr.taxes;
        orders = curr.orders;
        cogs = md.cogs;
        db1 = md.gross_profit;
        shipping = period.shippingAndPickPack;
        transactionCosts = md.transaction_fee;
        db2 = db1 - shipping - transactionCosts;
        marketingSpend = md.cost;
        marketingBureau = fixed.marketingBureau;
        marketingTooling = fixed.marketingTooling;
        db3 = db2 - marketingSpend - marketingBureau - marketingTooling;
        fixedExpenses = fixed.fixedExpenses;
        result = period.netProfit;
        blendedPoas = period.poas;

        totalCosts = md.total_expenses;
        realizedROAS = md.roas;
        breakEvenROAS = marketingSpend !== 0 ? totalCosts / marketingSpend : 0;
        db1Pct = totalSales !== 0 ? (db1 / totalSales) * 100 : 0;
        db2Pct = totalSales !== 0 ? (db2 / totalSales) * 100 : 0;
        db3Pct = totalSales !== 0 ? (db3 / totalSales) * 100 : 0;
        channelSpendTotals = channelSpendTotalsFromMerged(merged);

        if (mergedPrev) {
            grossSalesPrev = prev.grossSales;
            totalSalesDisplayPrev = period.primarySalesRevenuePrev;
            discountsPrev = prev.discounts;
            refundsPrev = prev.returns;
            deliveryFeesPrev = prev.shippingCharges;
            taxesPrev = prev.taxes;
            totalSalesPrev = period.primarySalesRevenuePrev;
            cogsPrev = mdPrev.cogs;
            db1Prev = mdPrev.gross_profit;
            shippingPrev = period.shippingAndPickPackPrev;
            transactionCostsPrev = mdPrev.transaction_fee;
            db2Prev = db1Prev - shippingPrev - transactionCostsPrev;
            marketingSpendPrev = mdPrev.cost;
            marketingBureauPrev = fixedPrev.marketingBureau;
            marketingToolingPrev = fixedPrev.marketingTooling;
            db3Prev = db2Prev - marketingSpendPrev - marketingBureauPrev - marketingToolingPrev;
            fixedExpensesPrev = fixedPrev.fixedExpenses;
            resultPrev = period.netProfitPrev;
            blendedPoasPrev = period.poasPrev;
            channelSpendTotalsPrev = channelSpendTotalsFromMerged(mergedPrev);
        }
    }

    const db1CTS = totalSales ? cogs / totalSales : 0;
    const db2CTS = totalSales ? (shipping + transactionCosts) / totalSales : 0;
    const db3CTS = totalSales
        ? (marketingSpend + marketingBureau + marketingTooling) / totalSales
        : 0;
    const db1DG = totalSales ? 1 - db1CTS : 0;
    const db2DG = totalSales ? db1DG - db2CTS : 0;
    const db3DG = totalSales ? db2DG - db3CTS : 0;

    const visibleAdSpendChannels =
        merged && days > 0
            ? pnlMarketsSpend?.shopifyMarkets === true &&
              customerSettings?.shopifyMarketsEnabled === true
                ? adSpendChannelsForShopifyMarketsFilterUi(customerSettings).filter(
                      (c) => pnlMarketsSpend.appliedExcludedPlatforms?.[c.id] !== true
                  )
                : adSpendChannelsForSpendTotals(
                      customerSettings,
                      channelSpendTotals,
                      mergedPrev ? channelSpendTotalsPrev : undefined
                  )
            : [];

    return {
        loading,
        error,
        hasPrev: !!mergedPrev,
        days,
        staticExpenses,
        fetchCogs,
        grossSales,
        totalSalesDisplay,
        discounts,
        refunds,
        deliveryFees,
        taxes,
        totalSales,
        orders,
        cogs,
        db1,
        shipping,
        transactionCosts,
        db2,
        marketingSpend,
        channelSpendTotals,
        marketingBureau,
        marketingTooling,
        db3,
        fixedExpenses,
        result,
        blendedPoas,
        realizedROAS,
        breakEvenROAS,
        totalCosts,
        db1Pct,
        db2Pct,
        db3Pct,
        db1CTSDisplay: totalSales ? `${Math.round(db1CTS * 100)}%` : "—",
        db2CTSDisplay: totalSales ? `${Math.round(db2CTS * 100)}%` : "—",
        db3CTSDisplay: totalSales ? `${Math.round(db3CTS * 100)}%` : "—",
        db1DGDisplay: totalSales ? `${Math.round(db1DG * 100)}%` : "—",
        db2DGDisplay: totalSales ? `${Math.round(db2DG * 100)}%` : "—",
        db3DGDisplay: totalSales ? `${Math.round(db3DG * 100)}%` : "—",
        grossSalesPrev,
        totalSalesDisplayPrev,
        discountsPrev,
        refundsPrev,
        deliveryFeesPrev,
        taxesPrev,
        totalSalesPrev,
        cogsPrev,
        db1Prev,
        shippingPrev,
        transactionCostsPrev,
        db2Prev,
        marketingSpendPrev,
        channelSpendTotalsPrev,
        marketingBureauPrev,
        marketingToolingPrev,
        db3Prev,
        fixedExpensesPrev,
        resultPrev,
        blendedPoasPrev,
        visibleAdSpendChannels,
        primarySalesRevenueLabel,
    };
}
