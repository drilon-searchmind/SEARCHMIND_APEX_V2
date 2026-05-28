"use client";

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { showToast } from "@/components/ui/ToastProvider";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import { useParams } from "next/navigation";
import MetricCard from "@/components/dashboard/MetricCard";
import Spinner from "@/components/ui/Spinner";
import { FiTrendingUp, FiDollarSign, FiShoppingCart, FiPercent } from "react-icons/fi";
import ParentRevenueOrdersChart from "./components/ParentRevenueOrdersChart";
import ParenteAdspendChart from "./components/ParentAdspendChart";
import ParentROASChart from "./components/ParentROASChart";
import { useParentPropertyView, PARENT_VIEWS } from "@/contexts/ParentPropertyViewContext";
import { useParentPropertyFilter } from "@/contexts/ParentPropertyFilterContext";
import { useParentPropertyGroupSettings } from "@/contexts/ParentPropertyGroupSettingsContext";
import ParentPropertyLoadingOverlay from "@/components/layout/ParentPropertyLoadingOverlay";
import {
    ParentOverviewView,
    ParentDailyView,
    ParentPaceReportView,
    ParentPnlView,
    ParentEcommerceView,
} from "./views";
import { buildParentDailyRows } from "./utils/buildParentDailyRows";
import { isShopifyMarketsCustomer } from "@/lib/customerPlatformDisplay";
import { buildParentShopifyMarketOverridesJson, buildParentAdSpendPlatformOverridesJson } from "@/lib/parentPropertyShopifyMarketOverrides";
import { normalizeMongoId } from "@/lib/parentPropertyGoogleAdsCampaignOverrides";
import { normalizeGoogleAdsCampaignId } from "@/lib/googleAdsCampaignIdUtils";
import ParentChildPropertiesTable from "./components/ParentChildPropertiesTable";
import {
    buildDefaultExcludedAdSpendPlatformsForShopifyMarkets,
} from "@/lib/mergeAdSpendDaily";
import {
    aggregateParentGroupDailyChart,
    parentGroupVisibleAdSpendChannels,
} from "@/lib/parentPropertyAdSpend";

function deriveDisplayedChildRow(row, shopifyRevenueField, groupMetricPreference) {
    const fm = row.fullMetrics;
    let revenue;
    let revenuePrev;
    if (fm) {
        revenue = shopifyRevenueField === "gross_sales" ? fm.grossSales ?? 0 : fm.netRevenue ?? 0;
        revenuePrev =
            shopifyRevenueField === "gross_sales" ? fm.grossSalesPrev ?? 0 : fm.netRevenuePrev ?? 0;
    } else {
        revenue = row.revenue ?? 0;
        revenuePrev = row.prevData?.revenue ?? 0;
    }
    const adspend = row.adspend ?? 0;
    const orders = row.orders ?? 0;
    const roas = adspend > 0 ? revenue / adspend : null;
    const spendshare = revenue > 0 ? adspend / revenue : null;
    const aov = orders > 0 ? revenue / orders : null;
    const adspendPrev = row.prevData?.adspend ?? 0;
    return {
        ...row,
        revenue,
        roas,
        spendshare,
        aov,
        metricPreference: groupMetricPreference,
        prevData: row.prevData
            ? {
                  ...row.prevData,
                  revenue: revenuePrev,
                  roas: adspendPrev > 0 ? revenuePrev / adspendPrev : null,
                  spendshare: revenuePrev > 0 ? adspendPrev / revenuePrev : null,
              }
            : row.prevData,
    };
}

