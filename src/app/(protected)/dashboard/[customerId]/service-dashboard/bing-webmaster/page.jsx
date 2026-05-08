"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import GraphCard from "@/components/dashboard/GraphCard";
import Spinner from "@/components/ui/Spinner";
import {
    FiBookmark,
    FiExternalLink,
    FiEye,
    FiFileText,
    FiLayers,
    FiMousePointer,
    FiPercent,
    FiServer,
    FiShield,
} from "react-icons/fi";
import { pushDashboardDateRangeApplied } from "@root/lib/gtmFunctions";

const SEARCH_METRIC_OPTIONS = [
    { key: "impressions", label: "Impressions", icon: FiEye },
    { key: "clicks", label: "Clicks", icon: FiMousePointer },
    { key: "ctr", label: "CTR", icon: FiPercent },
];

const AI_METRIC_OPTIONS = [
    { key: "totalCitations", label: "Total Citations", icon: FiBookmark },
    { key: "avgCitedPages", label: "Avg. Cited Pages", icon: FiFileText },
];

function formatNumber(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return "—";
    return Number(n).toLocaleString("da-DK");
}

function calcCtr(clicks, impressions) {
    if (!impressions) return "0.00";
    return ((Number(clicks) / Number(impressions)) * 100).toFixed(2);
}

const defaultRange = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const isFirstOfMonth = today.getDate() === 1;
    const defaultStart = `${yyyy}-${mm}-01`;
    const defaultEnd = isFirstOfMonth
        ? `${yyyy}-${mm}-01`
        : `${yyyy}-${mm}-${String(today.getDate() - 1).padStart(2, "0")}`;
    return { startDate: defaultStart, endDate: defaultEnd };
};

const DISCLAIMER =
    "Microsoft has not published a public JSON API for AI Performance (total citations, avg cited pages, grounding queries). The dashboard is ready to wire up when an endpoint is available. Use Open in Bing Webmaster for live data.";

