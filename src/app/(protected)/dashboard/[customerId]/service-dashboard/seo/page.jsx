"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import GraphCard from "@/components/dashboard/GraphCard";
import Spinner from "@/components/ui/Spinner";
import SEOKeywordSettings from "@/components/seo/SEOKeywordSettings";
import { FiMousePointer, FiEye, FiPercent, FiTrendingUp } from "react-icons/fi";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";
import { useDashboardDateRange } from "@/hooks/useDashboardDateRange";
import {
    formatComparisonPeriodDates,
    resolveDailyComparisonDate,
    COMPARISON_METHOD,
} from "@/lib/dateRangeComparison";
const METRIC_OPTIONS = [
    { key: "clicks", label: "Clicks", icon: FiMousePointer },
    { key: "impressions", label: "Impressions", icon: FiEye },
    { key: "ctr", label: "CTR", icon: FiPercent },
    { key: "position", label: "Avg. Position", icon: FiTrendingUp },
];

function formatNumber(n) {
    return n?.toLocaleString("da-DK") ?? "-";
}

function calcCtr(clicks, impressions) {
    if (!impressions) return 0;
    return ((clicks / impressions) * 100).toFixed(2);
}

function calcAvgPosition(rows) {
    if (!rows?.length) return 0;
    const sum = rows.reduce((acc, r) => acc + (r.position || 0), 0);
    return (sum / rows.length).toFixed(2);
}

function aggregateSeoMetric(key, rows) {
    if (!rows?.length) return null;
    if (key === "clicks") {
        return rows.reduce((acc, r) => acc + (r.clicks || 0), 0);
    }
    if (key === "impressions") {
        return rows.reduce((acc, r) => acc + (r.impressions || 0), 0);
    }
    if (key === "ctr") {
        const clicks = rows.reduce((acc, r) => acc + (r.clicks || 0), 0);
        const impressions = rows.reduce((acc, r) => acc + (r.impressions || 0), 0);
        return impressions > 0 ? Number(calcCtr(clicks, impressions)) : null;
    }
    if (key === "position") {
        return Number(calcAvgPosition(rows));
    }
    return null;
}

function metricValueForRow(key, row) {
    if (!row) return null;
    if (key === "ctr") return Number(calcCtr(row.clicks, row.impressions));
    if (key === "position") return row.position != null ? Number(row.position.toFixed(2)) : null;
    return row[key] ?? null;
}

