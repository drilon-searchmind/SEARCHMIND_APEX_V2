"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import GraphCard from "@/components/dashboard/GraphCard";
import Spinner from "@/components/ui/Spinner";
import SEOKeywordSettings from "@/components/seo/SEOKeywordSettings";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import {
    formatComparisonPeriodDates,
    resolveDailyComparisonDate,
    COMPARISON_METHOD,
} from "@/lib/dateRangeComparison";
import {
    buildSeoSummary,
    getDailyMetricValue,
    getSeoKpiValue,
    normalizeSeriesValues,
    SEO_CHART_METRIC_LABELS,
} from "@/lib/seoDashboardUtils";
import {
    CHART_TOGGLE_ROW1,
    CHART_TOGGLE_ROW2,
    DISPLAY_ONLY_METRICS,
    CHART_SERIES_KEYS,
} from "./components/seoDashboardConfig";

const CURRENCY_KEYS = new Set(["organic_revenue", "spend_saved", "revenue_per_click"]);

function formatKpiValue(key, value, opt = {}) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    if (opt.isPercent || key === "ctr" || key === "organic_conv_rate" || key.endsWith("_traffic_share")) {
        return `${Number(value).toLocaleString("da-DK", { maximumFractionDigits: 2 })} %`;
    }
    if (key === "position" || opt.decimals != null) {
        return Number(value).toLocaleString("da-DK", {
            maximumFractionDigits: opt.decimals ?? 2,
            minimumFractionDigits: opt.decimals ?? 2,
        });
    }
    if (CURRENCY_KEYS.has(key)) {
        return `${Number(value).toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr.`;
    }
    return Number(value).toLocaleString("da-DK", { maximumFractionDigits: 0 });
}

function changeTypeForMetric(key, changeVal) {
    if (changeVal === null) return undefined;
    const lowerIsBetter = key === "position";
    if (lowerIsBetter) {
        return changeVal < 0 ? "up" : changeVal > 0 ? "down" : undefined;
    }
    return changeVal > 0 ? "up" : changeVal < 0 ? "down" : undefined;
}

