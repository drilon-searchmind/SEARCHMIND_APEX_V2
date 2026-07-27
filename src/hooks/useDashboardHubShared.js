"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useCustomers } from "@/hooks/useCustomers";
import { useDashboardDataOptional } from "@/contexts/DashboardDataContext";
import { useShopifyMarketsFilter } from "@/hooks/useShopifyMarketsFilter";
import { useAdSpendPlatformsFilter } from "@/hooks/useAdSpendPlatformsFilter";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";

/**
 * When rendered inside the dashboard hub ([customerId]/layout providers),
 * returns shared customer, date range, filters, and cached fetch helpers.
 * Otherwise returns null so pages keep their existing local setup.
 */
export function useDashboardHubShared() {
    return useDashboardDataOptional();
}

/**
 * Resolves customer + optional hub shared state. Pages call this once at the top
 * and branch: if `shared` is set, use shared.* ; else use local hooks/state.
 */
export function useDashboardPageContext() {
    const params = useParams();
    const customerId = params?.customerId;
    const { customers } = useCustomers();
    const customer = useMemo(
        () => customers.find((c) => c._id === customerId) || null,
        [customers, customerId]
    );
    const shared = useDashboardHubShared();

    return { customerId, customer, shared };
}

export function useLocalDashboardDateRange(options) {
    return useDashboardDateRange(options);
}

export function useLocalShopifyMarketsFilter(customer, customerId) {
    return useShopifyMarketsFilter(customer, customerId);
}

export function useLocalAdSpendPlatformsFilter(customer, shopifyMarketsFeatureOn) {
    return useAdSpendPlatformsFilter(customer, shopifyMarketsFeatureOn);
}

/**
 * Single source of truth for markets + ad spend filters in the dashboard hub.
 * When inside DashboardDataProvider, returns shared filter state (persists across views).
 * Otherwise falls back to local hook instances.
 */
export function useDashboardFilters(customer, customerId) {
    const shared = useDashboardDataOptional();
    const localMarkets = useShopifyMarketsFilter(customer, customerId);
    const localSpend = useAdSpendPlatformsFilter(
        customer,
        shared?.shopifyMarketsFeatureOn ?? localMarkets.shopifyMarketsFeatureOn
    );

    return useMemo(() => {
        if (shared) {
            return {
                shopifyMarketsFeatureOn: shared.shopifyMarketsFeatureOn,
                shopifyMarkets: shared.shopifyMarkets,
                shopifyMarketsLoading: shared.shopifyMarketsLoading,
                excludedShopifyMarkets: shared.excludedShopifyMarkets,
                appliedExcludedShopifyMarkets: shared.appliedExcludedShopifyMarkets,
                toggleShopifyMarket: shared.toggleShopifyMarket,
                applyShopifyMarketFilters: shared.applyShopifyMarketFilters,
                syncDraftFromAppliedMarkets: shared.syncDraftFromAppliedMarkets,
                marketQuerySuffix: shared.marketQuerySuffix,
                draftFilterAdSpendByMarket: shared.draftFilterAdSpendByMarket,
                appliedFilterAdSpendByMarket: shared.appliedFilterAdSpendByMarket,
                setDraftFilterAdSpendByMarket: shared.setDraftFilterAdSpendByMarket,
                adSpendFilterUiChannels: shared.adSpendFilterUiChannels,
                draftExcludedPlatforms: shared.draftExcludedPlatforms,
                appliedExcludedPlatforms: shared.appliedExcludedPlatforms,
                toggleAdSpendPlatformDraft: shared.toggleAdSpendPlatformDraft,
                applyAdSpendPlatformFilters: shared.applyAdSpendPlatformFilters,
                syncDraftFromAppliedSpend: shared.syncDraftFromAppliedSpend,
                spendQuerySuffix: shared.spendQuerySuffix,
                mergedSourcesQuerySuffix: shared.mergedSourcesQuerySuffix,
            };
        }

        return {
            ...localMarkets,
            ...localSpend,
            mergedSourcesQuerySuffix: `${localMarkets.marketQuerySuffix}${localSpend.spendQuerySuffix}`,
        };
    }, [shared, localMarkets, localSpend]);
}

export function buildShopifyMarketFilterProps(filters) {
    if (!filters?.shopifyMarketsFeatureOn) return null;
    return {
        loading: filters.shopifyMarketsLoading,
        options: filters.shopifyMarkets,
        excludedMarkets: filters.excludedShopifyMarkets,
        appliedExcludedMarkets: filters.appliedExcludedShopifyMarkets,
        onToggleMarket: filters.toggleShopifyMarket,
        onMenuWillOpen: filters.syncDraftFromAppliedMarkets,
        onApplyMarkets: filters.applyShopifyMarketFilters,
        filterAdSpendByMarket: filters.draftFilterAdSpendByMarket,
        appliedFilterAdSpendByMarket: filters.appliedFilterAdSpendByMarket,
        onFilterAdSpendByMarketChange: filters.setDraftFilterAdSpendByMarket,
    };
}

export function buildAdSpendPlatformFilterProps(filters) {
    if (
        !filters?.shopifyMarketsFeatureOn ||
        !filters.adSpendFilterUiChannels?.length
    ) {
        return null;
    }
    return {
        options: filters.adSpendFilterUiChannels.map((c) => ({
            id: c.id,
            label: c.label,
        })),
        excludedPlatforms: filters.draftExcludedPlatforms,
        appliedExcludedPlatforms: filters.appliedExcludedPlatforms,
        onTogglePlatform: filters.toggleAdSpendPlatformDraft,
        onMenuWillOpen: filters.syncDraftFromAppliedSpend,
        onApplySpend: filters.applyAdSpendPlatformFilters,
    };
}
