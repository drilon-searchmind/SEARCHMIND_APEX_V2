"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import dayjs from "dayjs";
import {
    FiEye,
    FiMousePointer,
    FiPercent,
    FiTrendingUp,
    FiDollarSign,
    FiShoppingCart,
    FiCalendar,
    FiLink2,
    FiAward,
} from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
import CobaltLoader from "@/components/ui/CobaltLoader";
import SeoAppliedFilterBadges from "@/components/seo/SeoAppliedFilterBadges";
import { COMMERCE_CHART_CHROME, METRIC_CHART_PALETTE } from "@/components/dashboard/chartColors";
import { hexWithAlpha } from "@/lib/charts/chartSeriesColors";
import {
    formatComparisonPeriodDates,
    resolveDailyComparisonDate,
    COMPARISON_METHOD,
} from "@/lib/dateRangeComparison";
import {
    buildSeoSummary,
    getDailyMetricValue,
    normalizeSeriesValues,
    SEO_CHART_METRIC_LABELS,
} from "@/lib/seoDashboardUtils";
import {
    notableDays,
    positionDistribution,
    weekdayPattern,
    winnersAndLosers,
} from "@/lib/seoAnalytics";
import { CHART_SERIES_KEYS } from "./seoDashboardConfig";
import {
    SEO_COLORS,
    SeoDonut,
    SeoKpi,
    DeltaChip,
    compact,
    fmtDec,
    fmtInt,
    fmtKr,
    fmtPctPoints,
    fmtShare,
    isNum,
    num,
    vsCaption,
} from "./SeoParts";

/** Metrics the trend chart can show, in toggle order. */
const CHART_CHIPS = [
    { key: "clicks", label: "Clicks" },
    { key: "impressions", label: "Impressions" },
    { key: "ctr", label: "CTR" },
    { key: "position", label: "Avg. position" },
    { key: "organic_revenue", label: "Organic revenue" },
    { key: "organic_conversions", label: "Conversions" },
    { key: "spend_saved", label: "Spend saved" },
];

/** Rank bands from best to worst (DESIGN.md funnel steps). */
const BAND_COLORS = ["#111A12", "#2F8434", "#5DBB58", "#A9EDA2"];

function formatMetric(key, value) {
    if (!isNum(value)) return "-";
    if (key === "ctr") return fmtPctPoints(value, 2);
    if (key === "position") return fmtDec(value, 1);
    if (key === "organic_revenue" || key === "spend_saved") return fmtKr(value);
    return fmtInt(value);
}

