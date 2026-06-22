"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import DashboardHeading from "@/components/dashboard/DashboardHeading";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import MetricCard from "@/components/dashboard/MetricCard";
import GraphCard from "@/components/dashboard/GraphCard";
import CobaltLoader from "@/components/ui/CobaltLoader";
import { getCobaltChartBaseOptions } from "@/lib/charts/cobaltChartTheme";
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
import "./bing-webmaster-dashboard.css";

const SEARCH_METRIC_OPTIONS = [
    { key: "impressions", label: "Impressions", icon: FiEye },
    { key: "clicks", label: "Clicks", icon: FiMousePointer },
    { key: "ctr", label: "CTR", icon: FiPercent },
];

const AI_METRIC_OPTIONS = [
    { key: "totalCitations", label: "Total Citations", icon: FiBookmark },
    { key: "avgCitedPages", label: "Avg. Cited Pages", icon: FiFileText },
];

const CHART_COLORS = {
    impressions: "#213b34",
    clicks: "#3d6b5e",
    ctr: "#5c756a",
    totalCitations: "#213b34",
    avgCitedPages: "#3d6b5e",
};

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
    "Microsoft has not published a public JSON API for AI Performance (total citations, avg cited pages, grounding queries). Live accounts see placeholder series until an endpoint is available. Use Open in Bing Webmaster for live AI reporting.";

