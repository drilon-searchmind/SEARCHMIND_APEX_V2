"use client";

import React, {
    createContext,
    useContext,
    useRef,
    useEffect,
    useMemo,
    useCallback,
    useState,
} from "react";
import { useParams } from "next/navigation";
import dayjs from "dayjs";
import { useCustomers } from "@/hooks/useCustomers";
import { useBusinessCategory } from "@/hooks/useBusinessCategory";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import { useShopifyMarketsFilter } from "@/hooks/useShopifyMarketsFilter";
import { useAdSpendPlatformsFilter } from "@/hooks/useAdSpendPlatformsFilter";
import {
    formatComparisonPeriodDates,
    COMPARISON_METHOD,
} from "@/lib/dateRangeComparison";
import {
    fetchMergedSourcesJson,
    fetchCustomKpisJson,
    fetchMarketsOverviewJson,
} from "@/lib/dashboard/fetchMergedSources";
import { isShopifyMarketsCustomer } from "@/lib/customerPlatformDisplay";

const DashboardDataContext = createContext(null);

export function DashboardDataProvider({ children }) {
    const params = useParams();
    const customerId = params?.customerId;
    const { customers } = useCustomers();
    const customer = useMemo(
        () => customers.find((c) => c._id === customerId) || null,
        [customers, customerId]
    );
    const { isB2B } = useBusinessCategory(customer);
    const isShopifyMarkets = isShopifyMarketsCustomer(customer);

    const cacheRef = useRef(new Map());
    const resolvedCacheRef = useRef(new Map());
    const prefetchGenerationRef = useRef(0);
    const [isPrefetchReady, setIsPrefetchReady] = useState(false);

    const dateRange = useDashboardDateRange();
    const {
        appliedDateRange,
        appliedCompareRange,
        comparisonMethod,
        tempDateRange,
        tempCompareRange,
        tempComparisonMethod,
        comparisonLabel,
        dateRangePickerProps,
        handleDateRangeApply,
        handleStartDateChange,
        handleEndDateChange,
    } = dateRange;

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
    } = useShopifyMarketsFilter(customer, customerId);

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

    const fetchMergedSources = useCallback(
        (source, startDate, endDate, suffix = mergedSourcesQuerySuffix) =>
            fetchMergedSourcesJson({
                customerId,
                source,
                startDate,
                endDate,
                suffix,
                cache: cacheRef.current,
                resolvedCache: resolvedCacheRef.current,
            }),
        [customerId, mergedSourcesQuerySuffix]
    );

    const fetchCustomKpis = useCallback(
        (context = "ecommerce") =>
            fetchCustomKpisJson({
                customerId,
                context,
                cache: cacheRef.current,
                resolvedCache: resolvedCacheRef.current,
            }),
        [customerId]
    );

    const fetchMarketsOverview = useCallback(
        (startDate, endDate, suffix = spendQuerySuffix) =>
            fetchMarketsOverviewJson({
                customerId,
                startDate,
                endDate,
                suffix,
                cache: cacheRef.current,
                resolvedCache: resolvedCacheRef.current,
            }),
        [customerId, spendQuerySuffix]
    );

    const invalidateCache = useCallback(() => {
        cacheRef.current.clear();
        resolvedCacheRef.current.clear();
    }, []);

    useEffect(() => {
        cacheRef.current.clear();
        resolvedCacheRef.current.clear();
    }, [mergedSourcesQuerySuffix]);

    useEffect(() => {
        if (!customerId || !customer) {
            setIsPrefetchReady(false);
            return undefined;
        }

        if (isB2B) {
            setIsPrefetchReady(true);
            return undefined;
        }

        if (!appliedDateRange?.startDate || !appliedDateRange?.endDate) {
            setIsPrefetchReady(false);
            return undefined;
        }

        setIsPrefetchReady(false);

        const generation = ++prefetchGenerationRef.current;
        const abortController = new AbortController();

        const comparisonDates = formatComparisonPeriodDates({
            comparisonMethod,
            startDate: appliedDateRange.startDate,
            endDate: appliedDateRange.endDate,
            compareStartDate: appliedCompareRange.startDate,
            compareEndDate: appliedCompareRange.endDate,
        });

        const prevPeriodDates = formatComparisonPeriodDates({
            comparisonMethod: COMPARISON_METHOD.LAST_PERIOD,
            startDate: appliedDateRange.startDate,
            endDate: appliedDateRange.endDate,
        });

        const startMonth = dayjs(appliedDateRange.startDate);
        const lastYearMonthStart = startMonth.subtract(1, "year").startOf("month");
        const lastYearMonthEnd = lastYearMonthStart.endOf("month");

        const tasks = [
            fetchMergedSources("performance-dashboard", appliedDateRange.startDate, appliedDateRange.endDate),
            fetchMergedSources("daily-overview", appliedDateRange.startDate, appliedDateRange.endDate),
            fetchMergedSources("pace-report", appliedDateRange.startDate, appliedDateRange.endDate),
            fetchMergedSources("pnl", appliedDateRange.startDate, appliedDateRange.endDate),
            fetchCustomKpis("ecommerce"),
        ];

        if (
            !comparisonDates.skip &&
            comparisonDates.startDate &&
            comparisonDates.endDate
        ) {
            tasks.push(
                fetchMergedSources(
                    "performance-dashboard",
                    comparisonDates.startDate,
                    comparisonDates.endDate
                ),
                fetchMergedSources("pnl", comparisonDates.startDate, comparisonDates.endDate)
            );
        }

        if (prevPeriodDates.startDate && prevPeriodDates.endDate) {
            tasks.push(
                fetchMergedSources(
                    "daily-overview",
                    prevPeriodDates.startDate,
                    prevPeriodDates.endDate
                )
            );
        }

        tasks.push(
            fetchMergedSources(
                "daily-overview",
                lastYearMonthStart.format("YYYY-MM-DD"),
                lastYearMonthEnd.format("YYYY-MM-DD")
            )
        );

        if (isShopifyMarkets) {
            tasks.push(
                fetchMarketsOverview(
                    appliedDateRange.startDate,
                    appliedDateRange.endDate
                )
            );
        }

        Promise.allSettled(tasks).then(() => {
            if (generation !== prefetchGenerationRef.current) return;
            setIsPrefetchReady(true);
        });

        return () => {
            abortController.abort();
        };
    }, [
        customerId,
        customer,
        isB2B,
        appliedDateRange,
        appliedCompareRange,
        comparisonMethod,
        mergedSourcesQuerySuffix,
        fetchMergedSources,
        fetchCustomKpis,
        fetchMarketsOverview,
        isShopifyMarkets,
    ]);

    const value = useMemo(
        () => ({
            customerId,
            customer,
            isB2B,
            isShopifyMarkets,
            isHubMode: true,
            isPrefetchReady,
            appliedDateRange,
            appliedCompareRange,
            comparisonMethod,
            tempDateRange,
            tempCompareRange,
            tempComparisonMethod,
            comparisonLabel,
            dateRangePickerProps,
            handleDateRangeApply,
            handleStartDateChange,
            handleEndDateChange,
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
            adSpendFilterUiChannels,
            draftExcludedPlatforms,
            appliedExcludedPlatforms,
            toggleAdSpendPlatformDraft,
            applyAdSpendPlatformFilters,
            syncDraftFromAppliedSpend,
            spendQuerySuffix,
            mergedSourcesQuerySuffix,
            fetchMergedSources,
            fetchCustomKpis,
            fetchMarketsOverview,
            invalidateCache,
        }),
        [
            customerId,
            customer,
            isB2B,
            isShopifyMarkets,
            isPrefetchReady,
            appliedDateRange,
            appliedCompareRange,
            comparisonMethod,
            tempDateRange,
            tempCompareRange,
            tempComparisonMethod,
            comparisonLabel,
            dateRangePickerProps,
            handleDateRangeApply,
            handleStartDateChange,
            handleEndDateChange,
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
            adSpendFilterUiChannels,
            draftExcludedPlatforms,
            appliedExcludedPlatforms,
            toggleAdSpendPlatformDraft,
            applyAdSpendPlatformFilters,
            syncDraftFromAppliedSpend,
            spendQuerySuffix,
            mergedSourcesQuerySuffix,
            fetchMergedSources,
            fetchCustomKpis,
            fetchMarketsOverview,
            invalidateCache,
        ]
    );

    return (
        <DashboardDataContext.Provider value={value}>
            {children}
        </DashboardDataContext.Provider>
    );
}

export function useDashboardData() {
    const ctx = useContext(DashboardDataContext);
    if (!ctx) {
        throw new Error("useDashboardData must be used within DashboardDataProvider");
    }
    return ctx;
}

export function useDashboardDataOptional() {
    return useContext(DashboardDataContext);
}
