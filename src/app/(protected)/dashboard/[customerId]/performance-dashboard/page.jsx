"use client"

import React from "react";
import { useParams } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import { FiDollarSign, FiTrendingUp, FiShoppingCart, FiCreditCard, FiBarChart2, FiPieChart, FiShoppingBag, FiUserCheck } from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
// import { revenueData, spendAllocationData, roasData, aovData } from "@/data/dashboardCharts";
import { useEffect, useState, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import { getChartColors } from "@/components/dashboard/chartColors";
import Spinner from "@/components/ui/Spinner";
import Custom from "./components/Custom";
import ReturnsOverrideModal from "./components/ReturnsOverrideModal";
import CogsSettingsModal from "./components/CogsSettingsModal";
import FixedExpensesSettingsModal from "./components/FixedExpensesSettingsModal";
import {
    prepareCustomerStaticExpensesForSave,
    getMonthlyFixedExpensesTotal,
    getFixedExpensesBreakdownLineItems,
} from "@/lib/customerStaticExpensesUtils";
import { buildPerformanceMetricsCards } from "./components/buildPerformanceMetricsCards";
import PerformanceDashboardStandardSections from "./components/PerformanceDashboardStandardSections";
import {
    buildStandardOverviewSections,
    collectSectionMetricKeys,
    getOverviewKpiCardKeys,
} from "@/lib/performanceDashboard/performanceDashboardLayout";
import { computePerformanceDashboardMetrics, netRevenueForShopifyDay } from "@/lib/performanceDashboard/computePerformanceMetrics";
import { getReturnsOverrideSettings } from "@/lib/performanceDashboard/performanceDashboardConstants";
import { applyVatDisplayToShopifyDailyRows } from "@/lib/revenueVatDisplay";
import { netRevenueFromGrossDiscountsReturns } from "@/lib/performanceDashboard/computePerformanceMetrics";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";
import {
    getDefaultDashboardDateRange,
    getComparisonPeriodRange,
    getComparisonMethodLabel,
    getPrevKeyForChartCategory,
    resolveChartCategoryPrevKey,
    COMPARISON_METHOD,
} from "@/lib/dateRangeComparison";
import { useShopifyMarketsFilter } from "@/hooks/useShopifyMarketsFilter";
import { useAdSpendPlatformsFilter } from "@/hooks/useAdSpendPlatformsFilter";
import {
    adSpendByPeriodMap,
    adSpendChannelsForDashboard,
    adSpendChannelsForShopifyMarketsFilterUi,
    aggregateShopifyAndAdSpendByPeriodFromRows,
    channelSpendTotalsFromMerged,
    totalAdSpendFromMerged,
} from "@/lib/mergeAdSpendDaily";
import { calcBlendedPoasOrZero } from "@/lib/poasMetrics";

export default function PerformanceDashboard() {
    const params = useParams();
    const { customers, updateCustomer } = useCustomers();
    const customer = customers.find(c => c._id === params.customerId);

    const defaultRange = getDefaultDashboardDateRange();

    // Separate temp (input) and applied (fetch-triggered) date ranges
    const [tempDateRange, setTempDateRange] = useState({
        startDate: defaultRange.startDate,
        endDate: defaultRange.endDate,
    });
    const [appliedDateRange, setAppliedDateRange] = useState({
        startDate: defaultRange.startDate,
        endDate: defaultRange.endDate,
    });
    const [tempCompareRange, setTempCompareRange] = useState({
        startDate: "",
        endDate: "",
    });
    const [appliedCompareRange, setAppliedCompareRange] = useState({
        startDate: "",
        endDate: "",
    });

    // Comparison method: applied (triggers fetch) vs temp (shown in picker until Apply)
    const [comparisonMethod, setComparisonMethod] = useState(COMPARISON_METHOD.LAST_YEAR);
    const [tempComparisonMethod, setTempComparisonMethod] = useState(
        COMPARISON_METHOD.LAST_YEAR
    );

    const comparisonLabel = getComparisonMethodLabel(comparisonMethod);
    const comparisonMethodForUi =
        comparisonMethod === COMPARISON_METHOD.NONE ? null : comparisonMethod;

    // Handlers for DateRangePicker (controlled) - comparison only applies on Apply
    const handleDateRangeApply = ({
        startDate,
        endDate,
        comparisonMethod: appliedComparison,
        compareStartDate,
        compareEndDate,
    }) => {
        pushDashboardDateRangeApplied({
            page: "performance_dashboard",
            customerId: params.customerId,
            startDate,
            endDate,
            comparisonMethod: appliedComparison,
        });
        setAppliedDateRange({ startDate, endDate });
        if (appliedComparison) setComparisonMethod(appliedComparison);
        if (compareStartDate && compareEndDate) {
            setAppliedCompareRange({
                startDate: compareStartDate,
                endDate: compareEndDate,
            });
        } else {
            setAppliedCompareRange({ startDate: "", endDate: "" });
        }
    };
    const handleStartDateChange = (newStart) => {
        setTempDateRange(dr => ({ ...dr, startDate: newStart }));
    };
    const handleEndDateChange = (newEnd) => {
        setTempDateRange(dr => ({ ...dr, endDate: newEnd }));
    };
    const handleCompareStartChange = (newStart) => {
        setTempCompareRange((r) => ({ ...r, startDate: newStart }));
    };
    const handleCompareEndChange = (newEnd) => {
        setTempCompareRange((r) => ({ ...r, endDate: newEnd }));
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
    } = useShopifyMarketsFilter(customer, params?.customerId);

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

    // Metrics state
    const [metrics, setMetrics] = useState([]);
    const [metricsData, setMetricsData] = useState(null);
    const [metricsDataForCustomKpis, setMetricsDataForCustomKpis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [customKpis, setCustomKpis] = useState([]);
    const [replacementByKey, setReplacementByKey] = useState({});
    const [returnsOverrideModalOpen, setReturnsOverrideModalOpen] = useState(false);
    const [cogsSettingsModalOpen, setCogsSettingsModalOpen] = useState(false);
    const [fixedExpensesModalOpen, setFixedExpensesModalOpen] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [mergedDataRefreshKey, setMergedDataRefreshKey] = useState(0);

    // Fetch merged data and prepare chart data
    const [shopifyDaily, setShopifyDaily] = useState([]);
    const [facebookDaily, setFacebookDaily] = useState([]);
    const [googleDaily, setGoogleDaily] = useState([]);
    const [pinterestDaily, setPinterestDaily] = useState([]);
    const [snapchatDaily, setSnapchatDaily] = useState([]);
    const [bingDaily, setBingDaily] = useState([]);
    const [redditDaily, setRedditDaily] = useState([]);
    // Previous period data for comparison
    const [shopifyDailyPrev, setShopifyDailyPrev] = useState([]);
    const [facebookDailyPrev, setFacebookDailyPrev] = useState([]);
    const [googleDailyPrev, setGoogleDailyPrev] = useState([]);
    const [pinterestDailyPrev, setPinterestDailyPrev] = useState([]);
    const [snapchatDailyPrev, setSnapchatDailyPrev] = useState([]);
    const [bingDailyPrev, setBingDailyPrev] = useState([]);
    const [redditDailyPrev, setRedditDailyPrev] = useState([]);
    // Cached merged responses for metrics rebuild
    const [merged, setMerged] = useState(null);
    const [mergedPrev, setMergedPrev] = useState(null);

    const channelRowsCurr = useMemo(
        () => ({
            facebook: facebookDaily,
            google: googleDaily,
            pinterest: pinterestDaily,
            snapchat: snapchatDaily,
            bing: bingDaily,
            reddit: redditDaily,
        }),
        [facebookDaily, googleDaily, pinterestDaily, snapchatDaily, bingDaily, redditDaily]
    );
    const channelRowsPrev = useMemo(
        () => ({
            facebook: facebookDailyPrev,
            google: googleDailyPrev,
            pinterest: pinterestDailyPrev,
            snapchat: snapchatDailyPrev,
            bing: bingDailyPrev,
            reddit: redditDailyPrev,
        }),
        [
            facebookDailyPrev,
            googleDailyPrev,
            pinterestDailyPrev,
            snapchatDailyPrev,
            bingDailyPrev,
            redditDailyPrev,
        ]
    );

    const visibleAdSpendChannels = useMemo(() => {
        if (
            shopifyMarketsFeatureOn &&
            customer?.CustomerSettings?.shopifyMarketsEnabled === true
        ) {
            return adSpendChannelsForShopifyMarketsFilterUi(customer.CustomerSettings).filter(
                (c) => appliedExcludedPlatforms[c.id] !== true
            );
        }
        return adSpendChannelsForDashboard(
            customer?.CustomerSettings,
            merged,
            mergedPrev
        );
    }, [
        shopifyMarketsFeatureOn,
        customer?.CustomerSettings,
        appliedExcludedPlatforms,
        merged,
        mergedPrev,
    ]);

    const visibleSpendMetricKeys = useMemo(
        () => visibleAdSpendChannels.map((c) => c.metricsDataKey),
        [visibleAdSpendChannels]
    );

    // Main fetch: merged data
    useEffect(() => {
        if (!customer) return;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
                const comp = getComparisonPeriodRange({
                    comparisonMethod,
                    startDate: appliedDateRange.startDate,
                    endDate: appliedDateRange.endDate,
                    compareStartDate: appliedCompareRange.startDate,
                    compareEndDate: appliedCompareRange.endDate,
                });

                const res = await fetch(
                    `${baseUrl}/api/merged-sources/${customer._id}?startDate=${appliedDateRange.startDate}&endDate=${appliedDateRange.endDate}&source=performance-dashboard${mergedSourcesQuerySuffix}`
                );
                if (!res.ok) throw new Error("Failed to fetch merged data");
                const merged = await res.json();

                let mergedPrev = {
                    shopifyDaily: [],
                    facebookDaily: [],
                    googleDaily: [],
                    pinterestDaily: [],
                    snapchatDaily: [],
                    bingDaily: [],
                    redditDaily: [],
                };
                if (!comp.skip && comp.prevStart && comp.prevEnd) {
                    const resPrev = await fetch(
                        `${baseUrl}/api/merged-sources/${customer._id}?startDate=${comp.prevStart.format("YYYY-MM-DD")}&endDate=${comp.prevEnd.format("YYYY-MM-DD")}&source=performance-dashboard${mergedSourcesQuerySuffix}`
                    );
                    if (!resPrev.ok) throw new Error("Failed to fetch comparison period data");
                    mergedPrev = await resPrev.json();
                }
                setMerged(merged);
                setMergedPrev(mergedPrev);
                const vatSettings = customer?.CustomerSettings || {};
                // Save daily arrays for charts (VAT display applied to revenue fields)
                setShopifyDaily(
                    applyVatDisplayToShopifyDailyRows(merged.shopifyDaily || [], vatSettings)
                );
                setFacebookDaily(merged.facebookDaily || []);
                setGoogleDaily(merged.googleDaily || []);
                setPinterestDaily(merged.pinterestDaily || []);
                setSnapchatDaily(merged.snapchatDaily || []);
                setBingDaily(merged.bingDaily || []);
                setRedditDaily(merged.redditDaily || []);

                console.log("::: MERGED DATA :::");
                console.log({ merged });

                // Save previous period data for comparison
                setShopifyDailyPrev(
                    applyVatDisplayToShopifyDailyRows(mergedPrev.shopifyDaily || [], vatSettings)
                );
                setFacebookDailyPrev(mergedPrev.facebookDaily || []);
                setGoogleDailyPrev(mergedPrev.googleDaily || []);
                setPinterestDailyPrev(mergedPrev.pinterestDaily || []);
                setSnapchatDailyPrev(mergedPrev.snapchatDaily || []);
                setBingDailyPrev(mergedPrev.bingDaily || []);
                setRedditDailyPrev(mergedPrev.redditDaily || []);

                setLoading(false);
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        })();
    }, [
        customer,
        appliedDateRange,
        appliedCompareRange,
        comparisonMethod,
        mergedSourcesQuerySuffix,
        mergedDataRefreshKey,
    ]);

    useEffect(() => {
        const customerId = params?.customerId;
        if (!customerId) return;
        let cancelled = false;
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
        fetch(`${baseUrl}/api/custom-kpis/${customerId}`)
            .then((r) => (r.ok ? r.json() : []))
            .then((data) => {
                if (!cancelled) setCustomKpis(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                if (!cancelled) setCustomKpis([]);
            });
        return () => { cancelled = true; };
    }, [params?.customerId]);

    const refreshCustomKpis = useCallback(async () => {
        const customerId = params?.customerId;
        if (!customerId) return;
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
        try {
            const res = await fetch(`${baseUrl}/api/custom-kpis/${customerId}`);
            if (res.ok) {
                const data = await res.json();
                setCustomKpis(Array.isArray(data) ? data : []);
            }
        } catch {
            /* ignore */
        }
    }, [params?.customerId]);

    const returnsOverrideSettings = getReturnsOverrideSettings(
        customer?.CustomerSettings
    );

    const refreshDashboardData = useCallback(() => {
        setMergedDataRefreshKey((k) => k + 1);
    }, []);

    const handleReturnsOverrideSave = async ({ enabled, percent }) => {
        if (!params?.customerId || !customer) return;
        setSettingsSaving(true);
        try {
            await updateCustomer(params.customerId, {
                CustomerSettings: {
                    ...customer.CustomerSettings,
                    performanceDashboard: {
                        ...(customer.CustomerSettings?.performanceDashboard || {}),
                        returnsOverrideEnabled: enabled,
                        returnsOverridePercent: percent,
                    },
                },
            });
            setReturnsOverrideModalOpen(false);
            refreshDashboardData();
        } catch (err) {
            console.error(err);
        } finally {
            setSettingsSaving(false);
        }
    };

    const handleCogsSettingsSave = async ({ fetchCogsFromStore, cogsPercentage }) => {
        if (!params?.customerId || !customer) return;
        setSettingsSaving(true);
        try {
            await updateCustomer(params.customerId, {
                CustomerSettings: {
                    ...customer.CustomerSettings,
                    fetchCogsFromStore,
                },
                CustomerStaticExpenses: {
                    ...(customer.CustomerStaticExpenses || {}),
                    cogsPercentage,
                },
            });
            setCogsSettingsModalOpen(false);
            refreshDashboardData();
        } catch (err) {
            console.error(err);
        } finally {
            setSettingsSaving(false);
        }
    };

    const handleFixedExpensesSave = async (staticExpensesDraft) => {
        if (!params?.customerId || !customer) return;
        setSettingsSaving(true);
        try {
            const prepared = prepareCustomerStaticExpensesForSave({
                ...(customer.CustomerStaticExpenses || {}),
                ...staticExpensesDraft,
            });
            await updateCustomer(params.customerId, {
                CustomerStaticExpenses: prepared,
            });
            setFixedExpensesModalOpen(false);
            refreshDashboardData();
        } catch (err) {
            console.error(err);
        } finally {
            setSettingsSaving(false);
        }
    };

    // Build metrics when merged data is available
    useEffect(() => {
        if (!customer || !merged || !mergedPrev) return;
        const start = dayjs(appliedDateRange.startDate);
        const end = dayjs(appliedDateRange.endDate);
        const daysInRange = end.diff(start, 'day') + 1;

        const shopify = merged.shopifyDaily || [];
        const shopifyPrev = mergedPrev.shopifyDaily || [];

        const cost = totalAdSpendFromMerged(merged);
        const costPrev = totalAdSpendFromMerged(mergedPrev);
        const chTotals = channelSpendTotalsFromMerged(merged);
        const chTotalsPrev = channelSpendTotalsFromMerged(mergedPrev);

        const staticExp = customer?.CustomerStaticExpenses || {};
        const fixedExpensesMonthly = getMonthlyFixedExpensesTotal(staticExp);
        const calcFixedForRange = (rangeStart, rangeEnd) => {
            let total = 0;
            let d = dayjs(rangeStart);
            const endDay = dayjs(rangeEnd);
            while (!d.isAfter(endDay)) {
                total += fixedExpensesMonthly / d.daysInMonth();
                d = d.add(1, 'day');
            }
            return total;
        };
        const fixedCosts = calcFixedForRange(start, end);
        const compRange = getComparisonPeriodRange({
            comparisonMethod,
            startDate: appliedDateRange.startDate,
            endDate: appliedDateRange.endDate,
            compareStartDate: appliedCompareRange.startDate,
            compareEndDate: appliedCompareRange.endDate,
        });
        const prevPeriodStart = compRange.prevStart
            ? compRange.prevStart.format("YYYY-MM-DD")
            : start.subtract(1, "day").format("YYYY-MM-DD");
        const prevPeriodEnd = compRange.prevEnd
            ? compRange.prevEnd.format("YYYY-MM-DD")
            : prevPeriodStart;
        const prevDaysInRange =
            dayjs(prevPeriodEnd).diff(dayjs(prevPeriodStart), "day") + 1;
        const fixedCostsPrev = calcFixedForRange(prevPeriodStart, prevPeriodEnd);

        const cogsPercentage = customer?.CustomerStaticExpenses?.cogsPercentage || 0;
        const fetchCogs = customer?.CustomerSettings?.fetchCogsFromStore === true;

        const channelTotals = Object.fromEntries(
            visibleAdSpendChannels.map((c) => [c.metricsDataKey, chTotals[c.metricsDataKey] ?? 0])
        );
        const channelTotalsPrev = Object.fromEntries(
            visibleAdSpendChannels.map((c) => [c.metricsDataKey, chTotalsPrev[c.metricsDataKey] ?? 0])
        );

        const computed = computePerformanceDashboardMetrics({
            shopify,
            shopifyPrev,
            customerSettings: customer?.CustomerSettings,
            customerType: customer?.customerType || "Shopify",
            staticExpenses: staticExp,
            fetchCogs,
            cogsPercentage,
            cost,
            costPrev,
            channelTotals,
            channelTotalsPrev,
            fixedCosts,
            fixedCostsPrev,
            customKpis,
            daysInRange,
            prevDaysInRange,
        });

        const {
            metricsData,
            metricsDataPrev,
            derived,
            replacementByKey: repMap,
            returnsOverride,
            metricsDataForCustomKpis: customKpiMetrics,
        } = computed;
        setReplacementByKey(repMap || {});
        setMetricsDataForCustomKpis(customKpiMetrics ?? null);

        const { metricsArray, metricsData: mdOut } = buildPerformanceMetricsCards({
            metricsData,
            metricsDataPrev,
            derived,
            curr: computed.curr,
            prev: computed.prev,
            returnsOverride,
            replacementByKey: repMap,
            fetchCogs,
            cogsPercentage,
            visibleAdSpendChannels,
            chTotals,
            chTotalsPrev,
            merged,
            mergedPrev,
            staticExp,
            daysInRange,
            rangeStart: appliedDateRange.startDate,
            rangeEnd: appliedDateRange.endDate,
            prevRangeStart: prevPeriodStart,
            prevRangeEnd: prevPeriodEnd,
            customerType: customer?.customerType || "Shopify",
            customerSettings: customer?.CustomerSettings || {},
        });

        setMetrics(metricsArray);
        setMetricsData(mdOut);
    }, [
        customer,
        appliedDateRange,
        appliedCompareRange,
        comparisonMethod,
        merged,
        mergedPrev,
        visibleAdSpendChannels,
        customKpis,
    ]);

    // Chart color palette from CSS variables
    const [chartColors, setChartColors] = useState({});
    useEffect(() => {
        setChartColors(getChartColors());
    }, []);

    // Graph controls: metric toggles and aggregation (period vs monthly)
    const METRIC_OPTIONS = [
        // Net Revenue section
        { key: 'revenue', label: 'Net Revenue', icon: FiDollarSign },
        { key: 'orders', label: 'Orders', icon: FiShoppingCart },
        { key: 'aov', label: 'Net AOV', icon: FiShoppingBag },
        { key: 'total_sales', label: 'Gross Sales', icon: FiDollarSign },
        { key: 'returns', label: 'Refunds', icon: FiTrendingUp },
        { key: 'gross_profit', label: 'Gross Profit', icon: FiDollarSign },
        // Total Expenses section
        { key: 'cost', label: 'Marketing Spend', icon: FiCreditCard },
        { key: 'variable_costs', label: 'Variable Expenses', icon: FiCreditCard },
        { key: 'cogs', label: 'COGS', icon: FiDollarSign },
        { key: 'pick_pack', label: 'Pick & Pack', icon: FiCreditCard },
        { key: 'fixed_costs', label: 'Fixed Expenses', icon: FiCreditCard },
        // Net Profit section
        { key: 'ebit', label: 'Net Profit', icon: FiDollarSign },
        { key: 'roas', label: 'Blended ROAS', icon: FiTrendingUp },
        { key: 'cac', label: 'Blended CAC', icon: FiUserCheck },
        { key: 'poas', label: 'Blended POAS', icon: FiPieChart },
        { key: 'ebit_pct', label: 'EBIT%', icon: FiPieChart },
    ];
    const [selectedMetrics, setSelectedMetrics] = useState(['revenue']); // revenue default
    const [aggregateBy, setAggregateBy] = useState('period'); // 'period' | 'monthly'
    const [viewMode, setViewMode] = useState('standard'); // 'standard' | 'custom'
    const [showCalcs, setShowCalcs] = useState(false); // Default ON for Standard view

    const fixedBreakdownRows = useMemo(
        () => getFixedExpensesBreakdownLineItems(customer?.CustomerStaticExpenses || {}),
        [customer?.CustomerStaticExpenses]
    );

    const STANDARD_SECTIONS = useMemo(
        () =>
            buildStandardOverviewSections({
                visibleAdSpendChannels,
                fixedBreakdownRows,
                customerSettings: customer?.CustomerSettings || {},
            }),
        [visibleAdSpendChannels, fixedBreakdownRows, customer?.CustomerSettings]
    );

    const overviewColumnMetricKeys = useMemo(
        () => collectSectionMetricKeys(STANDARD_SECTIONS),
        [STANDARD_SECTIONS]
    );

    const overviewKpiCardKeys = useMemo(
        () => getOverviewKpiCardKeys(overviewColumnMetricKeys),
        [overviewColumnMetricKeys]
    );

    const overviewKpiMetrics = useMemo(
        () =>
            overviewKpiCardKeys
                .map((key) => metrics.find((m) => m.key === key))
                .filter(Boolean),
        [overviewKpiCardKeys, metrics]
    );

    const toggleMetricSelection = useCallback((key) => {
        if (!key) return;
        setSelectedMetrics((prev) =>
            prev.includes(key)
                ? prev.length > 1
                    ? prev.filter((k) => k !== key)
                    : prev
                : [...prev, key]
        );
    }, []);

    // Helper to aggregate daily arrays by keyFn (period or month)
    const aggregateDaily = (shopifyArr, channelRows, keyFn) =>
        aggregateShopifyAndAdSpendByPeriodFromRows(shopifyArr, channelRows, keyFn);

    // Build series for selected metrics and current + comparison (aligned)
    const buildSeriesFromSelected = () => {
        const keyFn = (period) => aggregateBy === 'monthly' ? dayjs(period).format('YYYY-MM') : period;
        const currAgg = aggregateDaily(shopifyDaily, channelRowsCurr, keyFn);
        const prevAgg = aggregateDaily(shopifyDailyPrev, channelRowsPrev, keyFn);

        const categories = Object.keys(currAgg).sort();
        const series = [];

        // days/months count in applied range
        const daysInRange = dayjs(appliedDateRange.endDate).diff(dayjs(appliedDateRange.startDate), 'day') + 1;

        const sortedPrevKeys = Object.keys(prevAgg).sort();
        const getPrevKeyForCategory = (categoryKey, idx) =>
            resolveChartCategoryPrevKey({
                comparisonMethod,
                categoryKey,
                categoryIndex: idx,
                aggregateBy,
                appliedStartDate: appliedDateRange.startDate,
                appliedEndDate: appliedDateRange.endDate,
                sortedPrevKeys,
            });

        const staticExp = customer?.CustomerStaticExpenses || {};
        const fixedBase = getMonthlyFixedExpensesTotal(staticExp);
        const shippingPerOrder = staticExp.shippingCostPerOrder ?? 0;
        const pickPerOrder = staticExp.pickNPackCostPerOrder ?? 0;
        const txCostPct = staticExp.transactionCostPercentage ?? 0.015;
        const returnsOverride = getReturnsOverrideSettings(customer?.CustomerSettings);
        const fetchCogsChart = customer?.CustomerSettings?.fetchCogsFromStore === true;
        const cogsPctChart = customer?.CustomerStaticExpenses?.cogsPercentage || 0;

        const effectiveRevenue = (v) => {
            if (!v) return 0;
            if (returnsOverride.enabled) {
                const pct = (returnsOverride.percent ?? 0) / 100;
                const ret = (v.grossSales || 0) * pct;
                return netRevenueFromGrossDiscountsReturns(
                    v.grossSales || 0,
                    v.discounts || 0,
                    ret
                );
            }
            return v.revenue || 0;
        };
        const effectiveReturns = (v) => {
            if (!v) return 0;
            if (returnsOverride.enabled) {
                return (v.grossSales || 0) * ((returnsOverride.percent ?? 0) / 100);
            }
            return v.returns || 0;
        };
        const effectiveCogs = (v, rev) => {
            if (fetchCogsChart) return v.cogs || 0;
            return rev * cogsPctChart;
        };

        const getFixedForPeriod = (k) => {
            if (aggregateBy === 'monthly') {
                return fixedBase; // full month
            }
            const daysInMonth = dayjs(k).daysInMonth();
            return fixedBase / daysInMonth;
        };

        selectedMetrics.forEach((metric) => {
            if (metric === 'cost') {
                for (const spec of visibleAdSpendChannels) {
                    const field = spec.bucketKey;
                    const currData = categories.map((k) => {
                        const v = currAgg[k];
                        return v ? Number((v[field] || 0).toFixed(0)) : null;
                    });
                    const prevData = categories.map((k, idx) => {
                        const prevKey = getPrevKeyForCategory(k, idx);
                        const v = prevAgg[prevKey];
                        return v ? Number((v[field] || 0).toFixed(0)) : null;
                    });
                    series.push({ name: `${spec.label} (Current)`, data: currData });
                    if (comparisonMethod !== COMPARISON_METHOD.NONE) {
                        series.push({
                            name: `${spec.label} (${comparisonLabel})`,
                            data: prevData,
                        });
                    }
                }
                return;
            }

            const currData = categories.map(k => {
                const v = currAgg[k];
                if (!v) return null;
                if (metric === 'revenue') return Number(effectiveRevenue(v).toFixed(0));
                if (metric === 'total_sales') return Number(v.totalRevenue.toFixed(0));
                if (metric === 'returns') return Number(effectiveReturns(v).toFixed(0));
                if (metric === 'gross_profit') {
                    const rev = effectiveRevenue(v);
                    return Number((rev - effectiveCogs(v, rev)).toFixed(0));
                }
                if (metric === 'cogs') return Number(effectiveCogs(v, effectiveRevenue(v)).toFixed(0));
                if (metric === 'fixed_costs') return Number(getFixedForPeriod(k).toFixed(0));
                if (metric === 'variable_costs') return Number(((shippingPerOrder + pickPerOrder) * (v.orders || 0)).toFixed(0));
                if (metric === 'pick_pack') return Number(((pickPerOrder || 0) * (v.orders || 0)).toFixed(0));
                if (metric === 'ebit_pct') {
                    const rev = effectiveRevenue(v);
                    const cogs = effectiveCogs(v, rev);
                    const fixed = getFixedForPeriod(k);
                    const variable = (shippingPerOrder + pickPerOrder) * (v.orders || 0);
                    const txFee = rev * txCostPct;
                    const allCosts = cogs + fixed + variable + txFee + v.cost;
                    return rev > 0 ? Number(((rev - allCosts) / rev * 100).toFixed(1)) : null;
                }
                if (metric === 'ebit') {
                    const rev = effectiveRevenue(v);
                    const cogs = effectiveCogs(v, rev);
                    const fixed = getFixedForPeriod(k);
                    const variable = (shippingPerOrder + pickPerOrder) * (v.orders || 0);
                    const txFee = rev * txCostPct;
                    const allCosts = cogs + fixed + variable + txFee + v.cost;
                    return Number((rev - allCosts).toFixed(0));
                }
                if (metric === 'orders') return Number(v.orders || 0);
                if (metric === 'roas') {
                    const rev = effectiveRevenue(v);
                    return v.cost > 0 ? Number((rev / v.cost).toFixed(2)) : null;
                }
                if (metric === 'poas') {
                    const rev = effectiveRevenue(v);
                    const cogs = effectiveCogs(v, rev);
                    const grossProfit = rev - cogs;
                    return v.cost > 0 ? Number(calcBlendedPoasOrZero(grossProfit, v.cost).toFixed(2)) : null;
                }
                if (metric === 'aov') {
                    const rev = effectiveRevenue(v);
                    return v.orders > 0 ? Number((rev / v.orders).toFixed(0)) : null;
                }
                if (metric === 'spendshare') {
                    const rev = effectiveRevenue(v);
                    return rev > 0 ? Number(((v.cost / rev) * 100).toFixed(0)) : null;
                }
                if (metric === 'cac') return (v.orders > 0 ? Number((v.cost / v.orders).toFixed(0)) : null);
                return null;
            });

            series.push({ name: `${METRIC_OPTIONS.find(o=>o.key===metric)?.label || metric} (Current)`, data: currData });

            const prevData = categories.map((k, idx) => {
                const prevKey = getPrevKeyForCategory(k, idx);
                const v = prevAgg[prevKey];
                if (!v) return null;
                if (metric === 'revenue') return Number(effectiveRevenue(v).toFixed(0));
                if (metric === 'total_sales') return Number(v.totalRevenue.toFixed(0));
                if (metric === 'returns') return Number(effectiveReturns(v).toFixed(0));
                if (metric === 'gross_profit') {
                    const rev = effectiveRevenue(v);
                    return Number((rev - effectiveCogs(v, rev)).toFixed(0));
                }
                if (metric === 'cogs') return Number(effectiveCogs(v, effectiveRevenue(v)).toFixed(0));
                if (metric === 'fixed_costs') return Number(getFixedForPeriod(prevKey).toFixed(0));
                if (metric === 'variable_costs') return Number(((shippingPerOrder + pickPerOrder) * (v.orders || 0)).toFixed(0));
                if (metric === 'pick_pack') return Number(((pickPerOrder || 0) * (v.orders || 0)).toFixed(0));
                if (metric === 'ebit_pct') {
                    const rev = effectiveRevenue(v);
                    const cogs = effectiveCogs(v, rev);
                    const fixed = getFixedForPeriod(prevKey);
                    const variable = (shippingPerOrder + pickPerOrder) * (v.orders || 0);
                    const txFee = rev * txCostPct;
                    const allCosts = cogs + fixed + variable + txFee + v.cost;
                    return rev > 0 ? Number(((rev - allCosts) / rev * 100).toFixed(1)) : null;
                }
                if (metric === 'ebit') {
                    const rev = v.revenue || 0;
                    const cogs = v.cogs || 0;
                    const fixed = getFixedForPeriod(prevKey);
                    const variable = (shippingPerOrder + pickPerOrder) * (v.orders || 0);
                    const txFee = rev * txCostPct;
                    const allCosts = cogs + fixed + variable + txFee + v.cost;
                    return Number((rev - allCosts).toFixed(0));
                }
                if (metric === 'orders') return Number(v.orders || 0);
                if (metric === 'roas') return (v.cost > 0 ? Number((v.revenue / v.cost).toFixed(2)) : null);
                if (metric === 'poas') {
                    const rev = v.revenue || 0;
                    const cogs = v.cogs || 0;
                    const grossProfit = rev - cogs;
                    return v.cost > 0 ? Number(calcBlendedPoasOrZero(grossProfit, v.cost).toFixed(2)) : null;
                }
                if (metric === 'aov') return (v.orders > 0 ? Number((v.revenue / v.orders).toFixed(0)) : null);
                if (metric === 'spendshare') return (v.revenue > 0 ? Number(((v.cost / v.revenue) * 100).toFixed(0)) : null);
                if (metric === 'cac') return (v.orders > 0 ? Number((v.cost / v.orders).toFixed(0)) : null);
                return null;
            });

            if (comparisonMethod !== COMPARISON_METHOD.NONE) {
                series.push({
                    name: `${METRIC_OPTIONS.find((o) => o.key === metric)?.label || metric} (${comparisonLabel})`,
                    data: prevData,
                });
            }
        });

        const formatChartValue = (v) => (typeof v === 'number' && !isNaN(v) ? v.toLocaleString('da-DK', { maximumFractionDigits: 2, minimumFractionDigits: 0 }) : v);
        const isCurrentSeries = (s) => s.name && s.name.includes('(Current)');
        const options = {
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
            xaxis: { categories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
            yaxis: { labels: { style: { colors: chartColors.primary || '#1E2B2B' }, formatter: formatChartValue } },
            tooltip: { theme: 'light', y: { formatter: formatChartValue } },
            colors: [chartColors.primaryLighter || '#406969', chartColors.lime || '#C6ED62', '#94a3b8', '#cbd5e1', chartColors.green || '#213834', '#f1f5f9'],
            stroke: { width: series.map((s) => isCurrentSeries(s) ? 2 : 1), curve: 'smooth', dashArray: series.map((s) => isCurrentSeries(s) ? 0 : 5) },
            fill: { type: 'solid', opacity: series.map((s) => isCurrentSeries(s) ? 1 : 0.5) },
            grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
            dataLabels: { enabled: false },
            tooltip: { theme: 'light' },
            legend: { show: true, position: 'top', labels: { colors: chartColors.primary || '#1E2B2B' } },
        };

        return { series, options };
    };

    const { series: combinedSeries, options: combinedOptions } = buildSeriesFromSelected();

    // Chart options for each graph
    // No fill/gradient for now
    const noFill = { type: 'solid', opacity: 0 };

    // Prepare chart data from real daily arrays
    // Revenue chart
    const revenueCategories = shopifyDaily.map(d => d.period);
    const revenueSeries = [
        { name: "Revenue (Current)", data: shopifyDaily.map((d) => Number(d.total_sales).toFixed(0)) },
        ...(comparisonMethod !== COMPARISON_METHOD.NONE
            ? [
                  {
                      name: `Revenue (${comparisonLabel})`,
                      data: shopifyDaily.map((d, idx) => {
                          const prevKey = getPrevKeyForChartCategory({
                              comparisonMethod,
                              currKey: d.period,
                              categoryIndex: idx,
                              aggregateBy: "period",
                              appliedStartDate: appliedDateRange.startDate,
                              appliedEndDate: appliedDateRange.endDate,
                              sortedPrevKeys: shopifyDailyPrev.map((p) => p.period).sort(),
                          });
                          const prevRow = shopifyDailyPrev.find(
                              (p) => p.period === prevKey
                          );
                          return prevRow
                              ? Number(prevRow.total_sales).toFixed(0)
                              : null;
                      }),
                  },
              ]
            : []),
    ];
    const revenueOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { categories: revenueCategories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
        yaxis: { labels: { style: { colors: chartColors.primary || '#1E2B2B' } } },
        colors: [chartColors.lime || '#C6ED62', '#94a3b8'],
        stroke: { width: [2, 1], curve: 'smooth', dashArray: [0, 5] },
        fill: { type: 'solid', opacity: [1, 0.5] },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light' },
        legend: { show: true, position: 'top', labels: { colors: chartColors.primary || '#1E2B2B' } },
    };

    const shopifyPrevPeriodKeys = shopifyDailyPrev.map((p) => p.period).sort();
    const resolveComparisonPeriodKey = (period, index) =>
        getPrevKeyForChartCategory({
            comparisonMethod,
            currKey: period,
            categoryIndex: index,
            aggregateBy: "period",
            appliedStartDate: appliedDateRange.startDate,
            appliedEndDate: appliedDateRange.endDate,
            sortedPrevKeys: shopifyPrevPeriodKeys,
        });

    // Spend Allocation chart — daily spend by platform (current + comparison period)
    const spendCategories = shopifyDaily.map((d) => d.period);
    const spendAllocationSeries = [];
    for (const spec of visibleAdSpendChannels) {
        const rowsCurr = channelRowsCurr[spec.id] || [];
        const rowsPrev = channelRowsPrev[spec.id] || [];
        const mapCurr = Object.fromEntries(rowsCurr.map((d) => [d.period, d.spend]));
        const mapPrev = Object.fromEntries(rowsPrev.map((d) => [d.period, d.spend]));
        const curSeries = spendCategories.map((date) =>
            mapCurr[date] ? Number(mapCurr[date]).toFixed(0) : "0"
        );
        const prevSeries = spendCategories.map((date, idx) => {
            const prevDate = resolveComparisonPeriodKey(date, idx);
            return prevDate && mapPrev[prevDate]
                ? Number(mapPrev[prevDate]).toFixed(0)
                : "0";
        });
        spendAllocationSeries.push({ name: `${spec.label} (Current)`, data: curSeries });
        if (comparisonMethod !== COMPARISON_METHOD.NONE) {
            spendAllocationSeries.push({
                name: `${spec.label} (${comparisonLabel})`,
                data: prevSeries,
            });
        }
    }
    const spendDashPattern = spendAllocationSeries.map((s) => (String(s.name).includes("(Current)") ? 0 : 5));
    const spendStrokeWidth = spendAllocationSeries.map((s) => (String(s.name).includes("(Current)") ? 2 : 1));
    const spendFillOpacity = spendAllocationSeries.map((s) => (String(s.name).includes("(Current)") ? 1 : 0.45));
    const spendPalette = [
        "#406969",
        "#94a3b8",
        "#C6ED62",
        "#cbd5e1",
        "#0d9488",
        "#99f6e4",
        "#2563eb",
        "#93c5fd",
        "#7c3aed",
        "#c4b5fd",
        "#ea580c",
        "#fdba74",
    ];
    const spendOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "Outfit, sans-serif" },
        xaxis: {
            categories: spendCategories,
            labels: { style: { colors: chartColors.primaryLighter || "#406969" } },
            axisTicks: { show: true },
            axisBorder: { show: true },
        },
        yaxis: { labels: { style: { colors: chartColors.primary || "#1E2B2B" } } },
        colors: spendPalette.slice(0, spendAllocationSeries.length),
        stroke: { width: spendStrokeWidth, curve: "smooth", dashArray: spendDashPattern },
        fill: { type: "solid", opacity: spendFillOpacity },
        grid: {
            borderColor: "#e5e7eb",
            strokeDashArray: 0,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
        },
        dataLabels: { enabled: false },
        tooltip: { theme: "light" },
        legend: { show: true, position: "top", labels: { colors: chartColors.primary || "#1E2B2B" } },
    };

    // Determine metric preference
    const customerMetricPreference = customer?.CustomerSettings?.metricPreference || 'ROAS/POAS';

    const totalSpendByDay = merged ? adSpendByPeriodMap(merged) : {};
    const totalSpendByDayPrev = mergedPrev ? adSpendByPeriodMap(mergedPrev) : {};
    const spendOnDay = (map, period) =>
        Number(map[String(period ?? "").slice(0, 10)]) || 0;

    // ROAS or Spendshare chart (conditional)
    const metricCategories = shopifyDaily.map(d => d.period);
    let metricSeries, metricOptions, metricTitle;

    if (customerMetricPreference === 'Spendshare') {
        // Spendshare chart
        metricSeries = [
            {
                name: 'Spendshare (Current)',
                data: shopifyDaily.map((d, i) => {
                    const spend = spendOnDay(totalSpendByDay, d.period);
                    return d.total_sales > 0 ? ((spend / d.total_sales) * 100).toFixed(0) : null;
                })
            },
            ...(comparisonMethod !== COMPARISON_METHOD.NONE
                ? [
                      {
                          name: `Spendshare (${comparisonLabel})`,
                          data: shopifyDaily.map((d, i) => {
                              const prevDate = resolveComparisonPeriodKey(d.period, i);
                              const prevShopifyData = shopifyDailyPrev.find(
                                  (pd) => pd.period === prevDate
                              );
                              const prevSpend = spendOnDay(
                                  totalSpendByDayPrev,
                                  prevDate
                              );
                              return prevShopifyData &&
                                  prevShopifyData.total_sales > 0
                                  ? (
                                        (prevSpend / prevShopifyData.total_sales) *
                                        100
                                    ).toFixed(0)
                                  : null;
                          }),
                      },
                  ]
                : []),
        ];
        metricTitle = 'Spendshare (%)';
    } else {
        // ROAS chart (default) - use blended ROAS label
        const roasLabel = METRIC_OPTIONS.find(o => o.key === 'roas')?.label || 'Blended ROAS';
        metricSeries = [
            {
                name: `${roasLabel} (Current)`,
                data: shopifyDaily.map((d, i) => {
                    const spend = spendOnDay(totalSpendByDay, d.period);
                    return spend > 0 ? ( (Number(d.net_sales || d.total_sales) / spend) ).toFixed(2) : null;
                })
            },
            ...(comparisonMethod !== COMPARISON_METHOD.NONE
                ? [
                      {
                          name: `${roasLabel} (${comparisonLabel})`,
                          data: shopifyDaily.map((d, i) => {
                              const prevDate = resolveComparisonPeriodKey(d.period, i);
                              const prevShopifyData = shopifyDailyPrev.find(
                                  (pd) => pd.period === prevDate
                              );
                              const prevSpend = spendOnDay(
                                  totalSpendByDayPrev,
                                  prevDate
                              );
                              return prevShopifyData && prevSpend > 0
                                  ? (
                                        Number(
                                            prevShopifyData.net_sales ||
                                                prevShopifyData.total_sales
                                        ) / prevSpend
                                    ).toFixed(2)
                                  : null;
                          }),
                      },
                  ]
                : []),
        ];
        metricTitle = roasLabel;
    }

    metricOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { categories: metricCategories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
        yaxis: { labels: { style: { colors: chartColors.primary || '#1E2B2B' } } },
        colors: [chartColors.green || '#213834', '#94a3b8'],
        stroke: { width: [2, 1], curve: 'smooth', dashArray: [0, 5] },
        fill: { type: 'solid', opacity: [1, 0.5] },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light' },
        legend: { show: true, position: 'top', labels: { colors: chartColors.primary || '#1E2B2B' } },
    };

    // AOV chart
    const aovCategories = shopifyDaily.map(d => d.period);
    const aovSeries = [
        {
            name: "Net AOV (Current)",
            data: shopifyDaily.map((d) =>
                d.orders > 0
                    ? (Number(d.net_sales || d.total_sales) / d.orders).toFixed(0)
                    : null
            ),
        },
        ...(comparisonMethod !== COMPARISON_METHOD.NONE
            ? [
                  {
                      name: `Net AOV (${comparisonLabel})`,
                      data: shopifyDaily.map((d, i) => {
                          const prevDate = resolveComparisonPeriodKey(d.period, i);
                          const prevShopifyData = shopifyDailyPrev.find(
                              (pd) => pd.period === prevDate
                          );
                          return prevShopifyData && prevShopifyData.orders > 0
                              ? (
                                    Number(
                                        prevShopifyData.net_sales ||
                                            prevShopifyData.total_sales
                                    ) / prevShopifyData.orders
                                ).toFixed(0)
                              : null;
                      }),
                  },
              ]
            : []),
    ];
    const aovOptions = {
        chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'Outfit, sans-serif' },
        xaxis: { categories: aovCategories, labels: { style: { colors: chartColors.primaryLighter || '#406969' } }, axisTicks: { show: true }, axisBorder: { show: true } },
        yaxis: { labels: { style: { colors: chartColors.primary || '#1E2B2B' } } },
        colors: [chartColors.secondary || '#D6CDB6', '#94a3b8'],
        stroke: { width: [2, 1], curve: 'smooth', dashArray: [0, 5] },
        fill: { type: 'solid', opacity: [1, 0.5] },
        grid: { borderColor: '#e5e7eb', strokeDashArray: 0, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
        dataLabels: { enabled: false },
        tooltip: { theme: 'light' },
        legend: { show: true, position: 'top', labels: { colors: chartColors.primary || '#1E2B2B' } },
    };

    return (
        <div className="w-full">
            {/* Top Card */}
            <DashboardHeading
                title="Performance Dashboard"
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                dateRange={appliedDateRange}
                comparisonMethod={comparisonMethod}
                loading={loading}
                dashboardType="performance-dashboard"
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
                dataSnapshot={{
                    metrics,
                    metricsData,
                    dailyData: {
                        shopify: shopifyDaily,
                        facebook: facebookDaily,
                        google: googleDaily,
                        pinterest: pinterestDaily,
                        snapchat: snapchatDaily,
                        bing: bingDaily,
                        reddit: redditDaily,
                    },
                    aggregates: {
                        revenue: shopifyDaily.reduce((sum, d) => sum + (d.total_sales || 0), 0),
                        orders: shopifyDaily.reduce((sum, d) => sum + (d.orders || 0), 0),
                        cost: merged ? totalAdSpendFromMerged(merged) : 0,
                    },
                    revenueType: customer?.CustomerSettings?.customerRevenueType || 'total_sales',
                    metricPreference: customer?.CustomerSettings?.metricPreference || 'ROAS/POAS'
                }}
                right={
                    <DateRangePicker
                        onApply={handleDateRangeApply}
                        startDate={tempDateRange.startDate}
                        endDate={tempDateRange.endDate}
                        onStartDateChange={handleStartDateChange}
                        onEndDateChange={handleEndDateChange}
                        compareStartDate={tempCompareRange.startDate}
                        compareEndDate={tempCompareRange.endDate}
                        onCompareStartDateChange={handleCompareStartChange}
                        onCompareEndDateChange={handleCompareEndChange}
                        loading={loading}
                        showComparisonMethodToggler={true}
                        comparisonMethod={tempComparisonMethod}
                        onComparisonMethodChange={setTempComparisonMethod}
                    />
                }
            />

            {/* View Mode Toggler + Show calcs + Metrics Cards Section */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex border border-gray-200 bg-gray-100 rounded-lg overflow-hidden w-fit">
                    <button
                        type="button"
                        className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium focus:outline-none transition-colors duration-150 ${viewMode === 'standard' ? 'bg-white text-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 hover:text-[var(--color-primary-searchmind)]'}`}
                        style={{ borderRadius: '8px 0 0 8px' }}
                        onClick={() => setViewMode('standard')}
                    >
                        Standard
                    </button>
                    <button
                        type="button"
                        className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium focus:outline-none transition-colors duration-150 ${viewMode === 'custom' ? 'bg-white text-[var(--color-primary-searchmind)] shadow-sm' : 'text-gray-500 hover:text-[var(--color-primary-searchmind)]'}`}
                        style={{ borderRadius: '0 8px 8px 0' }}
                        onClick={() => setViewMode('custom')}
                    >
                        Custom
                    </button>
                </div>
                <button
                    type="button"
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors focus:outline-none ${showCalcs ? 'bg-[var(--color-primary-searchmind)] text-white border-[var(--color-primary-searchmind)]' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                    onClick={() => setShowCalcs((v) => !v)}
                >
                    Show calcs
                </button>
            </div>

            {viewMode === 'standard' ? (
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full mb-8">
                <PerformanceDashboardStandardSections
                    sections={STANDARD_SECTIONS}
                    metrics={metrics}
                    metricsData={metricsData}
                    loading={loading}
                    error={error}
                    showCalcs={showCalcs}
                    comparisonMethod={comparisonMethodForUi}
                    selectedMetrics={selectedMetrics}
                    onToggleMetric={toggleMetricSelection}
                    onReturnsOverrideClick={() => setReturnsOverrideModalOpen(true)}
                    onCogsSettingsClick={() => setCogsSettingsModalOpen(true)}
                    onFixedExpensesSettingsClick={() => setFixedExpensesModalOpen(true)}
                />
            </div>
            </>
            ) : (
            <div className="mb-8">
                <Custom
                    customerId={params.customerId}
                    metricsData={metricsDataForCustomKpis}
                    metrics={metrics}
                    showCalcs={showCalcs}
                    shopifyDaily={shopifyDaily}
                    shopifyDailyPrev={shopifyDailyPrev}
                    adChannelRowsCurr={channelRowsCurr}
                    adChannelRowsPrev={channelRowsPrev}
                    appliedDateRange={appliedDateRange}
                    comparisonMethod={comparisonMethodForUi}
                    aggregateBy={aggregateBy}
                    chartColors={chartColors}
                    visibleSpendMetricKeys={visibleSpendMetricKeys}
                    onKpisUpdated={refreshCustomKpis}
                />
            </div>
            )}

            {/* Single Toggleable Graph Section - Standard view only */}
            {viewMode === 'standard' && (
            <div className="w-full mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div className="flex flex-wrap items-center gap-2">
                        {METRIC_OPTIONS.map(opt => (
                            <button
                                key={opt.key}
                                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors duration-150 ${selectedMetrics.includes(opt.key) ? 'bg-[var(--color-primary-searchmind)] text-white border-[var(--color-primary-searchmind)]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                                onClick={() => setSelectedMetrics(prev => prev.includes(opt.key) ? (prev.length > 1 ? prev.filter(k => k !== opt.key) : prev) : [...prev, opt.key])}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64"><Spinner size={40} color="#406969" /></div>
                ) : (
                    <GraphCard title={selectedMetrics.length === 1 ? `${METRIC_OPTIONS.find(o=>o.key===selectedMetrics[0])?.label} Over Time` : 'Performance Metrics Over Time'} chartOptions={combinedOptions} chartSeries={combinedSeries} />
                )}

                {!loading && !error && overviewKpiMetrics.length > 0 && (
                    <div className="mt-6">
                        <h3 className="text-sm font-medium text-gray-500 mb-3">Key metrics</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                            {overviewKpiMetrics.map((metric) => (
                                <div
                                    key={metric.key}
                                    role="button"
                                    tabIndex={0}
                                    className="min-w-0 cursor-pointer"
                                    onClick={() => toggleMetricSelection(metric.key)}
                                    onKeyDown={(e) =>
                                        (e.key === "Enter" || e.key === " ") &&
                                        toggleMetricSelection(metric.key)
                                    }
                                >
                                    <MetricCard
                                        label={metric.label}
                                        value={metric.value}
                                        change={metric.change}
                                        changeType={metric.changeType}
                                        changeAbsolute={metric.changeAbsolute}
                                        changePrevValue={metric.changePrevValue}
                                        comparisonMethod={comparisonMethodForUi}
                                        popOverContent={metric.popOverContent}
                                        icon={metric.icon}
                                        isActive={selectedMetrics.includes(metric.key)}
                                        className="min-w-0"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            )}

            <ReturnsOverrideModal
                open={returnsOverrideModalOpen}
                onClose={() => setReturnsOverrideModalOpen(false)}
                initialEnabled={returnsOverrideSettings.enabled}
                initialPercent={returnsOverrideSettings.percent}
                onSave={handleReturnsOverrideSave}
                saving={settingsSaving}
            />
            <CogsSettingsModal
                open={cogsSettingsModalOpen}
                onClose={() => setCogsSettingsModalOpen(false)}
                initialFetchCogsFromStore={
                    customer?.CustomerSettings?.fetchCogsFromStore === true
                }
                initialCogsPercentage={
                    customer?.CustomerStaticExpenses?.cogsPercentage ?? 0
                }
                onSave={handleCogsSettingsSave}
                saving={settingsSaving}
            />
            <FixedExpensesSettingsModal
                open={fixedExpensesModalOpen}
                onClose={() => setFixedExpensesModalOpen(false)}
                initialStaticExpenses={customer?.CustomerStaticExpenses || {}}
                onSave={handleFixedExpensesSave}
                saving={settingsSaving}
            />
        </div>
    );
}