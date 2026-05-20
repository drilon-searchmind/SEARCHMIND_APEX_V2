"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import { usePnlData } from "./usePnlData";
import PnlLeftSection from "./PnlLeftSection";
import PnlChartsSidebar from "./PnlChartsSidebar";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";
import { useShopifyMarketsFilter } from "@/hooks/useShopifyMarketsFilter";
import { useAdSpendPlatformsFilter } from "@/hooks/useAdSpendPlatformsFilter";

export default function PNLPage() {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const isFirstOfMonth = today.getDate() === 1;
    const defaultStart = `${yyyy}-${mm}-01`;
    const defaultEnd = isFirstOfMonth ? defaultStart : `${yyyy}-${mm}-${String(today.getDate() - 1).padStart(2, "0")}`;

    const [tempDateRange, setTempDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });
    const [appliedDateRange, setAppliedDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });
    const [comparisonMethod, setComparisonMethod] = useState("Last Year");
    const [tempComparisonMethod, setTempComparisonMethod] = useState("Last Year");

    const handleDateRangeApply = ({ startDate, endDate, comparisonMethod: appliedComparison }) => {
        pushDashboardDateRangeApplied({
            page: "tools_pnl",
            customerId: params.customerId,
            startDate,
            endDate,
            comparisonMethod: appliedComparison,
        });
        setAppliedDateRange({ startDate, endDate });
        if (appliedComparison) setComparisonMethod(appliedComparison);
    };
    const handleStartDateChange = (newStart) => {
        setTempDateRange((dr) => ({ ...dr, startDate: newStart }));
    };
    const handleEndDateChange = (newEnd) => {
        setTempDateRange((dr) => ({ ...dr, endDate: newEnd }));
    };

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
        pnlMarketsSpend
    );
    const comparisonLabel = comparisonMethod === "Last Year" ? "Last Year" : "Last Period";

    return (
        <div className="w-full">
            <DashboardHeading
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
                        onApply={handleDateRangeApply}
                        startDate={tempDateRange.startDate}
                        endDate={tempDateRange.endDate}
                        onStartDateChange={handleStartDateChange}
                        onEndDateChange={handleEndDateChange}
                        loading={pnl.loading}
                        showComparisonMethodToggler={true}
                        comparisonMethod={tempComparisonMethod}
                        onComparisonMethodChange={setTempComparisonMethod}
                    />
                }
            />
            <div className="flex flex-col md:flex-row gap-8 mt-4">
                <PnlLeftSection
                    loading={pnl.loading}
                    error={pnl.error}
                    hasPrev={pnl.hasPrev}
                    comparisonLabel={comparisonLabel}
                    staticExpenses={pnl.staticExpenses}
                    days={pnl.days}
                    fetchCogs={pnl.fetchCogs}
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
                    realizedROAS={pnl.realizedROAS}
                    breakEvenROAS={pnl.breakEvenROAS}
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
    );
}
