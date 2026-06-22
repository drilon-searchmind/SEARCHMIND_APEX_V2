"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import GraphCard from "@/components/dashboard/GraphCard";
import CobaltLoader from "@/components/ui/CobaltLoader";
import PerformanceDashboardStandardSections from "./components/PerformanceDashboardStandardSections";
import B2BCustom from "./components/B2BCustom";
import Ga4ConversionEventsModal from "./components/Ga4ConversionEventsModal";
import CalculationWalkthroughModal from "./components/CalculationWalkthroughModal";
import "./performance-dashboard.css";
import { useCustomers } from "@/hooks/useCustomers";
import { getGa4ConversionEventNames } from "@/lib/ga4ConversionEvents";
import {
    FiUsers,
    FiActivity,
    FiTarget,
    FiCreditCard,
    FiTrendingUp,
    FiBarChart2,
    FiGlobe,
    FiClock,
    FiEye,
    FiZap,
    FiPercent,
} from "react-icons/fi";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";
import {
    getDefaultDashboardDateRange,
    getComparisonPeriodRange,
    COMPARISON_METHOD,
} from "@/lib/dateRangeComparison";
import { useAdSpendPlatformsFilter } from "@/hooks/useAdSpendPlatformsFilter";
import { adSpendChannelsForDashboard } from "@/lib/mergeAdSpendDaily";
import { getChartColors } from "@/components/dashboard/chartColors";
import {
    buildB2BStandardOverviewSections,
    getB2BOverviewKpiCardKeys,
} from "@/lib/b2bDashboard/b2bOverviewLayout";
import { collectSectionMetricKeys } from "@/lib/performanceDashboard/performanceDashboardLayout";
import {
    computeB2BMetricsData,
    buildB2BMetricsArray,
    buildB2BReplacementMap,
} from "@/lib/b2bDashboard/b2bOverviewMetrics";
import { buildB2BDailyMetricsRow } from "@/lib/b2bDashboard/b2bKpiFormulaUtils";
import { B2B_CHART_METRIC_OPTIONS } from "@/lib/b2bDashboard/b2bKpiConstants";

const METRIC_ICONS = {
    sessions: FiActivity,
    totalUsers: FiUsers,
    newUsers: FiTrendingUp,
    engagedSessions: FiZap,
    engagement_rate: FiBarChart2,
    averageSessionDuration: FiClock,
    bounce_rate: FiPercent,
    screenPageViews: FiEye,
    eventCount: FiZap,
    conversions: FiTarget,
    conversion_rate: FiBarChart2,
    marketing_spend: FiCreditCard,
    cost: FiCreditCard,
    cost_per_lead: FiTarget,
    cost_per_session: FiCreditCard,
    leads_per_1k_spend: FiTrendingUp,
    sessions_per_conversion: FiActivity,
    meta_spend: FiCreditCard,
    google_spend: FiCreditCard,
    pinterest_spend: FiCreditCard,
    snapchat_spend: FiCreditCard,
    bing_spend: FiCreditCard,
    reddit_spend: FiCreditCard,
};

