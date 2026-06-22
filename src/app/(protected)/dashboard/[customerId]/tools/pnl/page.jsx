"use client";

import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import { usePnlData } from "./usePnlData";
import PnlLeftSection from "./PnlLeftSection";
import PnlChartsSidebar from "./PnlChartsSidebar";
import PnlSummaryStrip from "./PnlSummaryStrip";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { useShopifyMarketsFilter } from "@/hooks/useShopifyMarketsFilter";
import { useAdSpendPlatformsFilter } from "@/hooks/useAdSpendPlatformsFilter";
import "./pnl.css";

export default function PNLPage() {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);

    const {
        appliedDateRange,
        appliedCompareRange,
        comparisonMethod,
        comparisonLabel,
        dateRangePickerProps,
    } = useDashboardDateRange({
        onApply: ({ startDate, endDate, comparisonMethod: appliedComparison }) => {
            pushDashboardDateRangeApplied({
                page: "tools_pnl",
                customerId: params.customerId,
                startDate,
                endDate,
                comparisonMethod: appliedComparison,
            });
        },
    });

    const {
        shopifyMarketsFeatureOn,
        shopifyMarkets,
        shopifyMarketsLoading,
        excludedShopifyMarkets,
        appliedExcludedShopifyMarkets,
        toggleShopifyMarket,
        applyShopifyMarketFilters,
        syncDraftFromAppliedMarkets,
        marketQuerySuffix,
        draftFilterAdSpendByMarket,
        appliedFilterAdSpendByMarket,
        setDraftFilterAdSpendByMarket,
    } = useShopifyMarketsFilter(customer, params.customerId);

    const {
        adSpendFilterUiChannels,
        draftExcludedPlatforms,
        appliedExcludedPlatforms,
        toggleAdSpendPlatformDraft,
        applyAdSpendPlatformFilters,
        syncDraftFromAppliedSpend,
        spendQuerySuffix,
    } = useAdSpendPlatformsFilter(customer, shopifyMarketsFeatureOn);

    const mergedSourcesQuerySuffix = `${marketQuerySuffix}${spendQuerySuffix}`;

    const pnlMarketsSpend = useMemo(
        () =>
            shopifyMarketsFeatureOn
                ? { shopifyMarkets: true, appliedExcludedPlatforms }
                : null,
        [shopifyMarketsFeatureOn, appliedExcludedPlatforms]
    );

    const pnl = usePnlData(
        customer,
        appliedDateRange,
        comparisonMethod,
        mergedSourcesQuerySuffix,
        pnlMarketsSpend,
        appliedCompareRange
    );

    return (
        <div id="PnlPage" className="cobalt-perf w-full" data-theme="cobalt">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="P&L Report"
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                dateRange={appliedDateRange}
                loading={pnl.loading}
                dashboardType="pnl"
                comparisonMethod={comparisonMethod}
                dataSnapshot={{
                    totalSales: pnl.totalSales,
                    grossSales: pnl.grossSales,
                    totalSalesDisplay: pnl.totalSalesDisplay,
                    discounts: pnl.discounts,
                    refunds: pnl.refunds,
                    deliveryFees: pnl.deliveryFees,
                    taxes: pnl.taxes,
                    orders: pnl.orders,
                    cogs: pnl.cogs,
                    db1: pnl.db1,
                    db2: pnl.db2,
                    db3: pnl.db3,
                    shipping: pnl.shipping,
                    transactionCosts: pnl.transactionCosts,
                    marketingSpend: pnl.marketingSpend,
                    channelSpendTotals: pnl.channelSpendTotals,
                    marketingBureau: pnl.marketingBureau,
                    marketingTooling: pnl.marketingTooling,
                    fixedExpenses: pnl.fixedExpenses,
                    result: pnl.result,
                    realizedROAS: pnl.realizedROAS,
                    breakEvenROAS: pnl.breakEvenROAS,
                    totalCosts: pnl.totalCosts,
                    db1Pct: pnl.db1Pct,
                    db2Pct: pnl.db2Pct,
                    db3Pct: pnl.db3Pct,
                    staticExpenses: pnl.staticExpenses,
                    days: pnl.days,
                }}
                shopifyMarketFilter={
                    shopifyMarketsFeatureOn
                        ? {
                              loading: shopifyMarketsLoading,
                              options: shopifyMarkets,
                              excludedMarkets: excludedShopifyMarkets,
                              appliedExcludedMarkets: appliedExcludedShopifyMarkets,
                              onToggleMarket: toggleShopifyMarket,
                              onMenuWillOpen: syncDraftFromAppliedMarkets,
                              onApplyMarkets: applyShopifyMarketFilters,
                              filterAdSpendByMarket: draftFilterAdSpendByMarket,
                              appliedFilterAdSpendByMarket,
                              onFilterAdSpendByMarketChange: setDraftFilterAdSpendByMarket,
                          }
                        : null
                }
                adSpendPlatformFilter={
                    shopifyMarketsFeatureOn && adSpendFilterUiChannels.length > 0
                        ? {
                              options: adSpendFilterUiChannels.map((c) => ({
                                  id: c.id,
                                  label: c.label,
                              })),
                              excludedPlatforms: draftExcludedPlatforms,
                              appliedExcludedPlatforms,
                              onTogglePlatform: toggleAdSpendPlatformDraft,
                              onMenuWillOpen: syncDraftFromAppliedSpend,
                              onApplySpend: applyAdSpendPlatformFilters,
                          }
                        : null
                }
                right={
                    <DateRangePicker
                        {...dateRangePickerProps}
                        variant="cobalt"
                        loading={pnl.loading}
                    />
                }
            />

            <PnlSummaryStrip
                loading={pnl.loading}
                result={pnl.result}
                realizedROAS={pnl.realizedROAS}
                breakEvenROAS={pnl.breakEvenROAS}
            />

            <div className="apex-pnl-layout">
                <PnlLeftSection
                    loading={pnl.loading}
                    error={pnl.error}
                    hasPrev={pnl.hasPrev}
                    comparisonLabel={comparisonLabel}
                    staticExpenses={pnl.staticExpenses}
                    days={pnl.days}
                    fetchCogs={pnl.fetchCogs}
                    primarySalesRevenueLabel={pnl.primarySalesRevenueLabel}
                    grossSales={pnl.grossSales}
                    totalSalesDisplay={pnl.totalSalesDisplay}
                    discounts={pnl.discounts}
                    refunds={pnl.refunds}
                    deliveryFees={pnl.deliveryFees}
                    taxes={pnl.taxes}
                    totalSales={pnl.totalSales}
                    cogs={pnl.cogs}
                    db1={pnl.db1}
                    shipping={pnl.shipping}
                    transactionCosts={pnl.transactionCosts}
                    db2={pnl.db2}
                    marketingSpend={pnl.marketingSpend}
                    channelSpendTotals={pnl.channelSpendTotals}
                    visibleAdSpendChannels={pnl.visibleAdSpendChannels}
                    marketingBureau={pnl.marketingBureau}
                    marketingTooling={pnl.marketingTooling}
                    db3={pnl.db3}
                    fixedExpenses={pnl.fixedExpenses}
                    result={pnl.result}
                    db1CTSDisplay={pnl.db1CTSDisplay}
                    db2CTSDisplay={pnl.db2CTSDisplay}
                    db3CTSDisplay={pnl.db3CTSDisplay}
                    db1DGDisplay={pnl.db1DGDisplay}
                    db2DGDisplay={pnl.db2DGDisplay}
                    db3DGDisplay={pnl.db3DGDisplay}
                    grossSalesPrev={pnl.grossSalesPrev}
                    totalSalesDisplayPrev={pnl.totalSalesDisplayPrev}
                    discountsPrev={pnl.discountsPrev}
                    refundsPrev={pnl.refundsPrev}
                    deliveryFeesPrev={pnl.deliveryFeesPrev}
                    taxesPrev={pnl.taxesPrev}
                    totalSalesPrev={pnl.totalSalesPrev}
                    cogsPrev={pnl.cogsPrev}
                    db1Prev={pnl.db1Prev}
                    shippingPrev={pnl.shippingPrev}
                    transactionCostsPrev={pnl.transactionCostsPrev}
                    db2Prev={pnl.db2Prev}
                    marketingSpendPrev={pnl.marketingSpendPrev}
                    channelSpendTotalsPrev={pnl.channelSpendTotalsPrev}
                    marketingBureauPrev={pnl.marketingBureauPrev}
                    marketingToolingPrev={pnl.marketingToolingPrev}
                    db3Prev={pnl.db3Prev}
                    fixedExpensesPrev={pnl.fixedExpensesPrev}
                    resultPrev={pnl.resultPrev}
                />
                <div className="apex-pnl-layout__aside">
                    <PnlChartsSidebar
                        appliedDateRange={appliedDateRange}
                        customerId={params.customerId}
                        staticExpenses={pnl.staticExpenses}
                        db1Pct={pnl.db1Pct}
                        db2Pct={pnl.db2Pct}
                        db3Pct={pnl.db3Pct}
                        db1={pnl.db1}
                        db2={pnl.db2}
                        db3={pnl.db3}
                    />
                </div>
            </div>
        </div>
    );
}