export default function ParentPropertyHome() {
    const { activeView } = useParentPropertyView();
    const { enabledProperties, setChildCustomers: setFilterChildCustomers, setEnabledProperties: setFilterEnabledProperties, toggleProperty } = useParentPropertyFilter();
    const groupSettings = useParentPropertyGroupSettings();
    const shopifyRevenueField = groupSettings?.shopifyRevenueField ?? "net_sales";
    const predominantMetricPreference = groupSettings?.groupMetricPreference ?? "ROAS/POAS";
    const params = useParams();
    const parentCustomerId = params.parentCustomerId;
    const [parentCustomer, setParentCustomer] = useState(null);
    const [childCustomers, setChildCustomers] = useState([]);
    const [allTableRows, setAllTableRows] = useState([]); // Store all fetched data
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [allDailyChartData, setAllDailyChartData] = useState([]); // Store all daily data
    const [chartLoading, setChartLoading] = useState(false);
    const [loadingPhase, setLoadingPhase] = useState("parent"); // 'parent' | 'properties' | 'aggregating' | 'complete'
    const [progressItems, setProgressItems] = useState([]); // [{ id, name, status: 'loading'|'loaded', source?, shop? }]
    const [overlayFading, setOverlayFading] = useState(false); // true during fade-out before unmount
    /** Per Shopify Markets child: catalog + draft/applied exclusions (Apply commits draft) */
    const [groupMarketCatalogs, setGroupMarketCatalogs] = useState({});
    const [groupMarketExcludedDraft, setGroupMarketExcludedDraft] = useState({});
    const [groupMarketExcludedApplied, setGroupMarketExcludedApplied] = useState({});
    /** Per child: match ad spend to market countries (default on) */
    const [groupMarketFilterAdSpendDraft, setGroupMarketFilterAdSpendDraft] = useState({});
    const [groupMarketFilterAdSpendApplied, setGroupMarketFilterAdSpendApplied] = useState({});
    /** Per Shopify Markets child: excluded platform ids (draft / applied) */
    const [groupSpendExcludedDraft, setGroupSpendExcludedDraft] = useState({});
    const [groupSpendExcludedApplied, setGroupSpendExcludedApplied] = useState({});
    /** Google Ads campaign filter (group view only); off by default */
    const [googleCampaignFilterEnabled, setGoogleCampaignFilterEnabled] = useState(false);
    const [groupGoogleCampaignExcludedDraft, setGroupGoogleCampaignExcludedDraft] = useState({});
    const [groupGoogleCampaignExcludedApplied, setGroupGoogleCampaignExcludedApplied] = useState({});
    const softAggregatedRefetchRef = useRef(false);
    const [campaignFilterRevision, setCampaignFilterRevision] = useState(0);
    /** Sync refs so aggregated fetch URL always sees latest campaign exclusions (avoids stale closure). */
    const googleCampaignFilterEnabledRef = useRef(false);
    const campaignExclusionsAppliedRef = useRef({});
    const aggregatedFetchGenerationRef = useRef(0);

    useEffect(() => {
        setGroupMarketCatalogs({});
        setGroupMarketExcludedDraft({});
        setGroupMarketExcludedApplied({});
        setGroupMarketFilterAdSpendDraft({});
        setGroupMarketFilterAdSpendApplied({});
        setGroupSpendExcludedDraft({});
        setGroupSpendExcludedApplied({});
    }, [parentCustomerId]);

    const applyGoogleAdsFiltersFromServer = useCallback((ga) => {
        const nextApplied = ga?.excludedByChildId || {};
        const nextEnabled = ga?.filterEnabled === true;
        campaignExclusionsAppliedRef.current = nextApplied;
        googleCampaignFilterEnabledRef.current = nextEnabled;
        setGroupGoogleCampaignExcludedApplied(nextApplied);
        setGroupGoogleCampaignExcludedDraft(nextApplied);
        setGoogleCampaignFilterEnabled(nextEnabled);
    }, []);

    /** Save exclusions for one child Customer (not the parent). */
    const persistGoogleAdsChildFilters = useCallback(
        async (childCustomerId, excludedCampaignIds, filterEnabled) => {
            const cid = normalizeMongoId(childCustomerId);
            if (!cid) throw new Error("Invalid child property id");

            const res = await fetch(
                `/api/parent-customers/${parentCustomerId}/customer-filters`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    credentials: "same-origin",
                    body: JSON.stringify({
                        googleAds: {
                            filterEnabled: filterEnabled === true,
                            childCustomerId: cid,
                            excludedCampaignIds: Array.isArray(excludedCampaignIds)
                                ? excludedCampaignIds
                                : [],
                        },
                    }),
                }
            );
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(body.error || `Save filters (${res.status})`);
            }
            applyGoogleAdsFiltersFromServer(body.googleAds);
            return body;
        },
        [parentCustomerId, applyGoogleAdsFiltersFromServer]
    );

    const persistGoogleAdsFilterEnabledOnly = useCallback(
        async (filterEnabled) => {
            const res = await fetch(
                `/api/parent-customers/${parentCustomerId}/customer-filters`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    credentials: "same-origin",
                    body: JSON.stringify({
                        googleAds: { filterEnabled: filterEnabled === true },
                    }),
                }
            );
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(body.error || `Save filter toggle (${res.status})`);
            }
            applyGoogleAdsFiltersFromServer(body.googleAds);
            return body;
        },
        [parentCustomerId, applyGoogleAdsFiltersFromServer]
    );

    useEffect(() => {
        if (!parentCustomerId) return undefined;
        let cancelled = false;

        (async () => {
            try {
                const res = await fetch(
                    `/api/parent-customers/${parentCustomerId}/customer-filters`,
                    { credentials: "same-origin" }
                );
                const body = await res.json().catch(() => ({}));
                if (cancelled) return;
                if (!res.ok) return;

                const ga = body.googleAds || {};
                const excludedByChildId = ga.excludedByChildId || {};
                const filterEnabled = ga.filterEnabled === true;

                campaignExclusionsAppliedRef.current = excludedByChildId;
                googleCampaignFilterEnabledRef.current = filterEnabled;
                setGroupGoogleCampaignExcludedApplied(excludedByChildId);
                setGroupGoogleCampaignExcludedDraft(excludedByChildId);
                setGoogleCampaignFilterEnabled(filterEnabled);
            } catch {
                /* keep defaults */
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [parentCustomerId]);

    useEffect(() => {
        googleCampaignFilterEnabledRef.current = googleCampaignFilterEnabled;
    }, [googleCampaignFilterEnabled]);

    useEffect(() => {
        campaignExclusionsAppliedRef.current = groupGoogleCampaignExcludedApplied;
    }, [groupGoogleCampaignExcludedApplied]);

    const handleGoogleCampaignFilterEnabledChange = useCallback(
        async (enabled) => {
            const nextEnabled = enabled === true;
            googleCampaignFilterEnabledRef.current = nextEnabled;
            setGoogleCampaignFilterEnabled(nextEnabled);
            try {
                await persistGoogleAdsFilterEnabledOnly(nextEnabled);
                softAggregatedRefetchRef.current = true;
                setCampaignFilterRevision((n) => n + 1);
            } catch (e) {
                showToast({
                    message: e?.message || "Could not save campaign filter setting",
                    type: "error",
                    position: "top-center",
                });
            }
        },
        [persistGoogleAdsFilterEnabledOnly]
    );

    useEffect(() => {
        if (!Array.isArray(childCustomers) || childCustomers.length === 0) return;
        setGroupSpendExcludedApplied((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const c of childCustomers) {
                if (!isShopifyMarketsCustomer(c)) continue;
                const id = String(c._id);
                if (Object.prototype.hasOwnProperty.call(prev, id)) continue;
                next[id] = buildDefaultExcludedAdSpendPlatformsForShopifyMarkets();
                changed = true;
            }
            return changed ? next : prev;
        });
        setGroupSpendExcludedDraft((prev) => {
            const next = { ...prev };
            let changed = false;
            for (const c of childCustomers) {
                if (!isShopifyMarketsCustomer(c)) continue;
                const id = String(c._id);
                if (Object.prototype.hasOwnProperty.call(prev, id)) continue;
                next[id] = buildDefaultExcludedAdSpendPlatformsForShopifyMarkets();
                changed = true;
            }
            return changed ? next : prev;
        });
    }, [childCustomers]);

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    // First day of month as start; end = yesterday (unless 1st of month, then 1st as end too)
    const isFirstOfMonth = today.getDate() === 1;
    const defaultStart = `${yyyy}-${mm}-01`;
    const defaultEnd = isFirstOfMonth ? `${yyyy}-${mm}-01` : `${yyyy}-${mm}-${String(today.getDate() - 1).padStart(2, "0")}`;
    const [tempDateRange, setTempDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });
    const [appliedDateRange, setAppliedDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });

    // Comparison method: applied (triggers fetch) vs temp (picker until Apply)
    const [comparisonMethod, setComparisonMethod] = useState("Last Year");
    const [tempComparisonMethod, setTempComparisonMethod] = useState("Last Year");
    // Handlers for DateRangePicker (controlled) - comparison only applies on Apply
    const handleDateRangeApply = ({ startDate, endDate, comparisonMethod: appliedComparison }) => {
        setAppliedDateRange({ startDate, endDate });
        if (appliedComparison) setComparisonMethod(appliedComparison);
    };
    const handleStartDateChange = (newStart) => {
        setTempDateRange(dr => ({ ...dr, startDate: newStart }));
    };
    const handleEndDateChange = (newEnd) => {
        setTempDateRange(dr => ({ ...dr, endDate: newEnd }));
    };

    // Helper for percent change
    function percentChange(current, prev) {
        if (prev === 0 || prev === null || prev === undefined) return null;
        return ((current - prev) / Math.abs(prev)) * 100;
    }

    const shopifyMarketOverridesParam = useMemo(
        () =>
            buildParentShopifyMarketOverridesJson(
                childCustomers,
                groupMarketCatalogs,
                groupMarketExcludedApplied,
                groupMarketFilterAdSpendApplied
            ),
        [childCustomers, groupMarketCatalogs, groupMarketExcludedApplied, groupMarketFilterAdSpendApplied]
    );

    const adSpendPlatformOverridesParam = useMemo(
        () =>
            buildParentAdSpendPlatformOverridesJson(childCustomers, groupSpendExcludedApplied),
        [childCustomers, groupSpendExcludedApplied]
    );

    const parentAggregatedQueryExtras = useMemo(() => {
        const qs = [];
        if (shopifyMarketOverridesParam && shopifyMarketOverridesParam.length > 0) {
            qs.push(`shopifyMarketOverrides=${encodeURIComponent(shopifyMarketOverridesParam)}`);
        }
        if (adSpendPlatformOverridesParam && adSpendPlatformOverridesParam.length > 0) {
            qs.push(`adSpendPlatformOverrides=${encodeURIComponent(adSpendPlatformOverridesParam)}`);
        }
        return qs.length > 0 ? `&${qs.join("&")}` : "";
    }, [shopifyMarketOverridesParam, adSpendPlatformOverridesParam]);

    const handleGroupMarketCatalogLoaded = useCallback((childId, list) => {
        setGroupMarketCatalogs((prev) => ({ ...prev, [String(childId)]: list }));
    }, []);

    const handleGroupMarketToggleDraft = useCallback((childId, marketId, included) => {
        setGroupMarketExcludedDraft((prev) => {
            const cid = String(childId);
            const next = { ...prev };
            const cur = { ...(next[cid] || {}) };
            if (included) delete cur[marketId];
            else cur[marketId] = true;
            if (Object.keys(cur).length === 0) delete next[cid];
            else next[cid] = cur;
            return next;
        });
    }, []);

    const handleApplyMarketsForChild = useCallback((childId) => {
        const cid = String(childId);
        const draft = groupMarketExcludedDraft[cid];
        setGroupMarketExcludedApplied((prev) => {
            const next = { ...prev };
            if (!draft || Object.keys(draft).length === 0) delete next[cid];
            else next[cid] = { ...draft };
            return next;
        });
        setGroupMarketFilterAdSpendApplied((prev) => ({
            ...prev,
            [cid]: groupMarketFilterAdSpendDraft[cid] === true,
        }));
    }, [groupMarketExcludedDraft, groupMarketFilterAdSpendDraft]);

    const handleMarketsMenuOpen = useCallback(
        (childId) => {
            const cid = String(childId);
            setGroupMarketExcludedDraft((prev) => ({
                ...prev,
                [cid]: { ...(groupMarketExcludedApplied[cid] || {}) },
            }));
            setGroupMarketFilterAdSpendDraft((prev) => ({
                ...prev,
                [cid]: groupMarketFilterAdSpendApplied[cid] === true,
            }));
        },
        [groupMarketExcludedApplied, groupMarketFilterAdSpendApplied]
    );

    const handleGroupMarketFilterAdSpendDraft = useCallback((childId, enabled) => {
        const cid = String(childId);
        setGroupMarketFilterAdSpendDraft((prev) => ({ ...prev, [cid]: enabled }));
    }, []);

    const handleGroupSpendToggleDraft = useCallback((childId, platformId, included) => {
        setGroupSpendExcludedDraft((prev) => {
            const cid = String(childId);
            const next = { ...prev };
            const cur = { ...(next[cid] || {}) };
            if (included) delete cur[platformId];
            else cur[platformId] = true;
            if (Object.keys(cur).length === 0) delete next[cid];
            else next[cid] = cur;
            return next;
        });
    }, []);

    const handleApplySpendForChild = useCallback((childId) => {
        const cid = String(childId);
        const draft = groupSpendExcludedDraft[cid];
        setGroupSpendExcludedApplied((prev) => {
            const next = { ...prev };
            if (!draft || Object.keys(draft).length === 0) delete next[cid];
            else next[cid] = { ...draft };
            return next;
        });
    }, [groupSpendExcludedDraft]);

    const handleSpendMenuOpen = useCallback(
        (childId) => {
            const cid = String(childId);
            setGroupSpendExcludedDraft((prev) => ({
                ...prev,
                [cid]: { ...(groupSpendExcludedApplied[cid] || {}) },
            }));
        },
        [groupSpendExcludedApplied]
    );

    const handleApplyGoogleCampaignsForChild = useCallback(
        async (childId, excludedCampaignIds) => {
            const cid = normalizeMongoId(childId);
            if (!cid) return;

            const ids = Array.isArray(excludedCampaignIds)
                ? excludedCampaignIds
                      .map((id) => normalizeGoogleAdsCampaignId(id))
                      .filter(Boolean)
                : [];

            const filterEnabled =
                googleCampaignFilterEnabledRef.current === true || ids.length > 0;

            try {
                await persistGoogleAdsChildFilters(cid, ids, filterEnabled);
                softAggregatedRefetchRef.current = true;
                setCampaignFilterRevision((n) => n + 1);
                showToast({
                    message: "Campaign filters saved for this property. Updating adspend…",
                    position: "top-center",
                });
            } catch (e) {
                showToast({
                    message: e?.message || "Could not save campaign filters",
                    type: "error",
                    position: "top-center",
                });
            }
        },
        [persistGoogleAdsChildFilters]
    );

    const handleGoogleCampaignsMenuOpen = useCallback(
        (childId) => {
            const cid = normalizeMongoId(childId);
            setGroupGoogleCampaignExcludedDraft((prev) => ({
                ...prev,
                [cid]: { ...(groupGoogleCampaignExcludedApplied[cid] || {}) },
            }));
        },
        [groupGoogleCampaignExcludedApplied]
    );

    // Streaming aggregated fetch: parent + all children's merged data with progressive progress updates.
    useEffect(() => {
        const softRefetch = softAggregatedRefetchRef.current;
        softAggregatedRefetchRef.current = false;

        if (!softRefetch) {
            setLoading(true);
            setLoadingPhase("parent");
            setProgressItems([]);
            setOverlayFading(false);
        }
        setChartLoading(true);
        setError(null);

        const fetchGeneration = ++aggregatedFetchGenerationRef.current;
        const abortController = new AbortController();

        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
                const url = `${baseUrl}/api/parent-customers/${parentCustomerId}/aggregated?startDate=${appliedDateRange.startDate}&endDate=${appliedDateRange.endDate}&comparisonMethod=${encodeURIComponent(comparisonMethod)}&stream=1${parentAggregatedQueryExtras}`;
                const res = await fetch(url, { signal: abortController.signal });
                if (!res.ok) throw new Error("Failed to fetch parent property data");
                if (!res.body) throw new Error("Streaming not supported");

                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (fetchGeneration !== aggregatedFetchGenerationRef.current) return;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (!line.trim()) continue;
                        if (fetchGeneration !== aggregatedFetchGenerationRef.current) return;
                        try {
                            const event = JSON.parse(line);
                            if (event.type === "start") {
                                setLoadingPhase("properties");
                                setParentCustomer((p) => (p ? p : { _id: null, name: event.parentName, customers: [] }));
                                setProgressItems(
                                    (event.children || []).map((c) => ({ id: c.id, name: c.name, status: "loading" }))
                                );
                            } else if (event.type === "loaded") {
                                setProgressItems((prev) =>
                                    prev.map((p) =>
                                        p.id === event.id
                                            ? { ...p, status: "loaded", source: event.source, shop: event.shop }
                                            : p
                                    )
                                );
                            } else if (event.type === "aggregating") {
                                setLoadingPhase("aggregating");
                            } else if (event.type === "complete" || (event.parent && event.rows !== undefined)) {
                                if (fetchGeneration !== aggregatedFetchGenerationRef.current) return;

                                const parent = { _id: event.parent._id, name: event.parent.name, customers: event.parent.customers || [] };
                                const children = event.parent.customers || [];

                                setParentCustomer(parent);
                                setChildCustomers(children);
                                setAllTableRows(event.rows || []);
                                setAllDailyChartData(event.dailyData || []);
                                setFilterChildCustomers(children);
                                const initialEnabled = {};
                                children.forEach((c) => {
                                    initialEnabled[String(c._id)] = true;
                                });
                                setFilterEnabledProperties(initialEnabled);

                                setLoadingPhase("complete");
                                setLoading(false);
                                setChartLoading(false);

                                // Brief "Complete" display, then fade out
                                await new Promise((r) => setTimeout(r, 600));
                                if (fetchGeneration !== aggregatedFetchGenerationRef.current) return;
                                setOverlayFading(true);
                                await new Promise((r) => setTimeout(r, 400));
                                setLoadingPhase("parent");
                                setProgressItems([]);
                                setOverlayFading(false);
                            }
                        } catch (e) {
                            // ignore parse errors for partial chunks
                        }
                    }
                }
            } catch (err) {
                if (err?.name === "AbortError") return;
                if (fetchGeneration !== aggregatedFetchGenerationRef.current) return;
                setError(err.message);
                setChildCustomers([]);
                setAllTableRows([]);
                setAllDailyChartData([]);
                setLoading(false);
                setChartLoading(false);
            }
        })();

        return () => {
            abortController.abort();
        };
    }, [
        parentCustomerId,
        appliedDateRange,
        comparisonMethod,
        parentAggregatedQueryExtras,
        campaignFilterRevision,
    ]);

    // Filter data based on enabled properties
    const { filteredTableRows, filteredDailyData, metrics, metricsPrev, aggregatedMetrics, aggregatedMetricsPrev, filteredDailyRows, filteredDailyRowsPrev } = useMemo(() => {
        const filteredRaw = allTableRows.filter((row) => enabledProperties[String(row._id)] !== false);
        const filtered = filteredRaw.map((row) =>
            deriveDisplayedChildRow(row, shopifyRevenueField, predominantMetricPreference)
        );
        const filteredDailyDataList = allDailyChartData.filter(
            (r) => enabledProperties[String(r._id)] !== false
        );

        const aggregatedDaily = aggregateParentGroupDailyChart(
            allDailyChartData.filter((result) => enabledProperties[String(result._id)] !== false),
            shopifyRevenueField
        );

        // Calculate metrics from filtered data (revenue aligns with chosen Shopify basis + group metric prefs)
        const totalRevenue = filtered.reduce((sum, r) => sum + r.revenue, 0);
        const totalAdspend = filtered.reduce((sum, r) => sum + r.adspend, 0);
        const totalOrders = filtered.reduce((sum, r) => sum + r.orders, 0);
        const combinedRoas = totalAdspend > 0 ? totalRevenue / totalAdspend : null;
        const combinedSpendshare = totalRevenue > 0 ? totalAdspend / totalRevenue : null;

        const totalRevenuePrev = filtered.reduce((sum, r) => sum + (r.prevData?.revenue || 0), 0);
        const totalAdspendPrev = filtered.reduce((sum, r) => sum + (r.prevData?.adspend || 0), 0);
        const totalOrdersPrev = filtered.reduce((sum, r) => sum + (r.prevData?.orders || 0), 0);
        const combinedRoasPrev = totalAdspendPrev > 0 ? totalRevenuePrev / totalAdspendPrev : null;
        const combinedSpendsharePrev = totalRevenuePrev > 0 ? totalAdspendPrev / totalRevenuePrev : null;

        // Aggregate full metrics from filtered rows (for parent overview)
        const agg = (key) => filteredRaw.reduce((s, r) => s + (r.fullMetrics?.[key] ?? 0), 0);
        const totalSales = agg("totalSales");
        const grossSales = agg("grossSales");
        const discounts = agg("discounts");
        const returns = agg("returns");
        const netRevenue = agg("netRevenue");
        const orders = agg("orders");
        const shippingCharges = agg("shippingCharges");
        const taxes = agg("taxes");
        const metaSpend = agg("metaSpend");
        const googleSpend = agg("googleSpend");
        const snapchatSpend = agg("snapchatSpend");
        const redditSpend = agg("redditSpend");
        const pinterestSpend = agg("pinterestSpend");
        const bingSpend = agg("bingSpend");
        const cost = agg("cost");
        const totalCogs = agg("totalCogs");
        const fixedCosts = agg("fixedCosts");
        const variableCosts = agg("variableCosts");
        const shippingCost = agg("shippingCost");
        const pickPackCost = agg("pickPackCost");
        const transactionFee = agg("transactionFee");
        const allCosts = agg("allCosts");
        const ebit = agg("ebit");
        const grossProfit = agg("grossProfit");

        const totalSalesPrev = agg("totalSalesPrev");
        const grossSalesPrev = agg("grossSalesPrev");
        const discountsPrev = agg("discountsPrev");
        const returnsPrev = agg("returnsPrev");
        const netRevenuePrev = agg("netRevenuePrev");
        const ordersPrev = agg("ordersPrev");
        const shippingChargesPrev = agg("shippingChargesPrev");
        const taxesPrev = agg("taxesPrev");
        const metaSpendPrev = agg("metaSpendPrev");
        const googleSpendPrev = agg("googleSpendPrev");
        const snapchatSpendPrev = agg("snapchatSpendPrev");
        const redditSpendPrev = agg("redditSpendPrev");
        const pinterestSpendPrev = agg("pinterestSpendPrev");
        const bingSpendPrev = agg("bingSpendPrev");
        const costPrev = agg("costPrev");
        const prevTotalCogs = agg("prevTotalCogs");
        const fixedCostsPrev = agg("fixedCostsPrev");
        const variableCostsPrev = agg("variableCostsPrev");
        const shippingCostPrev = agg("shippingCostPrev");
        const pickPackCostPrev = agg("pickPackCostPrev");
        const transactionFeePrev = agg("transactionFeePrev");
        const allCostsPrev = agg("allCostsPrev");
        const ebitPrev = agg("ebitPrev");
        const grossProfitPrev = agg("grossProfitPrev");

        const revKeyCur = shopifyRevenueField === "gross_sales" ? "grossSales" : "netRevenue";
        const revKeyPrev = shopifyRevenueField === "gross_sales" ? "grossSalesPrev" : "netRevenuePrev";
        const reportingRevenue = filteredRaw.reduce((s, r) => s + (r.fullMetrics?.[revKeyCur] ?? 0), 0);
        const reportingRevenuePrev = filteredRaw.reduce((s, r) => s + (r.fullMetrics?.[revKeyPrev] ?? 0), 0);

        const aov = orders > 0 ? reportingRevenue / orders : null;
        const aovPrev = ordersPrev > 0 ? reportingRevenuePrev / ordersPrev : null;
        const roas = cost > 0 ? reportingRevenue / cost : null;
        const roasPrev = costPrev > 0 ? reportingRevenuePrev / costPrev : null;
        const poas = cost > 0 ? ebit / cost : null;
        const poasPrev = costPrev > 0 ? ebitPrev / costPrev : null;
        const cac = orders > 0 ? cost / orders : null;
        const cacPrev = ordersPrev > 0 ? costPrev / ordersPrev : null;
        const ebitPct = netRevenue > 0 ? (ebit / netRevenue) * 100 : null;
        const ebitPctPrev = netRevenuePrev > 0 ? (ebitPrev / netRevenuePrev) * 100 : null;
        const spendshare = reportingRevenue > 0 ? cost / reportingRevenue : null;
        const spendsharePrev =
            reportingRevenuePrev > 0 ? costPrev / reportingRevenuePrev : null;

        const aggregatedMetrics = filteredRaw.length > 0 ? {
            totalSales,
            grossSales,
            discounts,
            returns,
            netRevenue,
            reportingRevenue,
            orders,
            shippingCharges,
            taxes,
            metaSpend,
            googleSpend,
            snapchatSpend,
            redditSpend,
            pinterestSpend,
            bingSpend,
            cost,
            totalCogs,
            fixedCosts,
            variableCosts,
            shippingCost,
            pickPackCost,
            transactionFee,
            allCosts,
            ebit,
            grossProfit,
            aov,
            roas,
            poas,
            cac,
            ebitPct,
            spendshare,
        } : null;
        const aggregatedMetricsPrev = filteredRaw.length > 0 ? {
            totalSales: totalSalesPrev, grossSales: grossSalesPrev, discounts: discountsPrev, returns: returnsPrev,
            netRevenue: netRevenuePrev,
            reportingRevenue: reportingRevenuePrev,
            orders: ordersPrev, shippingCharges: shippingChargesPrev, taxes: taxesPrev,
            metaSpend: metaSpendPrev,
            googleSpend: googleSpendPrev,
            snapchatSpend: snapchatSpendPrev,
            redditSpend: redditSpendPrev,
            pinterestSpend: pinterestSpendPrev,
            bingSpend: bingSpendPrev,
            cost: costPrev,
            totalCogs: prevTotalCogs,
            fixedCosts: fixedCostsPrev, variableCosts: variableCostsPrev, shippingCost: shippingCostPrev, pickPackCost: pickPackCostPrev,
            transactionFee: transactionFeePrev, allCosts: allCostsPrev, ebit: ebitPrev, grossProfit: grossProfitPrev,
            aov: aovPrev, roas: roasPrev, poas: poasPrev, cac: cacPrev, ebitPct: ebitPctPrev, spendshare: spendsharePrev,
        } : null;

        const dailyRowOpts = { usePrev: false, shopifyRevenueField };
        const filteredDailyRows = buildParentDailyRows(filteredDailyDataList, childCustomers, dailyRowOpts);
        const filteredDailyRowsPrev = buildParentDailyRows(filteredDailyDataList, childCustomers, {
            usePrev: true,
            shopifyRevenueField,
        });

        return {
            filteredTableRows: filtered,
            filteredDailyData: aggregatedDaily,
            metrics: {
                revenue: totalRevenue,
                adspend: totalAdspend,
                orders: totalOrders,
                roas: combinedRoas,
                spendshare: combinedSpendshare,
            },
            metricsPrev: {
                revenue: totalRevenuePrev,
                adspend: totalAdspendPrev,
                orders: totalOrdersPrev,
                roas: combinedRoasPrev,
                spendshare: combinedSpendsharePrev,
            },
            aggregatedMetrics,
            aggregatedMetricsPrev,
            filteredDailyRows,
            filteredDailyRowsPrev,
        };
    }, [
        allTableRows,
        allDailyChartData,
        enabledProperties,
        childCustomers,
        shopifyRevenueField,
        predominantMetricPreference,
    ]);

    const childPropertyRowsForUi = useMemo(
        () =>
            allTableRows.map((row) =>
                deriveDisplayedChildRow(row, shopifyRevenueField, predominantMetricPreference)
            ),
        [allTableRows, shopifyRevenueField, predominantMetricPreference]
    );

    const parentVisibleAdSpendChannels = useMemo(
        () => parentGroupVisibleAdSpendChannels(childCustomers),
        [childCustomers]
    );

    // Metric cards config - conditionally show either ROAS or Spendshare
    const metricCards = [
        {
            label: shopifyRevenueField === "gross_sales" ? "Combined Revenue (gross)" : "Combined Revenue",
            value: metrics.revenue.toLocaleString("da-DK", { style: "currency", currency: "DKK" }),
            change: percentChange(metrics.revenue, metricsPrev.revenue) !== null ? Math.abs(percentChange(metrics.revenue, metricsPrev.revenue)).toFixed(1) : undefined,
            changeType: percentChange(metrics.revenue, metricsPrev.revenue) > 0 ? "up" : percentChange(metrics.revenue, metricsPrev.revenue) < 0 ? "down" : undefined,
            icon: <FiDollarSign />,
        },
        {
            label: "Total Adspend",
            value: metrics.adspend.toLocaleString("da-DK", { style: "currency", currency: "DKK" }),
            change: percentChange(metrics.adspend, metricsPrev.adspend) !== null ? Math.abs(percentChange(metrics.adspend, metricsPrev.adspend)).toFixed(1) : undefined,
            changeType: percentChange(metrics.adspend, metricsPrev.adspend) > 0 ? "up" : percentChange(metrics.adspend, metricsPrev.adspend) < 0 ? "down" : undefined,
            icon: <FiTrendingUp />,
        },
        {
            label: "Total Orders",
            value: metrics.orders.toLocaleString(),
            change: percentChange(metrics.orders, metricsPrev.orders) !== null ? Math.abs(percentChange(metrics.orders, metricsPrev.orders)).toFixed(1) : undefined,
            changeType: percentChange(metrics.orders, metricsPrev.orders) > 0 ? "up" : percentChange(metrics.orders, metricsPrev.orders) < 0 ? "down" : undefined,
            icon: <FiShoppingCart />,
        },
    ];

    // Add either Combined ROAS or Spendshare based on predominant preference
    if (predominantMetricPreference === 'Spendshare') {
        metricCards.push({
            label: "Combined Spendshare",
            value: metrics.spendshare !== null ? (metrics.spendshare * 100).toFixed(2) + "%" : "-",
            change: percentChange(metrics.spendshare, metricsPrev.spendshare) !== null ? Math.abs(percentChange(metrics.spendshare, metricsPrev.spendshare)).toFixed(1) : undefined,
            changeType: percentChange(metrics.spendshare, metricsPrev.spendshare) > 0 ? "up" : percentChange(metrics.spendshare, metricsPrev.spendshare) < 0 ? "down" : undefined,
            icon: <FiPercent />,
        });
    } else {
        metricCards.push({
            label: "Combined ROAS",
            value: metrics.roas !== null ? metrics.roas.toFixed(2) : "-",
            change: percentChange(metrics.roas, metricsPrev.roas) !== null ? Math.abs(percentChange(metrics.roas, metricsPrev.roas)).toFixed(1) : undefined,
            changeType: percentChange(metrics.roas, metricsPrev.roas) > 0 ? "up" : percentChange(metrics.roas, metricsPrev.roas) < 0 ? "down" : undefined,
            icon: <FiPercent />,
        });
    }

    // Shared data passed to all views - state is preserved when switching
    const sharedData = {
        parentCustomer,
        parentCustomerId,
        childCustomers,
        filteredTableRows,
        filteredDailyData,
        allTableRows,
        enabledProperties,
        metrics,
        metricsPrev,
        aggregatedMetrics,
        aggregatedMetricsPrev,
        filteredDailyRows,
        filteredDailyRowsPrev,
        appliedDateRange,
        tempDateRange,
        comparisonMethod,
        tempComparisonMethod,
        setTempComparisonMethod,
        predominantMetricPreference,
        shopifyRevenueField,
        loading,
        chartLoading,
        toggleProperty,
        handleDateRangeApply,
        handleStartDateChange,
        handleEndDateChange,
        parentAggregatedQueryExtras,
        childPropertyRowsForUi,
        parentVisibleAdSpendChannels,
        error,
        groupMarketExcludedDraft,
        groupMarketFilterAdSpendDraft,
        groupSpendExcludedDraft,
        handleGroupMarketToggleDraft,
        handleGroupMarketFilterAdSpendDraft,
        handleGroupMarketCatalogLoaded,
        handleApplyMarketsForChild,
        handleMarketsMenuOpen,
        handleGroupSpendToggleDraft,
        handleApplySpendForChild,
        handleSpendMenuOpen,
        googleCampaignFilterEnabled,
        handleGoogleCampaignFilterEnabledChange,
        groupGoogleCampaignExcludedDraft,
        handleApplyGoogleCampaignsForChild,
        handleGoogleCampaignsMenuOpen,
    };

    // Render views with loading overlay
    return (
        <>
            <ParentPropertyLoadingOverlay
                visible={loading || loadingPhase === "complete" || overlayFading}
                phase={loadingPhase}
                parentName={parentCustomer?.name}
                items={progressItems}
                fading={overlayFading}
            />
            {activeView === PARENT_VIEWS.OVERVIEW && <ParentOverviewView sharedData={sharedData} />}
            {activeView === PARENT_VIEWS.DAILY && <ParentDailyView sharedData={sharedData} />}
            {activeView === PARENT_VIEWS.PACE_REPORT && <ParentPaceReportView sharedData={sharedData} />}
            {activeView === PARENT_VIEWS.PNL && <ParentPnlView sharedData={sharedData} />}
            {activeView === PARENT_VIEWS.ECOMMERCE && <ParentEcommerceView sharedData={sharedData} />}
            {activeView !== PARENT_VIEWS.OVERVIEW &&
                activeView !== PARENT_VIEWS.DAILY &&
                activeView !== PARENT_VIEWS.PACE_REPORT &&
                activeView !== PARENT_VIEWS.PNL &&
                activeView !== PARENT_VIEWS.ECOMMERCE && (
                    <div className="w-full">
            <DashboardHeading
                title="Parent Property Overview"
                label={parentCustomer?.name || parentCustomerId}
                customerId={parentCustomerId}
                dateRange={appliedDateRange}
                loading={loading}
                dashboardType="parent-property"
                dataSnapshot={{ metrics, metricsPrev, tableRows: filteredTableRows, dailyChartData: filteredDailyData, predominantMetricPreference }}
                right={
                    <DateRangePicker
                        startDate={tempDateRange.startDate}
                        endDate={tempDateRange.endDate}
                        onStartDateChange={handleStartDateChange}
                        onEndDateChange={handleEndDateChange}
                        onApply={handleDateRangeApply}
                        loading={loading}
                        showComparisonMethodToggler={true}
                        comparisonMethod={tempComparisonMethod}
                        onComparisonMethodChange={setTempComparisonMethod}
                    />
                }
                comparisonMethod={comparisonMethod}
            />

            {/* Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 w-full mb-8">
                {metricCards.map((card, idx) => (
                    <MetricCard
                        key={idx}
                        label={card.label}
                        value={card.value}
                        icon={card.icon}
                        change={card.change}
                        changeType={card.changeType}
                        comparisonMethod={comparisonMethod}
                    />
                ))}
            </div>

            <ParentChildPropertiesTable
                loading={loading}
                error={error}
                rows={childPropertyRowsForUi}
                childCustomers={childCustomers}
                visibleAdSpendChannels={parentVisibleAdSpendChannels}
                shopifyRevenueField={shopifyRevenueField}
                predominantMetricPreference={predominantMetricPreference}
                groupMarketExcludedDraft={groupMarketExcludedDraft}
                groupMarketFilterAdSpendDraft={groupMarketFilterAdSpendDraft}
                groupSpendExcludedDraft={groupSpendExcludedDraft}
                onToggleMarket={handleGroupMarketToggleDraft}
                onCatalogLoaded={handleGroupMarketCatalogLoaded}
                onFilterAdSpendByMarketChange={handleGroupMarketFilterAdSpendDraft}
                onApplyMarketsForChild={handleApplyMarketsForChild}
                onMarketsMenuOpen={handleMarketsMenuOpen}
                onToggleSpendPlatform={handleGroupSpendToggleDraft}
                onApplySpendForChild={handleApplySpendForChild}
                onSpendMenuOpen={handleSpendMenuOpen}
                fetchDisabled={loading}
                googleCampaignFilterEnabled={googleCampaignFilterEnabled}
                onGoogleCampaignFilterEnabledChange={handleGoogleCampaignFilterEnabledChange}
                groupGoogleCampaignExcludedDraft={groupGoogleCampaignExcludedDraft}
                appliedDateRange={appliedDateRange}
                onApplyGoogleCampaignsForChild={handleApplyGoogleCampaignsForChild}
                onGoogleCampaignsMenuOpen={handleGoogleCampaignsMenuOpen}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full mb-8">
                <ParentRevenueOrdersChart
                    dailyData={filteredDailyData}
                    loading={chartLoading}
                    shopifyRevenueField={shopifyRevenueField}
                />
                <ParenteAdspendChart
                    dailyData={filteredDailyData}
                    loading={chartLoading}
                    visibleAdSpendChannels={parentVisibleAdSpendChannels}
                />
                <ParentROASChart
                    dailyData={filteredDailyData}
                    loading={chartLoading}
                    metricPreference={predominantMetricPreference}
                    visibleAdSpendChannels={parentVisibleAdSpendChannels}
                />
            </div>
        </div>
                )}
        </>
    );
}