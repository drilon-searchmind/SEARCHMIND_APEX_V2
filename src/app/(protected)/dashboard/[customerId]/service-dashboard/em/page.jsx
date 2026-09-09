"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import GraphCard from "@/components/dashboard/GraphCard";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { useCustomers } from "@/hooks/useCustomers";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import {
    formatComparisonPeriodDates,
    resolveDailyComparisonDate,
    COMPARISON_METHOD,
} from "@/lib/dateRangeComparison";
import {
    aggregateEmPeriodFromDaily,
    getEmDailyMetricValue,
    normalizeSeriesValues,
    formatEmKpiValue,
    EM_CHART_METRIC_LABELS,
} from "@/lib/emDashboardUtils";
import PsSortableMetricsTable from "../ps/components/PsSortableMetricsTable";
import {
    KPI_ROW1,
    KPI_ROW2,
    DISPLAY_ONLY_METRICS,
    CAMPAIGN_TABLE_COLUMNS,
} from "./components/emDashboardConfig";
import "./em-dashboard.css";

function mergeMetricRows(a, b) {
    if (!a) return b ? { ...b } : null;
    if (!b) return { ...a };
    const recipients = (a.recipients || 0) + (b.recipients || 0);
    const opens = (a.opens || 0) + (b.opens || 0);
    const clicks = (a.clicks || 0) + (b.clicks || 0);
    return {
        ...a,
        recipients,
        opens,
        clicks,
        conversions: (a.conversions || 0) + (b.conversions || 0),
        conversion_value: (a.conversion_value || 0) + (b.conversion_value || 0),
        unsubscribes: (a.unsubscribes || 0) + (b.unsubscribes || 0),
        open_rate: recipients > 0 ? opens / recipients : null,
        click_rate: recipients > 0 ? clicks / recipients : null,
    };
}

