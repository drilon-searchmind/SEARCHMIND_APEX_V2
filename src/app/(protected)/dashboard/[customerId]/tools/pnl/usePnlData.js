"use client";

import { useEffect, useState } from "react";
import { totalAdSpendFromMerged, channelSpendTotalsFromMerged, adSpendChannelsForSpendTotals, adSpendChannelsForShopifyMarketsFilterUi } from "@/lib/mergeAdSpendDaily";
import { formatComparisonPeriodDates } from "@/lib/dateRangeComparison";

/**
 * Fetches merged data (current + previous period) and computes all P&L metrics.
 * LEVEL 1 (DB1): Revenue - Cost of Goods Sold
 * LEVEL 2 (DB2): DB1 - Direct Selling Costs (Shipping + Transaction Fees)
 * LEVEL 3 (DB3): DB2 - Marketing Costs (Ad Spend + Bureau + Tooling)
 * RESULT: DB3 - Fixed Expenses (Net Profit/Loss)
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

    const staticExpenses = customer?.CustomerStaticExpenses || {};
    const fetchCogs = customer?.CustomerSettings?.fetchCogsFromStore === true;

    const start = new Date(appliedDateRange?.startDate || 0);
    const end = new Date(appliedDateRange?.endDate || 0);
    const days = appliedDateRange ? Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1 : 0;

    useEffect(() => {
        if (!customer || !appliedDateRange?.startDate || !appliedDateRange?.endDate) return;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
                const compDates = formatComparisonPeriodDates({
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
                ];
                if (!compDates.skip && compDates.startDate && compDates.endDate) {
                    fetches.push(
                        fetch(
                            `${baseUrl}/api/merged-sources/${customer._id}?startDate=${compDates.startDate}&endDate=${compDates.endDate}&source=pnl${mergedSourcesQuerySuffix}`
                        )
                    );
                }
                const results = await Promise.all(fetches);
                const res = results[0];
                const resPrev = results[1];
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

    // Current period calculations
    let totalSales = 0, orders = 0, cogs = 0, db1 = 0, shipping = 0, transactionCosts = 0, db2 = 0;
    let grossSales = 0, totalSalesDisplay = 0, discounts = 0, refunds = 0, deliveryFees = 0, taxes = 0;
    let marketingSpend = 0, marketingBureau = 0, marketingTooling = 0, db3 = 0, fixedExpenses = 0, result = 0;
    let realizedROAS = 0, breakEvenROAS = 0, totalCosts = 0, db1Pct = 0, db2Pct = 0, db3Pct = 0;

    if (merged && days > 0) {
        totalSales = merged.shopifyDaily?.reduce((sum, d) => sum + (d.net_sales || 0), 0) || 0;
        grossSales = merged.shopifyDaily?.reduce((sum, d) => sum + (d.gross_sales || 0), 0) || 0;
        totalSalesDisplay = merged.shopifyDaily?.reduce((sum, d) => sum + (d.total_sales || 0), 0) || 0;
        discounts = merged.shopifyDaily?.reduce((sum, d) => sum + (d.discounts || 0), 0) || 0;
        refunds = merged.shopifyDaily?.reduce((sum, d) => sum + (d.returns || 0), 0) || 0;
        deliveryFees = merged.shopifyDaily?.reduce((sum, d) => sum + (d.shipping_charges || 0), 0) || 0;
        taxes = merged.shopifyDaily?.reduce((sum, d) => sum + (d.taxes || 0), 0) || 0;
        orders = merged.shopifyDaily?.reduce((sum, d) => sum + (d.orders || 0), 0) || 0;

        const cogsPercentage = staticExpenses.cogsPercentage || 0;
        cogs = fetchCogs
            ? (merged.shopifyDaily?.reduce((sum, d) => sum + (d.cost_of_goods_sold || 0), 0) || 0)
            : totalSales * cogsPercentage;
        db1 = totalSales - cogs;
        shipping = orders * (staticExpenses.shippingCostPerOrder || 0);
        transactionCosts = totalSales * (staticExpenses.transactionCostPercentage || 0);
        db2 = db1 - shipping - transactionCosts;

        marketingSpend = totalAdSpendFromMerged(merged);
        marketingBureau = (staticExpenses.marketingBureauCost || 0) / days;
        marketingTooling = (staticExpenses.marketingToolingCost || 0) / days;
        db3 = db2 - marketingSpend - marketingBureau - marketingTooling;
        fixedExpenses = (staticExpenses.fixedExpenses || 0) / days;
        result = db3 - fixedExpenses;

        totalCosts = cogs + shipping + transactionCosts + marketingSpend + marketingBureau + marketingTooling + fixedExpenses;
        realizedROAS = marketingSpend !== 0 ? totalSales / marketingSpend : 0;
        breakEvenROAS = marketingSpend !== 0 ? totalCosts / marketingSpend : 0;
        db1Pct = totalSales !== 0 ? (db1 / totalSales) * 100 : 0;
        db2Pct = totalSales !== 0 ? (db2 / totalSales) * 100 : 0;
        db3Pct = totalSales !== 0 ? (db3 / totalSales) * 100 : 0;
        channelSpendTotals = channelSpendTotalsFromMerged(merged);
    }

    // Previous period calculations
    let grossSalesPrev = 0, totalSalesDisplayPrev = 0, discountsPrev = 0, refundsPrev = 0;
    let deliveryFeesPrev = 0, taxesPrev = 0, totalSalesPrev = 0, cogsPrev = 0, db1Prev = 0;
    let shippingPrev = 0, transactionCostsPrev = 0, db2Prev = 0;
    let marketingSpendPrev = 0, marketingBureauPrev = 0, marketingToolingPrev = 0;
    let db3Prev = 0, fixedExpensesPrev = 0, resultPrev = 0;

    if (mergedPrev && days > 0) {
        const shopifyPrev = mergedPrev.shopifyDaily || [];
        grossSalesPrev = shopifyPrev.reduce((sum, d) => sum + (d.gross_sales || 0), 0);
        totalSalesDisplayPrev = shopifyPrev.reduce((sum, d) => sum + (d.total_sales || 0), 0);
        discountsPrev = shopifyPrev.reduce((sum, d) => sum + (d.discounts || 0), 0);
        refundsPrev = shopifyPrev.reduce((sum, d) => sum + (d.returns || 0), 0);
        deliveryFeesPrev = shopifyPrev.reduce((sum, d) => sum + (d.shipping_charges || 0), 0);
        taxesPrev = shopifyPrev.reduce((sum, d) => sum + (d.taxes || 0), 0);
        totalSalesPrev = shopifyPrev.reduce((sum, d) => sum + (d.net_sales || 0), 0);
        const ordersPrev = shopifyPrev.reduce((sum, d) => sum + (d.orders || 0), 0);

        cogsPrev = fetchCogs
            ? shopifyPrev.reduce((sum, d) => sum + (d.cost_of_goods_sold || 0), 0)
            : totalSalesPrev * (staticExpenses.cogsPercentage || 0);
        db1Prev = totalSalesPrev - cogsPrev;
        shippingPrev = ordersPrev * (staticExpenses.shippingCostPerOrder || 0);
        transactionCostsPrev = totalSalesPrev * (staticExpenses.transactionCostPercentage || 0);
        db2Prev = db1Prev - shippingPrev - transactionCostsPrev;
        marketingSpendPrev = totalAdSpendFromMerged(mergedPrev);
        marketingBureauPrev = (staticExpenses.marketingBureauCost || 0) / days;
        marketingToolingPrev = (staticExpenses.marketingToolingCost || 0) / days;
        db3Prev = db2Prev - marketingSpendPrev - marketingBureauPrev - marketingToolingPrev;
        fixedExpensesPrev = (staticExpenses.fixedExpenses || 0) / days;
        resultPrev = db3Prev - fixedExpensesPrev;
        channelSpendTotalsPrev = channelSpendTotalsFromMerged(mergedPrev);
    }

    const db1CTS = totalSales ? cogs / totalSales : 0;
    const db2CTS = totalSales ? (shipping + transactionCosts) / totalSales : 0;
    const db3CTS = totalSales ? (marketingSpend + marketingBureau + marketingTooling) / totalSales : 0;
    const db1DG = totalSales ? 1 - db1CTS : 0;
    const db2DG = totalSales ? db1DG - db2CTS : 0;
    const db3DG = totalSales ? db2DG - db3CTS : 0;

    const visibleAdSpendChannels =
        merged && days > 0
            ? pnlMarketsSpend?.shopifyMarkets === true &&
              customer?.CustomerSettings?.shopifyMarketsEnabled === true
                ? adSpendChannelsForShopifyMarketsFilterUi(customer.CustomerSettings).filter(
                      (c) => pnlMarketsSpend.appliedExcludedPlatforms?.[c.id] !== true
                  )
                : adSpendChannelsForSpendTotals(
                      customer?.CustomerSettings,
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
        // Current
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
        // Previous
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
        visibleAdSpendChannels,
    };
}