/** For avg. position, a decrease is positive (better ranking). */
function changeTypeForMetric(key, changeVal) {
    if (changeVal === null) return undefined;
    if (key === "position") {
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
    const [metrics, setMetrics] = useState(null);
    const [metricsPrev, setMetricsPrev] = useState(null);
    const [keywords, setKeywords] = useState([]);
    const [urls, setUrls] = useState([]);
    const [selectedMetrics, setSelectedMetrics] = useState(["clicks"]);

    useEffect(() => {
        if (selectedMetrics.length === 0) {
            setSelectedMetrics(["clicks"]);
        }
    }, [selectedMetrics]);

    useEffect(() => {
        if (rangeStartQ && rangeEndQ) {
            setTempRange({ startDate: rangeStartQ, endDate: rangeEndQ });
            setAppliedRange({ startDate: rangeStartQ, endDate: rangeEndQ });
        }
    }, [rangeStartQ, rangeEndQ, setTempRange, setAppliedRange]);

    const [siteUrl, setSiteUrl] = useState("");

    const [keywordFilter, setKeywordFilter] = useState("all");
    const [brandKeywords, setBrandKeywords] = useState([]);
    const [exactGroups, setExactGroups] = useState([]);
    const [partialGroups, setPartialGroups] = useState([]);

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

    useEffect(() => {
        if (!customerId) return;
        fetchKeywordGroups();
    }, [customerId]);

    async function fetchKeywordGroups() {
        try {
            const brandRes = await fetch(`/api/seo-keywords/brand/${customerId}`);
            const brandData = await brandRes.json();
            if (brandData.success && brandData.data?.keywords) {
                setBrandKeywords(brandData.data.keywords);
            } else {
                setBrandKeywords([]);
            }

            const exactRes = await fetch(`/api/seo-keywords/exact/${customerId}`);
            const exactData = await exactRes.json();
            if (exactData.success) {
                setExactGroups(exactData.data);
            } else {
                setExactGroups([]);
            }

            const partialRes = await fetch(`/api/seo-keywords/partial/${customerId}`);
            const partialData = await partialRes.json();
            if (partialData.success) {
                setPartialGroups(partialData.data);
            } else {
                setPartialGroups([]);
            }
        } catch (err) {
            console.error("Error fetching keyword groups:", err);
        }
    }

    const handleKeywordGroupsUpdate = () => {
        fetchKeywordGroups();
    };

    useEffect(() => {
        if (!siteUrl) return;
        fetchData();
    }, [
        appliedRange.startDate,
        appliedRange.endDate,
        appliedCompareRange,
        comparisonMethod,
        siteUrl,
        customerId,
    ]);

    async function fetchSeoMetrics(startDate, endDate) {
        const res = await fetch("/api/seo-dashboard/metrics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                siteUrl,
                startDate,
                endDate,
                customerId,
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || "API error");
        return data;
    }

    async function fetchData() {
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

            const current = await fetchSeoMetrics(
                appliedRange.startDate,
                appliedRange.endDate
            );
            setMetrics(current.metrics?.rows || []);
            setKeywords(current.keywords?.rows || []);
            setUrls(current.urls?.rows || []);

            if (!compDates.skip && compDates.startDate && compDates.endDate) {
                const prev = await fetchSeoMetrics(
                    compDates.startDate,
                    compDates.endDate
                );
                setMetricsPrev(prev.metrics?.rows || []);
            } else {
                setMetricsPrev(null);
            }
        } catch (e) {
            setError(e.message);
            setMetrics(null);
            setMetricsPrev(null);
            setKeywords([]);
            setUrls([]);
        } finally {
            setLoading(false);
        }
    }

    const percentChange = (current, prev) => {
        if (prev === 0 || prev === null || prev === undefined) return null;
        return ((current - prev) / Math.abs(prev)) * 100;
    };

    const metricCards = useMemo(() => {
        const rows = metrics || [];
        const rowsPrev = metricsPrev || [];
        return METRIC_OPTIONS.map((opt) => {
            const currentValue = aggregateSeoMetric(opt.key, rows);
            const prevValue =
                rowsPrev.length > 0 ? aggregateSeoMetric(opt.key, rowsPrev) : null;
            const change = percentChange(currentValue, prevValue);

            let value;
            let unit;
            if (opt.key === "clicks") value = formatNumber(currentValue);
            if (opt.key === "impressions") value = formatNumber(currentValue);
            if (opt.key === "ctr") {
                value = currentValue;
                unit = "%";
            }
            if (opt.key === "position") value = currentValue;

            return {
                key: opt.key,
                label: opt.label,
                value,
                unit,
                icon: opt.icon,
                change:
                    change !== null && comparisonMethod !== COMPARISON_METHOD.NONE
                        ? Math.abs(change).toFixed(1)
                        : undefined,
                changeType:
                    comparisonMethod !== COMPARISON_METHOD.NONE
                        ? changeTypeForMetric(opt.key, change)
                        : undefined,
            };
        });
    }, [metrics, metricsPrev, comparisonMethod]);

    const filteredKeywords = useMemo(() => {
        if (keywordFilter === "all") return keywords;

        if (keywordFilter === "brand") {
            if (brandKeywords.length === 0) return [];
            return keywords.filter((row) => {
                const keyword = (row.keys?.[0] || "").toLowerCase();
                return brandKeywords.some((brand) =>
                    keyword.includes(brand.toLowerCase())
                );
            });
        }

        if (keywordFilter.startsWith("exact:")) {
            const groupId = keywordFilter.split(":")[1];
            const group = exactGroups.find((g) => g._id === groupId);
            if (!group || !group.keywords.length) return [];
            const groupKeywordsLower = group.keywords.map((k) => k.toLowerCase());
            return keywords.filter((row) => {
                const keyword = (row.keys?.[0] || "").toLowerCase();
                return groupKeywordsLower.includes(keyword);
            });
        }

        if (keywordFilter.startsWith("partial:")) {
            const groupId = keywordFilter.split(":")[1];
            const group = partialGroups.find((g) => g._id === groupId);
            if (!group || !group.keywords.length) return [];
            return keywords.filter((row) => {
                const keyword = (row.keys?.[0] || "").toLowerCase();
                return group.keywords.some((partial) =>
                    keyword.includes(partial.toLowerCase())
                );
            });
        }

        return keywords;
    }, [keywords, keywordFilter, brandKeywords, exactGroups, partialGroups]);

    const { chartOptions, chartSeries } = useMemo(() => {
        const rows = metrics || [];
        const chartCategories = rows.map((r) => r.keys?.[0]).filter(Boolean);
        const prevRows = metricsPrev || [];
        const prevByDate = Object.fromEntries(
            prevRows.map((r) => [r.keys?.[0], r])
        );
        const sortedPrevDates = prevRows.map((r) => r.keys?.[0]).filter(Boolean).sort();

        const series = [];
        const colors = ["#1E2B2B", "#D6CDB6", "#406969", "#C6ED62"];

        selectedMetrics.forEach((metricKey, idx) => {
            const opt = METRIC_OPTIONS.find((o) => o.key === metricKey);
            series.push({
                name: `${opt?.label || metricKey} (Current)`,
                data: chartCategories.map((date) => {
                    const row = rows.find((r) => r.keys?.[0] === date);
                    const val = metricValueForRow(metricKey, row);
                    return val != null && !Number.isNaN(val) ? val : null;
                }),
                color: colors[idx % colors.length],
            });
        });

        if (comparisonMethod !== COMPARISON_METHOD.NONE && prevRows.length > 0) {
            selectedMetrics.forEach((metricKey, idx) => {
                const opt = METRIC_OPTIONS.find((o) => o.key === metricKey);
                series.push({
                    name: `${opt?.label || metricKey} (${comparisonLabel})`,
                    data: chartCategories.map((date) => {
                        const prevDate = resolveDailyComparisonDate({
                            comparisonMethod,
                            currentDate: date,
                            appliedStartDate: appliedRange.startDate,
                            appliedEndDate: appliedRange.endDate,
                            sortedPrevKeys: sortedPrevDates,
                        });
                        const row = prevDate ? prevByDate[prevDate] : null;
                        const val = metricValueForRow(metricKey, row);
                        return val != null && !Number.isNaN(val) ? val : null;
                    }),
                    color: "#94a3b8",
                });
            });
        }

        const isCurrentSeries = (s) => s.name?.includes("(Current)");
        const strokeWidths = series.map((s) => (isCurrentSeries(s) ? 2 : 1));
        const strokeDashArrays = series.map((s) => (isCurrentSeries(s) ? 0 : 5));
        const fillOpacities = series.map((s) => (isCurrentSeries(s) ? 1 : 0.5));

        return {
            chartSeries: series,
            chartOptions: {
                chart: {
                    id: "seo-metrics",
                    toolbar: { show: false },
                    fontFamily: "Outfit, sans-serif",
                },
                xaxis: {
                    categories: chartCategories,
                    labels: { rotate: -45 },
                    axisTicks: { show: true },
                    axisBorder: { show: true },
                },
                colors: series.map((s) => s.color),
                stroke: {
                    curve: "smooth",
                    width: strokeWidths,
                    dashArray: strokeDashArrays,
                },
                fill: { type: "solid", opacity: fillOpacities },
                legend: { show: true, position: "top" },
                tooltip: { shared: true },
                grid: {
                    borderColor: "#e5e7eb",
                    strokeDashArray: 0,
                    xaxis: { lines: { show: false } },
                    yaxis: { lines: { show: true } },
                },
                dataLabels: { enabled: false },
            },
        };
    }, [
        metrics,
        metricsPrev,
        selectedMetrics,
        comparisonMethod,
        comparisonLabel,
        appliedRange.startDate,
        appliedRange.endDate,
    ]);

    return (
        <div className="mx-auto">
            <DashboardHeading
                title="SEO Dashboard"
                label={siteUrl || "No property set"}
                customerId={customerId}
                dateRange={appliedRange}
                comparisonMethod={comparisonMethod}
                loading={loading}
                dashboardType="seo-dashboard"
                dataSnapshot={{
                    metrics,
                    metricsPrev,
                    keywords,
                    urls,
                    selectedMetrics,
                    siteUrl,
                }}
                right={
                    <DateRangePicker {...dateRangePickerProps} loading={loading} />
                }
            />

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Spinner size={48} />
                </div>
            ) : error ? (
                <div className="text-red-500 text-center py-8">{error}</div>
            ) : (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-6 mb-8">
                        {metricCards.map((card) => {
                            const Icon = card.icon;
                            return (
                                <div
                                    key={card.key}
                                    className="cursor-pointer"
                                    tabIndex={0}
                                    role="button"
                                    aria-pressed={selectedMetrics.includes(card.key)}
                                    onClick={() =>
                                        setSelectedMetrics((prev) => {
                                            if (prev.includes(card.key)) {
                                                return prev.length > 1
                                                    ? prev.filter((m) => m !== card.key)
                                                    : prev;
                                            }
                                            return [...prev, card.key];
                                        })
                                    }
                                    onKeyDown={(e) =>
                                        (e.key === "Enter" || e.key === " ") &&
                                        setSelectedMetrics((prev) => {
                                            if (prev.includes(card.key)) {
                                                return prev.length > 1
                                                    ? prev.filter((m) => m !== card.key)
                                                    : prev;
                                            }
                                            return [...prev, card.key];
                                        })
                                    }
                                    style={{ outline: "none" }}
                                >
                                    <MetricCard
                                        label={card.label}
                                        value={card.value}
                                        unit={card.unit}
                                        change={card.change}
                                        changeType={card.changeType}
                                        comparisonMethod={comparisonMethod}
                                        icon={
                                            <Icon className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />
                                        }
                                        isActive={selectedMetrics.includes(card.key)}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-2">
                            {METRIC_OPTIONS.map((opt) => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors duration-150 ${selectedMetrics.includes(opt.key) ? "bg-[var(--color-primary-searchmind)] text-white border-[var(--color-primary-searchmind)]" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"}`}
                                    onClick={() =>
                                        setSelectedMetrics((prev) => {
                                            if (prev.includes(opt.key)) {
                                                return prev.length > 1
                                                    ? prev.filter((m) => m !== opt.key)
                                                    : prev;
                                            }
                                            return [...prev, opt.key];
                                        })
                                    }
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <GraphCard
                            title={
                                selectedMetrics.length === 1
                                    ? `${METRIC_OPTIONS.find((o) => o.key === selectedMetrics[0])?.label} Over Time`
                                    : "Multiple SEO Metrics Over Time"
                            }
                            chartOptions={chartOptions}
                            chartSeries={chartSeries}
                        />
                    </div>

                    <div className="mb-8">
                        <div className="border border-gray-200 rounded-xl bg-white p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">Top Keywords</h2>

                                <div className="flex items-center gap-2">
                                    <label htmlFor="keyword-filter" className="text-sm text-gray-600">
                                        Filter by:
                                    </label>
                                    <select
                                        id="keyword-filter"
                                        value={keywordFilter}
                                        onChange={(e) => setKeywordFilter(e.target.value)}
                                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        <option value="all">All Keywords</option>
                                        {brandKeywords.length > 0 && (
                                            <option value="brand">
                                                Brand Keywords ({brandKeywords.length})
                                            </option>
                                        )}
                                        {exactGroups.length > 0 && (
                                            <optgroup label="Exact Match Groups">
                                                {exactGroups.map((group) => (
                                                    <option
                                                        key={group._id}
                                                        value={`exact:${group._id}`}
                                                    >
                                                        {group.name} ({group.keywords.length})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                        {partialGroups.length > 0 && (
                                            <optgroup label="Partial Match Groups">
                                                {partialGroups.map((group) => (
                                                    <option
                                                        key={group._id}
                                                        value={`partial:${group._id}`}
                                                    >
                                                        {group.name} ({group.keywords.length})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        )}
                                    </select>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Keyword</th>
                                            <th className="px-4 py-2 text-right">Clicks</th>
                                            <th className="px-4 py-2 text-right">Impressions</th>
                                            <th className="px-4 py-2 text-right">CTR</th>
                                            <th className="px-4 py-2 text-right">Avg. Position</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredKeywords.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="text-center py-4">
                                                    {keywordFilter === "all"
                                                        ? "No data"
                                                        : "No keywords match this filter"}
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredKeywords.map((row, i) => (
                                                <tr key={i} className="border-b last:border-b-0">
                                                    <td className="px-4 py-2">{row.keys?.[0]}</td>
                                                    <td className="px-4 py-2 text-right">
                                                        {formatNumber(row.clicks)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        {formatNumber(row.impressions)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        {calcCtr(row.clicks, row.impressions)}%
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        {row.position?.toFixed(2) ?? "-"}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="border border-gray-200 rounded-xl bg-white p-6">
                            <h2 className="text-lg font-semibold mb-2">Top URLs</h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left">URL</th>
                                            <th className="px-4 py-2 text-right">Clicks</th>
                                            <th className="px-4 py-2 text-right">Impressions</th>
                                            <th className="px-4 py-2 text-right">CTR</th>
                                            <th className="px-4 py-2 text-right">Avg. Position</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {urls.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="text-center py-4">
                                                    No data
                                                </td>
                                            </tr>
                                        ) : (
                                            urls.map((row, i) => (
                                                <tr key={i} className="border-b last:border-b-0">
                                                    <td className="px-4 py-2">
                                                        <a
                                                            href={row.keys?.[0]}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 underline"
                                                        >
                                                            {row.keys?.[0]}
                                                        </a>
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        {formatNumber(row.clicks)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        {formatNumber(row.impressions)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        {calcCtr(row.clicks, row.impressions)}%
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        {row.position?.toFixed(2) ?? "-"}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <SEOKeywordSettings
                        customerId={customerId}
                        onKeywordsUpdate={handleKeywordGroupsUpdate}
                    />
                </>
            )}
        </div>
    );
}