export default function EmailDashboardPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const rangeStartQ = searchParams.get("startDate");
    const rangeEndQ = searchParams.get("endDate");
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);
    const customerId = params?.customerId;

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
                page: "service_dashboard_em",
                customerId,
                startDate,
                endDate,
                comparisonMethod: appliedComparison,
            });
        },
    });

    const [selectedMetrics, setSelectedMetrics] = useState(["revenue"]);
    const [campaignTotals, setCampaignTotals] = useState(null);
    const [campaignTotalsPrev, setCampaignTotalsPrev] = useState(null);
    const [flowDaily, setFlowDaily] = useState([]);
    const [flowDailyPrev, setFlowDailyPrev] = useState([]);
    const [topCampaigns, setTopCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [chartLoading, setChartLoading] = useState(false);
    const [prevLoading, setPrevLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (selectedMetrics.length === 0) setSelectedMetrics(["revenue"]);
    }, [selectedMetrics]);

    useEffect(() => {
        if (rangeStartQ && rangeEndQ) {
            setTempRange({ startDate: rangeStartQ, endDate: rangeEndQ });
            setAppliedRange({ startDate: rangeStartQ, endDate: rangeEndQ });
        }
    }, [rangeStartQ, rangeEndQ, setTempRange, setAppliedRange]);

    const hasKlaviyoCredentials =
        !!customer?.CustomerSettings?.klaviyoPrivateApiKey || isDemoCustomerId(customerId);

    useEffect(() => {
        if (!customer || !hasKlaviyoCredentials || !customerId) {
            setLoading(false);
            return;
        }
        const abortController = new AbortController();
        const signal = abortController.signal;

        const compDates = formatComparisonPeriodDates({
            comparisonMethod,
            startDate: appliedRange.startDate,
            endDate: appliedRange.endDate,
            compareStartDate: appliedCompareRange.startDate,
            compareEndDate: appliedCompareRange.endDate,
        });

        const isDemo = isDemoCustomerId(String(customerId));

        (async () => {
            setLoading(true);
            setChartLoading(!isDemo);
            setError(null);
            setCampaignTotalsPrev(null);
            setFlowDaily([]);
            setFlowDailyPrev([]);

            try {
                if (isDemo) {
                    const params = new URLSearchParams({
                        startDate: appliedRange.startDate,
                        endDate: appliedRange.endDate,
                    });
                    if (!compDates.skip && compDates.startDate && compDates.endDate) {
                        params.set("prevStartDate", compDates.startDate);
                        params.set("prevEndDate", compDates.endDate);
                    }
                    const res = await fetch(`/api/klaviyo-dashboard/${customerId}?${params}`, { signal });
                    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Klaviyo API error");
                    const data = await res.json();
                    setFlowDaily(data.metrics_by_date || []);
                    setFlowDailyPrev(data.metrics_by_date_prev || []);
                    setCampaignTotals((data.metrics_by_date || [])[0] || null);
                    setTopCampaigns(data.top_campaigns || []);
                    setLoading(false);
                    setChartLoading(false);
                    return;
                }

                const summaryParams = new URLSearchParams({
                    part: "summary",
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                });
                const summaryRes = await fetch(
                    `/api/klaviyo-dashboard/${customerId}?${summaryParams}`,
                    { signal }
                );
                if (!summaryRes.ok) {
                    throw new Error(
                        (await summaryRes.json().catch(() => ({}))).error || "Klaviyo API error"
                    );
                }
                const summary = await summaryRes.json();
                setCampaignTotals(summary.metrics_by_date?.[0] || null);
                setTopCampaigns(summary.top_campaigns || []);
                setLoading(false);

                await new Promise((r) => setTimeout(r, 65000));
                if (signal.aborted) return;

                setChartLoading(true);
                const dailyParams = new URLSearchParams({
                    part: "daily",
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                });
                const dailyRes = await fetch(
                    `/api/klaviyo-dashboard/${customerId}?${dailyParams}`,
                    { signal }
                );
                if (dailyRes.ok) {
                    const daily = await dailyRes.json();
                    setFlowDaily(daily.flow_daily || []);
                }
                setChartLoading(false);

                if (!compDates.skip && compDates.startDate && compDates.endDate) {
                    setPrevLoading(true);
                    try {
                        await new Promise((r) => setTimeout(r, 65000));
                        if (signal.aborted) return;

                        const prevSummaryParams = new URLSearchParams({
                            part: "summary",
                            startDate: compDates.startDate,
                            endDate: compDates.endDate,
                        });
                        const prevSummaryRes = await fetch(
                            `/api/klaviyo-dashboard/${customerId}?${prevSummaryParams}`,
                            { signal }
                        );
                        if (prevSummaryRes.ok) {
                            const prevSummary = await prevSummaryRes.json();
                            setCampaignTotalsPrev(prevSummary.metrics_by_date?.[0] || null);
                        }

                        await new Promise((r) => setTimeout(r, 65000));
                        if (signal.aborted) return;

                        const prevDailyParams = new URLSearchParams({
                            part: "daily",
                            startDate: compDates.startDate,
                            endDate: compDates.endDate,
                        });
                        const prevDailyRes = await fetch(
                            `/api/klaviyo-dashboard/${customerId}?${prevDailyParams}`,
                            { signal }
                        );
                        if (prevDailyRes.ok) {
                            const prevDaily = await prevDailyRes.json();
                            setFlowDailyPrev(prevDaily.flow_daily || []);
                        }
                    } catch {
                        /* optional */
                    } finally {
                        if (!signal.aborted) setPrevLoading(false);
                    }
                }
            } catch (err) {
                if (err.name === "AbortError") return;
                setError(err.message);
                setCampaignTotals(null);
                setFlowDaily([]);
                setTopCampaigns([]);
            } finally {
                if (!signal.aborted) {
                    setLoading(false);
                    setChartLoading(false);
                }
            }
        })();

        return () => abortController.abort();
    }, [customer, customerId, hasKlaviyoCredentials, appliedRange, appliedCompareRange, comparisonMethod]);

    const flowTotals = useMemo(() => {
        if (!flowDaily.length) return null;
        return flowDaily.reduce(
            (acc, row) => mergeMetricRows(acc, row),
            null
        );
    }, [flowDaily]);

    const kpiRows = useMemo(() => {
        const combined = mergeMetricRows(campaignTotals, flowTotals);
        return combined ? [combined] : [];
    }, [campaignTotals, flowTotals]);

    const kpiRowsPrev = useMemo(() => {
        const flowPrevTotals = flowDailyPrev.length
            ? flowDailyPrev.reduce((acc, row) => mergeMetricRows(acc, row), null)
            : null;
        const combined = mergeMetricRows(campaignTotalsPrev, flowPrevTotals);
        return combined ? [combined] : [];
    }, [campaignTotalsPrev, flowDailyPrev]);

    const chartDaily = flowDaily.length > 1 ? flowDaily : isDemoCustomerId(String(customerId)) ? flowDaily : [];

    const percentChange = (current, prev) => {
        if (prev === 0 || prev === null || prev === undefined) return null;
        return ((current - prev) / Math.abs(prev)) * 100;
    };
    const changeType = (val) => {
        if (val === null) return undefined;
        return val > 0 ? "up" : val < 0 ? "down" : undefined;
    };

    const displayOnlyValues = useMemo(
        () => ({
            rpe: aggregateEmPeriodFromDaily(kpiRows, "rpe"),
            conv_rate: aggregateEmPeriodFromDaily(kpiRows, "conv_rate"),
        }),
        [kpiRows]
    );

    const buildMetricCard = (opt, chartToggle = true) => {
        let current;
        let prev = null;
        if (DISPLAY_ONLY_METRICS.some((d) => d.key === opt.key)) {
            current = displayOnlyValues[opt.key];
        } else {
            current = aggregateEmPeriodFromDaily(kpiRows, opt.key);
            prev = kpiRowsPrev.length > 0 ? aggregateEmPeriodFromDaily(kpiRowsPrev, opt.key) : null;
        }
        const change = percentChange(current, prev);
        const isActive = chartToggle && selectedMetrics.includes(opt.key);
        const Icon = opt.icon;

        return (
            <div
                key={opt.key}
                className={chartToggle ? "apex-em-kpi-card" : undefined}
                onClick={
                    chartToggle
                        ? () =>
                              setSelectedMetrics((prevSel) => {
                                  if (prevSel.includes(opt.key)) {
                                      return prevSel.length > 1
                                          ? prevSel.filter((m) => m !== opt.key)
                                          : prevSel;
                                  }
                                  return [...prevSel, opt.key];
                              })
                        : undefined
                }
            >
                <MetricCard
                    variant="cobalt"
                    label={opt.label}
                    value={formatEmKpiValue(opt.key, current)}
                    icon={Icon ? <Icon className="w-4 h-4 shrink-0" /> : null}
                    isActive={isActive}
                    change={
                        prevLoading && comparisonMethod !== COMPARISON_METHOD.NONE
                            ? undefined
                            : change !== null
                              ? Math.abs(change).toFixed(1)
                              : undefined
                    }
                    changeType={changeType(change)}
                    comparisonMethod={chartToggle ? comparisonMethod : undefined}
                />
            </div>
        );
    };

    const chartCategories = chartDaily.map((row) => row.date);
    const hasDailyChart = chartCategories.length > 1;
    const flowDailyPrevMap = Object.fromEntries(flowDailyPrev.map((row) => [row.date, row]));
    const sortedPrevDates = flowDailyPrev.map((row) => row.date).sort();

    const chartSeries = useMemo(() => {
        if (!hasDailyChart) return [];
        const series = [];
        for (const key of selectedMetrics) {
            const label = EM_CHART_METRIC_LABELS[key] || key;
            const current = chartCategories.map((date) =>
                getEmDailyMetricValue(chartDaily.find((r) => r.date === date), key)
            );
            series.push({
                name: `${label} (Current)`,
                data: normalizeSeriesValues(current),
                meta: { raw: current, key },
            });
            if (comparisonMethod !== COMPARISON_METHOD.NONE && flowDailyPrev.length > 0) {
                const prev = chartCategories.map((date) => {
                    const prevDate = resolveDailyComparisonDate({
                        comparisonMethod,
                        currentDate: date,
                        appliedStartDate: appliedRange.startDate,
                        appliedEndDate: appliedRange.endDate,
                        sortedPrevKeys: sortedPrevDates,
                    });
                    return getEmDailyMetricValue(
                        prevDate ? flowDailyPrevMap[prevDate] : null,
                        key
                    );
                });
                series.push({
                    name: `${label} (${comparisonLabel})`,
                    data: normalizeSeriesValues(prev),
                    meta: { raw: prev, key },
                });
            }
        }
        return series;
    }, [
        selectedMetrics,
        chartCategories,
        chartDaily,
        flowDailyPrevMap,
        sortedPrevDates,
        comparisonMethod,
        comparisonLabel,
        flowDailyPrev,
        appliedRange,
        hasDailyChart,
    ]);

    const chartOptions = useMemo(() => {
        const selectedMetricsCount = selectedMetrics.length;
        const compCount =
            comparisonMethod !== COMPARISON_METHOD.NONE && flowDailyPrev.length > 0
                ? selectedMetricsCount
                : 0;
        return {
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "Outfit, sans-serif" },
            xaxis: { categories: chartCategories, labels: { rotate: -45 } },
            yaxis: {
                min: 0,
                max: 100,
                labels: { formatter: (v) => `${Math.round(v)}%` },
            },
            colors: ["#406969", "#1E2B2B", "#4F46E5", "#06B6D4", "#C6ED62"],
            stroke: {
                width: [...Array(selectedMetricsCount).fill(2), ...Array(compCount).fill(1)],
                curve: "smooth",
                dashArray: [...Array(selectedMetricsCount).fill(0), ...Array(compCount).fill(5)],
            },
            fill: {
                type: "solid",
                opacity: [...Array(selectedMetricsCount).fill(1), ...Array(compCount).fill(0.5)],
            },
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
                        if (key === "open_rate" || key === "click_rate" || key === "conv_rate") {
                            return `${Number(raw).toFixed(2)}%`;
                        }
                        return formatEmKpiValue(key, raw);
                    },
                },
            },
            legend: { show: true, position: "top" },
        };
    }, [chartCategories, chartSeries, selectedMetrics, comparisonMethod, flowDailyPrev]);

    const campaignBarChart = useMemo(() => {
        const rows = topCampaigns.slice(0, 8);
        if (!rows.length) return null;
        return {
            options: {
                chart: { toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
                plotOptions: { bar: { horizontal: true, borderRadius: 2 } },
                xaxis: {
                    categories: rows.map((r) => r.campaign_name),
                    labels: {
                        formatter: (v) =>
                            `${Number(v).toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr.`,
                    },
                },
                colors: ["#406969"],
                dataLabels: { enabled: false },
                grid: { borderColor: "#e5e7eb" },
            },
            series: [
                {
                    name: "Revenue",
                    data: rows.map((r) => Math.round(r.conversion_value || 0)),
                },
            ],
        };
    }, [topCampaigns]);

    const campaignRows = useMemo(
        () =>
            topCampaigns.map((r, i) => ({
                ...r,
                id: r.campaign_id || r.campaign_name || i,
            })),
        [topCampaigns]
    );

    if (!customerId) return null;

    return (
        <div id="EmDashboardPage" className="apex-perf w-full">
            {!hasKlaviyoCredentials && (
                <div className="apex-em-alert">
                    Configure your Klaviyo Private API Key in{" "}
                    <a href={`/dashboard/${customerId}/config`}>Property Settings → Email (Klaviyo)</a>{" "}
                    to enable email metrics.
                </div>
            )}

            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Email Dashboard"
                label={customer ? customer.customerName : ""}
                customerId={customerId}
                dateRange={appliedRange}
                comparisonMethod={comparisonMethod}
                loading={loading}
                dashboardType="em-dashboard"
                dataSnapshot={{ kpiRows, topCampaigns, flowDaily, selectedMetrics }}
                right={
                    <DateRangePicker {...dateRangePickerProps} variant="cobalt" loading={loading} />
                }
            />

            {error ? <div className="apex-em-error">{error}</div> : null}

            {!hasKlaviyoCredentials ? null : loading ? (
                <div className="apex-perf-loading">
                    <CobaltLoader
                        variant="block"
                        title="Loading email metrics"
                        request="GET /api/klaviyo-dashboard?part=summary"
                    />
                </div>
            ) : (
                <div className="apex-em-panel">
                    <section className="apex-em-section">
                        <h3 className="apex-em-section__label">Revenue & delivery</h3>
                        <div className="apex-em-kpi-grid apex-em-kpi-grid--4">
                            {KPI_ROW1.map((opt) => buildMetricCard(opt))}
                        </div>
                    </section>

                    <section className="apex-em-section">
                        <h3 className="apex-em-section__label">Engagement & list health</h3>
                        <div className="apex-em-kpi-grid apex-em-kpi-grid--4">
                            {KPI_ROW2.map((opt) => buildMetricCard(opt))}
                        </div>
                    </section>

                    <section className="apex-em-section">
                        <h3 className="apex-em-section__label">Efficiency</h3>
                        <div className="apex-em-kpi-grid apex-em-kpi-grid--2">
                            {DISPLAY_ONLY_METRICS.map((opt) => buildMetricCard(opt, false))}
                        </div>
                    </section>

                    <section className="apex-em-section apex-em-chart-section">
                        {chartLoading ? (
                            <div className="apex-em-table-panel">
                                <div className="apex-em-table-panel__head">
                                    <h3 className="apex-em-table-panel__title">
                                        Automation flows — daily trend
                                    </h3>
                                    <p className="apex-em-table-panel__subtitle">
                                        Loading daily series from Klaviyo…
                                    </p>
                                </div>
                                <CobaltLoader variant="inline" title="Loading chart" request="flow-series-reports" />
                            </div>
                        ) : hasDailyChart ? (
                            <GraphCard
                                variant="cobalt"
                                title="Automation flows — daily trend"
                                chartOptions={chartOptions}
                                chartSeries={chartSeries}
                                chartType="line"
                                height={320}
                            />
                        ) : campaignBarChart ? (
                            <GraphCard
                                variant="cobalt"
                                title="Campaign revenue (period total)"
                                chartOptions={campaignBarChart.options}
                                chartSeries={campaignBarChart.series}
                                chartType="bar"
                                height={280}
                                hideChartToggle
                            />
                        ) : null}
                    </section>

                    <PsSortableMetricsTable
                        variant="cobalt"
                        cobaltScope="em"
                        title="Top email campaigns"
                        subtitle="Campaign sends in the selected period — sorted by emails sent."
                        columns={CAMPAIGN_TABLE_COLUMNS}
                        rows={campaignRows}
                        rowKeyField="id"
                    />
                </div>
            )}
        </div>
    );
}
