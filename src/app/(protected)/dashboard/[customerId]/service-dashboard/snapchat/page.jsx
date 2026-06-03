"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
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
    FiBarChart2,
    FiPlusCircle,
} from "react-icons/fi";
import { useCustomers } from "@/hooks/useCustomers";
import { normalizeSnapchatSettings } from "@/lib/snapchatCustomerSettings";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import {
    formatComparisonPeriodDates,
    resolveDailyComparisonDate,
    COMPARISON_METHOD,
} from "@/lib/dateRangeComparison";

const METRIC_OPTIONS = [
    { key: "ad_spend", label: "Ad spend", icon: FiTrendingUp },
    { key: "conversions", label: "Conversions", icon: FiShoppingCart },
    { key: "impressions", label: "Impressions", icon: FiEye },
    { key: "clicks", label: "Swipe-ups", icon: FiMousePointer },
    { key: "ctr", label: "CTR", icon: FiPercent },
    { key: "cpc", label: "CPC", icon: FiArrowDownRight },
    { key: "cpm", label: "CPM", icon: FiArrowUpRight },
];

export default function SnapchatServiceDashboardPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const rangeStartQ = searchParams.get("startDate");
    const rangeEndQ = searchParams.get("endDate");
    const { customers } = useCustomers();
    const customer = customers.find((c) => c._id === params.customerId);

    const {
        tempDateRange: tempRange,
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
                page: "service_dashboard_snapchat",
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
        if (selectedMetrics.length === 0) {
            setSelectedMetrics(["ad_spend"]);
        }
    }, [selectedMetrics]);

    useEffect(() => {
        if (rangeStartQ && rangeEndQ) {
            setTempRange({ startDate: rangeStartQ, endDate: rangeEndQ });
            setAppliedRange({ startDate: rangeStartQ, endDate: rangeEndQ });
        }
    }, [rangeStartQ, rangeEndQ]);

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
                const snap = normalizeSnapchatSettings(settings);
                if (!snap.adAccountId?.trim()) {
                    throw new Error("Missing Snapchat ad account UUID — set it under Config → Snapchat Ads");
                }
                const hasAuth =
                    !!(snap.accessToken && snap.accessToken.trim()) ||
                    (Boolean(snap.clientId?.trim()) &&
                        Boolean(snap.clientSecret?.trim()) &&
                        Boolean(snap.refreshToken?.trim()));
                if (!hasAuth) {
                    throw new Error(
                        "Missing Snapchat Marketing API authorization — add access token or client id + client secret + refresh token in Config"
                    );
                }

                const compDates = formatComparisonPeriodDates({
                    comparisonMethod,
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                    compareStartDate: appliedCompareRange.startDate,
                    compareEndDate: appliedCompareRange.endDate,
                });

                const q = (s, e) =>
                    `startDate=${encodeURIComponent(s)}&endDate=${encodeURIComponent(e)}&dashboardCustomerId=${encodeURIComponent(String(customer._id))}`;

                const fetches = [fetch(`/api/snapchat-dashboard?${q(appliedRange.startDate, appliedRange.endDate)}`)];
                if (!compDates.skip && compDates.startDate && compDates.endDate) {
                    fetches.push(fetch(`/api/snapchat-dashboard?${q(compDates.startDate, compDates.endDate)}`));
                }
                const [curRes, prevRes] = await Promise.all(fetches);

                if (!curRes.ok) {
                    const errJson = await curRes.json().catch(() => ({}));
                    throw new Error(errJson.error || "Failed to fetch Snapchat dashboard metrics");
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
                        console.debug("[Snapchat dashboard] comparison period fetch failed", prevRes.status, errPrev);
                    }
                }

                if (process.env.NODE_ENV === "development") {
                    const spend = byDate.reduce((s, r) => s + (Number(r.ad_spend) || 0), 0);
                    console.debug("[Snapchat dashboard]", {
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
    }, [customer, appliedRange, appliedCompareRange, comparisonMethod]);

    const percentChange = (current, prev) => {
        if (current === null || current === undefined || isNaN(Number(current))) return null;
        if (prev === 0 || prev === null || prev === undefined || isNaN(Number(prev))) return null;
        return ((current - prev) / Math.abs(prev)) * 100;
    };
    const changeType = (val) => {
        if (val === null) return undefined;
        return val > 0 ? "up" : val < 0 ? "down" : undefined;
    };

    const metrics = useMemo(() => {
        if (!metricsByDate.length) return [];

        const agg = (key, data) => {
            if (key === "purchases") {
                return data.reduce((sum, row) => sum + (Number(row.purchases ?? row.conversions) || 0), 0);
            }
            if (key === "adds_to_cart") {
                return data.reduce((sum, row) => sum + (Number(row.adds_to_cart) || 0), 0);
            }
            if (key === "purchase_value") {
                return data.reduce((sum, row) => sum + (Number(row.purchase_value ?? row.conversion_value) || 0), 0);
            }
            if (key === "purchase_roas") {
                const spend = data.reduce((sum, row) => sum + (Number(row.ad_spend) || 0), 0);
                const val = data.reduce(
                    (sum, row) => sum + (Number(row.purchase_value ?? row.conversion_value) || 0),
                    0
                );
                return spend > 0 ? val / spend : null;
            }
            if (key === "ctr") {
                const totalClicks = data.reduce((sum, row) => sum + (row.clicks || 0), 0);
                const totalImpressions = data.reduce((sum, row) => sum + (row.impressions || 0), 0);
                return totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null;
            }
            return data.reduce((sum, row) => sum + (row[key] || 0), 0);
        };

        return METRIC_OPTIONS.map((opt) => {
            const currentValue = agg(opt.key, metricsByDate);
            const prevValue = metricsByDatePrev.length > 0 ? agg(opt.key, metricsByDatePrev) : null;
            const change = percentChange(currentValue, prevValue);

            return {
                label: opt.label,
                value: currentValue,
                change: change !== null ? Math.abs(change).toFixed(1) : undefined,
                changeType: changeType(change),
            };
        });
    }, [metricsByDate, metricsByDatePrev]);

    const { chartOptions, chartSeries } = useMemo(() => {
        const chartCategories = metricsByDate.map((row) => row.date);
        const metricsByDatePrevMap = Object.fromEntries(metricsByDatePrev.map((row) => [row.date, row]));

        /** Chart Y value for one day row — ROAS derived from spend + purchase value like Ads Manager cards. */
        const pointChartValue = (row, metricKey) => {
            if (!row) return null;
            let val = row[metricKey];
            if (metricKey === "ctr" && row.impressions > 0) {
                val = ((row.clicks || 0) / row.impressions) * 100;
            }
            if (metricKey === "purchase_roas") {
                const pv = Number(row.purchase_value ?? row.conversion_value) || 0;
                const sp = Number(row.ad_spend) || 0;
                val = sp > 0 ? pv / sp : null;
            }
            if (typeof val === "number" && !isNaN(val)) {
                if (
                    metricKey === "ctr" ||
                    metricKey === "purchase_roas" ||
                    metricKey === "purchase_value"
                ) {
                    return Number(val.toFixed(2));
                }
                return Math.round(val);
            }
            return val ?? null;
        };

        const series = [];

        selectedMetrics.forEach((metricKey) => {
            const metricOption = METRIC_OPTIONS.find((opt) => opt.key === metricKey);
            series.push({
                name: `${metricOption?.label || "Metric"} (Current)`,
                data: chartCategories.map((date) => {
                    const row = metricsByDate.find((r) => r.date === date);
                    return pointChartValue(row, metricKey);
                }),
            });
        });

        const sortedPrevDates = metricsByDatePrev.map((row) => row.date).sort();

        if (comparisonMethod !== COMPARISON_METHOD.NONE) {
        selectedMetrics.forEach((metricKey) => {
            const metricOption = METRIC_OPTIONS.find((opt) => opt.key === metricKey);
            series.push({
                name: `${metricOption?.label || "Metric"} (${comparisonLabel})`,
                data: chartCategories.map((date) => {
                    const prevDate = resolveDailyComparisonDate({
                        comparisonMethod,
                        currentDate: date,
                        appliedStartDate: appliedRange.startDate,
                        appliedEndDate: appliedRange.endDate,
                        sortedPrevKeys: sortedPrevDates,
                    });

                    const row = prevDate ? metricsByDatePrevMap[prevDate] : null;
                    return pointChartValue(row, metricKey);
                }),
            });
        });
        }

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
        metricsByDate,
        metricsByDatePrev,
        selectedMetrics,
        comparisonMethod,
        comparisonLabel,
        appliedRange,
    ]);

    return (
        <div className="w-full">
            <DashboardHeading
                title="Snapchat Ads Dashboard"
                label={customer ? customer.customerName : ""}
                customerId={params.customerId}
                dateRange={appliedRange}
                comparisonMethod={comparisonMethod}
                loading={loading}
                dashboardType="snapchat-dashboard"
                dataSnapshot={{
                    metricsByDate,
                    metricsByDatePrev,
                    topCampaigns,
                    selectedMetrics,
                    METRIC_OPTIONS,
                }}
                right={
                    <DateRangePicker {...dateRangePickerProps} loading={loading} />
                }
            />

            <div
                className="grid w-full gap-6 mb-8 [grid-template-columns:repeat(auto-fill,minmax(13.5rem,1fr))]"
            >
                {loading ? (
                    <div className="col-span-full text-center">
                        <Spinner size={40} color="#406969" />
                    </div>
                ) : error ? (
                    <div className="col-span-full text-center text-red-500">{error}</div>
                ) : (
                    metrics.map((metric, idx) => {
                        const Icon = METRIC_OPTIONS.find((opt) => opt.label === metric.label)?.icon;
                        const isActive = selectedMetrics.includes(METRIC_OPTIONS[idx].key);
                        return (
                            <div
                                key={idx}
                                className="min-w-0"
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
                                    className="h-full"
                                    label={metric.label}
                                    value={
                                        metric.value !== null && metric.value !== undefined
                                            ? typeof metric.value === "number" && !isNaN(metric.value)
                                                ? metric.label === "Ad spend" || metric.label === "Purchase value"
                                                    ? metric.value.toLocaleString("da-DK", {
                                                          style: "currency",
                                                          currency: "DKK",
                                                          maximumFractionDigits:
                                                              metric.label === "Purchase value" ? 2 : 0,
                                                          minimumFractionDigits:
                                                              metric.label === "Purchase value" ? 2 : 0,
                                                      })
                                                    : metric.label === "CTR"
                                                      ? `${metric.value.toFixed(2)}%`
                                                      : metric.label === "Purchase ROAS"
                                                        ? `${metric.value.toFixed(2)}×`
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
                                ? `${METRIC_OPTIONS.find((opt) => opt.key === (selectedMetrics || [])[0])?.label ?? "Metric"} vs ${comparisonLabel}`
                                : `Multiple Snapchat metrics vs ${comparisonLabel}`
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
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Spend (DKK)</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Purchases</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Adds to cart</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Swipe-ups</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">Impressions</th>
                                    <th className="px-3 py-1.5 font-semibold text-gray-700">CTR</th>
                                </tr>
                            </thead>
                            <tbody className="text-[12px]">
                                {topCampaigns.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-8 text-gray-400">
                                            No campaign data for selected range.
                                        </td>
                                    </tr>
                                ) : (
                                    topCampaigns.map((row, idx) => {
                                        const spendNum = Number(row.ad_spend) || 0;
                                        const purchasesNum = Number(row.purchases) || 0;
                                        const addsNum = Number(row.adds_to_cart) || 0;
                                        const max = {
                                            ad_spend: Math.max(...topCampaigns.map((r) => Number(r.ad_spend) || 0)),
                                            clicks: Math.max(...topCampaigns.map((r) => Number(r.clicks) || 0)),
                                            impressions: Math.max(
                                                ...topCampaigns.map((r) => Number(r.impressions) || 0)
                                            ),
                                            purchases: Math.max(...topCampaigns.map((r) => Number(r.purchases) || 0)),
                                            adds_to_cart: Math.max(
                                                ...topCampaigns.map((r) => Number(r.adds_to_cart) || 0)
                                            ),
                                            ctr: Math.max(...topCampaigns.map((r) => (Number(r.ctr) || 0) * 100)),
                                        };
                                        return (
                                            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                                <td className="px-3 py-2 whitespace-nowrap">{row.campaign_name}</td>
                                                <td
                                                    className="px-3 py-2 whitespace-nowrap"
                                                    style={{
                                                        ...(spendNum > 0 && max.ad_spend > 0
                                                            ? {
                                                                  backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (spendNum / max.ad_spend)})`,
                                                              }
                                                            : {}),
                                                    }}
                                                >
                                                    {spendNum.toLocaleString("da-DK", {
                                                        style: "currency",
                                                        currency: "DKK",
                                                        maximumFractionDigits: 2,
                                                        minimumFractionDigits: 2,
                                                    })}
                                                </td>
                                                <td
                                                    className="px-3 py-2 whitespace-nowrap"
                                                    style={{
                                                        ...(purchasesNum > 0 && max.purchases > 0
                                                            ? {
                                                                  backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (purchasesNum / max.purchases)})`,
                                                              }
                                                            : {}),
                                                    }}
                                                >
                                                    {purchasesNum.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </td>
                                                <td
                                                    className="px-3 py-2 whitespace-nowrap"
                                                    style={{
                                                        ...(addsNum > 0 && max.adds_to_cart > 0
                                                            ? {
                                                                  backgroundColor: `rgba(214,205,182,${0.15 + 0.85 * (addsNum / max.adds_to_cart)})`,
                                                              }
                                                            : {}),
                                                    }}
                                                >
                                                    {addsNum.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                </td>
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
