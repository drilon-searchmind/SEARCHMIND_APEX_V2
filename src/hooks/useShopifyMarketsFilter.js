"use client";

/* eslint-disable react-hooks/set-state-in-effect -- sync markets catalog / clear exclusions when customer or feature gate changes (same pattern as Performance Dashboard) */

import { useCallback, useEffect, useMemo, useState } from "react";
import { showToast } from "@/components/ui/ToastProvider";

/**
 * Shopify Markets multi-select + query suffix for merged-sources APIs.
 * Draft exclusions in the dropdown; Apply commits to `appliedExcludedMarkets` and updates fetches.
 */
export function useShopifyMarketsFilter(customer, customerIdFromParams) {
    const shopifyMarketsFeatureOn = Boolean(
        customer?.customerType === "Shopify" &&
            customer?.CustomerSettings?.shopifyMarketsEnabled === true
    );
    const [shopifyMarkets, setShopifyMarkets] = useState([]);
    const [shopifyMarketsLoading, setShopifyMarketsLoading] = useState(false);
    const [appliedExcludedMarkets, setAppliedExcludedMarkets] = useState({});
    const [draftExcludedMarkets, setDraftExcludedMarkets] = useState({});

    useEffect(() => {
        setAppliedExcludedMarkets({});
        setDraftExcludedMarkets({});
    }, [customer?._id]);

    useEffect(() => {
        const id = customer?._id || customerIdFromParams;
        if (!shopifyMarketsFeatureOn || !id) {
            setShopifyMarkets([]);
            setShopifyMarketsLoading(false);
            return undefined;
        }
        let cancelled = false;
        setShopifyMarketsLoading(true);
        fetch(`/api/shopify-markets/${id}`, { credentials: "same-origin" })
            .then(async (r) => {
                const body = await r.json().catch(() => ({}));
                if (!r.ok) {
                    throw new Error(body.error || `Failed to load markets (${r.status})`);
                }
                if (
                    body.graphqlErrors?.length &&
                    !(Array.isArray(body.markets) && body.markets.length > 0)
                ) {
                    const msg = Array.isArray(body.graphqlErrors)
                        ? body.graphqlErrors[0]
                        : String(body.graphqlErrors);
                    showToast({
                        message: `Shopify Markets: ${msg}. Ensure the Admin API token includes the read_markets scope.`,
                        type: "warning",
                        position: "top-center",
                    });
                }
                return body;
            })
            .then((body) => {
                if (cancelled || !body) return;
                setShopifyMarkets(Array.isArray(body.markets) ? body.markets : []);
            })
            .catch((err) => {
                if (!cancelled) {
                    setShopifyMarkets([]);
                    showToast({
                        message: err?.message || "Could not load Shopify Markets",
                        type: "error",
                        position: "top-center",
                    });
                }
            })
            .finally(() => {
                if (!cancelled) setShopifyMarketsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [shopifyMarketsFeatureOn, customer?._id, customerIdFromParams]);

    const syncDraftFromAppliedMarkets = useCallback(() => {
        setDraftExcludedMarkets({ ...appliedExcludedMarkets });
    }, [appliedExcludedMarkets]);

    const toggleShopifyMarketDraft = useCallback((marketId, included) => {
        setDraftExcludedMarkets((prev) => {
            const next = { ...prev };
            if (included) delete next[marketId];
            else next[marketId] = true;
            return next;
        });
    }, []);

    const applyShopifyMarketFilters = useCallback(() => {
        setAppliedExcludedMarkets({ ...draftExcludedMarkets });
    }, [draftExcludedMarkets]);

    const marketQuerySuffix = useMemo(() => {
        const enabledMarkets = shopifyMarkets.filter(
            (m) => appliedExcludedMarkets[m.shopifyqlMarketId] !== true
        );
        if (!shopifyMarketsFeatureOn || shopifyMarkets.length === 0) return "";
        if (enabledMarkets.length === 0) {
            return "&shopifyMarketNoSelection=1";
        }
        if (enabledMarkets.length < shopifyMarkets.length) {
            const payload = encodeURIComponent(
                JSON.stringify(
                    enabledMarkets.map((m) => ({
                        shopifyqlMarketId: m.shopifyqlMarketId,
                        handle: m.handle || "",
                    }))
                )
            );
            return `&shopifyMarkets=${payload}`;
        }
        return "";
    }, [shopifyMarketsFeatureOn, shopifyMarkets, appliedExcludedMarkets]);

    /** @deprecated use draftExcludedMarkets */
    const excludedShopifyMarkets = draftExcludedMarkets;

    /** @deprecated use toggleShopifyMarketDraft */
    const toggleShopifyMarket = toggleShopifyMarketDraft;

    return {
        shopifyMarketsFeatureOn,
        shopifyMarkets,
        shopifyMarketsLoading,
        excludedShopifyMarkets,
        appliedExcludedShopifyMarkets: appliedExcludedMarkets,
        draftExcludedMarkets,
        toggleShopifyMarketDraft,
        toggleShopifyMarket,
        applyShopifyMarketFilters,
        syncDraftFromAppliedMarkets,
        marketQuerySuffix,
    };
}
