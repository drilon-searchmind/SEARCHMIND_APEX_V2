"use client";

import React, { useEffect, useState, useMemo } from "react";
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
import PsSortableMetricsTable from "../ps/components/PsSortableMetricsTable";
import {
    CHART_TOGGLE_ROW1,
    CHART_TOGGLE_ROW2,
    CHART_TOGGLE_ROW3,
    METRIC_OPTIONS,
    CAMPAIGN_TABLE_COLUMNS,
} from "./components/pinterestDashboardConfig";
import "./pinterest-dashboard.css";

function aggregateMetric(key, data) {
    if (!data?.length) return null;
    if (key === "conversions") {
        return data.reduce((sum, row) => sum + (row.conversions || 0), 0);
    }
    if (key === "ctr") {
        const totalClicks = data.reduce((sum, row) => sum + (row.clicks || 0), 0);
        const totalImpressions = data.reduce((sum, row) => sum + (row.impressions || 0), 0);
        return totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;
    }
    return data.reduce((sum, row) => sum + (row[key] || 0), 0);
}

function formatKpiValue(key, value, opt = {}) {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    if (opt.isPercent || key === "ctr") {
        return `${Number(value).toLocaleString("da-DK", { maximumFractionDigits: 2 })}%`;
    }
    if (key === "ad_spend" || key === "cpc" || key === "cpm" || opt.isCurrency) {
        return Number(value).toLocaleString("da-DK", {
            style: "currency",
            currency: "DKK",
            maximumFractionDigits: opt.decimals ?? (key === "ad_spend" ? 0 : 2),
            minimumFractionDigits: opt.decimals ?? (key === "ad_spend" ? 0 : 2),
        });
    }
    return Number(value).toLocaleString("da-DK", { maximumFractionDigits: 0 });
}

function getDailyValue(row, key) {
    if (!row) return null;
    if (key === "ctr" && row.impressions > 0) {
        return ((row.clicks || 0) / row.impressions) * 100;
    }
    const val = row[key];
    if (typeof val !== "number" || Number.isNaN(val)) return val ?? null;
    return key === "ctr" ? Number(val.toFixed(2)) : Math.round(val);
}

