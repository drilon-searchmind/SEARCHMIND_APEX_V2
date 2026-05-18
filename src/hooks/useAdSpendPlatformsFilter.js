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
 * Shopify Markets: all channels in the Spend menu are included by default; user can exclude via Apply.
 */
export function useAdSpendPlatformsFilter(customer, shopifyMarketsFeatureOn) {
    const configuredChannels = useMemo(() => {
        if (!customer?.CustomerSettings || !shopifyMarketsFeatureOn) return [];
        return adSpendChannelsConfigured(customer.CustomerSettings);
    }, [customer, shopifyMarketsFeatureOn]);

    /** Checkboxes in the Spend menu (configured platforms + Reddit when app id is set). */
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
        const init = buildDefaultExcludedAdSpendPlatformsForShopifyMarkets();
        setAppliedExcludedPlatforms({ ...init });
        setDraftExcludedPlatforms({ ...init });
    }, [shopifyMarketsFeatureOn, marketsSpendInitKey]);

    const syncDraftFromAppliedSpend = useCallback(() => {
        setDraftExcludedPlatforms({ ...appliedExcludedPlatforms });
    }, [appliedExcludedPlatforms]);

    const toggleAdSpendPlatformDraft = useCallback((platformId, included) => {
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
        if (!shopifyMarketsFeatureOn || adSpendFilterUiChannels.length === 0) return "";
        const excludedIds = adSpendFilterUiChannels
            .map((c) => c.id)
            .filter((id) => appliedExcludedPlatforms[id] === true);
        if (excludedIds.length === 0) return "";
        const encoded = encodeURIComponent(JSON.stringify(excludedIds));
        return `&adSpendExclude=${encoded}`;
    }, [shopifyMarketsFeatureOn, adSpendFilterUiChannels, appliedExcludedPlatforms]);

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