export default function SEODashboardPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const rangeStartQ = searchParams.get("startDate");
    const rangeEndQ = searchParams.get("endDate");
    const customerId = params.customerId;

    const {
        setTempDateRange: setTempRange,
        appliedDateRange: appliedRange,
        setAppliedDateRange: setAppliedRange,
        appliedCompareRange,
        comparisonMethod,
        comparisonLabel,
        dateRangePickerProps,
    } = useDashboardDateRange({
        onApply: ({ startDate, endDate, comparisonMethod: appliedComparison }) => {
            pushDashboardDateRangeApplied({
                page: "service_dashboard_seo",
                customerId,
                startDate,
                endDate,
                comparisonMethod: appliedComparison,
            });
        },
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [metrics, setMetrics] = useState([]);
    const [metricsPrev, setMetricsPrev] = useState([]);
    const [keywords, setKeywords] = useState([]);
    const [supplemental, setSupplemental] = useState(null);
    const [supplementalPrev, setSupplementalPrev] = useState(null);
    const [selectedMetrics, setSelectedMetrics] = useState(["clicks"]);
    const [siteUrl, setSiteUrl] = useState("");
    const [brandKeywords, setBrandKeywords] = useState([]);

    useEffect(() => {
        if (selectedMetrics.length === 0) setSelectedMetrics(["clicks"]);
    }, [selectedMetrics]);

    useEffect(() => {
        if (rangeStartQ && rangeEndQ) {
            setTempRange({ startDate: rangeStartQ, endDate: rangeEndQ });
            setAppliedRange({ startDate: rangeStartQ, endDate: rangeEndQ });
        }
    }, [rangeStartQ, rangeEndQ, setTempRange, setAppliedRange]);

    useEffect(() => {
        async function fetchCustomer() {
            if (!customerId) return;
            try {
                const res = await fetch(`/api/customers/${customerId}`);
                if (!res.ok) throw new Error("Failed to fetch customer");
                const customer = await res.json();
                setSiteUrl(customer?.CustomerSettings?.googleSearchConsoleProperty || "");
            } catch {
                setSiteUrl("");
            }
        }
        fetchCustomer();
    }, [customerId]);

    const fetchBrandKeywords = useCallback(async () => {
        if (!customerId) return;
        try {
            const brandRes = await fetch(`/api/seo-keywords/brand/${customerId}`);
            const brandData = await brandRes.json();
            setBrandKeywords(brandData.success && brandData.data?.keywords ? brandData.data.keywords : []);
        } catch {
            setBrandKeywords([]);
        }
    }, [customerId]);

    useEffect(() => {
        fetchBrandKeywords();
    }, [fetchBrandKeywords]);

    const fetchSeoMetrics = useCallback(
        async (startDate, endDate) => {
            const res = await fetch("/api/seo-dashboard/metrics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ siteUrl, startDate, endDate, customerId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || "API error");
            return data;
        },
        [siteUrl, customerId]
    );

    useEffect(() => {
        if (!siteUrl) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const compDates = formatComparisonPeriodDates({
                    comparisonMethod,
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                    compareStartDate: appliedCompareRange.startDate,
                    compareEndDate: appliedCompareRange.endDate,
                });

                const current = await fetchSeoMetrics(appliedRange.startDate, appliedRange.endDate);
                if (cancelled) return;
                setMetrics(current.metrics?.rows || []);
                setKeywords(current.keywords?.rows || []);
                setSupplemental(current.supplemental || null);

                if (!compDates.skip && compDates.startDate && compDates.endDate) {
                    const prev = await fetchSeoMetrics(compDates.startDate, compDates.endDate);
                    if (!cancelled) {
                        setMetricsPrev(prev.metrics?.rows || []);
                        setSupplementalPrev(prev.supplemental || null);
                    }
                } else {
                    setMetricsPrev([]);
                    setSupplementalPrev(null);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e.message);
                    setMetrics([]);
                    setMetricsPrev([]);
                    setKeywords([]);
                    setSupplemental(null);
                    setSupplementalPrev(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [
        siteUrl,
        appliedRange.startDate,
        appliedRange.endDate,
        appliedCompareRange,
        comparisonMethod,
        fetchSeoMetrics,
    ]);

    const summary = useMemo(
        () => buildSeoSummary(metrics, supplemental, keywords, brandKeywords),
        [metrics, supplemental, keywords, brandKeywords]
    );

    const summaryPrev = useMemo(
        () =>
            metricsPrev.length > 0
                ? buildSeoSummary(metricsPrev, supplementalPrev, keywords, brandKeywords)
                : {},
        [metricsPrev, supplementalPrev, keywords, brandKeywords]
    );

    const percentChange = (current, prev) => {
        if (prev === 0 || prev === null || prev === undefined) return null;
        if (current === null || current === undefined) return null;
        return ((current - prev) / Math.abs(prev)) * 100;
    };

    const buildMetricCard = (opt, chartToggle) => {
        const currentValue = getSeoKpiValue(opt.key, summary);
        const prevValue = metricsPrev.length > 0 ? getSeoKpiValue(opt.key, summaryPrev) : null;
        const change =
            chartToggle && comparisonMethod !== COMPARISON_METHOD.NONE
                ? percentChange(currentValue, prevValue)
                : null;
        const isActive = chartToggle && selectedMetrics.includes(opt.key);
        const Icon = opt.icon;

        return (
            <div
                key={opt.key}
                onClick={
                    chartToggle
                        ? () =>
                              setSelectedMetrics((prev) => {
                                  if (prev.includes(opt.key)) {
                                      return prev.length > 1 ? prev.filter((m) => m !== opt.key) : prev;
                                  }
                                  return [...prev, opt.key];
                              })
                        : undefined
                }
                style={chartToggle ? { cursor: "pointer" } : undefined}
            >
                <MetricCard
                    label={opt.label}
                    value={formatKpiValue(opt.key, currentValue, opt)}
                    icon={Icon ? <Icon size={22} color={isActive ? "#fff" : undefined} /> : null}
                    isActive={isActive}
                    change={change !== null ? Math.abs(change).toFixed(1) : undefined}
                    changeType={change !== null ? changeTypeForMetric(opt.key, change) : undefined}
                    comparisonMethod={chartToggle ? comparisonMethod : undefined}
                />
            </div>
        );
    };

    const chartCategories = (metrics || []).map((r) => r.keys?.[0]).filter(Boolean);
    const prevByDate = Object.fromEntries((metricsPrev || []).map((r) => [r.keys?.[0], r]));
    const sortedPrevDates = (metricsPrev || []).map((r) => r.keys?.[0]).filter(Boolean).sort();
    const chartMetricKeys = selectedMetrics.filter((k) => CHART_SERIES_KEYS.has(k));

    const chartSeries = useMemo(() => {
        const series = [];
        for (const key of chartMetricKeys) {
            const label = SEO_CHART_METRIC_LABELS[key] || key;
            const opt = [...CHART_TOGGLE_ROW1, ...CHART_TOGGLE_ROW2].find((m) => m.key === key);
            const currentRaw = chartCategories.map((date) => {
                const row = metrics.find((r) => r.keys?.[0] === date);
                return getDailyMetricValue(row, key, supplemental, date);
            });
            series.push({
                name: `${label} (Current)`,
                data: normalizeSeriesValues(currentRaw),
                meta: { raw: currentRaw, key, opt },
            });
            if (comparisonMethod !== COMPARISON_METHOD.NONE && metricsPrev.length > 0) {
                const prevRaw = chartCategories.map((date) => {
                    const prevDate = resolveDailyComparisonDate({
                        comparisonMethod,
                        currentDate: date,
                        appliedStartDate: appliedRange.startDate,
                        appliedEndDate: appliedRange.endDate,
                        sortedPrevKeys: sortedPrevDates,
                    });
                    const row = prevDate ? prevByDate[prevDate] : null;
                    return getDailyMetricValue(row, key, supplementalPrev, prevDate);
                });
                series.push({
                    name: `${label} (${comparisonLabel})`,
                    data: normalizeSeriesValues(prevRaw),
                    meta: { raw: prevRaw, key, opt },
                });
            }
        }
        return series;
    }, [
        chartMetricKeys,
        chartCategories,
        metrics,
        metricsPrev,
        supplemental,
        supplementalPrev,
        comparisonMethod,
        comparisonLabel,
        appliedRange,
        sortedPrevDates,
        prevByDate,
    ]);

    const selectedCount = chartMetricKeys.length;
    const compCount = comparisonMethod !== COMPARISON_METHOD.NONE ? selectedCount : 0;
    const strokeWidths = [...Array(selectedCount).fill(2), ...Array(compCount).fill(1)];
    const strokeDashArrays = [...Array(selectedCount).fill(0), ...Array(compCount).fill(5)];
    const fillOpacities = [...Array(selectedCount).fill(1), ...Array(compCount).fill(0.5)];

    const chartOptions = useMemo(
        () => ({
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "Outfit, sans-serif" },
            xaxis: { categories: chartCategories, labels: { rotate: -45 } },
            yaxis: {
                min: 0,
                max: 100,
                labels: { formatter: (v) => `${Math.round(v)}%` },
            },
            colors: ["#406969", "#1E2B2B", "#4F46E5", "#06B6D4", "#C6ED62", "#D6CDB6", "#F59E0B", "#EF4444"],
            stroke: { width: strokeWidths, curve: "smooth", dashArray: strokeDashArrays },
            fill: { type: "solid", opacity: fillOpacities },
            grid: {
                borderColor: "#e5e7eb",
                strokeDashArray: 0,
                xaxis: { lines: { show: false } },
                yaxis: { lines: { show: true } },
            },
            dataLabels: { enabled: false },
            tooltip: {
                theme: "light",
                y: {
                    formatter: (_val, opts) => {
                        const s = chartSeries[opts?.seriesIndex];
                        const raw = s?.meta?.raw?.[opts?.dataPointIndex];
                        const key = s?.meta?.key;
                        const metricOpt = s?.meta?.opt;
                        if (raw == null) return "—";
                        return formatKpiValue(key, raw, metricOpt || {});
                    },
                },
            },
            legend: { show: true, position: "top" },
        }),
        [chartCategories, strokeWidths, strokeDashArrays, fillOpacities, chartSeries]
    );

    return (
        <div className="mx-auto w-full">
            <DashboardHeading
                title="SEO Dashboard"
                label={siteUrl || "No property set"}
                customerId={customerId}
                dateRange={appliedRange}
                comparisonMethod={comparisonMethod}
                loading={loading}
                dashboardType="seo-dashboard"
                dataSnapshot={{ metrics, selectedMetrics, siteUrl }}
                right={<DateRangePicker {...dateRangePickerProps} loading={loading} />}
            />

            {!siteUrl && !loading && (
                <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                    Add a Google Search Console property in Property Settings to load SEO metrics.
                </div>
            )}

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Spinner size={48} />
                </div>
            ) : error ? (
                <div className="text-red-500 text-center py-8">{error}</div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mb-4">
                        {CHART_TOGGLE_ROW1.map((opt) => buildMetricCard(opt, true))}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 w-full mb-4">
                        {CHART_TOGGLE_ROW2.map((opt) => buildMetricCard(opt, true))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-8">
                        {DISPLAY_ONLY_METRICS.map((opt) => buildMetricCard(opt, false))}
                    </div>

                    <div className="mb-8">
                        <GraphCard
                            title="Performance over time"
                            chartOptions={chartOptions}
                            chartSeries={chartSeries}
                            hideChartToggle
                        />
                        <p className="text-[11px] text-gray-500 mt-2">
                            Values are normalized to 0–100% of each metric&apos;s maximum for comparable curves.
                            Hover for actual numbers. Click KPI cards above to show or hide metrics (daily series only).
                        </p>
                    </div>

                    <SEOKeywordSettings customerId={customerId} onKeywordsUpdate={fetchBrandKeywords} />
                </>
            )}
        </div>
    );
}
