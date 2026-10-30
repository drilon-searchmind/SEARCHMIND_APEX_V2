"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { FiArrowRight, FiBarChart2, FiEye, FiMousePointer, FiPercent, FiPlay, FiShoppingBag, FiTarget, FiUsers } from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
import { COMMERCE_CHART_CHROME, METRIC_CHART_PALETTE } from "@/components/dashboard/chartColors";
import { hexWithAlpha } from "@/lib/charts/chartSeriesColors";
import { resolveDailyComparisonDate, COMPARISON_METHOD } from "@/lib/dateRangeComparison";
import { normalizeSeriesValues } from "@/lib/emDashboardUtils";
import { liWeekdays } from "@/lib/liAnalytics";
import { redAudienceRows, redStatus, summarizeRed, videoFunnel } from "@/lib/redAnalytics";
import { ServiceKpi, compact, fmtDec, fmtInt, fmtKr, fmtPctPoints, fmtShare, isNum, num, vsCaption } from "@/components/dashboard/ServiceParts";

const CHART_CHIPS = [
    { key: "ad_spend", label: "Spend" },
    { key: "clicks", label: "Clicks" },
    { key: "impressions", label: "Impressions" },
    { key: "ctr", label: "CTR" },
    { key: "cpc", label: "CPC" },
    { key: "cpm", label: "CPM" },
    { key: "purchases", label: "Purchases", needsPurchases: true },
    { key: "conversion_value", label: "Revenue", needsValue: true },
    { key: "roas", label: "ROAS", needsValue: true },
];

const MONEY_KEYS = new Set(["ad_spend", "conversion_value"]);
const VIDEO_COLORS = ["#111A12", "#2F8434", "#5DBB58", "#A9EDA2", "#C9E8C4"];