export default function PinterestServiceDashboardPage() {
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
                page: "service_dashboard_pinterest",
                customerId: params.customerId,
                startDate,
                endDate,
                comparisonMethod: appliedComparison,
            });
        },
    });

    const [metricsByDate, setMetricsByDate] = useState([]);
    const [metricsByDatePrev, setMetricsByDatePrev] = useState([]);
    const [topCampaigns, setTopCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMetrics, setSelectedMetrics] = useState(["ad_spend"]);

    useEffect(() => {
        if (selectedMetrics.length === 0) setSelectedMetrics(["ad_spend"]);
    }, [selectedMetrics]);

    useEffect(() => {
        if (rangeStartQ && rangeEndQ) {
            setTempRange({ startDate: rangeStartQ, endDate: rangeEndQ });
            setAppliedRange({ startDate: rangeStartQ, endDate: rangeEndQ });
        }
    }, [rangeStartQ, rangeEndQ, setTempRange, setAppliedRange]);

    useEffect(() => {
        if (!customer) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
                const res = await fetch(`${baseUrl}/api/customers/${customer._id}`);
                if (!res.ok) throw new Error("Failed to fetch customer settings");
                const settings = (await res.json()).CustomerSettings || {};
                const { pinterestAdAccountId } = settings;
                if (!pinterestAdAccountId?.trim()) {
                    throw new Error("Missing Pinterest ad account ID");
                }

                const compDates = formatComparisonPeriodDates({
                    comparisonMethod,
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                    compareStartDate: appliedCompareRange.startDate,
                    compareEndDate: appliedCompareRange.endDate,
                });

                const q = (s, e) =>
                    `adAccountId=${encodeURIComponent(pinterestAdAccountId.trim())}&startDate=${encodeURIComponent(s)}&endDate=${encodeURIComponent(e)}&dashboardCustomerId=${encodeURIComponent(String(customer._id))}`;

                const fetches = [fetch(`/api/pinterest-dashboard?${q(appliedRange.startDate, appliedRange.endDate)}`)];
                if (!compDates.skip && compDates.startDate && compDates.endDate) {
                    fetches.push(fetch(`/api/pinterest-dashboard?${q(compDates.startDate, compDates.endDate)}`));
                }
                const [curRes, prevRes] = await Promise.all(fetches);

                if (!curRes.ok) {
                    const errJson = await curRes.json().catch(() => ({}));
                    throw new Error(errJson.error || "Failed to fetch Pinterest dashboard metrics");
                }
                const metrics = await curRes.json();
                setMetricsByDate(metrics.metrics_by_date || []);
                setTopCampaigns(metrics.top_campaigns || []);

                if (prevRes.ok) {
                    const metricsPrev = await prevRes.json();
                    setMetricsByDatePrev(metricsPrev.metrics_by_date || []);
                } else {
                    setMetricsByDatePrev([]);
                }
            } catch (err) {
                setError(err.message);
                setMetricsByDate([]);
                setMetricsByDatePrev([]);
                setTopCampaigns([]);
            } finally {
                setLoading(false);
            }
        })();
    }, [customer, appliedRange, appliedCompareRange, comparisonMethod]);

    const percentChange = (current, prev) => {
        if (prev === 0 || prev === null || prev === undefined) return null;
        return ((current - prev) / Math.abs(prev)) * 100;
    };
    const changeType = (val) => {
        if (val === null) return undefined;
        return val > 0 ? "up" : val < 0 ? "down" : undefined;
    };

    const buildMetricCard = (opt) => {
        const currentValue = aggregateMetric(opt.key, metricsByDate);
        const prevValue =
            metricsByDatePrev.length > 0 ? aggregateMetric(opt.key, metricsByDatePrev) : null;
        const change = percentChange(currentValue, prevValue);
        const isActive = selectedMetrics.includes(opt.key);
        const Icon = opt.icon;

        return (
            <div
                key={opt.key}
                className="apex-pin-kpi-card"
                onClick={() =>
                    setSelectedMetrics((prev) => {
                        if (prev.includes(opt.key)) {
                            return prev.length > 1 ? prev.filter((m) => m !== opt.key) : prev;
                        }
                        return [...prev, opt.key];
                    })
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
                    comparisonMethod={comparisonMethod}
                />
            </div>
        );
    };

    const chartCategories = metricsByDate.map((row) => row.date);
    const metricsByDatePrevMap = Object.fromEntries(metricsByDatePrev.map((row) => [row.date, row]));
    const sortedPrevDates = metricsByDatePrev.map((row) => row.date).sort();

    const { chartOptions, chartSeries } = useMemo(() => {
        const series = [];

        for (const metricKey of selectedMetrics) {
            const metricOption = METRIC_OPTIONS.find((opt) => opt.key === metricKey);
            series.push({
                name: `${metricOption?.label || "Metric"} (Current)`,
                data: chartCategories.map((date) =>
                    getDailyValue(
                        metricsByDate.find((r) => r.date === date),
                        metricKey
                    )
                ),
                meta: {
                    key: metricKey,
                    opt: metricOption,
                    raw: chartCategories.map((date) =>
                        getDailyValue(
                            metricsByDate.find((r) => r.date === date),
                            metricKey
                        )
                    ),
                },
            });
        }

        if (comparisonMethod !== COMPARISON_METHOD.NONE) {
            for (const metricKey of selectedMetrics) {
                const metricOption = METRIC_OPTIONS.find((opt) => opt.key === metricKey);
                const prevRaw = chartCategories.map((date) => {
                    const prevDate = resolveDailyComparisonDate({
                        comparisonMethod,
                        currentDate: date,
                        appliedStartDate: appliedRange.startDate,
                        appliedEndDate: appliedRange.endDate,
                        sortedPrevKeys: sortedPrevDates,
                    });
                    return getDailyValue(prevDate ? metricsByDatePrevMap[prevDate] : null, metricKey);
                });
                series.push({
                    name: `${metricOption?.label || "Metric"} (${comparisonLabel})`,
                    data: prevRaw,
                    meta: { key: metricKey, opt: metricOption, raw: prevRaw },
                });
            }
        }

        const selectedCount = selectedMetrics.length;
        const compCount = comparisonMethod !== COMPARISON_METHOD.NONE ? selectedCount : 0;
        const strokeWidths = [...Array(selectedCount).fill(2), ...Array(compCount).fill(1)];
        const strokeDashArrays = [...Array(selectedCount).fill(0), ...Array(compCount).fill(5)];
        const fillOpacities = [...Array(selectedCount).fill(1), ...Array(compCount).fill(0.5)];

        return {
            chartSeries: series,
            chartOptions: {
                chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "Outfit, sans-serif" },
                xaxis: { categories: chartCategories, labels: { rotate: -45 } },
                yaxis: {},
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
                            const s = series[opts?.seriesIndex];
                            const raw = s?.meta?.raw?.[opts?.dataPointIndex];
                            const key = s?.meta?.key;
                            const metricOpt = s?.meta?.opt;
                            if (raw == null) return "—";
                            return formatKpiValue(key, raw, metricOpt || {});
                        },
                    },
                },
                legend: { show: true, position: "top" },
            },
        };
    }, [
        metricsByDate,
        metricsByDatePrevMap,
        chartCategories,
        sortedPrevDates,
        selectedMetrics,
        comparisonMethod,
        comparisonLabel,
        appliedRange,
    ]);

    const chartTitle =
        selectedMetrics.length === 1
            ? `${METRIC_OPTIONS.find((opt) => opt.key === selectedMetrics[0])?.label ?? "Metric"} over time`
            : "Pinterest metrics over time";

    const campaignRows = useMemo(
        () =>
            topCampaigns.map((r, i) => ({
                ...r,
                id: r.campaign_name || i,
                ctr: r.ctr != null && r.ctr <= 1 ? r.ctr : r.ctr != null ? r.ctr / 100 : null,
            })),
        [topCampaigns]
    );

    return (
        <div id="PinterestDashboardPage" className="apex-perf w-full">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
                title="Pinterest Ads Dashboard"
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                dateRange={appliedRange}
                comparisonMethod={comparisonMethod}
                loading={loading}
                dashboardType="pinterest-dashboard"
                dataSnapshot={{
                    metricsByDate,
                    metricsByDatePrev,
                    topCampaigns,
                    selectedMetrics,
                    METRIC_OPTIONS,
                }}
                right={
                    <DateRangePicker {...dateRangePickerProps} variant="cobalt" loading={loading} />
                }
            />

            {loading ? (
                <div className="apex-perf-loading">
                    <CobaltLoader
                        variant="block"
                        title="Loading Pinterest metrics"
                        request="GET /api/pinterest-dashboard"
                    />
                </div>
            ) : error ? (
                <div className="apex-pin-error">{error}</div>
            ) : (
                <div className="apex-pin-panel">
                    <section className="apex-pin-section">
                        <h3 className="apex-pin-section__label">Spend & results</h3>
                        <div className="apex-pin-kpi-grid apex-pin-kpi-grid--3">
                            {CHART_TOGGLE_ROW1.map((opt) => buildMetricCard(opt))}
                        </div>
                    </section>

                    <section className="apex-pin-section">
                        <h3 className="apex-pin-section__label">Reach & engagement</h3>
                        <div className="apex-pin-kpi-grid apex-pin-kpi-grid--2">
                            {CHART_TOGGLE_ROW2.map((opt) => buildMetricCard(opt))}
                        </div>
                    </section>

                    <section className="apex-pin-section">
                        <h3 className="apex-pin-section__label">Efficiency</h3>
                        <div className="apex-pin-kpi-grid apex-pin-kpi-grid--3">
                            {CHART_TOGGLE_ROW3.map((opt) => buildMetricCard(opt))}
                        </div>
                    </section>

                    <div className="apex-pin-chart-block">
                        <GraphCard
                            variant="cobalt"
                            title={chartTitle}
                            chartOptions={chartOptions}
                            chartSeries={chartSeries}
                            hideChartToggle
                        />
                        <p className="apex-pin-chart-note">
                            Click KPI cards above to show or hide metrics on the chart. Comparison period shown as dashed lines when enabled.
                        </p>
                    </div>

                    <PsSortableMetricsTable
                        variant="cobalt"
                        cobaltScope="pin"
                        title="Top performance campaigns"
                        subtitle="Sorted by outbound clicks — heatmap highlights relative volume within the table."
                        columns={CAMPAIGN_TABLE_COLUMNS}
                        rows={campaignRows}
                        rowKeyField="id"
                    />
                </div>
            )}
        </div>
    );
}