export default function BingWebmasterDashboardPage() {
    const params = useParams();
    const customerId = params.customerId;
    const defaultRangeValue = defaultRange();
    const [tempRange, setTempRange] = useState(defaultRangeValue);
    const [appliedRange, setAppliedRange] = useState(defaultRangeValue);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [data, setData] = useState(null);
    const [selectedSearchMetrics, setSelectedSearchMetrics] = useState(["impressions"]);
    const [selectedAiMetrics, setSelectedAiMetrics] = useState(["totalCitations"]);

    useEffect(() => {
        if (selectedSearchMetrics.length === 0) setSelectedSearchMetrics(["impressions"]);
    }, [selectedSearchMetrics]);

    useEffect(() => {
        if (selectedAiMetrics.length === 0) setSelectedAiMetrics(["totalCitations"]);
    }, [selectedAiMetrics]);

    const handleDateRangeApply = ({ startDate, endDate }) => {
        pushDashboardDateRangeApplied({
            page: "service_dashboard_bing_webmaster",
            customerId,
            startDate,
            endDate,
        });
        setAppliedRange({ startDate, endDate });
    };

    useEffect(() => {
        if (!customerId) return;
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const q = new URLSearchParams({
                    customerId,
                    startDate: appliedRange.startDate,
                    endDate: appliedRange.endDate,
                });
                const res = await fetch(`/api/bing-webmaster/site-data?${q.toString()}`);
                const json = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(json.error || "Failed to load Bing Webmaster data");
                if (!cancelled) setData(json);
            } catch (e) {
                if (!cancelled) {
                    setError(e.message);
                    setData(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, [customerId, appliedRange.startDate, appliedRange.endDate]);

    const traffic = data?.traffic || [];
    const totalImpressions = traffic.reduce((acc, r) => acc + (Number(r.impressions) || 0), 0);
    const totalClicks = traffic.reduce((acc, r) => acc + (Number(r.clicks) || 0), 0);
    const avgCtr = calcCtr(totalClicks, totalImpressions);

    const searchChartDataMap = {
        impressions: {
            name: "Impressions",
            data: traffic.map((r) => r.impressions ?? 0),
            color: "#D6CDB6",
        },
        clicks: {
            name: "Clicks",
            data: traffic.map((r) => r.clicks ?? 0),
            color: "#1E2B2B",
        },
        ctr: {
            name: "CTR %",
            data: traffic.map((r) => calcCtr(r.clicks, r.impressions)),
            color: "#406969",
        },
    };

    const searchChartSeries = selectedSearchMetrics.map((k) => searchChartDataMap[k]);
    const searchChartOptions = {
        chart: { id: "bing-search-performance", toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
        xaxis: {
            categories: traffic.map((r) => r.date),
            labels: { rotate: -45 },
            axisTicks: { show: true },
            axisBorder: { show: true },
        },
        colors: selectedSearchMetrics.map((k) => searchChartDataMap[k].color),
        stroke: { curve: "smooth", width: 2 },
        legend: { show: true, position: "top" },
        tooltip: { shared: true },
        grid: {
            borderColor: "#e5e7eb",
            strokeDashArray: 0,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
        },
        dataLabels: { enabled: false },
    };

    const crawlLatest = data?.crawlStats?.latest;
    const portalUrl = data?.aiPerformancePortalUrl;
    const propertyUrl = data?.bingPropertyUrl;
    const aiSeries = data?.aiPerformance?.seriesDaily || [];
    const groundingRows = data?.aiPerformance?.groundingQueries || [];

    const totalAiCitations = aiSeries.reduce((acc, r) => acc + (Number(r.totalCitations) || 0), 0);
    const avgAiPages =
        aiSeries.length > 0
            ? (aiSeries.reduce((acc, r) => acc + (Number(r.avgCitedPages) || 0), 0) / aiSeries.length).toFixed(2)
            : "0";

    const aiChartDataMap = {
        totalCitations: {
            name: "Total Citations",
            data: aiSeries.map((r) => r.totalCitations ?? 0),
            color: "#1E2B2B",
        },
        avgCitedPages: {
            name: "Avg. Cited Pages",
            data: aiSeries.map((r) => r.avgCitedPages ?? 0),
            color: "#C6ED62",
        },
    };

    const aiChartSeries = selectedAiMetrics.map((k) => aiChartDataMap[k]);
    const aiChartOptions = {
        chart: { id: "bing-ai-performance", toolbar: { show: false }, fontFamily: "Outfit, sans-serif" },
        xaxis: {
            categories: aiSeries.map((r) => r.date),
            labels: { rotate: -45 },
            axisTicks: { show: true },
            axisBorder: { show: true },
        },
        colors: selectedAiMetrics.map((k) => aiChartDataMap[k].color),
        stroke: { curve: "smooth", width: 2 },
        legend: { show: true, position: "top" },
        tooltip: { shared: true },
        grid: {
            borderColor: "#e5e7eb",
            strokeDashArray: 0,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } },
        },
        dataLabels: { enabled: false },
    };

    const siteLabel = data?.siteUrl || "—";

    return (
        <div className="mx-auto w-full min-w-0 max-w-full">
            <DashboardHeading
                title="Bing Webmaster"
                label={siteLabel}
                customerId={customerId}
                dateRange={appliedRange}
                loading={loading}
                dashboardType="bing-webmaster"
                dataSnapshot={{
                    siteUrl: data?.siteUrl,
                    dateRange: appliedRange,
                    traffic,
                    crawlStats: data?.crawlStats,
                    siteInAccount: data?.siteInAccount,
                    aiPerformance: data?.aiPerformance,
                }}
                right={
                    <DateRangePicker
                        onApply={handleDateRangeApply}
                        startDate={tempRange.startDate}
                        endDate={tempRange.endDate}
                        onStartDateChange={(d) => setTempRange((r) => ({ ...r, startDate: d }))}
                        onEndDateChange={(d) => setTempRange((r) => ({ ...r, endDate: d }))}
                    />
                }
            />

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Spinner size={48} />
                </div>
            ) : error ? (
                <div className="text-red-600 text-center py-8 rounded-xl border border-red-100 bg-red-50 px-4">{error}</div>
            ) : (
                <>
                    {/* Search performance */}
                    <section className="mb-10">
                        <div className="mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Search performance</h2>
                            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
                                Bing search impressions and clicks for your verified property.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 mb-6 max-w-5xl">
                            {SEARCH_METRIC_OPTIONS.map((opt) => {
                                let value;
                                let unit;
                                if (opt.key === "impressions") value = formatNumber(totalImpressions);
                                if (opt.key === "clicks") value = formatNumber(totalClicks);
                                if (opt.key === "ctr") {
                                    value = avgCtr;
                                    unit = "%";
                                }
                                const Icon = opt.icon;
                                return (
                                    <div
                                        key={opt.key}
                                        className="cursor-pointer"
                                        tabIndex={0}
                                        role="button"
                                        aria-pressed={selectedSearchMetrics.includes(opt.key)}
                                        onClick={() =>
                                            setSelectedSearchMetrics((prev) => {
                                                if (prev.includes(opt.key)) {
                                                    return prev.length > 1 ? prev.filter((m) => m !== opt.key) : prev;
                                                }
                                                return [...prev, opt.key];
                                            })
                                        }
                                        onKeyDown={(e) =>
                                            (e.key === "Enter" || e.key === " ") &&
                                            setSelectedSearchMetrics((prev) => {
                                                if (prev.includes(opt.key)) {
                                                    return prev.length > 1 ? prev.filter((m) => m !== opt.key) : prev;
                                                }
                                                return [...prev, opt.key];
                                            })
                                        }
                                        style={{ outline: "none" }}
                                    >
                                        <MetricCard
                                            label={opt.label}
                                            value={value}
                                            unit={unit}
                                            icon={
                                                <Icon className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />
                                            }
                                            isActive={selectedSearchMetrics.includes(opt.key)}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            {SEARCH_METRIC_OPTIONS.map((opt) => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors duration-150 ${
                                        selectedSearchMetrics.includes(opt.key)
                                            ? "bg-[var(--color-primary-searchmind)] text-white border-[var(--color-primary-searchmind)]"
                                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                                    }`}
                                    onClick={() =>
                                        setSelectedSearchMetrics((prev) => {
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
                        <GraphCard
                            title={
                                selectedSearchMetrics.length === 1
                                    ? `${searchChartDataMap[selectedSearchMetrics[0]].name} over time`
                                    : "Search metrics over time"
                            }
                            chartOptions={searchChartOptions}
                            chartSeries={searchChartSeries}
                        />

                        <div className="mt-6 border border-gray-200 rounded-xl bg-white p-6">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Daily search activity</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium text-gray-700">Date</th>
                                            <th className="px-4 py-2 text-right font-medium text-gray-700">Impressions</th>
                                            <th className="px-4 py-2 text-right font-medium text-gray-700">Clicks</th>
                                            <th className="px-4 py-2 text-right font-medium text-gray-700">CTR</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {traffic.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                                    No traffic rows for this date range.
                                                </td>
                                            </tr>
                                        ) : (
                                            [...traffic].reverse().map((row) => (
                                                <tr key={row.date} className="border-b border-gray-100 last:border-b-0">
                                                    <td className="px-4 py-2 whitespace-nowrap">{row.date}</td>
                                                    <td className="px-4 py-2 text-right tabular-nums">
                                                        {formatNumber(row.impressions)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right tabular-nums">
                                                        {formatNumber(row.clicks)}
                                                    </td>
                                                    <td className="px-4 py-2 text-right tabular-nums">
                                                        {calcCtr(row.clicks, row.impressions)}%
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>

                    {/* Crawl & index */}
                    <section className="mb-10">
                        <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">Crawl &amp; index</h2>
                                <p className="text-sm text-gray-500 mt-1 max-w-3xl">
                                    How Bing crawls and indexes your site.
                                </p>
                            </div>
                            {propertyUrl ? (
                                <a
                                    href={propertyUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                                >
                                    Open site in Bing Webmaster
                                    <FiExternalLink className="w-4 h-4" />
                                </a>
                            ) : null}
                        </div>

                        {data?.crawlError ? (
                            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
                                Crawl stats could not be loaded: {data.crawlError}
                            </p>
                        ) : null}

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <MetricCard
                                label="Pages in index"
                                value={formatNumber(crawlLatest?.inIndex)}
                                icon={<FiLayers className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            />
                            <MetricCard
                                label="Pages crawled"
                                value={formatNumber(crawlLatest?.crawledPages)}
                                icon={<FiServer className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            />
                            <MetricCard
                                label="Crawl errors"
                                value={formatNumber(crawlLatest?.crawlErrors)}
                                icon={<FiShield className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            />
                            <MetricCard
                                label="Inlinks discovered"
                                value={formatNumber(crawlLatest?.inLinks)}
                                icon={<FiLayers className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />}
                            />
                        </div>
                        <p className="text-xs text-gray-500">
                            {crawlLatest?.date
                                ? `Latest crawl stats row: ${crawlLatest.date}. Bing updates daily.`
                                : "No crawl stats returned yet for this property."}
                        </p>
                    </section>

                    {/* AI Performance (placeholder) */}
                    <section className="mb-10">
                        <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">AI Performance</h2>
                                <p className="text-sm text-gray-500 mt-1 max-w-3xl">
                                    Citations in Copilot and Bing AI experiences — placeholder layout until Microsoft ships
                                    an API for these metrics.
                                </p>
                            </div>
                            {portalUrl ? (
                                <a
                                    href={portalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                                >
                                    Open AI Performance
                                    <FiExternalLink className="w-4 h-4" />
                                </a>
                            ) : null}
                        </div>

                        <div className="grid grid-cols-2 gap-6 mb-6 max-w-3xl">
                            {AI_METRIC_OPTIONS.map((opt) => {
                                let value;
                                let unit;
                                if (opt.key === "totalCitations") value = formatNumber(totalAiCitations);
                                if (opt.key === "avgCitedPages") value = avgAiPages;
                                const Icon = opt.icon;
                                return (
                                    <div
                                        key={opt.key}
                                        className="cursor-pointer"
                                        tabIndex={0}
                                        role="button"
                                        aria-pressed={selectedAiMetrics.includes(opt.key)}
                                        onClick={() =>
                                            setSelectedAiMetrics((prev) => {
                                                if (prev.includes(opt.key)) {
                                                    return prev.length > 1 ? prev.filter((m) => m !== opt.key) : prev;
                                                }
                                                return [...prev, opt.key];
                                            })
                                        }
                                        onKeyDown={(e) =>
                                            (e.key === "Enter" || e.key === " ") &&
                                            setSelectedAiMetrics((prev) => {
                                                if (prev.includes(opt.key)) {
                                                    return prev.length > 1 ? prev.filter((m) => m !== opt.key) : prev;
                                                }
                                                return [...prev, opt.key];
                                            })
                                        }
                                        style={{ outline: "none" }}
                                    >
                                        <MetricCard
                                            label={opt.label}
                                            value={value}
                                            unit={unit}
                                            icon={
                                                <Icon className="text-[var(--color-primary-searchmind-lighter)] font-bold text-lg" />
                                            }
                                            isActive={selectedAiMetrics.includes(opt.key)}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            {AI_METRIC_OPTIONS.map((opt) => (
                                <button
                                    key={opt.key}
                                    type="button"
                                    className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors duration-150 ${
                                        selectedAiMetrics.includes(opt.key)
                                            ? "bg-[var(--color-primary-searchmind)] text-white border-[var(--color-primary-searchmind)]"
                                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-100"
                                    }`}
                                    onClick={() =>
                                        setSelectedAiMetrics((prev) => {
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
                        <GraphCard
                            title={
                                selectedAiMetrics.length === 1
                                    ? `${aiChartDataMap[selectedAiMetrics[0]].name} over time`
                                    : "AI performance metrics over time"
                            }
                            chartOptions={aiChartOptions}
                            chartSeries={aiChartSeries}
                        />

                        <div className="mt-6 border border-gray-200 rounded-xl bg-white p-6">
                            <h3 className="text-sm font-semibold text-gray-900 mb-3">Grounding queries</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium text-gray-700">Grounding query</th>
                                            <th className="px-4 py-2 text-right font-medium text-gray-700">Citations</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groundingRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={2} className="px-4 py-8 text-center text-gray-500">
                                                    No grounding query data yet. Use{" "}
                                                    {portalUrl ? (
                                                        <a
                                                            href={portalUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[var(--color-primary-searchmind)] underline font-medium"
                                                        >
                                                            AI Performance in Bing
                                                        </a>
                                                    ) : (
                                                        "AI Performance in Bing"
                                                    )}{" "}
                                                    for live reporting.
                                                </td>
                                            </tr>
                                        ) : (
                                            groundingRows.map((row, i) => (
                                                <tr key={i} className="border-b border-gray-100 last:border-b-0">
                                                    <td className="px-4 py-2 text-gray-900">
                                                        {row.query ?? row.groundingQuery ?? "—"}
                                                    </td>
                                                    <td className="px-4 py-2 text-right tabular-nums">
                                                        {formatNumber(row.citations ?? row.citationCount)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>

                    {/* Disclaimer */}
                    <footer className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600">
                        {DISCLAIMER}
                    </footer>
                </>
            )}
        </div>
    );
}
