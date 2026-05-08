"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import GraphCard from "@/components/dashboard/GraphCard";
import Spinner from "@/components/ui/Spinner";
import {
    FiTrendingUp,
    FiShoppingCart,
    FiEye,
    FiMousePointer,
    FiPercent,
    FiArrowDownRight,
    FiArrowUpRight,
    FiDollarSign,
} from "react-icons/fi";
import { useCustomers } from "@/hooks/useCustomers";
import dayjs from "dayjs";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";

const METRIC_OPTIONS = [
    { key: "ad_spend", label: "Ad spend", icon: FiTrendingUp },
    { key: "conversions", label: "Conversions", icon: FiShoppingCart },
    { key: "impressions", label: "Impressions", icon: FiEye },
    { key: "clicks", label: "Clicks", icon: FiMousePointer },
    { key: "conversion_value", label: "Conversion value", icon: FiDollarSign },
    { key: "ctr", label: "CTR", icon: FiPercent },
    { key: "cpc", label: "CPC", icon: FiArrowDownRight },
    { key: "cpm", label: "CPM", icon: FiArrowUpRight },
];

export default function BingAdsServiceDashboardPage() {
    const params = useParams();
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const isFirstOfMonth = today.getDate() === 1;
    const defaultStart = `${yyyy}-${mm}-01`;
    const defaultEnd = isFirstOfMonth
        ? `${yyyy}-${mm}-01`
        : `${yyyy}-${mm}-${String(today.getDate() - 1).padStart(2, "0")}`;
    const defaultRangeValue = { startDate: defaultStart, endDate: defaultEnd };
    const [tempRange, setTempRange] = useState(defaultRangeValue);
    const [appliedRange, setAppliedRange] = useState(defaultRangeValue);

    const handleDateRangeApply = ({ startDate, endDate }) => {
        pushDashboardDateRangeApplied({
            page: "service_dashboard_bing",
            customerId: params.customerId,
            startDate,
            endDate,
        });
        setAppliedRange({ startDate, endDate });
    };
    const handleStartDateChange = (newStart) => {
        setTempRange((dr) => ({ ...dr, startDate: newStart }));
    };
    const handleEndDateChange = (newEnd) => {
        setTempRange((dr) => ({ ...dr, endDate: newEnd }));
    };

    const [comparisonMethod, setComparisonMethod] = useState("Last Year");

    const [metricsByDate, setMetricsByDate] = useState([]);
    const [metricsByDatePrev, setMetricsByDatePrev] = useState([]);
    const [topCampaigns, setTopCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [selectedMetrics, setSelectedMetrics] = useState(["ad_spend"]);

    useEffect(() => {
        if (selectedMetrics.length === 0) {
            setSelectedMetrics(["ad_spend"]);
        }
    }, [selectedMetrics]);

    /** When the API has no rows for the range, still show one point per day at 0 (server also fills; this covers edge cases). */
    const displayMetricsByDate = useMemo(() => {
        if (metricsByDate.length > 0) return metricsByDate;
        if (loading || error) return [];
        const start = dayjs(appliedRange.startDate);
        const end = dayjs(appliedRange.endDate);
        if (!start.isValid() || !end.isValid() || end.isBefore(start)) return [];
        const rows = [];
        for (let d = start; d.isBefore(end) || d.isSame(end, "day"); d = d.add(1, "day")) {
            rows.push({
                date: d.format("YYYY-MM-DD"),
                ad_spend: 0,
                impressions: 0,
                clicks: 0,
                conversions: 0,
                conversion_value: 0,
                ctr: 0,
                cpc: 0,
                cpm: 0,
            });
        }
        return rows;
    }, [metricsByDate, loading, error, appliedRange.startDate, appliedRange.endDate]);

    useEffect(() => {
        if (!customer) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const start = dayjs(appliedRange.startDate);
                const end = dayjs(appliedRange.endDate);
                const days = end.diff(start, "day") + 1;
                let prevStart;
                let prevEnd;
                if (comparisonMethod === "Last Year") {
                    prevStart = start.subtract(1, "year");
                    prevEnd = end.subtract(1, "year");
                } else {
                    prevEnd = start.subtract(1, "day");
                    prevStart = prevEnd.subtract(days - 1, "day");
                }

                const prevStartStr = prevStart.format("YYYY-MM-DD");
                const prevEndStr = prevEnd.format("YYYY-MM-DD");

                const q = (s, e) =>
                    `startDate=${encodeURIComponent(s)}&endDate=${encodeURIComponent(e)}&dashboardCustomerId=${encodeURIComponent(String(customer._id))}`;

                const [curRes, prevRes] = await Promise.all([
                    fetch(`/api/bing-dashboard?${q(appliedRange.startDate, appliedRange.endDate)}`),
                    fetch(`/api/bing-dashboard?${q(prevStartStr, prevEndStr)}`),
                ]);

                if (!curRes.ok) {
                    const errJson = await curRes.json().catch(() => ({}));
                    throw new Error(errJson.error || "Failed to fetch Bing Ads dashboard metrics");
                }
                const metrics = await curRes.json();
                const byDate = metrics.metrics_by_date || [];
                const campaigns = metrics.top_campaigns || [];
                setMetricsByDate(byDate);
                setTopCampaigns(campaigns);

                if (prevRes.ok) {
                    const metricsPrev = await prevRes.json();
                    setMetricsByDatePrev(metricsPrev.metrics_by_date || []);
                } else {
                    setMetricsByDatePrev([]);
                    const errPrev = await prevRes.json().catch(() => ({}));
                    if (process.env.NODE_ENV === "development") {
                        console.debug("[Bing dashboard] comparison period fetch failed", prevRes.status, errPrev);
                    }
                }

                if (process.env.NODE_ENV === "development") {
                    const spend = byDate.reduce((s, r) => s + (Number(r.ad_spend) || 0), 0);
                    console.debug("[Bing dashboard]", {
                        range: `${appliedRange.startDate}–${appliedRange.endDate}`,
                        days: byDate.length,
                        totalAdSpend: spend,
                        topCampaigns: campaigns.length,
                        sampleDay: byDate[0],
                        comparison: comparisonMethod,
                        prevOk: prevRes.ok,
                    });
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
    }, [customer, appliedRange.startDate, appliedRange.endDate, comparisonMethod]);

    const percentChange = (current, prev) => {
        if (prev === 0 || prev === null || prev === undefined) return null;
        return ((current - prev) / Math.abs(prev)) * 100;
    };
    const changeType = (val) => {
        if (val === null) return undefined;
        return val > 0 ? "up" : val < 0 ? "down" : undefined;
    };

    const metrics = useMemo(() => {
        if (!displayMetricsByDate.length) return [];

        const agg = (key, data) => {
            if (key === "conversions") {
                return data.reduce((sum, row) => sum + (row.conversions || 0), 0);
            }
            if (key === "conversion_value") {
                return data.reduce((sum, row) => sum + (Number(row.conversion_value) || 0), 0);
            }
            if (key === "ctr") {
                const totalClicks = data.reduce((sum, row) => sum + (row.clicks || 0), 0);
                const totalImpressions = data.reduce((sum, row) => sum + (row.impressions || 0), 0);
                return totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;
            }
            return data.reduce((sum, row) => sum + (row[key] || 0), 0);
        };

        return METRIC_OPTIONS.map((opt) => {
            const currentValue = agg(opt.key, displayMetricsByDate);
            const prevValue = metricsByDatePrev.length > 0 ? agg(opt.key, metricsByDatePrev) : null;
            const change = percentChange(currentValue, prevValue);

            return {
                label: opt.label,
                value: currentValue,
                change: change !== null ? Math.abs(change).toFixed(1) : undefined,
                changeType: changeType(change),
            };
        });
    }, [displayMetricsByDate, metricsByDatePrev]);

    const { chartOptions, chartSeries } = useMemo(() => {
        const chartCategories = displayMetricsByDate.map((row) => row.date);
        const metricsByDatePrevMap = Object.fromEntries(metricsByDatePrev.map((row) => [row.date, row]));
        const series = [];

        selectedMetrics.forEach((metricKey) => {
            const metricOption = METRIC_OPTIONS.find((opt) => opt.key === metricKey);
            series.push({
                name: `${metricOption?.label || "Metric"} (Current)`,
                data: chartCategories.map((date) => {
                    const row = displayMetricsByDate.find((r) => r.date === date);
                    if (!row) return null;
                    let val = row[metricKey];
                    if (metricKey === "ctr" && row.impressions > 0) {
                        val = ((row.clicks || 0) / row.impressions) * 100;
                    }
                    if (typeof val === "number" && !isNaN(val)) {
                        return metricKey === "ctr" ? Number(val.toFixed(2)) : Math.round(val);
                    }
                    return val ?? null;
                }),
            });
        });

        selectedMetrics.forEach((metricKey) => {
            const metricOption = METRIC_OPTIONS.find((opt) => opt.key === metricKey);
            series.push({
                name: `${metricOption?.label || "Metric"} (${comparisonMethod})`,
                data: chartCategories.map((date) => {
                    let prevDate;
                    if (comparisonMethod === "Last Year") {
                        const currentDate = dayjs(date);
                        prevDate = currentDate.subtract(1, "year").format("YYYY-MM-DD");
                    } else {
                        const currentDate = dayjs(date);
                        const periodStart = dayjs(appliedRange.startDate);
                        const periodEnd = dayjs(appliedRange.endDate);
                        const daysDiff = currentDate.diff(periodStart, "day");
                        const prevPeriodStart = periodStart.subtract(periodEnd.diff(periodStart, "day") + 1, "day");
                        prevDate = prevPeriodStart.add(daysDiff, "day").format("YYYY-MM-DD");
                    }

                    const row = metricsByDatePrevMap[prevDate];
                    if (!row) return null;
                    let val = row[metricKey];
                    if (metricKey === "ctr" && row.impressions > 0) {
                        val = ((row.clicks || 0) / row.impressions) * 100;
                    }
                    if (typeof val === "number" && !isNaN(val)) {
                        return metricKey === "ctr" ? Number(val.toFixed(2)) : Math.round(val);
                    }
                    return val ?? null;
                }),
            });
        });

        const selectedMetricsCount = selectedMetrics.length;
        const strokeWidths = [...Array(selectedMetricsCount).fill(2), ...Array(selectedMetricsCount).fill(1)];
        const strokeDashArrays = [...Array(selectedMetricsCount).fill(0), ...Array(selectedMetricsCount).fill(5)];
        const fillOpacities = [...Array(selectedMetricsCount).fill(1), ...Array(selectedMetricsCount).fill(0.5)];

        return {
            chartSeries: series,
            chartOptions: {
                chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: "Outfit, sans-serif" },
                xaxis: { categories: chartCategories },
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
                stroke: {
                    width: strokeWidths,
                    curve: "smooth",
                    dashArray: strokeDashArrays,
                },
                fill: {
                    type: "solid",
                    opacity: fillOpacities,
                },
                grid: {
                    borderColor: "#e5e7eb",
                    strokeDashArray: 0,
                    xaxis: { lines: { show: false } },
                    yaxis: { lines: { show: true } },
                },
                dataLabels: { enabled: false },
                tooltip: { theme: "light" },
                legend: { show: true, position: "top" },
            },
        };
    }, [
        displayMetricsByDate,
        metricsByDatePrev,
        selectedMetrics,
        comparisonMethod,
        appliedRange.startDate,
        appliedRange.endDate,
    ]);

    return (
        <div className="w-full">
            <DashboardHeading
                title="Bing Ads Dashboard"
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                dateRange={appliedRange}
                comparisonMethod={comparisonMethod}
                loading={loading}
                dashboardType="bing-dashboard"
                dataSnapshot={{
                    metricsByDate: displayMetricsByDate,
                    metricsByDatePrev,
                    topCampaigns,
                    selectedMetrics,
                    METRIC_OPTIONS,
                }}
                right={
                    <DateRangePicker
                        onApply={handleDateRangeApply}
                        startDate={tempRange.startDate}
                        endDate={tempRange.endDate}
                        onStartDateChange={handleStartDateChange}
                        onEndDateChange={handleEndDateChange}
                        loading={loading}
                        showComparisonMethodToggler={true}
                        comparisonMethod={comparisonMethod}
                        onComparisonMethodChange={setComparisonMethod}
                    />
                }
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 w-full mb-8">
                {loading ? (
                    <div className="col-span-5 text-center">
                        <Spinner size={40} color="#406969" />
                    </div>
                ) : error ? (
                    <div className="col-span-5 text-center text-red-500">{error}</div>
                ) : (
                    metrics.map((metric, idx) => {
                        const Icon = METRIC_OPTIONS.find((opt) => opt.label === metric.label)?.icon;
                        const isActive = selectedMetrics.includes(METRIC_OPTIONS[idx].key);
                        return (
                            <div
                                key={idx}
                                onClick={() =>
                                    setSelectedMetrics((prev) => {
                                        const metricKey = METRIC_OPTIONS[idx].key;
                                        if (prev.includes(metricKey)) {
                                            return prev.length > 1 ? prev.filter((m) => m !== metricKey) : prev;
                                        }
                                        return [...prev, metricKey];
                                    })
                                }
                                style={{ cursor: "pointer" }}
                            >
                                <MetricCard
                                    label={metric.label}
                                    value={
                                        metric.value !== null && metric.value !== undefined
                                            ? typeof metric.value === "number" && !isNaN(metric.value)
                                                ? metric.label === "Ad spend" || metric.label === "Conversion value"
                                                    ? metric.value.toLocaleString("da-DK", {
                                                          style: "currency",
                                                          currency: "DKK",
                                                          maximumFractionDigits: 0,
                                                          minimumFractionDigits: 0,
                                                      })
                                                    : metric.label === "CTR"
                                                      ? `${metric.value.toFixed(2)}%`
                                                      : metric.label === "CPC" || metric.label === "CPM"
                                                        ? metric.value.toLocaleString("da-DK", {
                                                              style: "currency",
                                                              currency: "DKK",
                                                              maximumFractionDigits: 2,
                                                              minimumFractionDigits: 2,
                                                          })
                                                        : metric.value.toLocaleString(undefined, {
                                                              maximumFractionDigits: 0,
                                                              minimumFractionDigits: 0,
                                                          })
                                                : metric.value
                                            : "-"
                                    }
                                    icon={Icon ? <Icon size={22} color={isActive ? "#fff" : undefined} /> : null}
                                    isActive={isActive}
                                    change={metric.change}
                                    changeType={metric.changeType}
                                    comparisonMethod={comparisonMethod}
                                />
                            </div>
                        );
                    })
                )}
            </div>

            <div className="mb-8">
                <div className="flex items-center gap-4 mb-2">
                    <span className="font-semibold">Metric:</span>
                    <div className="flex flex-wrap gap-2">
                        {METRIC_OPTIONS.map((opt) => (
                            <button
                                key={opt.key}
                                className={`px-3 py-1 rounded text-xs font-medium border transition-colors duration-150 ${
                                    selectedMetrics.includes(opt.key)
                                        ? "bg-white text-[var(--color-primary-searchmind)] border-[var(--color-primary-searchmind)] shadow-sm"
                                        : "text-gray-500 border-gray-200 hover:text-[var(--color-primary-searchmind)]"
                                }`}
                                onClick={() =>
                                    setSelectedMetrics((prev) => {
                                        if (prev.includes(opt.key)) {
                                            return prev.length > 1 ? prev.filter((m) => m !== opt.key) : prev;
                                        }
                                        return [...prev, opt.key];
                                    })
                                }
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <Spinner size={40} color="#406969" />
                    </div>
                ) : (
                    <GraphCard
                        title={
                            (selectedMetrics || []).length === 1 && (selectedMetrics || [])[0]
                                ? `${METRIC_OPTIONS.find((opt) => opt.key === (selectedMetrics || [])[0])?.label ?? "Metric"} vs ${comparisonMethod}`
                                : `Multiple Bing Ads metrics vs ${comparisonMethod}`
                        }
                        chartOptions={chartOptions}
                        chartSeries={chartSeries}
                    />
                )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold mb-4">Top performance campaigns</h3>
                {loading ? (
                    <div className="flex justify-center items-center min-h-[120px]">
                        <Spinner size={40} color="#406969" />
                    </div>
                ) : error ? (
                    <div className="text-red-500 text-center">{error}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-xs text-left border-collapse" style={{ fontSize: "12px" }}>
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Campaign</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Clicks</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Impressions</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Conversions</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">CTR</th>
                                </tr>
                            </thead>
                            <tbody className="text-[12px]">
                                {topCampaigns.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-8 text-gray-400">
                                            No campaign data for selected range.
                                        </td>
                                    </tr>
                                ) : (
                                    topCampaigns.map((row, idx) => {
                                        const max = {
                                            clicks: Math.max(...topCampaigns.map((r) => Number(r.clicks) || 0)),
                                            impressions: Math.max(
                                                ...topCampaigns.map((r) => Number(r.impressions) || 0)
                                            ),
                                            conversions: Math.max(
                                                ...topCampaigns.map((r) => Number(r.conversions) || 0)
                                            ),
                                            ctr: Math.max(...topCampaigns.map((r) => (Number(r.ctr) || 0) * 100)),
                                        };
                                        return (
                                            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                <td className="px-3 py-2 whitespace-nowrap">{row.campaign_name}</td>
                                                <td
                                                    className="px-3 py-2 whitespace-nowrap"
                                                    style={{
                                                        ...(row.clicks > 0
                                                            ? {
                                                                  backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.clicks / max.clicks)})`,
                                                              }
                                                            : {}),
                                                    }}
                                                >
                                                    {Number(row.clicks || 0).toLocaleString(undefined, {
                                                        maximumFractionDigits: 0,
                                                    })}
                                                </td>
                                                <td
                                                    className="px-3 py-2 whitespace-nowrap"
                                                    style={{
                                                        ...(row.impressions > 0
                                                            ? {
                                                                  backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.impressions / max.impressions)})`,
                                                              }
                                                            : {}),
                                                    }}
                                                >
                                                    {Number(row.impressions || 0).toLocaleString(undefined, {
                                                        maximumFractionDigits: 0,
                                                    })}
                                                </td>
                                                <td
                                                    className="px-3 py-2 whitespace-nowrap"
                                                    style={{
                                                        ...(row.conversions > 0
                                                            ? {
                                                                  backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (row.conversions / max.conversions)})`,
                                                              }
                                                            : {}),
                                                    }}
                                                >
                                                    {Number(row.conversions || 0).toLocaleString(undefined, {
                                                        maximumFractionDigits: 0,
                                                    })}
                                                </td>
                                                <td
                                                    className="px-3 py-2 whitespace-nowrap"
                                                    style={{
                                                        ...(row.ctr > 0
                                                            ? {
                                                                  backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (((Number(row.ctr) || 0) * 100) / max.ctr)})`,
                                                              }
                                                            : {}),
                                                    }}
                                                >
                                                    {row.ctr ? `${(Number(row.ctr) * 100).toFixed(2)}%` : "-"}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