export default function SeoDefaultTab({
    active,
    siteUrl,
    customerId,
    appliedRange,
    appliedCompareRange,
    comparisonMethod,
    comparisonLabel,
    onLoadingChange,
    onLedeChange,
    keywordSettingsVersion = 0,
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [metrics, setMetrics] = useState([]);
    const [metricsPrev, setMetricsPrev] = useState([]);
    const [keywords, setKeywords] = useState([]);
    const [keywordsPrev, setKeywordsPrev] = useState([]);
    const [supplemental, setSupplemental] = useState(null);
    const [supplementalPrev, setSupplementalPrev] = useState(null);
    const [selectedMetrics, setSelectedMetrics] = useState(["clicks"]);
    const [brandKeywords, setBrandKeywords] = useState([]);
    const [appliedFilters, setAppliedFilters] = useState([]);
    const [hoverMix, setHoverMix] = useState(null);

    useEffect(() => {
        onLoadingChange?.(loading);
    }, [loading, onLoadingChange]);

    const fetchBrandKeywords = useCallback(async () => {
        if (!customerId) return;
        try {
            const brandRes = await fetch(`/api/seo-keywords/brand/${customerId}`);
            const brandData = await brandRes.json();
            setBrandKeywords(
                brandData.success && brandData.data?.isActive && brandData.data?.keywords
                    ? brandData.data.keywords
                    : []
            );
        } catch {
            setBrandKeywords([]);
        }
    }, [customerId]);

    useEffect(() => {
        if (active) fetchBrandKeywords();
    }, [active, fetchBrandKeywords, keywordSettingsVersion]);

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
        if (!active) return undefined;
        if (!siteUrl) return undefined;
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
                setAppliedFilters(current.appliedFilters || []);

                if (!compDates.skip && compDates.startDate && compDates.endDate) {
                    const prev = await fetchSeoMetrics(compDates.startDate, compDates.endDate);
                    if (!cancelled) {
                        setMetricsPrev(prev.metrics?.rows || []);
                        setKeywordsPrev(prev.keywords?.rows || []);
                        setSupplementalPrev(prev.supplemental || null);
                    }
                } else {
                    setMetricsPrev([]);
                    setKeywordsPrev([]);
                    setSupplementalPrev(null);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e.message);
                    setMetrics([]);
                    setMetricsPrev([]);
                    setKeywords([]);
                    setKeywordsPrev([]);
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
        active,
        siteUrl,
        appliedRange.startDate,
        appliedRange.endDate,
        appliedCompareRange,
        comparisonMethod,
        fetchSeoMetrics,
        keywordSettingsVersion,
    ]);

    const hasPrev = comparisonMethod !== COMPARISON_METHOD.NONE && metricsPrev.length > 0;
    const vs = vsCaption(comparisonLabel);

    const summary = useMemo(
        () => buildSeoSummary(metrics, supplemental, keywords, brandKeywords),
        [metrics, supplemental, keywords, brandKeywords]
    );
    const prev = useMemo(
        () => (hasPrev ? buildSeoSummary(metricsPrev, supplementalPrev, keywordsPrev, brandKeywords) : {}),
        [hasPrev, metricsPrev, supplementalPrev, keywordsPrev, brandKeywords]
    );
    const pv = (key) => (hasPrev ? prev[key] : null);

    // Heading summary line
    useEffect(() => {
        if (!active || loading || error || !metrics.length) {
            onLedeChange?.(null);
            return;
        }
        const parts = [`Organic search brought ${fmtInt(summary.clicks)} clicks`];
        if (hasPrev && num(prev.clicks) > 0) {
            const pct = ((summary.clicks - prev.clicks) / prev.clicks) * 100;
            parts[0] += ` (${pct > 0 ? "+" : ""}${fmtDec(pct, 1)}% ${vs})`;
        }
        parts[0] += ` at average position ${fmtDec(summary.position, 1)}.`;
        // fmtKr already ends with "kr.", so no extra full stop here
        if (isNum(summary.organic_revenue)) parts.push(`Organic revenue was ${fmtKr(summary.organic_revenue)}`);
        onLedeChange?.(parts.join(" "));
    }, [active, loading, error, metrics.length, summary, prev, hasPrev, vs, onLedeChange]);

    const dist = useMemo(() => positionDistribution(keywords), [keywords]);
    const movers = useMemo(() => winnersAndLosers(keywords, keywordsPrev, 5), [keywords, keywordsPrev]);
    const weekdays = useMemo(() => weekdayPattern(metrics), [metrics]);
    const notable = useMemo(() => notableDays(metrics), [metrics]);
    const topKeywords = useMemo(
        () => [...keywords].sort((a, b) => num(b.clicks) - num(a.clicks)).slice(0, 8),
        [keywords]
    );

    // ── Trend chart ──
    const chartMetricKeys = selectedMetrics.filter((k) => CHART_SERIES_KEYS.has(k));
    const single = chartMetricKeys.length === 1;

    const chart = useMemo(() => {
        const dates = metrics.map((r) => r.keys?.[0]).filter(Boolean);
        const prevByDate = Object.fromEntries((metricsPrev || []).map((r) => [r.keys?.[0], r]));
        const sortedPrevDates = (metricsPrev || []).map((r) => r.keys?.[0]).filter(Boolean).sort();
        const byDate = Object.fromEntries(metrics.map((r) => [r.keys?.[0], r]));
        const series = [];
        const meta = [];
        chartMetricKeys.forEach((key, idx) => {
            const label = CHART_CHIPS.find((c) => c.key === key)?.label || SEO_CHART_METRIC_LABELS[key] || key;
            const curRaw = dates.map((d) => getDailyMetricValue(byDate[d], key, supplemental, d));
            series.push({
                name: label,
                type: single ? "area" : "line",
                data: single ? curRaw : normalizeSeriesValues(curRaw),
            });
            meta.push({ key, raw: curRaw, color: METRIC_CHART_PALETTE[idx % METRIC_CHART_PALETTE.length], prev: false });
            if (hasPrev) {
                const prevRaw = dates.map((d) => {
                    const prevDate = resolveDailyComparisonDate({
                        comparisonMethod,
                        currentDate: d,
                        appliedStartDate: appliedRange.startDate,
                        appliedEndDate: appliedRange.endDate,
                        sortedPrevKeys: sortedPrevDates,
                    });
                    const row = prevDate ? prevByDate[prevDate] : null;
                    return getDailyMetricValue(row, key, supplementalPrev, prevDate);
                });
                series.push({
                    name: `${label} (${vs.replace("vs ", "")})`,
                    type: "line",
                    data: single ? prevRaw : normalizeSeriesValues(prevRaw),
                });
                meta.push({ key, raw: prevRaw, color: METRIC_CHART_PALETTE[idx % METRIC_CHART_PALETTE.length], prev: true });
            }
        });

        const colors = meta.map((m) => (m.prev ? hexWithAlpha(m.color, 0.5) : m.color));
        const reversed = single && chartMetricKeys[0] === "position";
        const options = {
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: COMMERCE_CHART_CHROME.fontFamily },
            colors,
            stroke: { width: meta.map((m) => (m.prev ? 1.6 : 2.2)), curve: "smooth", dashArray: meta.map((m) => (m.prev ? 4 : 0)) },
            fill: { type: "solid", opacity: meta.map((m, i) => (single && !m.prev && i === 0 ? 0.1 : 1)) },
            markers: { size: 0, hover: { size: 5 }, colors: colors.map(() => "#ffffff"), strokeColors: colors, strokeWidth: 2 },
            xaxis: {
                categories: dates,
                tickAmount: 8,
                labels: {
                    rotate: 0,
                    hideOverlappingLabels: true,
                    style: { colors: COMMERCE_CHART_CHROME.axisLabel },
                    formatter: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? dayjs(v).format("D MMM") : v),
                },
                axisTicks: { show: false },
                axisBorder: { show: true, color: COMMERCE_CHART_CHROME.grid },
                tooltip: { enabled: false },
            },
            yaxis: single
                ? {
                      reversed,
                      tickAmount: 4,
                      forceNiceScale: true,
                      min: chartMetricKeys[0] === "position" ? undefined : 0,
                      labels: {
                          formatter: (v) =>
                              chartMetricKeys[0] === "ctr"
                                  ? `${fmtDec(v, 1)}%`
                                  : chartMetricKeys[0] === "position"
                                    ? fmtDec(v, 0)
                                    : compact(v),
                      },
                  }
                : { min: 0, max: 100, tickAmount: 4, labels: { formatter: (v) => `${Math.round(v)}%` } },
            grid: { borderColor: COMMERCE_CHART_CHROME.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
            dataLabels: { enabled: false },
            legend: { show: true, position: "top", horizontalAlign: "left" },
            tooltip: {
                theme: "dark",
                shared: true,
                intersect: false,
                x: { formatter: (v, o) => (dates[o?.dataPointIndex] ? dayjs(dates[o.dataPointIndex]).format("ddd, D MMM") : v) },
                y: {
                    formatter: (_val, o) => {
                        const m = meta[o?.seriesIndex];
                        const raw = m?.raw?.[o?.dataPointIndex];
                        return raw == null ? "-" : formatMetric(m.key, raw);
                    },
                },
            },
        };
        return { series, options };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [metrics, metricsPrev, supplemental, supplementalPrev, selectedMetrics, hasPrev, comparisonMethod, appliedRange.startDate, appliedRange.endDate, vs]);

    const toggleMetric = (key) =>
        setSelectedMetrics((cur) => {
            if (cur.includes(key)) return cur.length > 1 ? cur.filter((k) => k !== key) : cur;
            return [...cur, key];
        });

    if (!active) return null;

    if (!siteUrl) {
        return (
            <div className="apex-seo-alert">
                Add a Google Search Console property in Property Settings to load SEO metrics.
            </div>
        );
    }
    if (loading) {
        return (
            <div className="apex-perf-loading">
                <CobaltLoader variant="block" title="Loading SEO metrics" request="POST /api/seo-dashboard/metrics" />
            </div>
        );
    }
    if (error) return <div className="apex-seo-error">{error}</div>;
    if (!metrics.length) return <div className="apex-seo-alert">No Search Console data for this period.</div>;

    const brandShare = isNum(summary.brand_traffic_share) ? summary.brand_traffic_share / 100 : null;
    const mixItems =
        brandShare != null
            ? [
                  { id: "nonBrand", name: "Non-branded", value: 1 - brandShare, color: SEO_COLORS.nonBrand },
                  { id: "brand", name: "Branded", value: brandShare, color: SEO_COLORS.brand },
              ]
            : [];
    const mixFocus = mixItems.find((i) => i.id === hoverMix) || mixItems[0];
    const convRate = summary.organic_conv_rate;

    return (
        <div className="apex-sx-stack">
            <SeoAppliedFilterBadges sectionId="default-kpis" appliedFilters={appliedFilters} />

            <div className="apex-ov-grid apex-ov-grid--hero">
                <SeoKpi hero label="Organic clicks" value={fmtInt(summary.clicks)} cur={summary.clicks} prev={pv("clicks")} vs={vs} caption="From Google Search" />
                <SeoKpi label="Impressions" icon={FiEye} value={fmtInt(summary.impressions)} cur={summary.impressions} prev={pv("impressions")} vs={vs} caption="Times shown in results" />
                <SeoKpi label="Avg. position" icon={FiTrendingUp} value={fmtDec(summary.position, 1)} cur={summary.position} prev={pv("position")} mode="pos" vs={vs} caption="Lower is better" />
                <SeoKpi label="CTR" icon={FiPercent} value={fmtDec(summary.ctr, 2)} unit="%" cur={summary.ctr} prev={pv("ctr")} vs={vs} caption="Clicks per impression" />
            </div>

            <div className="apex-ov-grid apex-sx-grid-4">
                <SeoKpi
                    label="Organic revenue"
                    icon={FiDollarSign}
                    value={isNum(summary.organic_revenue) ? fmtInt(summary.organic_revenue) : "-"}
                    unit="kr."
                    cur={summary.organic_revenue}
                    prev={pv("organic_revenue")}
                    vs={vs}
                    caption={isNum(summary.organic_revenue) ? "From organic sessions (GA4)" : "Needs a GA4 property"}
                />
                <SeoKpi
                    label="Organic conversions"
                    icon={FiShoppingCart}
                    value={fmtInt(summary.organic_conversions)}
                    cur={summary.organic_conversions}
                    prev={pv("organic_conversions")}
                    vs={vs}
                    caption={isNum(convRate) ? `${fmtDec(convRate, 2)}% of clicks convert` : "Needs a GA4 property"}
                />
                <SeoKpi
                    label="Spend saved"
                    icon={FiCalendar}
                    value={isNum(summary.spend_saved) ? fmtInt(summary.spend_saved) : "-"}
                    unit="kr."
                    cur={summary.spend_saved}
                    prev={pv("spend_saved")}
                    vs={vs}
                    caption={isNum(summary.avg_cpc) ? `Clicks at your avg. CPC of ${fmtDec(summary.avg_cpc, 2)} kr.` : "Needs Google Ads CPC data"}
                />
                <SeoKpi
                    label="Revenue per click"
                    icon={FiMousePointer}
                    value={isNum(summary.revenue_per_click) ? fmtDec(summary.revenue_per_click, 2) : "-"}
                    unit="kr."
                    cur={summary.revenue_per_click}
                    prev={pv("revenue_per_click")}
                    vs={vs}
                    caption="Organic revenue per click"
                />
            </div>

            <section className="apex-ov-card apex-sx-chartcard">
                <div className="apex-ov-card__head">
                    <h3>Performance over time</h3>
                    <div className="apex-sx-chips" role="group" aria-label="Chart metrics">
                        {CHART_CHIPS.map((c) => (
                            <button
                                key={c.key}
                                type="button"
                                className={`apex-perf-chip${selectedMetrics.includes(c.key) ? " is-active" : ""}`}
                                aria-pressed={selectedMetrics.includes(c.key)}
                                onClick={() => toggleMetric(c.key)}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>
                <GraphCard
                    key={`chart-${chartMetricKeys.join("|")}`}
                    variant="cobalt"
                    hideChartToggle
                    title=""
                    chartType="line"
                    height={300}
                    chartOptions={chart.options}
                    chartSeries={chart.series}
                />
                <p className="apex-mk-note">
                    {single
                        ? "Select more metrics to compare them. With several selected, each is scaled to its own maximum (0 to 100%) so the curves share one axis; hover for the real values."
                        : "Each metric is scaled to its own maximum so the curves are comparable. Hover for the real values."}
                </p>
            </section>

            <div className="apex-ov-grid apex-sx-split">
                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>Where you rank</h3>
                        <span className="apex-ov-sub">{fmtInt(dist.totalKeywords)} keywords with impressions</span>
                    </div>
                    <div className="apex-sx-bands">
                        {dist.bands.map((b, i) => (
                            <div key={b.id} className="apex-sx-band">
                                <div className="apex-sx-band__top">
                                    <span className="apex-sx-band__name">
                                        <i style={{ background: BAND_COLORS[i] }} aria-hidden />
                                        {b.label}
                                    </span>
                                    <span>
                                        <b>{fmtInt(b.keywords)}</b> keywords
                                    </span>
                                </div>
                                <div className="apex-ov-bar">
                                    <i style={{ width: `${b.keywordShare * 100}%`, background: BAND_COLORS[i] }} />
                                </div>
                                <div className="apex-sx-band__cap">
                                    {fmtShare(b.clickShare)} of clicks, {fmtInt(b.clicks)} clicks
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="apex-mk-note">Based on the top keywords Search Console reports for the period. Position bands use each keyword&apos;s average position.</p>
                </section>

                <div className="apex-sx-col">
                    <section className="apex-ov-card">
                        <div className="apex-ov-card__head">
                            <h3>Brand mix</h3>
                            {brandShare != null && hasPrev && isNum(pv("brand_traffic_share")) ? (
                                <DeltaChip cur={summary.brand_traffic_share} prev={prev.brand_traffic_share} neutral compactSize />
                            ) : null}
                        </div>
                        {brandShare != null ? (
                            <div className="apex-sx-mix">
                                <SeoDonut
                                    items={mixItems}
                                    centerSmall={mixFocus?.name}
                                    centerBig={fmtShare(mixFocus?.value, 0)}
                                    active={hoverMix}
                                    onHover={setHoverMix}
                                />
                                <div className="apex-sx-mix__list">
                                    {mixItems.map((m) => (
                                        <div key={m.id} className="apex-sx-mix__row" onMouseEnter={() => setHoverMix(m.id)} onMouseLeave={() => setHoverMix(null)}>
                                            <i style={{ background: m.color }} aria-hidden />
                                            <span>{m.name}</span>
                                            <b>{fmtShare(m.value, 0)}</b>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="apex-mk-note apex-sx-empty-note">
                                Add your brand terms in the keyword settings below to see how much traffic comes from people who already know you.
                            </p>
                        )}
                    </section>

                    <section className="apex-ov-card">
                        <div className="apex-ov-card__head">
                            <h3>Authority</h3>
                            <span className="apex-ov-sub">Ahrefs</span>
                        </div>
                        <div className="apex-sx-auth">
                            <div className="apex-sx-auth__tile">
                                <span className="apex-ov-ic"><FiAward aria-hidden /></span>
                                <small>Domain rating</small>
                                <b>{isNum(summary.domain_rating) ? fmtInt(summary.domain_rating) : "-"}</b>
                            </div>
                            <div className="apex-sx-auth__tile">
                                <span className="apex-ov-ic"><FiLink2 aria-hidden /></span>
                                <small>Backlinks</small>
                                <b>{isNum(summary.backlinks) ? fmtInt(summary.backlinks) : "-"}</b>
                                <DeltaChip cur={summary.backlinks} prev={pv("backlinks")} compactSize />
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            <div className="apex-ov-grid apex-sx-split">
                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>{hasPrev ? "Winners and losers" : "Top keywords"}</h3>
                        <span className="apex-ov-sub">{hasPrev ? `Click change ${vs}` : "By clicks, selected period"}</span>
                    </div>
                    {hasPrev ? (
                        <div className="apex-sx-movers">
                            {[
                                { id: "win", title: "Gaining", rows: movers.winners, tone: "up" },
                                { id: "lose", title: "Losing", rows: movers.losers, tone: "down" },
                            ].map((col) => (
                                <div key={col.id} className="apex-sx-movers__col">
                                    <div className="apex-sx-movers__title">{col.title}</div>
                                    {col.rows.length === 0 ? (
                                        <p className="apex-mk-note">No keywords {col.id === "win" ? "gained" : "lost"} clicks.</p>
                                    ) : (
                                        col.rows.map((r) => (
                                            <div key={r.keyword} className="apex-sx-mover">
                                                <span className="apex-sx-mover__kw" title={r.keyword}>
                                                    {r.keyword}
                                                    {r.isNew ? <em>new</em> : null}
                                                    {r.isLost ? <em>no clicks</em> : null}
                                                </span>
                                                <span className="apex-sx-mover__now">{fmtInt(r.clicks)}</span>
                                                <span className={`apex-sx-mover__delta is-${col.tone}`}>
                                                    {r.delta > 0 ? "+" : "-"}
                                                    {fmtInt(Math.abs(r.delta))}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="apex-mk-tbl-wrap">
                            <table className="apex-sx-tbl">
                                <thead>
                                    <tr>
                                        <th>Keyword</th>
                                        <th>Clicks</th>
                                        <th>Position</th>
                                        <th>CTR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topKeywords.map((r) => (
                                        <tr key={r.keys[0]}>
                                            <td>{r.keys[0]}</td>
                                            <td>{fmtInt(r.clicks)}</td>
                                            <td>{fmtDec(r.position, 1)}</td>
                                            <td>{fmtDec(num(r.clicks) / Math.max(1, num(r.impressions)) * 100, 2)}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>Weekly rhythm</h3>
                        <span className="apex-ov-sub">Avg. clicks per weekday</span>
                    </div>
                    {weekdays.enough ? (
                        <>
                            <div className="apex-sx-week">
                                {weekdays.days.map((d) => (
                                    <div key={d.label} className={`apex-sx-week__day${d.isBest ? " is-best" : ""}`} title={`${d.label}: ${fmtInt(d.avg)} clicks on average`}>
                                        <span className="apex-sx-week__val">{compact(d.avg)}</span>
                                        <div className="apex-sx-week__bar">
                                            <i style={{ height: `${Math.max(4, d.index * 100)}%` }} />
                                        </div>
                                        <span className="apex-sx-week__lbl">{d.label}</span>
                                    </div>
                                ))}
                            </div>
                            {notable.enough && (notable.spikes.length > 0 || notable.dips.length > 0) ? (
                                <div className="apex-sx-notable">
                                    {[...notable.spikes.map((d) => ({ ...d, kind: "up" })), ...notable.dips.map((d) => ({ ...d, kind: "down" }))].map((d) => (
                                        <div key={d.date} className="apex-sx-notable__row">
                                            <span>{dayjs(d.date).format("ddd, D MMM")}</span>
                                            <span className={`apex-sx-mover__delta is-${d.kind}`}>
                                                {d.kind === "up" ? "Spike" : "Dip"}: {fmtInt(d.clicks)} clicks
                                            </span>
                                        </div>
                                    ))}
                                    <p className="apex-mk-note">Days far from the period average (more than 1,8 standard deviations).</p>
                                </div>
                            ) : null}
                        </>
                    ) : (
                        <p className="apex-mk-note apex-sx-empty-note">Pick a range of at least two weeks to see which weekdays perform best.</p>
                    )}
                </section>
            </div>
        </div>
    );
}