function dailyValue(row, key) {
    if (!row) return null;
    if (key === "ctr") return row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
    const v = row[key];
    return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function formatMetric(key, value) {
    if (!isNum(value)) return "-";
    if (key === "ad_spend" || key === "conversion_value") return fmtKr(value);
    if (key === "cpc" || key === "cpm") return `${fmtDec(value, 2)} kr.`;
    if (key === "roas") return fmtDec(value, 2);
    if (key === "ctr") return `${fmtDec(value, 2)}%`;
    return fmtInt(value);
}

function axisFormat(key, v) {
    if (key === "ctr") return `${fmtDec(v, 1)}%`;
    if (key === "roas" || key === "cpc" || key === "cpm") return fmtDec(v, 1);
    return compact(v);
}

export default function RedOverviewTab({ data, appliedRange, comparisonMethod, comparisonLabel, onLedeChange, onGoTo }) {
    const { metrics, metricsPrev, campaigns, account, audience } = data;
    const vs = vsCaption(comparisonLabel);
    const cur = useMemo(() => summarizeRed(metrics), [metrics]);
    const hasPrev = comparisonMethod !== COMPARISON_METHOD.NONE && metricsPrev.length > 0;
    const prev = useMemo(() => (hasPrev ? summarizeRed(metricsPrev) : null), [hasPrev, metricsPrev]);
    const pv = (key) => (prev ? prev[key] : null);

    const [selectedMetrics, setSelectedMetrics] = useState(() => (metrics.some((r) => num(r.conversion_value) > 0) ? ["ad_spend", "conversion_value"] : ["ad_spend"]));

    useEffect(() => {
        if (!cur) {
            onLedeChange?.(null);
            return;
        }
        let text = `Reddit spent ${fmtKr(cur.spend)} for ${fmtInt(cur.clicks)} clicks at ${fmtDec(cur.cpc, 2)} kr. each`;
        if (prev && num(prev.cpc) > 0 && num(cur.cpc) > 0) {
            const pct = ((cur.cpc - prev.cpc) / prev.cpc) * 100;
            text += ` (${pct > 0 ? "+" : ""}${fmtDec(pct, 1)}% ${vs})`;
        }
        onLedeChange?.(`${text}.`);
    }, [cur, prev, vs, onLedeChange]);

    const single = selectedMetrics.length === 1;
    const sharedAxis = !single && selectedMetrics.every((k) => MONEY_KEYS.has(k));
    const realValues = single || sharedAxis;

    const chart = useMemo(() => {
        const dates = metrics.map((r) => r.date);
        const byDate = Object.fromEntries(metrics.map((r) => [r.date, r]));
        const prevByDate = Object.fromEntries(metricsPrev.map((r) => [r.date, r]));
        const sortedPrevDates = metricsPrev.map((r) => r.date).sort();
        const series = [];
        const meta = [];
        selectedMetrics.forEach((key, idx) => {
            const label = CHART_CHIPS.find((c) => c.key === key)?.label || key;
            const color = METRIC_CHART_PALETTE[idx % METRIC_CHART_PALETTE.length];
            const curRaw = dates.map((d) => dailyValue(byDate[d], key));
            series.push({ name: label, type: single ? "area" : "line", data: realValues ? curRaw : normalizeSeriesValues(curRaw) });
            meta.push({ key, raw: curRaw, color, prev: false });
            if (hasPrev) {
                const prevRaw = dates.map((d) => {
                    const prevDate = resolveDailyComparisonDate({
                        comparisonMethod,
                        currentDate: d,
                        appliedStartDate: appliedRange.startDate,
                        appliedEndDate: appliedRange.endDate,
                        sortedPrevKeys: sortedPrevDates,
                    });
                    return dailyValue(prevDate ? prevByDate[prevDate] : null, key);
                });
                series.push({ name: `${label} (${(vs || "").replace("vs ", "")})`, type: "line", data: realValues ? prevRaw : normalizeSeriesValues(prevRaw) });
                meta.push({ key, raw: prevRaw, color, prev: true });
            }
        });
        const colors = meta.map((m) => (m.prev ? hexWithAlpha(m.color, 0.5) : m.color));
        const firstKey = selectedMetrics[0];
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
            yaxis: realValues
                ? { tickAmount: 4, forceNiceScale: true, min: 0, labels: { formatter: (v) => axisFormat(firstKey, v) } }
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
    }, [metrics, metricsPrev, selectedMetrics, single, realValues, hasPrev, comparisonMethod, appliedRange.startDate, appliedRange.endDate, vs]);

    const toggleMetric = (key) =>
        setSelectedMetrics((list) => {
            if (list.includes(key)) return list.length > 1 ? list.filter((k) => k !== key) : list;
            return [...list, key];
        });

    const video = useMemo(() => videoFunnel(account, cur?.impressions), [account, cur]);
    const weekdays = useMemo(() => liWeekdays(metrics, "clicks"), [metrics]);
    const communities = useMemo(() => redAudienceRows(audience?.community || [], { byPurchases: !!cur?.tracksPurchases }), [audience, cur]);
    const totals = useMemo(() => ({ spend: num(cur?.spend), impressions: num(cur?.impressions) }), [cur]);

    const topCommunities = useMemo(() => [...communities].filter((r) => r.impShare >= 0.02 && r.index != null).sort((a, b) => b.index - a.index).slice(0, 5), [communities]);

    const attention = useMemo(() => {
        const items = [];
        if (prev && num(prev.ctr) > 0) {
            const pct = ((cur.ctr - prev.ctr) / prev.ctr) * 100;
            if (pct <= -10) items.push({ id: "ctr", tone: "bad", text: `Click-through rate fell ${fmtDec(Math.abs(pct), 1)}% ${vs}, from ${fmtDec(prev.ctr, 2)}% to ${fmtDec(cur.ctr, 2)}%.` });
            else if (pct >= 10) items.push({ id: "ctr", tone: "ok", text: `Click-through rate is up ${fmtDec(pct, 1)}% ${vs}, from ${fmtDec(prev.ctr, 2)}% to ${fmtDec(cur.ctr, 2)}%.` });
        }
        if (prev && num(prev.cpc) > 0) {
            const pct = ((cur.cpc - prev.cpc) / prev.cpc) * 100;
            if (pct >= 15) items.push({ id: "cpc", tone: "warn", text: `Cost per click rose ${fmtDec(pct, 1)}% ${vs}, from ${fmtDec(prev.cpc, 2)} to ${fmtDec(cur.cpc, 2)} kr.` });
        }
        const weak = communities.filter((r) => r.verdict.label === "Under-indexes");
        if (weak.length > 0) {
            const spend = weak.reduce((s, r) => s + num(r.ad_spend), 0);
            items.push({ id: "communities", tone: "warn", text: `${fmtInt(weak.length)} ${weak.length === 1 ? "community clicks" : "communities click"} well under the account average and ${weak.length === 1 ? "takes" : "take"} ${fmtKr(spend)} of spend. They are candidates for the exclusion list.`, action: { label: "Open communities", tab: "communities" } });
        }
        const stat = campaigns.map((c) => ({ c, status: redStatus(c, cur, totals) }));
        const bad = stat.filter((x) => x.status.id === "weak" || x.status.id === "none");
        if (bad.length > 0) {
            const spend = bad.reduce((s, x) => s + num(x.c.ad_spend), 0);
            items.push({ id: "campaigns", tone: "warn", text: `${fmtInt(bad.length)} ${bad.length === 1 ? "campaign is" : "campaigns are"} well behind the account and ${bad.length === 1 ? "takes" : "take"} ${fmtShare(totals.spend > 0 ? spend / totals.spend : 0, 0)} of spend.`, action: { label: "Review campaigns", tab: "campaigns" } });
        }
        if (account && isNum(account.frequency) && account.frequency >= 4) {
            items.push({ id: "freq", tone: "warn", text: `Members have seen your ads ${fmtDec(account.frequency, 1)} times on average. Past 4 or so, new creative usually helps more than more budget.` });
        }
        if (!cur.tracksPurchases) {
            items.push({ id: "pixel", tone: "neutral", text: "No purchases came back from the Reddit pixel, so results are judged on clicks and click-through. Add the Reddit Pixel purchase event to see cost per purchase and ROAS." });
        }
        return items.slice(0, 5);
    }, [prev, cur, vs, communities, campaigns, totals, account]);

    if (!cur) return <div className="apex-sx-alert">No Reddit data for this period.</div>;

    const chips = CHART_CHIPS.filter((c) => (!c.needsPurchases || cur.tracksPurchases) && (!c.needsValue || cur.tracksValue));

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-ov-grid--hero">
                <ServiceKpi hero neutral label="Ad spend" value={fmtInt(cur.spend)} unit="kr." cur={cur.spend} prev={pv("spend")} vs={vs} caption="Reddit Ads" />
                <ServiceKpi label="Clicks" icon={FiMousePointer} value={fmtInt(cur.clicks)} cur={cur.clicks} prev={pv("clicks")} vs={vs} caption={`CPC ${fmtDec(cur.cpc, 2)} kr.`} />
                <ServiceKpi label="Click-through rate" icon={FiPercent} value={fmtDec(cur.ctr, 2)} unit="%" cur={cur.ctr} prev={pv("ctr")} vs={vs} caption="Clicks per impression" />
                <ServiceKpi label="Cost per click" icon={FiTarget} cost value={fmtDec(cur.cpc, 2)} unit="kr." cur={cur.cpc} prev={pv("cpc")} goodUp={false} vs={vs} caption="CPC" />
            </div>

            <div className="apex-ov-grid apex-sx-grid-4">
                <ServiceKpi label="Impressions" icon={FiEye} value={fmtInt(cur.impressions)} cur={cur.impressions} prev={pv("impressions")} vs={vs} caption={`CPM ${fmtDec(cur.cpm, 2)} kr.`} />
                <ServiceKpi label="Members reached" icon={FiUsers} value={account && account.reach > 0 ? compact(account.reach) : "-"} caption={account && account.reach > 0 ? "Unique members, whole period" : "Reach was not returned"} />
                <ServiceKpi label="Frequency" icon={FiBarChart2} value={account && account.frequency > 0 ? fmtDec(account.frequency, 2) : "-"} caption="Times each member saw an ad" />
                {cur.tracksPurchases ? (
                    <ServiceKpi label="Purchases" icon={FiShoppingBag} value={fmtInt(cur.purchases)} cur={cur.purchases} prev={pv("purchases")} vs={vs} caption={cur.roas != null ? `ROAS ${fmtDec(cur.roas, 2)}` : isNum(cur.cpa) ? `${fmtInt(cur.cpa)} kr. each` : "Reddit pixel"} />
                ) : (
                    <ServiceKpi label="Video starts" icon={FiPlay} value={account && account.video_started > 0 ? compact(account.video_started) : "-"} caption={video && video.startRate != null ? `${fmtDec(video.startRate * 100, 0)}% of impressions` : "No video delivery"} />
                )}
            </div>

            <section className="apex-ov-card apex-sx-chartcard">
                <div className="apex-ov-card__head">
                    <h3>Performance over time</h3>
                    <div className="apex-sx-chips" role="group" aria-label="Chart metrics">
                        {chips.map((c) => (
                            <button key={c.key} type="button" className={`apex-perf-chip${selectedMetrics.includes(c.key) ? " is-active" : ""}`} aria-pressed={selectedMetrics.includes(c.key)} onClick={() => toggleMetric(c.key)}>
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>
                <GraphCard key={`chart-${selectedMetrics.join("|")}`} variant="cobalt" hideChartToggle title="" chartType="line" height={300} chartOptions={chart.options} chartSeries={chart.series} />
                <p className="apex-mk-note">
                    {realValues ? "Select other metrics to compare them. Spend and revenue share one axis; any other mix is scaled to each metric's own maximum." : "Each metric is scaled to its own maximum (0 to 100%) so the curves share one axis. Hover for the real values."}
                </p>
            </section>

            <div className="apex-ov-grid apex-sx-split">
                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>Video viewing</h3>
                        <span className="apex-ov-sub">How far people watch</span>
                    </div>
                    {video ? (
                        <>
                            <div className="apex-em-funnel">
                                {video.steps.map((s, i) => (
                                    <div key={s.id} className="apex-em-funnel__row">
                                        <div className="apex-em-funnel__top">
                                            <span className="apex-em-funnel__name">
                                                <i style={{ background: VIDEO_COLORS[i] }} aria-hidden />
                                                {s.label}
                                            </span>
                                            <b>{fmtInt(s.value)}</b>
                                        </div>
                                        <div className="apex-ov-bar">
                                            <i style={{ width: `${Math.max(0.6, (s.ofStarted ?? 0) * 100)}%`, background: VIDEO_COLORS[i] }} />
                                        </div>
                                        <div className="apex-em-funnel__cap">{i === 0 ? (video.startRate != null ? `${fmtDec(video.startRate * 100, 1)}% of impressions start a video` : "Video starts") : `${fmtDec((s.ofStarted ?? 0) * 100, 0)}% of video starts`}</div>
                                    </div>
                                ))}
                            </div>
                            <p className="apex-mk-note">{video.withSound != null ? `${fmtDec(video.withSound * 100, 0)}% of video plays have sound on. ` : ""}Reddit autoplays video muted in the feed, so the first seconds and captions matter most.</p>
                        </>
                    ) : (
                        <p className="apex-mk-note apex-sx-empty-note">No video delivery in this period, or Reddit did not return video detail.</p>
                    )}
                </section>

                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>Where it works</h3>
                        <span className="apex-ov-sub">Communities that click above their share</span>
                    </div>
                    {topCommunities.length === 0 ? (
                        <p className="apex-mk-note apex-sx-empty-note">No community has enough reach to compare yet.</p>
                    ) : (
                        <div className="apex-sx-terms">
                            {topCommunities.map((r) => (
                                <div key={r.id} className="apex-sx-term">
                                    <div className="apex-sx-term__main">
                                        <b title={r.name}>{r.name}</b>
                                        <small>{fmtShare(r.impShare, 0)} of reach, {fmtPctPoints(num(r.ctr) * 100, 2)} CTR</small>
                                    </div>
                                    <span className="apex-sx-term__spend">{r.cpc != null ? `${fmtDec(r.cpc, 2)} kr.` : "-"}</span>
                                    <span className="apex-sx-term__roas is-pos">{fmtDec(r.index, 1)}x</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <button type="button" className="apex-sx-link" onClick={() => onGoTo?.("communities")}>
                        All communities
                        <FiArrowRight aria-hidden />
                    </button>
                </section>
            </div>

            <div className="apex-ov-grid apex-sx-split-even">
                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>What to look at</h3>
                        <span className="apex-ov-sub">Based on this period</span>
                    </div>
                    {attention.length === 0 ? (
                        <p className="apex-mk-note apex-sx-empty-note">Nothing stands out in this period.</p>
                    ) : (
                        <ul className="apex-sx-attn">
                            {attention.map((item) => (
                                <li key={item.id} className={`apex-sx-attn__item is-${item.tone}`}>
                                    <i aria-hidden />
                                    <div>
                                        <p>{item.text}</p>
                                        {item.action ? (
                                            <button type="button" className="apex-sx-link" onClick={() => onGoTo?.(item.action.tab)}>
                                                {item.action.label}
                                                <FiArrowRight aria-hidden />
                                            </button>
                                        ) : null}
                                    </div>
                                </li>
                            ))}
                        </ul>
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
                                    <div key={d.label} className={`apex-sx-week__day${d.isBest ? " is-best" : ""}`} title={`${d.label}: ${fmtDec(d.avg, 0)} clicks`}>
                                        <span className="apex-sx-week__val">{compact(d.avg)}</span>
                                        <div className="apex-sx-week__bar">
                                            <i style={{ height: `${Math.max(4, d.index * 100)}%` }} />
                                        </div>
                                        <span className="apex-sx-week__lbl">{d.label}</span>
                                        <span className="apex-sx-week__roas">{d.cost != null ? fmtDec(d.cost, 2) : "-"}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="apex-mk-note">Bars show average clicks per day, the number below each is the cost in kr. per click.</p>
                        </>
                    ) : (
                        <p className="apex-mk-note apex-sx-empty-note">Pick a range of at least two weeks to see which weekdays perform best.</p>
                    )}
                </section>
            </div>
        </div>
    );
}

