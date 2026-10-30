"use client";

/* eslint-disable react-hooks/set-state-in-effect -- sync markets catalog / clear exclusions when customer or feature gate changes (same pattern as Performance Dashboard) */

import { useCallback, useEffect, useMemo, useState } from "react";
import { showToast } from "@/components/ui/ToastProvider";

const MARKETS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MARKETS_CACHE_PREFIX = "apex.shopifyMarkets.v1:";

/** @type {Map<string, { at: number, markets: Array<object> }>} */
const marketsMemoryCache = new Map();

/** Markets (with country codes for flags) change rarely: keep them in memory and in localStorage for a day. */
function readMarketsCache(customerId) {
    const mem = marketsMemoryCache.get(customerId);
    if (mem && Date.now() - mem.at < MARKETS_CACHE_TTL_MS) return mem.markets;
    try {
        const raw = window.localStorage.getItem(MARKETS_CACHE_PREFIX + customerId);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.markets) || Date.now() - parsed.at >= MARKETS_CACHE_TTL_MS) return null;
        marketsMemoryCache.set(customerId, parsed);
        return parsed.markets;
    } catch {
        return null;
    }
}

function writeMarketsCache(customerId, markets) {
    const entry = { at: Date.now(), markets };
    marketsMemoryCache.set(customerId, entry);
    try {
        window.localStorage.setItem(MARKETS_CACHE_PREFIX + customerId, JSON.stringify(entry));
    } catch {
        /* storage may be unavailable (private mode, quota); the memory cache still works */
    }
}

/**
 * Shopify Markets multi-select + query suffix for merged-sources APIs.
 * Draft exclusions in the dropdown; Apply commits to `appliedExcludedMarkets` and updates fetches.
 */
export function useShopifyMarketsFilter(customer, customerIdFromParams, options = {}) {
    const fetchMarketsCatalog = options.fetchMarketsCatalog !== false;
    const shopifyMarketsFeatureOn = Boolean(
        customer?.customerType === "Shopify" &&
            customer?.CustomerSettings?.shopifyMarketsEnabled === true
    );
    const [shopifyMarkets, setShopifyMarkets] = useState([]);
    const [shopifyMarketsLoading, setShopifyMarketsLoading] = useState(false);
    const [appliedExcludedMarkets, setAppliedExcludedMarkets] = useState({});
    const [draftExcludedMarkets, setDraftExcludedMarkets] = useState({});
    /** When true, subset market filter also restricts Meta/Google spend to market countries */
    const [appliedFilterAdSpendByMarket, setAppliedFilterAdSpendByMarket] = useState(false);
    const [draftFilterAdSpendByMarket, setDraftFilterAdSpendByMarket] = useState(false);

    useEffect(() => {
        setAppliedExcludedMarkets({});
        setDraftExcludedMarkets({});
        setAppliedFilterAdSpendByMarket(false);
        setDraftFilterAdSpendByMarket(false);
    }, [customer?._id]);

    useEffect(() => {
        const id = customer?._id || customerIdFromParams;
        if (!fetchMarketsCatalog || !shopifyMarketsFeatureOn || !id) {
            setShopifyMarkets([]);
            setShopifyMarketsLoading(false);
            return undefined;
        }
        const cached = readMarketsCache(String(id));
        if (cached) {
            setShopifyMarkets(cached);
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
                const list = Array.isArray(body.markets) ? body.markets : [];
                setShopifyMarkets(list);
                // Only remember a real catalog, never an empty or failed one.
                if (list.length > 0 && !body.graphqlErrors?.length) writeMarketsCache(String(id), list);
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
    }, [shopifyMarketsFeatureOn, customer?._id, customerIdFromParams, fetchMarketsCatalog]);

    const syncDraftFromAppliedMarkets = useCallback(() => {
        setDraftExcludedMarkets({ ...appliedExcludedMarkets });
        setDraftFilterAdSpendByMarket(appliedFilterAdSpendByMarket);
    }, [appliedExcludedMarkets, appliedFilterAdSpendByMarket]);

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
        setAppliedFilterAdSpendByMarket(draftFilterAdSpendByMarket);
    }, [draftExcludedMarkets, draftFilterAdSpendByMarket]);

    const marketQuerySuffix = useMemo(() => {
        const enabledMarkets = shopifyMarkets.filter(
            (m) => appliedExcludedMarkets[m.shopifyqlMarketId] !== true
        );
        if (!shopifyMarketsFeatureOn) return "";
        const adSpendPart = appliedFilterAdSpendByMarket
            ? "&shopifyMarketFilterAdSpend=1"
            : "&shopifyMarketFilterAdSpend=0";
        // Stable suffix while catalog loads so prefetch cache keys don't change mid-flight.
        if (shopifyMarkets.length === 0) {
            return adSpendPart;
        }
        if (enabledMarkets.length === 0) {
            return `&shopifyMarketNoSelection=1${adSpendPart}`;
        }
        let suffix = "";
        if (enabledMarkets.length < shopifyMarkets.length) {
            const payload = encodeURIComponent(
                JSON.stringify(
                    enabledMarkets.map((m) => ({
                        shopifyqlMarketId: m.shopifyqlMarketId,
                        handle: m.handle || "",
                    }))
                )
            );
            suffix = `&shopifyMarkets=${payload}`;
        }
        return suffix + adSpendPart;
    }, [
        shopifyMarketsFeatureOn,
        shopifyMarkets,
        appliedExcludedMarkets,
        appliedFilterAdSpendByMarket,
    ]);

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
        appliedFilterAdSpendByMarket,
        draftFilterAdSpendByMarket,
        setDraftFilterAdSpendByMarket,
    };
}
