"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import GraphCard from "@/components/dashboard/GraphCard";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { useCustomers } from "@/hooks/useCustomers";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import {
    formatComparisonPeriodDates,
    resolveDailyComparisonDate,
    COMPARISON_METHOD,
} from "@/lib/dateRangeComparison";
import {
    aggregatePeriodFromDaily,
    CHART_METRIC_LABELS,
    getDailyMetricValue,
    normalizeSeriesValues,
    pickCreativeWinnersLosers,
} from "@/lib/facebookPsDashboardUtils";
import PsSortableMetricsTable from "./components/PsSortableMetricsTable";
import {
    CHART_TOGGLE_METRICS,
    DISPLAY_ONLY_METRICS,
    CREATIVE_TABLE_COLUMNS,
    PLACEMENT_TABLE_COLUMNS,
    CAMPAIGN_TABLE_COLUMNS,
} from "./components/psDashboardConfig";
import "./ps-dashboard.css";

function formatKpiValue(key, value, opt = {}) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    if (opt.isPercent || key === "conv_rate" || key === "engagement_rate") {
        const pctVal = key === "conv_rate" && value <= 1 ? value * 100 : value;
        return `${Number(pctVal).toLocaleString("da-DK", { maximumFractionDigits: 2 })}%`;
    }
    if (key === "roas") return Number(value).toFixed(2);
    if (
        key === "ad_spend" ||
        key === "conversion_value" ||
        key === "cpm" ||
        key === "cpc" ||
        key === "cpa"
    ) {
        return Number(value).toLocaleString("da-DK", {
            style: "currency",
            currency: "DKK",
            maximumFractionDigits: 0,
            minimumFractionDigits: 0,
        });
    }
    if (opt.decimals != null) {
        return Number(value).toLocaleString("da-DK", {
            maximumFractionDigits: opt.decimals,
            minimumFractionDigits: opt.decimals,
        });
    }
    return Number(value).toLocaleString("da-DK", { maximumFractionDigits: 0 });
}

