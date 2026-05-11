"use client";

/* eslint-disable react-hooks/set-state-in-effect -- reset spend exclusions when customer changes (same as markets filter) */

import { useCallback, useEffect, useMemo, useState } from "react";
import { adSpendChannelsConfigured } from "@/lib/mergeAdSpendDaily";

/**
 * Paid media multi-select by configured integrations (Shopify Markets feature gate).
 * Checkbox "on" = include channel in aggregates. Draft until Apply → `appliedExcludedPlatforms`.
 */
export function useAdSpendPlatformsFilter(customer, shopifyMarketsFeatureOn) {
    const configuredChannels = useMemo(() => {
        if (!customer?.CustomerSettings || !shopifyMarketsFeatureOn) return [];
        return adSpendChannelsConfigured(customer.CustomerSettings);
    }, [customer, shopifyMarketsFeatureOn]);

    const [appliedExcludedPlatforms, setAppliedExcludedPlatforms] = useState({});
    const [draftExcludedPlatforms, setDraftExcludedPlatforms] = useState({});

    useEffect(() => {
        setAppliedExcludedPlatforms({});
        setDraftExcludedPlatforms({});
    }, [customer?._id]);

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
        if (!shopifyMarketsFeatureOn || configuredChannels.length === 0) return "";
        const excludedIds = configuredChannels
            .map((c) => c.id)
            .filter((id) => appliedExcludedPlatforms[id] === true);
        if (excludedIds.length === 0) return "";
        const encoded = encodeURIComponent(JSON.stringify(excludedIds));
        return `&adSpendExclude=${encoded}`;
    }, [shopifyMarketsFeatureOn, configuredChannels, appliedExcludedPlatforms]);

    return {
        configuredAdSpendChannels: configuredChannels,
        draftExcludedPlatforms,
        appliedExcludedPlatforms,
        toggleAdSpendPlatformDraft,
        applyAdSpendPlatformFilters,
        syncDraftFromAppliedSpend,
        spendQuerySuffix,
    };
}
