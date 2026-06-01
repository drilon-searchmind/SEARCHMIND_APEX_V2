"use client"

import React from "react";
import { useParams } from "next/navigation";
import { useCustomers } from "@/hooks/useCustomers";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import ComparisonPeriodPopover from "@/components/dashboard/ComparisonPeriodPopover";
import { FiDollarSign, FiTrendingUp, FiTrendingDown, FiShoppingCart, FiCreditCard, FiBarChart2, FiPieChart, FiShoppingBag, FiUserCheck, FiSettings } from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
// import { revenueData, spendAllocationData, roasData, aovData } from "@/data/dashboardCharts";
import { useEffect, useState, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import { getChartColors } from "@/components/dashboard/chartColors";
import Spinner from "@/components/ui/Spinner";
import Custom from "./components/Custom";
import ReturnsOverrideModal from "./components/ReturnsOverrideModal";
import { buildPerformanceMetricsCards } from "./components/buildPerformanceMetricsCards";
import { computePerformanceDashboardMetrics, netRevenueForShopifyDay } from "@/lib/performanceDashboard/computePerformanceMetrics";
import { getReturnsOverrideSettings } from "@/lib/performanceDashboard/performanceDashboardConstants";
import { netRevenueFromGrossDiscountsReturns } from "@/lib/performanceDashboard/computePerformanceMetrics";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";
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

export default function PerformanceDashboard() {
    const params = useParams();
    const { customers, updateCustomer } = useCustomers();
    const customer = customers.find(c => c._id === params.customerId);

    // Date range state
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');

    // If today is the 1st of the month, use 1st as both start and end
    // Otherwise, use 1st as start and yesterday as end
    const isFirstOfMonth = today.getDate() === 1;
    const defaultStart = `${yyyy}-${mm}-01`;
    const defaultEnd = isFirstOfMonth ? `${yyyy}-${mm}-01` : `${yyyy}-${mm}-${String(today.getDate() - 1).padStart(2, '0')}`;
    
    // Separate temp (input) and applied (fetch-triggered) date ranges
    const [tempDateRange, setTempDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });
    const [appliedDateRange, setAppliedDateRange] = useState({ startDate: defaultStart, endDate: defaultEnd });

    // Handlers for DateRangePicker (controlled) - comparison only applies on Apply
    const handleDateRangeApply = ({ startDate, endDate, comparisonMethod: appliedComparison }) => {
        pushDashboardDateRangeApplied({
            page: "performance_dashboard",
            customerId: params.customerId,
            startDate,
            endDate,
            comparisonMethod: appliedComparison,
        });
        setAppliedDateRange({ startDate, endDate });
        if (appliedComparison) setComparisonMethod(appliedComparison);
    };
    const handleStartDateChange = (newStart) => {
        setTempDateRange(dr => ({ ...dr, startDate: newStart }));
    };
    const handleEndDateChange = (newEnd) => {
        setTempDateRange(dr => ({ ...dr, endDate: newEnd }));
    };

    // Comparison method: applied (triggers fetch) vs temp (shown in picker until Apply)
    const [comparisonMethod, setComparisonMethod] = useState("Last Year");
    const [tempComparisonMethod, setTempComparisonMethod] = useState("Last Year");

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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [customKpis, setCustomKpis] = useState([]);
    const [replacementByKey, setReplacementByKey] = useState({});
    const [returnsOverrideModalOpen, setReturnsOverrideModalOpen] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);

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
                const start = dayjs(appliedDateRange.startDate);
                const end = dayjs(appliedDateRange.endDate);
                const days = end.diff(start, 'day') + 1;

                let prevStart, prevEnd;
                if (comparisonMethod === "Last Year") {
                    prevStart = start.subtract(1, 'year');
                    prevEnd = end.subtract(1, 'year');
                } else {
                    prevEnd = start.subtract(1, 'day');
                    prevStart = prevEnd.subtract(days - 1, 'day');
                }

                const [res, resPrev] = await Promise.all([
                    fetch(`${baseUrl}/api/merged-sources/${customer._id}?startDate=${appliedDateRange.startDate}&endDate=${appliedDateRange.endDate}&source=performance-dashboard${mergedSourcesQuerySuffix}`),
                    fetch(`${baseUrl}/api/merged-sources/${customer._id}?startDate=${prevStart.format('YYYY-MM-DD')}&endDate=${prevEnd.format('YYYY-MM-DD')}&source=performance-dashboard${mergedSourcesQuerySuffix}`)
                ]);
                if (!res.ok || !resPrev.ok) throw new Error('Failed to fetch merged data');
                const merged = await res.json();
                const mergedPrev = await resPrev.json();
                setMerged(merged);
                setMergedPrev(mergedPrev);
                // Save daily arrays for charts
                setShopifyDaily(merged.shopifyDaily || []);
                setFacebookDaily(merged.facebookDaily || []);
                setGoogleDaily(merged.googleDaily || []);
                setPinterestDaily(merged.pinterestDaily || []);
                setSnapchatDaily(merged.snapchatDaily || []);
                setBingDaily(merged.bingDaily || []);
                setRedditDaily(merged.redditDaily || []);

                console.log("::: MERGED DATA :::");
                console.log({ merged });

                // Save previous period data for comparison
                setShopifyDailyPrev(mergedPrev.shopifyDaily || []);
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
    }, [customer, appliedDateRange, comparisonMethod, mergedSourcesQuerySuffix]);

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
        const fixedExpensesMonthly = Number(staticExp.fixedExpenses) || 0;
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
        const prevPeriodEnd = comparisonMethod === "Last Year" ? end.subtract(1, 'year') : start.subtract(1, 'day');
        const prevPeriodStart = prevPeriodEnd.subtract(daysInRange - 1, 'day');
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
            prevDaysInRange: daysInRange,
        });

        const { metricsData, metricsDataPrev, derived, replacementByKey: repMap, returnsOverride } = computed;
        setReplacementByKey(repMap || {});

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
        });

        setMetrics(metricsArray);
        setMetricsData(mdOut);
    }, [customer, appliedDateRange, comparisonMethod, merged, mergedPrev, visibleAdSpendChannels, customKpis]);

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

    // Standard view: 3 sections — per-channel spend metrics only for connected + meaningful spend
    const STANDARD_SECTIONS = useMemo(() => {
        const expenseSpendKeys = [
            "total_expenses",
            "marketing_spend",
            ...visibleAdSpendChannels.map((c) => c.metricsDataKey),
            "variable_costs",
            "cogs",
            "shipping_cost",
            "pick_pack",
            "fixed_costs",
        ];
        return [
            {
                key: "net_revenue",
                title: "Net Revenue",
                metricKeys: [
                    "revenue",
                    "orders",
                    "aov",
                    "gross_sales",
                    "discounts",
                    "returns",
                    "shipping_revenue",
                    "transaction_fee",
                    "tax",
                ],
            },
            {
                key: "total_expenses",
                title: "Total Expenses",
                metricKeys: expenseSpendKeys,
                variableSubItems: ["cogs", "shipping_cost", "pick_pack"],
            },
            {
                key: "net_profit",
                title: "Net Profit",
                metricKeys: ["ebit", "roas", "cac", "poas", "ebit_pct"],
            },
        ];
    }, [visibleAdSpendChannels]);

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

        const getPrevKeyForCategory = (currKey, idx) => {
            if (aggregateBy === 'monthly') {
                if (comparisonMethod === 'Last Year') {
                    return dayjs(currKey + '-01').subtract(1, 'year').format('YYYY-MM');
                }
                // Last Period: map months by index relative to previous contiguous month block
                const periodStartMonth = dayjs(appliedDateRange.startDate).startOf('month');
                const prevPeriodEnd = periodStartMonth.subtract(1, 'day').endOf('month');
                const prevPeriodStart = prevPeriodEnd.startOf('month');
                return prevPeriodStart.add(idx, 'month').format('YYYY-MM');
            }
            // daily
            if (comparisonMethod === 'Last Year') {
                return dayjs(currKey).subtract(1, 'year').format('YYYY-MM-DD');
            }
            const prevStart = dayjs(appliedDateRange.startDate).subtract(daysInRange, 'day');
            return prevStart.add(idx, 'day').format('YYYY-MM-DD');
        };

        const staticExp = customer?.CustomerStaticExpenses || {};
        const fixedBase = Number(staticExp.fixedExpenses) || 0;
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
                    series.push({ name: `${spec.label} (${comparisonMethod})`, data: prevData });
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
                    const fixed = getFixedForPeriod(k);
                    const variable = (shippingPerOrder + pickPerOrder) * (v.orders || 0);
                    const txFee = rev * txCostPct;
                    const allCosts = cogs + fixed + variable + txFee + v.cost;
                    const ebit = rev - allCosts;
                    return v.cost > 0 ? Number((ebit / v.cost).toFixed(2)) : null;
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
                    const fixed = getFixedForPeriod(prevKey);
                    const variable = (shippingPerOrder + pickPerOrder) * (v.orders || 0);
                    const txFee = rev * txCostPct;
                    const allCosts = cogs + fixed + variable + txFee + v.cost;
                    const ebit = rev - allCosts;
                    return (v.cost > 0 ? Number((ebit / v.cost).toFixed(2)) : null);
                }
                if (metric === 'aov') return (v.orders > 0 ? Number((v.revenue / v.orders).toFixed(0)) : null);
                if (metric === 'spendshare') return (v.revenue > 0 ? Number(((v.cost / v.revenue) * 100).toFixed(0)) : null);
                if (metric === 'cac') return (v.orders > 0 ? Number((v.cost / v.orders).toFixed(0)) : null);
                return null;
            });

            series.push({ name: `${METRIC_OPTIONS.find(o=>o.key===metric)?.label || metric} (${comparisonMethod})`, data: prevData });
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
        { name: 'Revenue (Current)', data: shopifyDaily.map(d => Number(d.total_sales).toFixed(0)) },
        { name: `Revenue (${comparisonMethod})`, data: shopifyDailyPrev.map(d => Number(d.total_sales).toFixed(0)) }
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

    // Spend Allocation chart — daily spend by platform (current + comparison period)
    const spendCategories = shopifyDaily.map((d) => d.period);
    const resolveSpendPrevDate = (date) => {
        if (comparisonMethod === "Last Year") {
            return dayjs(date).subtract(1, "year").format("YYYY-MM-DD");
        }
        const currentDate = dayjs(date);
        const periodStart = dayjs(appliedDateRange.startDate);
        const periodEnd = dayjs(appliedDateRange.endDate);
        const daysDiff = currentDate.diff(periodStart, "day");
        const prevPeriodStart = periodStart.subtract(periodEnd.diff(periodStart, "day") + 1, "day");
        return prevPeriodStart.add(daysDiff, "day").format("YYYY-MM-DD");
    };
    const spendAllocationSeries = [];
    for (const spec of visibleAdSpendChannels) {
        const rowsCurr = channelRowsCurr[spec.id] || [];
        const rowsPrev = channelRowsPrev[spec.id] || [];
        const mapCurr = Object.fromEntries(rowsCurr.map((d) => [d.period, d.spend]));
        const mapPrev = Object.fromEntries(rowsPrev.map((d) => [d.period, d.spend]));
        const curSeries = spendCategories.map((date) =>
            mapCurr[date] ? Number(mapCurr[date]).toFixed(0) : "0"
        );
        const prevSeries = spendCategories.map((date) => {
            const prevDate = resolveSpendPrevDate(date);
            return mapPrev[prevDate] ? Number(mapPrev[prevDate]).toFixed(0) : "0";
        });
        spendAllocationSeries.push({ name: `${spec.label} (Current)`, data: curSeries });
        spendAllocationSeries.push({ name: `${spec.label} (${comparisonMethod})`, data: prevSeries });
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
            {
                name: `Spendshare (${comparisonMethod})`,
                data: shopifyDaily.map((d, i) => {
                    let prevDate;
                    if (comparisonMethod === "Last Year") {
                        const currentDate = dayjs(d.period);
                        prevDate = currentDate.subtract(1, 'year').format('YYYY-MM-DD');
                    } else {
                        const currentDate = dayjs(d.period);
                        const periodStart = dayjs(appliedDateRange.startDate);
                        const periodEnd = dayjs(appliedDateRange.endDate);
                        const daysDiff = currentDate.diff(periodStart, 'day');
                        const prevPeriodStart = periodStart.subtract(periodEnd.diff(periodStart, 'day') + 1, 'day');
                        prevDate = prevPeriodStart.add(daysDiff, 'day').format('YYYY-MM-DD');
                    }

                    // Find corresponding previous period data
                    const prevShopifyData = shopifyDailyPrev.find(pd => pd.period === prevDate);
                    const prevSpend = spendOnDay(totalSpendByDayPrev, prevDate);

                    return prevShopifyData && prevShopifyData.total_sales > 0 ? ((prevSpend / prevShopifyData.total_sales) * 100).toFixed(0) : null;
                })
            }
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
            {
                name: `${roasLabel} (${comparisonMethod})`,
                data: shopifyDaily.map((d, i) => {
                    let prevDate;
                    if (comparisonMethod === "Last Year") {
                        const currentDate = dayjs(d.period);
                        prevDate = currentDate.subtract(1, 'year').format('YYYY-MM-DD');
                    } else {
                        const currentDate = dayjs(d.period);
                        const periodStart = dayjs(appliedDateRange.startDate);
                        const periodEnd = dayjs(appliedDateRange.endDate);
                        const daysDiff = currentDate.diff(periodStart, 'day');
                        const prevPeriodStart = periodStart.subtract(periodEnd.diff(periodStart, 'day') + 1, 'day');
                        prevDate = prevPeriodStart.add(daysDiff, 'day').format('YYYY-MM-DD');
                    }

                    // Find corresponding previous period data
                    const prevShopifyData = shopifyDailyPrev.find(pd => pd.period === prevDate);
                    const prevSpend = spendOnDay(totalSpendByDayPrev, prevDate);

                    return prevShopifyData && prevSpend > 0 ? ( (Number(prevShopifyData.net_sales || prevShopifyData.total_sales) / prevSpend) ).toFixed(2) : null;
                })
            }
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
            name: 'Net AOV (Current)',
            data: shopifyDaily.map(d => d.orders > 0 ? ((Number(d.net_sales || d.total_sales) / d.orders)).toFixed(0) : null)
        },
        {
            name: `Net AOV (${comparisonMethod})`,
            data: shopifyDaily.map((d, i) => {
                let prevDate;
                if (comparisonMethod === "Last Year") {
                    const currentDate = dayjs(d.period);
                    prevDate = currentDate.subtract(1, 'year').format('YYYY-MM-DD');
                } else {
                    const currentDate = dayjs(d.period);
                    const periodStart = dayjs(appliedDateRange.startDate);
                    const periodEnd = dayjs(appliedDateRange.endDate);
                    const daysDiff = currentDate.diff(periodStart, 'day');
                    const prevPeriodStart = periodStart.subtract(periodEnd.diff(periodStart, 'day') + 1, 'day');
                    prevDate = prevPeriodStart.add(daysDiff, 'day').format('YYYY-MM-DD');
                }

                // Find corresponding previous period data
                const prevShopifyData = shopifyDailyPrev.find(pd => pd.period === prevDate);
                return prevShopifyData && prevShopifyData.orders > 0 ? ((Number(prevShopifyData.net_sales || prevShopifyData.total_sales) / prevShopifyData.orders)).toFixed(0) : null;
            })
        }
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-8">
                {loading ? (
                    <div className="col-span-full text-center py-12"><Spinner size={40} color="#406969" /></div>
                ) : error ? (
                    <div className="col-span-full text-center text-red-500 py-12">{error}</div>
                ) : (
                    STANDARD_SECTIONS.map((section) => {
                        const primaryKey = section.metricKeys[0];
                        const breakdownKeys = section.metricKeys.slice(1); // Exclude primary from breakdown
                        const sectionMetrics = metrics
                            .filter((m) => breakdownKeys.includes(m.key))
                            .sort((a, b) => breakdownKeys.indexOf(a.key) - breakdownKeys.indexOf(b.key));
                        const primaryMetric = metrics.find((m) => m.key === primaryKey);
                        const totalSales = metricsData?.total_sales || 0;
                        const primaryValue = primaryKey === 'total_sales' ? totalSales
                            : primaryKey === 'revenue' ? (metricsData?.revenue ?? 0)
                            : primaryKey === 'gross_profit' ? (metricsData?.gross_profit ?? 0)
                            : primaryKey === 'total_expenses' ? (metricsData?.total_expenses ?? 0)
                            : primaryKey === 'ebit' ? (metricsData?.ebit ?? 0)
                            : 0;
                        const pctOfTotal = totalSales > 0 ? ((primaryValue / totalSales) * 100).toFixed(1) : '0';

                        return (
                            <div
                                key={section.key}
                                className="flex flex-col rounded-xl border border-gray-200 bg-white overflow-visible"
                            >
                                {/* Section header */}
                                <ComparisonPeriodPopover
                                    comparisonMethod={comparisonMethod}
                                    changePrevValue={primaryMetric?.changePrevValue}
                                    changeAbsolute={primaryMetric?.changeAbsolute}
                                >
                                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                                        <div className="text-sm font-medium text-gray-500 mb-1">{section.title}</div>
                                        <div className="flex items-end justify-between gap-2">
                                            <span className="text-2xl font-bold text-[var(--color-primary-searchmind)]">
                                                {primaryMetric?.value ?? '-'}
                                            </span>
                                            {totalSales > 0 && (
                                                <span className="text-xs text-gray-500 tabular-nums">
                                                    {pctOfTotal}% of total sales
                                                </span>
                                            )}
                                        </div>
                                        {primaryMetric?.change !== undefined && (
                                            <div className="mt-2 flex items-center gap-1">
                                                <span className={`text-[0.65rem] rounded-sm font-medium flex items-center justify-end gap-1 px-2 py-1 tabular-nums ${primaryMetric.changeType === 'up' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                                                    {primaryMetric.changeType === 'up' ? <FiTrendingUp className="text-sm" /> : <FiTrendingDown className="text-sm" />}
                                                    {primaryMetric.change}%
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </ComparisonPeriodPopover>

                                {/* Section calculation (when Show calcs enabled) */}
                                {showCalcs && primaryMetric?.popOverContent && (
                                    <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/30">
                                        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-[10px] font-mono text-gray-600 leading-tight">
                                            {primaryMetric.calcValueLabels && (
                                                <div className="mb-1.5 pb-1.5 border-b border-gray-200 space-y-0.5">
                                                    {primaryMetric.calcValueLabels.split('\n').filter(Boolean).map((line, i) => {
                                                        const colonIdx = line.indexOf(':');
                                                        const label = colonIdx >= 0 ? line.slice(0, colonIdx).trim() : line;
                                                        const val = colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : '';
                                                        return (
                                                            <div key={i} className="flex justify-between gap-4">
                                                                <span className="text-gray-500">{label}</span>
                                                                <span className="tabular-nums">{val}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            <div className="flex flex-col items-end gap-0.5">
                                                {(() => {
                                                    const calcLines = primaryMetric.popOverContent.split('\n').map((l) => l.trim()).filter((l) => l && l.startsWith('=') && /\d/.test(l));
                                                    return calcLines.map((line, i) => (
                                                        <span key={i} className={i === calcLines.length - 1 ? 'font-bold text-[var(--color-primary-searchmind)]' : ''}>
                                                            {line}
                                                        </span>
                                                    ));
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Section breakdown */}
                                <div className="flex flex-col divide-y divide-gray-100">
                                    {sectionMetrics.map((metric) => {
                                        const metricKey = metric.key;
                                        const isVariableSubItem = section.variableSubItems?.includes(metricKey);
                                        const toggleMetricSelection = (key) => {
                                            if (!key) return;
                                            setSelectedMetrics(prev =>
                                                prev.includes(key) ? (prev.length > 1 ? prev.filter(k => k !== key) : prev) : [...prev, key]
                                            );
                                        };
                                        const isSelected = selectedMetrics.includes(metricKey);
                                        const hasCalc = showCalcs && metric.popOverContent;
                                        const calcLines = metric.popOverContent ? metric.popOverContent.split('\n').map((l) => l.trim()).filter((l) => l && l.startsWith('=') && /\d/.test(l)) : [];

                                        return (
                                            <div
                                                key={metric.key}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => toggleMetricSelection(metricKey)}
                                                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleMetricSelection(metricKey)}
                                                className={`cursor-pointer transition-colors hover:bg-gray-50/50 ${isSelected ? 'bg-[#1E2B2B]/5' : ''}`}
                                                aria-pressed={isSelected}
                                            >
                                                <ComparisonPeriodPopover
                                                    comparisonMethod={comparisonMethod}
                                                    changePrevValue={metric.changePrevValue}
                                                    changeAbsolute={metric.changeAbsolute}
                                                >
                                                    <div className={`px-5 py-3 flex items-center justify-between gap-4 ${isVariableSubItem ? '' : ''}`}>
                                                        <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                                                            {metric.label}
                                                            {metric.key === "returns" ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setReturnsOverrideModalOpen(true);
                                                                    }}
                                                                    className={`p-1 rounded-md transition-colors ${metric.returnsOverrideActive ? "text-purple-600 bg-purple-50" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
                                                                    aria-label="Returns override settings"
                                                                    title="Returns % override"
                                                                >
                                                                    <FiSettings className="text-sm" />
                                                                </button>
                                                            ) : null}
                                                            {metric.isCustomReplacement ? (
                                                                <span className="text-[10px] font-normal text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                                                                    Custom
                                                                </span>
                                                            ) : null}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-semibold tabular-nums text-gray-900">{metric.value}</span>
                                                            <span className={`text-[0.65rem] rounded-sm font-medium flex items-center justify-end gap-0.5 px-1.5 py-0.5 min-w-[4rem] tabular-nums ${metric.changeType === 'up' ? 'text-green-600 bg-green-50' : metric.changeType === 'down' ? 'text-red-600 bg-red-50' : 'text-gray-600 bg-gray-100'}`}>
                                                                {metric.changeType === 'up' ? <FiTrendingUp className="text-xs" /> : metric.changeType === 'down' ? <FiTrendingDown className="text-xs" /> : null}
                                                                {(metric.change ?? 0)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </ComparisonPeriodPopover>
                                                {hasCalc && calcLines.length > 0 && (
                                                    <div className={`pb-3 pt-0 ${isVariableSubItem ? 'pl-8 pr-5' : 'px-5'}`}>
                                                        <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-[10px] font-mono text-gray-600 leading-tight">
                                                            {metric.calcValueLabels && (
                                                                <div className="mb-1.5 pb-1.5 border-b border-gray-200 space-y-0.5">
                                                                    {metric.calcValueLabels.split('\n').filter(Boolean).map((line, i) => {
                                                                        const colonIdx = line.indexOf(':');
                                                                        const label = colonIdx >= 0 ? line.slice(0, colonIdx).trim() : line;
                                                                        const val = colonIdx >= 0 ? line.slice(colonIdx + 1).trim() : '';
                                                                        return (
                                                                            <div key={i} className="flex justify-between gap-4">
                                                                                <span className="text-gray-500">{label}</span>
                                                                                <span className="tabular-nums">{val}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                            <div className="flex flex-col items-end gap-0.5">
                                                                {calcLines.map((line, i) => (
                                                                    <span key={i} className={i === calcLines.length - 1 ? 'font-bold text-[var(--color-primary-searchmind)]' : ''}>
                                                                        {line}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
            </>
            ) : (
            <div className="mb-8">
                <Custom
                    customerId={params.customerId}
                    metricsData={metricsData}
                    metrics={metrics}
                    showCalcs={showCalcs}
                    shopifyDaily={shopifyDaily}
                    shopifyDailyPrev={shopifyDailyPrev}
                    adChannelRowsCurr={channelRowsCurr}
                    adChannelRowsPrev={channelRowsPrev}
                    appliedDateRange={appliedDateRange}
                    comparisonMethod={comparisonMethod}
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
        </div>
    );
}