export default function FacebookPSPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const rangeStartQ = searchParams.get("startDate");
    const rangeEndQ = searchParams.get("endDate");
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);

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
                page: "service_dashboard_paid_social",
                customerId: params.customerId,
                startDate,
                endDate,
                comparisonMethod: appliedComparison,
            });
        },
    });

    const [fbMetricsByDate, setFbMetricsByDate] = useState([]);
    const [fbMetricsByDatePrev, setFbMetricsByDatePrev] = useState([]);
    const [campaignsPerformance, setCampaignsPerformance] = useState([]);
    const [placements, setPlacements] = useState([]);
    const [funnelSpendByDate, setFunnelSpendByDate] = useState([]);
    const [accountSummary, setAccountSummary] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMetrics, setSelectedMetrics] = useState(["ad_spend"]);

    const [adPerfRows, setAdPerfRows] = useState([]);
    const [adPerfLoading, setAdPerfLoading] = useState(true);
    const [adPerfError, setAdPerfError] = useState(null);

    useEffect(() => {
        if (selectedMetrics.length === 0) setSelectedMetrics(["ad_spend"]);
    }, [selectedMetrics]);

    useEffect(() => {
        if (rangeStartQ && rangeEndQ) {
            setTempRange({ startDate: rangeStartQ, endDate: rangeEndQ });
            setAppliedRange({ startDate: rangeStartQ, endDate: rangeEndQ });
        }
    }, [rangeStartQ, rangeEndQ, setTempRange, setAppliedRange]);

    const fetchMetaParams = useCallback(
        (settings, range) => {
            const { facebookAdAccountId, customerMetaID, customerMetaIDExclude } = settings;
            const adAccountId = facebookAdAccountId.startsWith("act_")
                ? facebookAdAccountId
                : `act_${facebookAdAccountId}`;
            const p = new URLSearchParams({
                adAccountId,
                since: range.startDate,
                until: range.endDate,
                dashboardCustomerId: String(customer._id),
            });
            if (customerMetaID) p.set("customerMetaID", customerMetaID);
            if (customerMetaIDExclude) p.set("customerMetaIDExclude", customerMetaIDExclude);
            return p;
        },
        [customer]
    );

    useEffect(() => {
        if (!customer) {
            setAdPerfLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setAdPerfLoading(true);
            setAdPerfError(null);
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
                const res = await fetch(`${baseUrl}/api/customers/${customer._id}`);
                if (!res.ok) throw new Error("Failed to fetch customer settings");
                const settings = (await res.json()).CustomerSettings || {};
                const { facebookAdAccountId } = settings;
                if (!facebookAdAccountId) {
                    if (!cancelled) {
                        setAdPerfRows([]);
                        setAdPerfError(
                            "Add a Facebook Ad Account ID in customer settings to load ad-level performance."
                        );
                        setAdPerfLoading(false);
                    }
                    return;
                }
                const p = fetchMetaParams(settings, appliedRange);
                const r = await fetch(`/api/facebook-ads-ad-performance?${p.toString()}`);
                const d = await r.json();
                if (!r.ok) throw new Error(d.error || "Failed to load ads performance");
                if (!cancelled) setAdPerfRows(Array.isArray(d.ads) ? d.ads : []);
            } catch (e) {
                if (!cancelled) setAdPerfError(e.message || "Failed to load ads performance");
            } finally {
                if (!cancelled) setAdPerfLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [customer, appliedRange, fetchMetaParams]);

    useEffect(() => {
        if (!customer) return;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
                const res = await fetch(`${baseUrl}/api/customers/${customer._id}`);
                if (!res.ok) throw new Error("Failed to fetch customer settings");
                const settings = (await res.json()).CustomerSettings || {};
                const { facebookAdAccountId } = settings;
                if (!facebookAdAccountId) throw new Error("Missing Facebook Ad Account ID");

                const compDates = formatComparisonPeriodDates({
                    comparisonMethod,
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                    compareStartDate: appliedCompareRange.startDate,
                    compareEndDate: appliedCompareRange.endDate,
                });

                const metaParams = fetchMetaParams(settings, appliedRange);
                const fetches = [fetch(`/api/facebook-campaign-insights?${metaParams.toString()}`)];
                if (!compDates.skip && compDates.startDate && compDates.endDate) {
                    const prevParams = fetchMetaParams(settings, {
                        startDate: compDates.startDate,
                        endDate: compDates.endDate,
                    });
                    fetches.push(fetch(`/api/facebook-campaign-insights?${prevParams.toString()}`));
                }

                const [fbRes, fbResPrev] = await Promise.all(fetches);
                if (!fbRes.ok) throw new Error("Failed to fetch Facebook PS dashboard metrics");
                const metrics = await fbRes.json();
                setFbMetricsByDate(metrics.metrics_by_date || []);
                setCampaignsPerformance(metrics.campaigns_performance || metrics.top_campaigns || []);
                setPlacements(metrics.placements || []);
                setFunnelSpendByDate(metrics.funnel_spend_by_date || []);
                setAccountSummary(metrics.account_summary || {});

                if (fbResPrev?.ok) {
                    const metricsPrev = await fbResPrev.json();
                    setFbMetricsByDatePrev(metricsPrev.metrics_by_date || []);
                } else {
                    setFbMetricsByDatePrev([]);
                }
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [customer, appliedRange, appliedCompareRange, comparisonMethod, fetchMetaParams]);

    const percentChange = (current, prev) => {
        if (prev === 0 || prev === null || prev === undefined) return null;
        return ((current - prev) / Math.abs(prev)) * 100;
    };
    const changeType = (val) => {
        if (val === null) return undefined;
        return val > 0 ? "up" : val < 0 ? "down" : undefined;
    };

    const displayOnlyValues = useMemo(() => {
        const reachSum = aggregatePeriodFromDaily(fbMetricsByDate, "reach");
        const freq = aggregatePeriodFromDaily(fbMetricsByDate, "frequency");
        const eng = aggregatePeriodFromDaily(fbMetricsByDate, "engagement_rate");
        return {
            new_customer_ratio: accountSummary.new_customer_ratio ?? null,
            recurring_customer_ratio: accountSummary.recurring_customer_ratio ?? null,
            reach: accountSummary.period_reach ?? reachSum,
            frequency: accountSummary.period_frequency ?? freq,
            engagement_rate: eng,
        };
    }, [fbMetricsByDate, accountSummary]);

    const buildMetricCard = (opt, chartToggle) => {
        let currentValue;
        let prevValue = null;
        if (DISPLAY_ONLY_METRICS.some((d) => d.key === opt.key)) {
            currentValue = displayOnlyValues[opt.key];
        } else {
            currentValue = aggregatePeriodFromDaily(fbMetricsByDate, opt.key);
            prevValue =
                fbMetricsByDatePrev.length > 0
                    ? aggregatePeriodFromDaily(fbMetricsByDatePrev, opt.key)
                    : null;
        }
        const change = percentChange(currentValue, prevValue);
        const isActive = chartToggle && selectedMetrics.includes(opt.key);
        const Icon = opt.icon;

        return (
            <div
                key={opt.key}
                className={chartToggle ? "apex-ps-kpi-card" : undefined}
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
            >
                <MetricCard
                    variant="cobalt"
                    label={opt.label}
                    value={formatKpiValue(opt.key, currentValue, opt)}
                    icon={Icon ? <Icon className="w-4 h-4 shrink-0" /> : null}
                    isActive={isActive}
                    change={change !== null ? Math.abs(change).toFixed(1) : undefined}
                    changeType={changeType(change)}
                    comparisonMethod={chartToggle ? comparisonMethod : undefined}
                />
            </div>
        );
    };

    const chartCategories = fbMetricsByDate.map((row) => row.date);
    const fbMetricsByDatePrevMap = Object.fromEntries(fbMetricsByDatePrev.map((row) => [row.date, row]));
    const sortedPrevDates = fbMetricsByDatePrev.map((row) => row.date).sort();

    const rawSeriesByMetric = useMemo(() => {
        const out = {};
        for (const key of selectedMetrics) {
            out[key] = {
                current: chartCategories.map((date) =>
                    getDailyMetricValue(fbMetricsByDate.find((r) => r.date === date), key)
                ),
                prev: chartCategories.map((date) => {
                    const prevDate = resolveDailyComparisonDate({
                        comparisonMethod,
                        currentDate: date,
                        appliedStartDate: appliedRange.startDate,
                        appliedEndDate: appliedRange.endDate,
                        sortedPrevKeys: sortedPrevDates,
                    });
                    return getDailyMetricValue(prevDate ? fbMetricsByDatePrevMap[prevDate] : null, key);
                }),
            };
        }
        return out;
    }, [
        selectedMetrics,
        chartCategories,
        fbMetricsByDate,
        fbMetricsByDatePrevMap,
        sortedPrevDates,
        comparisonMethod,
        appliedRange,
    ]);

    const chartSeries = useMemo(() => {
        const series = [];
        for (const key of selectedMetrics) {
            const label = CHART_METRIC_LABELS[key] || key;
            const raw = rawSeriesByMetric[key];
            if (!raw) continue;
            series.push({
                name: `${label} (Current)`,
                data: normalizeSeriesValues(raw.current),
                meta: { raw: raw.current, key },
            });
            if (comparisonMethod !== COMPARISON_METHOD.NONE) {
                series.push({
                    name: `${label} (${comparisonLabel})`,
                    data: normalizeSeriesValues(raw.prev),
                    meta: { raw: raw.prev, key },
                });
            }
        }
        return series;
    }, [selectedMetrics, rawSeriesByMetric, comparisonMethod, comparisonLabel]);

    const selectedMetricsCount = selectedMetrics.length;
    const compCount = comparisonMethod !== COMPARISON_METHOD.NONE ? selectedMetricsCount : 0;
    const strokeWidths = [...Array(selectedMetricsCount).fill(2), ...Array(compCount).fill(1)];
    const strokeDashArrays = [...Array(selectedMetricsCount).fill(0), ...Array(compCount).fill(5)];
    const fillOpacities = [...Array(selectedMetricsCount).fill(1), ...Array(compCount).fill(0.5)];

    const chartOptions = useMemo(
        () => ({
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "Outfit, sans-serif" },
            xaxis: { categories: chartCategories, labels: { rotate: -45 } },
            yaxis: {
                min: 0,
                max: 100,
                labels: { formatter: (v) => `${Math.round(v)}%` },
            },
            colors: [
                "#406969",
                "#1E2B2B",
                "#4F46E5",
                "#06B6D4",
                "#C6ED62",
                "#D6CDB6",
                "#F59E0B",
                "#EF4444",
                "#8B5CF6",
                "#EC4899",
                "#10B981",
            ],
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
                        if (raw == null) return "—";
                        if (key === "conv_rate" || key === "engagement_rate") {
                            return `${Number(raw).toFixed(2)}%`;
                        }
                        return formatKpiValue(key, raw);
                    },
                },
            },
            legend: { show: true, position: "top" },
        }),
        [chartCategories, strokeWidths, strokeDashArrays, fillOpacities, chartSeries]
    );

    const funnelChart = useMemo(() => {
        const dates = funnelSpendByDate.map((d) => d.date);
        return {
            options: {
                chart: {
                    stacked: true,
                    stackType: "normal",
                    toolbar: { show: false },
                    fontFamily: "Outfit, sans-serif",
                },
                plotOptions: { area: { stacking: "normal" } },
                xaxis: { categories: dates, labels: { rotate: -45 } },
                yaxis: {
                    labels: {
                        formatter: (v) =>
                            `${Number(v).toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr.`,
                    },
                },
                colors: ["#406969", "#C6ED62", "#94a3b8"],
                legend: { position: "top" },
                dataLabels: { enabled: false },
                stroke: { curve: "smooth", width: 1 },
                fill: { opacity: 0.85 },
            },
            series: [
                {
                    name: "Prospecting",
                    data: funnelSpendByDate.map((d) => Math.round(d.prospecting_spend || 0)),
                },
                {
                    name: "Retargeting",
                    data: funnelSpendByDate.map((d) => Math.round(d.retargeting_spend || 0)),
                },
                {
                    name: "Other",
                    data: funnelSpendByDate.map((d) => Math.round(d.other_spend || 0)),
                },
            ],
        };
    }, [funnelSpendByDate]);

    const { winners, losers } = useMemo(
        () => pickCreativeWinnersLosers(adPerfRows, { minSpend: 100, limit: 5 }),
        [adPerfRows]
    );

    const row1 = CHART_TOGGLE_METRICS.filter((m) => m.row === 1);
    const row2 = CHART_TOGGLE_METRICS.filter((m) => m.row === 2);
    const customerMixMetrics = DISPLAY_ONLY_METRICS.filter((m) =>
        ["new_customer_ratio", "recurring_customer_ratio"].includes(m.key)
    );
    const audienceMetrics = DISPLAY_ONLY_METRICS.filter((m) =>
        ["reach", "frequency", "engagement_rate"].includes(m.key)
    );

    return (
        <div id="PsDashboardPage" className="cobalt-perf w-full" data-theme="cobalt">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Paid Social Dashboard"
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                dateRange={appliedRange}
                comparisonMethod={comparisonMethod}
                loading={loading}
                dashboardType="ps-dashboard"
                dataSnapshot={{
                    fbMetricsByDate,
                    campaignsPerformance,
                    placements,
                    selectedMetrics,
                }}
                right={
                    <DateRangePicker {...dateRangePickerProps} variant="cobalt" loading={loading} />
                }
            />

            {loading ? (
                <div className="apex-perf-loading">
                    <CobaltLoader
                        variant="block"
                        title="Loading paid social metrics"
                        request="GET /api/facebook-campaign-insights"
                    />
                </div>
            ) : error ? (
                <div className="apex-ps-error">{error}</div>
            ) : (
                <div className="apex-ps-panel">
                    <section className="apex-ps-section">
                        <h3 className="apex-ps-section__label">Spend & results</h3>
                        <div className="apex-ps-kpi-grid apex-ps-kpi-grid--4">
                            {row1.map((opt) => buildMetricCard(opt, true))}
                        </div>
                    </section>

                    <section className="apex-ps-section">
                        <h3 className="apex-ps-section__label">Efficiency</h3>
                        <div className="apex-ps-kpi-grid apex-ps-kpi-grid--6">
                            {row2.map((opt) => buildMetricCard(opt, true))}
                        </div>
                    </section>

                    <section className="apex-ps-section">
                        <h3 className="apex-ps-section__label">Customer mix</h3>
                        <div className="apex-ps-kpi-grid apex-ps-kpi-grid--2">
                            {customerMixMetrics.map((opt) => buildMetricCard(opt, false))}
                        </div>
                    </section>

                    <section className="apex-ps-section">
                        <h3 className="apex-ps-section__label">Audience & engagement</h3>
                        <div className="apex-ps-kpi-grid apex-ps-kpi-grid--3">
                            {audienceMetrics.map((opt) => buildMetricCard(opt, false))}
                        </div>
                    </section>

                    <div className="apex-ps-chart-block">
                        <GraphCard
                            variant="cobalt"
                            title="Spend over time"
                            chartOptions={chartOptions}
                            chartSeries={chartSeries}
                            hideChartToggle
                        />
                        <p className="apex-ps-chart-note">
                            Values are normalized to 0–100% of each metric&apos;s maximum for comparable curves.
                            Hover for actual numbers. Click KPI cards above to show or hide metrics.
                        </p>
                    </div>

                    <section className="apex-ps-section">
                        <h3 className="apex-ps-section__label">Creatives</h3>
                        {adPerfError ? <div className="apex-ps-alert">{adPerfError}</div> : null}
                        {adPerfLoading ? (
                            <div className="apex-ps-inline-loading">
                                <CobaltLoader
                                    variant="block"
                                    title="Loading ad-level performance"
                                    request="GET /api/facebook-ads-ad-performance"
                                />
                            </div>
                        ) : (
                            <div className="apex-ps-tables-grid">
                                <PsSortableMetricsTable
                                    variant="cobalt"
                                    cobaltScope="ps"
                                    title="Creative winners"
                                    subtitle="Creatives with strong ROAS — candidates to scale budget or produce variants."
                                    columns={CREATIVE_TABLE_COLUMNS}
                                    rows={winners.map((r, i) => ({ ...r, id: r.ad_id || i }))}
                                    rowKeyField="id"
                                    highlightPositiveNegative
                                />
                                <PsSortableMetricsTable
                                    variant="cobalt"
                                    cobaltScope="ps"
                                    title="Creative losers"
                                    subtitle="Low ROAS creatives — consider pausing or refreshing creative."
                                    columns={CREATIVE_TABLE_COLUMNS}
                                    rows={losers.map((r, i) => ({ ...r, id: r.ad_id || `l-${i}` }))}
                                    rowKeyField="id"
                                    highlightPositiveNegative
                                />
                            </div>
                        )}
                    </section>

                    <PsSortableMetricsTable
                        variant="cobalt"
                        cobaltScope="ps"
                        title="Placement performance"
                        columns={PLACEMENT_TABLE_COLUMNS}
                        rows={placements.map((r, i) => ({
                            ...r,
                            id: r.placement || i,
                        }))}
                        rowKeyField="id"
                        highlightPositiveNegative
                    />

                    <PsSortableMetricsTable
                        variant="cobalt"
                        cobaltScope="ps"
                        title="Kampagne performance"
                        columns={CAMPAIGN_TABLE_COLUMNS}
                        rows={campaignsPerformance.map((r, i) => ({
                            ...r,
                            id: r.campaign_name || i,
                        }))}
                        rowKeyField="id"
                        highlightPositiveNegative
                    />

                    <div className="apex-ps-chart-block">
                        <GraphCard
                            variant="cobalt"
                            title="Prospecting vs Retargeting spend"
                            chartOptions={funnelChart.options}
                            chartSeries={funnelChart.series}
                            chartType="area"
                            hideChartToggle
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