function toggleMetric(prev, key) {
    if (prev.includes(key)) {
        return prev.length > 1 ? prev.filter((m) => m !== key) : prev;
    }
    return [...prev, key];
}

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

    const searchChartDataMap = useMemo(
        () => ({
            impressions: {
                name: "Impressions",
                data: traffic.map((r) => r.impressions ?? 0),
                color: CHART_COLORS.impressions,
            },
            clicks: {
                name: "Clicks",
                data: traffic.map((r) => r.clicks ?? 0),
                color: CHART_COLORS.clicks,
            },
            ctr: {
                name: "CTR %",
                data: traffic.map((r) => calcCtr(r.clicks, r.impressions)),
                color: CHART_COLORS.ctr,
            },
        }),
        [traffic]
    );

    const searchChartSeries = selectedSearchMetrics.map((k) => searchChartDataMap[k]);

    const searchChartOptions = useMemo(() => {
        const cobaltBase = getCobaltChartBaseOptions();
        return {
            ...cobaltBase,
            chart: { ...cobaltBase.chart, id: "bing-search-performance" },
            xaxis: {
                ...cobaltBase.xaxis,
                categories: traffic.map((r) => r.date),
                labels: { ...cobaltBase.xaxis?.labels, rotate: -45 },
            },
            colors: selectedSearchMetrics.map((k) => searchChartDataMap[k].color),
            stroke: { curve: "smooth", width: 2 },
            legend: { show: true, position: "top" },
            tooltip: { shared: true },
            dataLabels: { enabled: false },
        };
    }, [traffic, selectedSearchMetrics, searchChartDataMap]);

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

    const aiChartDataMap = useMemo(
        () => ({
            totalCitations: {
                name: "Total Citations",
                data: aiSeries.map((r) => r.totalCitations ?? 0),
                color: CHART_COLORS.totalCitations,
            },
            avgCitedPages: {
                name: "Avg. Cited Pages",
                data: aiSeries.map((r) => r.avgCitedPages ?? 0),
                color: CHART_COLORS.avgCitedPages,
            },
        }),
        [aiSeries]
    );

    const aiChartSeries = selectedAiMetrics.map((k) => aiChartDataMap[k]);

    const aiChartOptions = useMemo(() => {
        const cobaltBase = getCobaltChartBaseOptions();
        return {
            ...cobaltBase,
            chart: { ...cobaltBase.chart, id: "bing-ai-performance" },
            xaxis: {
                ...cobaltBase.xaxis,
                categories: aiSeries.map((r) => r.date),
                labels: { ...cobaltBase.xaxis?.labels, rotate: -45 },
            },
            colors: selectedAiMetrics.map((k) => aiChartDataMap[k].color),
            stroke: { curve: "smooth", width: 2 },
            legend: { show: true, position: "top" },
            tooltip: { shared: true },
            dataLabels: { enabled: false },
        };
    }, [aiSeries, selectedAiMetrics, aiChartDataMap]);

    const siteLabel = data?.siteUrl || "—";

    const buildSearchMetricCard = (opt) => {
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
                className="apex-bwm-kpi-card"
                tabIndex={0}
                role="button"
                aria-pressed={selectedSearchMetrics.includes(opt.key)}
                onClick={() => setSelectedSearchMetrics((prev) => toggleMetric(prev, opt.key))}
                onKeyDown={(e) =>
                    (e.key === "Enter" || e.key === " ") &&
                    setSelectedSearchMetrics((prev) => toggleMetric(prev, opt.key))
                }
            >
                <MetricCard
                    variant="cobalt"
                    label={opt.label}
                    value={value}
                    unit={unit}
                    icon={<Icon className="text-[var(--color-accent-light)] text-lg" />}
                    isActive={selectedSearchMetrics.includes(opt.key)}
                />
            </div>
        );
    };

    const buildAiMetricCard = (opt) => {
        let value;
        let unit;
        if (opt.key === "totalCitations") value = formatNumber(totalAiCitations);
        if (opt.key === "avgCitedPages") value = avgAiPages;
        const Icon = opt.icon;
        return (
            <div
                key={opt.key}
                className="apex-bwm-kpi-card"
                tabIndex={0}
                role="button"
                aria-pressed={selectedAiMetrics.includes(opt.key)}
                onClick={() => setSelectedAiMetrics((prev) => toggleMetric(prev, opt.key))}
                onKeyDown={(e) =>
                    (e.key === "Enter" || e.key === " ") &&
                    setSelectedAiMetrics((prev) => toggleMetric(prev, opt.key))
                }
            >
                <MetricCard
                    variant="cobalt"
                    label={opt.label}
                    value={value}
                    unit={unit}
                    icon={<Icon className="text-[var(--color-accent-light)] text-lg" />}
                    isActive={selectedAiMetrics.includes(opt.key)}
                />
            </div>
        );
    };

    return (
        <div id="BingWebmasterPage" className="cobalt-perf w-full apex-bwm-stack" data-theme="cobalt">
            <DashboardHeading
                variant="cobalt"
                showRunAudit={false}
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
                        variant="cobalt"
                        loading={loading}
                        onApply={handleDateRangeApply}
                        startDate={tempRange.startDate}
                        endDate={tempRange.endDate}
                        onStartDateChange={(d) => setTempRange((r) => ({ ...r, startDate: d }))}
                        onEndDateChange={(d) => setTempRange((r) => ({ ...r, endDate: d }))}
                    />
                }
            />

            {loading ? (
                <div className="apex-perf-loading">
                    <CobaltLoader
                        variant="block"
                        title="Loading Bing Webmaster data"
                        request="GET /api/bing-webmaster/site-data"
                    />
                </div>
            ) : error ? (
                <div className="apex-bwm-error">{error}</div>
            ) : (
                <div className="apex-bwm-panel">
                    <section className="apex-bwm-section">
                        <div className="apex-bwm-section__head">
                            <div>
                                <h3 className="apex-bwm-section__label">Organic search</h3>
                                <h2 className="apex-bwm-section__title">Search performance</h2>
                                <p className="apex-bwm-section__subtitle">
                                    Bing search impressions and clicks for your verified property.
                                </p>
                            </div>
                        </div>

                        <div className="apex-bwm-kpi-grid apex-bwm-kpi-grid--3">
                            {SEARCH_METRIC_OPTIONS.map(buildSearchMetricCard)}
                        </div>

                        <div className="apex-bwm-chart-block">
                            <GraphCard
                                variant="cobalt"
                                title={
                                    selectedSearchMetrics.length === 1
                                        ? `${searchChartDataMap[selectedSearchMetrics[0]].name} over time`
                                        : "Search metrics over time"
                                }
                                chartOptions={searchChartOptions}
                                chartSeries={searchChartSeries}
                            />
                        </div>

                        <div className="apex-bwm-table-panel">
                            <h3 className="apex-bwm-table-panel__title">Daily search activity</h3>
                            <div className="apex-bwm-table-wrap">
                                <table className="apex-bwm-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th className="is-num">Impressions</th>
                                            <th className="is-num">Clicks</th>
                                            <th className="is-num">CTR</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {traffic.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="apex-bwm-empty">
                                                    No traffic rows for this date range.
                                                </td>
                                            </tr>
                                        ) : (
                                            [...traffic].reverse().map((row) => (
                                                <tr key={row.date}>
                                                    <td className="is-brand">{row.date}</td>
                                                    <td className="is-num">{formatNumber(row.impressions)}</td>
                                                    <td className="is-num">{formatNumber(row.clicks)}</td>
                                                    <td className="is-num">
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

                    <section className="apex-bwm-section">
                        <div className="apex-bwm-section__head">
                            <div>
                                <h3 className="apex-bwm-section__label">Index health</h3>
                                <h2 className="apex-bwm-section__title">Crawl &amp; index</h2>
                                <p className="apex-bwm-section__subtitle">
                                    How Bing crawls and indexes your site.
                                </p>
                            </div>
                            {propertyUrl ? (
                                <a
                                    href={propertyUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="apex-bwm-link-btn"
                                >
                                    Open site in Bing Webmaster
                                    <FiExternalLink className="w-4 h-4" />
                                </a>
                            ) : null}
                        </div>

                        {data?.crawlError ? (
                            <p className="apex-bwm-warn">Crawl stats could not be loaded: {data.crawlError}</p>
                        ) : null}

                        <div className="apex-bwm-kpi-grid apex-bwm-kpi-grid--4">
                            <MetricCard
                                variant="cobalt"
                                label="Pages in index"
                                value={formatNumber(crawlLatest?.inIndex)}
                                icon={<FiLayers className="text-[var(--color-accent-light)] text-lg" />}
                            />
                            <MetricCard
                                variant="cobalt"
                                label="Pages crawled"
                                value={formatNumber(crawlLatest?.crawledPages)}
                                icon={<FiServer className="text-[var(--color-accent-light)] text-lg" />}
                            />
                            <MetricCard
                                variant="cobalt"
                                label="Crawl errors"
                                value={formatNumber(crawlLatest?.crawlErrors)}
                                icon={<FiShield className="text-[var(--color-accent-light)] text-lg" />}
                            />
                            <MetricCard
                                variant="cobalt"
                                label="Inlinks discovered"
                                value={formatNumber(crawlLatest?.inLinks)}
                                icon={<FiLayers className="text-[var(--color-accent-light)] text-lg" />}
                            />
                        </div>
                        <p className="apex-bwm-footnote">
                            {crawlLatest?.date
                                ? `Latest crawl stats row: ${crawlLatest.date}. Bing updates daily.`
                                : "No crawl stats returned yet for this property."}
                        </p>
                    </section>

                    <section className="apex-bwm-section">
                        <div className="apex-bwm-section__head">
                            <div>
                                <h3 className="apex-bwm-section__label">Copilot &amp; Bing AI</h3>
                                <h2 className="apex-bwm-section__title">AI Performance</h2>
                                <p className="apex-bwm-section__subtitle">
                                    Citations in Copilot and Bing AI experiences. Demo accounts show sample
                                    series; live accounts use placeholder data until Microsoft ships an API.
                                </p>
                            </div>
                            {portalUrl ? (
                                <a
                                    href={portalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="apex-bwm-link-btn"
                                >
                                    Open AI Performance
                                    <FiExternalLink className="w-4 h-4" />
                                </a>
                            ) : null}
                        </div>

                        <div className="apex-bwm-kpi-grid apex-bwm-kpi-grid--2">
                            {AI_METRIC_OPTIONS.map(buildAiMetricCard)}
                        </div>

                        <div className="apex-bwm-chart-block">
                            <GraphCard
                                variant="cobalt"
                                title={
                                    selectedAiMetrics.length === 1
                                        ? `${aiChartDataMap[selectedAiMetrics[0]].name} over time`
                                        : "AI performance metrics over time"
                                }
                                chartOptions={aiChartOptions}
                                chartSeries={aiChartSeries}
                            />
                        </div>

                        <div className="apex-bwm-table-panel">
                            <h3 className="apex-bwm-table-panel__title">Grounding queries</h3>
                            <div className="apex-bwm-table-wrap">
                                <table className="apex-bwm-table">
                                    <thead>
                                        <tr>
                                            <th>Grounding query</th>
                                            <th className="is-num">Citations</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groundingRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={2} className="apex-bwm-empty">
                                                    No grounding query data yet. Use{" "}
                                                    {portalUrl ? (
                                                        <a href={portalUrl} target="_blank" rel="noopener noreferrer">
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
                                                <tr key={i}>
                                                    <td className="is-brand">
                                                        {row.query ?? row.groundingQuery ?? "—"}
                                                    </td>
                                                    <td className="is-num">
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

                    <footer className="apex-bwm-disclaimer">{DISCLAIMER}</footer>
                </div>
            )}
        </div>
    );
}
