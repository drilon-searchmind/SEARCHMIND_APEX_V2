"use client";

/* eslint-disable react-hooks/set-state-in-effect -- reset spend exclusions when customer changes (same as markets filter) */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    adSpendChannelsConfigured,
    adSpendChannelsForShopifyMarketsFilterUi,
    buildDefaultExcludedAdSpendPlatformsForShopifyMarkets,
} from "@/lib/mergeAdSpendDaily";

/**
 * Paid media multi-select by configured integrations (Shopify Markets feature gate).
 * Checkbox "on" = include channel in aggregates. Draft until Apply → `appliedExcludedPlatforms`.
 *
 * Shopify Markets: defaults to Meta + Google only; other configured channels (not Reddit) are opt-in.
 * Reddit is never included (forced excluded server-side).
 */
export function useAdSpendPlatformsFilter(customer, shopifyMarketsFeatureOn) {
    const configuredChannels = useMemo(() => {
        if (!customer?.CustomerSettings || !shopifyMarketsFeatureOn) return [];
        return adSpendChannelsConfigured(customer.CustomerSettings);
    }, [customer, shopifyMarketsFeatureOn]);

    /** Checkboxes in the Spend menu (Reddit omitted — disabled for Markets dashboards). */
    const adSpendFilterUiChannels = useMemo(() => {
        if (!customer?.CustomerSettings || !shopifyMarketsFeatureOn) return [];
        return adSpendChannelsForShopifyMarketsFilterUi(customer.CustomerSettings);
    }, [customer, shopifyMarketsFeatureOn]);

    const [appliedExcludedPlatforms, setAppliedExcludedPlatforms] = useState({});
    const [draftExcludedPlatforms, setDraftExcludedPlatforms] = useState({});

    /** When set of configurable (UI) channels changes, re-apply Shopify Markets defaults (e.g. settings loaded). */
    const marketsSpendInitKey = useMemo(() => {
        if (!shopifyMarketsFeatureOn || !customer?._id) return "";
        const ids = adSpendChannelsForShopifyMarketsFilterUi(customer.CustomerSettings)
            .map((c) => c.id)
            .sort()
            .join(",");
        return `${customer._id}|${ids}`;
    }, [shopifyMarketsFeatureOn, customer]);

    useEffect(() => {
        if (!shopifyMarketsFeatureOn) {
            setAppliedExcludedPlatforms({});
            setDraftExcludedPlatforms({});
            return;
        }
        if (!marketsSpendInitKey) return;
        const init = buildDefaultExcludedAdSpendPlatformsForShopifyMarkets(customer?.CustomerSettings);
        setAppliedExcludedPlatforms({ ...init });
        setDraftExcludedPlatforms({ ...init });
    }, [shopifyMarketsFeatureOn, marketsSpendInitKey, customer]);

    const syncDraftFromAppliedSpend = useCallback(() => {
        setDraftExcludedPlatforms({ ...appliedExcludedPlatforms });
    }, [appliedExcludedPlatforms]);

    const toggleAdSpendPlatformDraft = useCallback((platformId, included) => {
        if (platformId === "reddit") return;
        setDraftExcludedPlatforms((prev) => {
            const next = { ...prev };
            if (included) delete next[platformId];
            else next[platformId] = true;
            return next;
        });
    }, []);

    const applyAdSpendPlatformFilters = useCallback(() => {
        setAppliedExcludedPlatforms({ ...draftExcludedPlatforms });
    }, [draftExcludedPlatforms]);

    const spendQuerySuffix = useMemo(() => {
        if (!shopifyMarketsFeatureOn || configuredChannels.length === 0) return "";
        const excludedIds = configuredChannels
            .map((c) => c.id)
            .filter((id) => {
                if (id === "reddit") return true;
                return appliedExcludedPlatforms[id] === true;
            });
        if (excludedIds.length === 0) return "";
        const encoded = encodeURIComponent(JSON.stringify(excludedIds));
        return `&adSpendExclude=${encoded}`;
    }, [shopifyMarketsFeatureOn, configuredChannels, appliedExcludedPlatforms]);

    return {
        configuredAdSpendChannels: configuredChannels,
        adSpendFilterUiChannels,
        draftExcludedPlatforms,
        appliedExcludedPlatforms,
        toggleAdSpendPlatformDraft,
        applyAdSpendPlatformFilters,
        syncDraftFromAppliedSpend,
        spendQuerySuffix,
    };
}
