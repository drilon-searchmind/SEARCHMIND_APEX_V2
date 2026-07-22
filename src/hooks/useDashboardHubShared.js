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