export default function B2BPerformanceDashboard({ customer: customerProp }) {
    const params = useParams();
    const { customers, updateCustomer } = useCustomers();
    const customer = customerProp || customers.find((c) => c._id === params.customerId);
    const defaultRange = getDefaultDashboardDateRange();

    const [tempDateRange, setTempDateRange] = useState(defaultRange);
    const [appliedDateRange, setAppliedDateRange] = useState(defaultRange);
    const [tempCompareRange, setTempCompareRange] = useState({ startDate: "", endDate: "" });
    const [appliedCompareRange, setAppliedCompareRange] = useState({ startDate: "", endDate: "" });
    const [comparisonMethod, setComparisonMethod] = useState(COMPARISON_METHOD.LAST_YEAR);
    const [tempComparisonMethod, setTempComparisonMethod] = useState(COMPARISON_METHOD.LAST_YEAR);
    const [viewMode, setViewMode] = useState("standard");
    const [calcWalkthroughOpen, setCalcWalkthroughOpen] = useState(false);
    const [selectedMetrics, setSelectedMetrics] = useState(["sessions", "cost"]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [current, setCurrent] = useState(null);
    const [comparison, setComparison] = useState(null);
    const [customKpis, setCustomKpis] = useState([]);
    const [chartColors, setChartColors] = useState({});
    const [ga4ConversionModalOpen, setGa4ConversionModalOpen] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);

    const { spendQuerySuffix } = useAdSpendPlatformsFilter(customer, false);

    const comparisonMethodForUi =
        comparisonMethod === COMPARISON_METHOD.NONE ? null : comparisonMethod;

    useEffect(() => {
        setChartColors(getChartColors());
    }, []);

    const handleDateRangeApply = ({
        startDate,
        endDate,
        comparisonMethod: appliedComparison,
        compareStartDate,
        compareEndDate,
    }) => {
        pushDashboardDateRangeApplied({
            page: "b2b_performance_dashboard",
            customerId: params.customerId,
            startDate,
            endDate,
            comparisonMethod: appliedComparison,
        });
        setAppliedDateRange({ startDate, endDate });
        if (appliedComparison) setComparisonMethod(appliedComparison);
        if (compareStartDate && compareEndDate) {
            setAppliedCompareRange({ startDate: compareStartDate, endDate: compareEndDate });
        } else {
            setAppliedCompareRange({ startDate: "", endDate: "" });
        }
    };

    const fetchCustomKpis = useCallback(async () => {
        if (!params.customerId) return;
        try {
            const res = await fetch(`/api/custom-kpis/${params.customerId}?context=b2b`);
            if (!res.ok) return;
            const data = await res.json();
            setCustomKpis(Array.isArray(data) ? data : []);
        } catch {
            setCustomKpis([]);
        }
    }, [params.customerId]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const comp = getComparisonPeriodRange({
                comparisonMethod,
                startDate: appliedDateRange.startDate,
                endDate: appliedDateRange.endDate,
                compareStartDate: appliedCompareRange.startDate,
                compareEndDate: appliedCompareRange.endDate,
            });

            const qs = new URLSearchParams({
                startDate: appliedDateRange.startDate,
                endDate: appliedDateRange.endDate,
                source: "performance-dashboard",
            });
            if (!comp.skip && comp.prevStart && comp.prevEnd) {
                qs.set("compareStartDate", comp.prevStart.format("YYYY-MM-DD"));
                qs.set("compareEndDate", comp.prevEnd.format("YYYY-MM-DD"));
            }
            const suffix = spendQuerySuffix?.replace(/^\?/, "") || "";
            if (suffix) {
                suffix.split("&").forEach((part) => {
                    const [k, v] = part.split("=");
                    if (k) qs.set(k, decodeURIComponent(v || ""));
                });
            }

            const [dashRes] = await Promise.all([
                fetch(`/api/b2b-dashboard/${params.customerId}?${qs.toString()}`),
                fetchCustomKpis(),
            ]);
            const json = await dashRes.json();
            if (!dashRes.ok) throw new Error(json?.error || "Failed to load B2B dashboard");
            setCurrent(json.current);
            setComparison(json.comparison);
        } catch (e) {
            setError(e?.message || "Unexpected error");
            setCurrent(null);
            setComparison(null);
        } finally {
            setLoading(false);
        }
    }, [
        appliedDateRange,
        appliedCompareRange,
        comparisonMethod,
        params.customerId,
        spendQuerySuffix,
        fetchCustomKpis,
    ]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const visibleAdChannels = useMemo(() => {
        if (!current) return [];
        return adSpendChannelsForDashboard(
            { ...(customer?.CustomerSettings || {}), customerType: customer?.customerType },
            current,
            comparison
        );
    }, [current, comparison, customer]);

    const visibleSpendMetricKeys = useMemo(
        () => visibleAdChannels.map((c) => c.metricsDataKey),
        [visibleAdChannels]
    );

    const STANDARD_SECTIONS = useMemo(
        () => buildB2BStandardOverviewSections({ visibleAdSpendChannels: visibleAdChannels }),
        [visibleAdChannels]
    );

    const sectionMetricKeys = useMemo(
        () => Array.from(collectSectionMetricKeys(STANDARD_SECTIONS)),
        [STANDARD_SECTIONS]
    );

    const overviewKpiKeys = useMemo(
        () => getB2BOverviewKpiCardKeys(STANDARD_SECTIONS),
        [STANDARD_SECTIONS]
    );

    const { metricsData, metricsDataPrev } = useMemo(
        () => computeB2BMetricsData(current, comparison, visibleAdChannels),
        [current, comparison, visibleAdChannels]
    );

    const conversionEventNames = useMemo(
        () =>
            getGa4ConversionEventNames(customer?.CustomerSettings).length
                ? getGa4ConversionEventNames(customer?.CustomerSettings)
                : current?.ga4ConversionEventNames || [],
        [customer?.CustomerSettings, current?.ga4ConversionEventNames]
    );

    const conversionSource =
        conversionEventNames.length > 0 || current?.ga4ConversionSource === "custom"
            ? "custom"
            : "default";

    const replacementByKey = useMemo(
        () => buildB2BReplacementMap(customKpis, metricsData, metricsDataPrev),
        [customKpis, metricsData, metricsDataPrev]
    );

    const allMetricKeys = useMemo(
        () => [...new Set([...sectionMetricKeys, ...overviewKpiKeys])],
        [sectionMetricKeys, overviewKpiKeys]
    );

    const metrics = useMemo(
        () =>
            buildB2BMetricsArray({
                metricsData,
                metricsDataPrev,
                metricKeys: allMetricKeys,
                customKpis,
                replacementByKey,
                conversionEventNames,
                conversionSource,
            }),
        [
            metricsData,
            metricsDataPrev,
            allMetricKeys,
            customKpis,
            replacementByKey,
            conversionEventNames,
            conversionSource,
        ]
    );

    const metricsByKey = useMemo(
        () => new Map(metrics.map((m) => [m.key, m])),
        [metrics]
    );

    const overviewKpiMetrics = useMemo(() => {
        const channelSpendKeys = new Set([
            "meta_spend",
            "google_spend",
            "pinterest_spend",
            "snapchat_spend",
            "bing_spend",
            "reddit_spend",
        ]);
        return overviewKpiKeys
            .filter((key) => {
                if (channelSpendKeys.has(key)) {
                    return visibleSpendMetricKeys.includes(key);
                }
                return true;
            })
            .map((key) => metricsByKey.get(key))
            .filter(Boolean)
            .map((m) => ({
                ...m,
                icon: METRIC_ICONS[m.key]
                    ? React.createElement(METRIC_ICONS[m.key], {
                          className:
                              "text-[var(--color-primary-searchmind-lighter)] font-bold text-lg",
                      })
                    : undefined,
            }));
    }, [overviewKpiKeys, metricsByKey, visibleSpendMetricKeys]);

    const dailyRows = useMemo(() => {
        const ga4ByDate = Object.fromEntries((current?.ga4Daily || []).map((d) => [d.date, d]));
        const spendMap = current?.adSpendByPeriod || {};
        const dates = Array.from(
            new Set([
                ...(current?.ga4Daily || []).map((d) => d.date),
                ...Object.keys(spendMap),
            ])
        ).sort();
        return dates.map((date) =>
            buildB2BDailyMetricsRow(date, ga4ByDate[date], spendMap[date] || 0, current)
        );
    }, [current]);

    const chartCategories = useMemo(() => dailyRows.map((r) => r.date), [dailyRows]);

    const { chartSeries, chartOptions } = useMemo(() => {
        const series = B2B_CHART_METRIC_OPTIONS.filter((opt) =>
            selectedMetrics.includes(opt.key)
        ).map((opt, i) => ({
            name: opt.label,
            data: dailyRows.map((row) => {
                if (opt.key === "cost") return row.marketing_spend || 0;
                if (opt.key === "engagement_rate") return row.engagement_rate ?? 0;
                return row[opt.key] ?? 0;
            }),
            color:
                i === 0
                    ? chartColors.primaryLighter || "#406969"
                    : chartColors.lime || "#C6ED62",
        }));

        return {
            chartSeries: series,
            chartOptions: {
                chart: {
                    id: "b2b-overview-chart",
                    toolbar: { show: false },
                    fontFamily: "Inter, sans-serif",
                },
                xaxis: { categories: chartCategories, labels: { rotate: -45 } },
                yaxis: {
                    labels: {
                        formatter: (v) =>
                            Number(v).toLocaleString("da-DK", { maximumFractionDigits: 0 }),
                    },
                },
                stroke: { curve: "smooth", width: 2 },
                legend: { show: true, position: "top" },
                tooltip: { shared: true },
                grid: {
                    borderColor: "#e5e7eb",
                    xaxis: { lines: { show: false } },
                    yaxis: { lines: { show: true } },
                },
            },
        };
    }, [selectedMetrics, dailyRows, chartCategories, chartColors]);

    const toggleMetricSelection = (key) => {
        setSelectedMetrics((prev) => {
            if (prev.includes(key)) {
                return prev.length > 1 ? prev.filter((k) => k !== key) : prev;
            }
            return [...prev, key];
        });
    };

    const ga4Configured = current?.ga4Configured;

    const handleGa4ConversionSave = async (eventNames) => {
        if (!params?.customerId || !customer) return;
        setSettingsSaving(true);
        try {
            await updateCustomer(params.customerId, {
                CustomerSettings: {
                    ...customer.CustomerSettings,
                    ga4ConversionEventNames: eventNames,
                },
            });
            setGa4ConversionModalOpen(false);
            fetchData();
        } catch (err) {
            console.error(err);
        } finally {
            setSettingsSaving(false);
        }
    };

    return (
        <div className="cobalt-perf w-full" data-theme="cobalt">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Overview"
                subtitle="B2B performance — traffic, leads & marketing spend"
                right={
                    <DateRangePicker
                        variant="cobalt"
                        startDate={tempDateRange.startDate}
                        endDate={tempDateRange.endDate}
                        onApply={handleDateRangeApply}
                        onStartDateChange={(v) => setTempDateRange((d) => ({ ...d, startDate: v }))}
                        onEndDateChange={(v) => setTempDateRange((d) => ({ ...d, endDate: v }))}
                        compareStartDate={tempCompareRange.startDate}
                        compareEndDate={tempCompareRange.endDate}
                        onCompareStartDateChange={(v) =>
                            setTempCompareRange((d) => ({ ...d, startDate: v }))
                        }
                        onCompareEndDateChange={(v) =>
                            setTempCompareRange((d) => ({ ...d, endDate: v }))
                        }
                        loading={loading}
                        showComparisonMethodToggler
                        comparisonMethod={tempComparisonMethod}
                        onComparisonMethodChange={setTempComparisonMethod}
                    />
                }
            />

            {!loading && error && (
                <div className="apex-perf-alert apex-perf-alert--error mb-6">
                    {error}
                </div>
            )}

            {!loading && !error && !ga4Configured && (
                <div className="apex-perf-empty mb-8">
                    <FiGlobe className="mx-auto mb-3 text-3xl text-[var(--color-accent-light)]" />
                    <h3 className="apex-perf-custom__title mb-2">
                        Connect GA4 to get started
                    </h3>
                    <p className="text-sm text-[var(--color-muted)] max-w-md mx-auto">
                        Add a GA4 Property ID in Property Configuration to load traffic and
                        conversion metrics.
                    </p>
                </div>
            )}

            {(ga4Configured || loading) && (
                <>
                    <div className="apex-perf-toolbar">
                        <div className="apex-perf-segment">
                            <button
                                type="button"
                                className={`apex-perf-segment__btn${viewMode === "standard" ? " is-active" : ""}`}
                                onClick={() => setViewMode("standard")}
                            >
                                Standard
                            </button>
                            <button
                                type="button"
                                className={`apex-perf-segment__btn${viewMode === "custom" ? " is-active" : ""}`}
                                onClick={() => setViewMode("custom")}
                            >
                                Custom
                            </button>
                        </div>
                        {viewMode === "standard" && (
                            <button
                                type="button"
                                className={`apex-perf-chip${calcWalkthroughOpen ? " is-active" : ""}`}
                                onClick={() => setCalcWalkthroughOpen(true)}
                            >
                                Show calcs
                            </button>
                        )}
                    </div>

                    {viewMode === "standard" ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full mb-8">
                                <PerformanceDashboardStandardSections
                                    variant="cobalt"
                                    sections={STANDARD_SECTIONS}
                                    metrics={metrics}
                                    metricsData={metricsData}
                                    loading={loading}
                                    error={error}
                                    comparisonMethod={comparisonMethodForUi}
                                    selectedMetrics={selectedMetrics}
                                    onToggleMetric={toggleMetricSelection}
                                    onGa4ConversionSettingsClick={() =>
                                        setGa4ConversionModalOpen(true)
                                    }
                                />
                            </div>

                            <div className="w-full mb-8">
                                <div className="flex flex-wrap items-center gap-2 mb-4">
                                    {B2B_CHART_METRIC_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            className={`apex-perf-chip${selectedMetrics.includes(opt.key) ? " is-active" : ""}`}
                                            onClick={() => toggleMetricSelection(opt.key)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                {loading ? (
                                    <div className="apex-perf-loading h-64">
                                        <CobaltLoader
                                            variant="block"
                                            title="Updating chart"
                                            request="GET /api/b2b-dashboard"
                                        />
                                    </div>
                                ) : (
                                    <GraphCard
                                        variant="cobalt"
                                        title={
                                            selectedMetrics.length === 1
                                                ? `${
                                                      B2B_CHART_METRIC_OPTIONS.find(
                                                          (o) => o.key === selectedMetrics[0]
                                                      )?.label
                                                  } Over Time`
                                                : "Performance Metrics Over Time"
                                        }
                                        chartOptions={chartOptions}
                                        chartSeries={chartSeries}
                                    />
                                )}

                                {!loading && overviewKpiMetrics.length > 0 && (
                                    <div className="mt-6">
                                        <h3 className="apex-perf-section-label">
                                            Key metrics
                                        </h3>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
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
                                                        variant="cobalt"
                                                        label={metric.label}
                                                        value={metric.value}
                                                        change={metric.change}
                                                        changeType={metric.changeType}
                                                        changeAbsolute={metric.changeAbsolute}
                                                        changePrevValue={metric.changePrevValue}
                                                        comparisonMethod={comparisonMethodForUi}
                                                        icon={metric.icon}
                                                        isActive={selectedMetrics.includes(
                                                            metric.key
                                                        )}
                                                        className="min-w-0"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="mb-8">
                            <B2BCustom
                                customerId={params.customerId}
                                metricsData={metricsData}
                                metricsDataPrev={metricsDataPrev}
                                current={current}
                                comparison={comparison}
                                comparisonMethod={comparisonMethodForUi}
                                visibleSpendMetricKeys={visibleSpendMetricKeys}
                                onKpisUpdated={fetchCustomKpis}
                            />
                        </div>
                    )}
                </>
            )}

            <Ga4ConversionEventsModal
                open={ga4ConversionModalOpen}
                onClose={() => setGa4ConversionModalOpen(false)}
                customerId={params.customerId}
                initialEventNames={conversionEventNames}
                dateRange={appliedDateRange}
                onSave={handleGa4ConversionSave}
                saving={settingsSaving}
            />
            <CalculationWalkthroughModal
                open={calcWalkthroughOpen}
                onClose={() => setCalcWalkthroughOpen(false)}
                sections={STANDARD_SECTIONS}
                metrics={metrics}
                title="How your metrics connect"
                subtitle="Follow each step to see how traffic, conversions, and marketing spend combine for this period."
                dateLabel={
                    appliedDateRange?.startDate && appliedDateRange?.endDate
                        ? `${appliedDateRange.startDate} – ${appliedDateRange.endDate}`
                        : null
                }
            />
        </div>
    );
}
