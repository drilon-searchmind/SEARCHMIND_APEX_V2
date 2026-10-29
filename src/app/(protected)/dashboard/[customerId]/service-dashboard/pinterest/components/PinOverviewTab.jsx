"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
    FiActivity,
    FiArrowRight,
    FiBarChart2,
    FiBookmark,
    FiDollarSign,
    FiEye,
    FiMousePointer,
    FiPercent,
    FiShoppingCart,
    FiTrendingUp,
} from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
import { COMMERCE_CHART_CHROME, METRIC_CHART_PALETTE } from "@/components/dashboard/chartColors";
import { hexWithAlpha } from "@/lib/charts/chartSeriesColors";
import { resolveDailyComparisonDate, COMPARISON_METHOD } from "@/lib/dateRangeComparison";
import { normalizeSeriesValues } from "@/lib/emDashboardUtils";
import { pinCampaignStatus, pinFunnel, pinWeekdays, summarizePin } from "@/lib/pinAnalytics";
import {
    ServiceKpi,
    compact,
    fmtDec,
    fmtInt,
    fmtKr,
    fmtShare,
    isNum,
    num,
    vsCaption,
} from "@/components/dashboard/ServiceParts";

const CHART_CHIPS = [
    { key: "ad_spend", label: "Spend" },
    { key: "conversion_value", label: "Revenue", needsValue: true },
    { key: "roas", label: "ROAS", needsValue: true },
    { key: "conversions", label: "Checkouts" },
    { key: "impressions", label: "Impressions" },
    { key: "clicks", label: "Outbound clicks" },
    { key: "saves", label: "Saves" },
    { key: "ctr", label: "CTR" },
    { key: "cpm", label: "CPM" },
    { key: "cpc", label: "CPC" },
];

const MONEY_KEYS = new Set(["ad_spend", "conversion_value"]);
const FUNNEL_COLORS = ["#111A12", "#2F8434", "#5DBB58", "#A9EDA2"];

function dailyValue(row, key) {
    if (!row) return null;
    if (key === "ctr") return row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
    const v = row[key];
    return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function formatMetric(key, value) {
    if (!isNum(value)) return "-";
    if (key === "ad_spend" || key === "conversion_value") return fmtKr(value);
    if (key === "cpm" || key === "cpc") return `${fmtDec(value, 2)} kr.`;
    if (key === "roas") return fmtDec(value, 2);
    if (key === "ctr") return `${fmtDec(value, 2)}%`;
    return fmtInt(value);
}

function axisFormat(key, v) {
    if (key === "ctr") return `${fmtDec(v, 1)}%`;
    if (key === "roas" || key === "cpc" || key === "cpm") return fmtDec(v, 1);
    return compact(v);
}

export default function PinOverviewTab({ data, appliedRange, comparisonMethod, comparisonLabel, onLedeChange, onGoTo }) {
    const { metrics, metricsPrev, campaigns, window: win, windowPrev } = data;
    const vs = vsCaption(comparisonLabel);

    const cur = useMemo(() => summarizePin(metrics), [metrics]);
    const prevAllowed = windowPrev?.rangeAllowed !== false;
    const hasPrev = comparisonMethod !== COMPARISON_METHOD.NONE && metricsPrev.length > 0 && prevAllowed;
    const prev = useMemo(() => (hasPrev ? summarizePin(metricsPrev) : null), [hasPrev, metricsPrev]);
    const pv = (key) => (prev ? prev[key] : null);
    const tracksValue = !!cur?.tracksValue;

    const [selectedMetrics, setSelectedMetrics] = useState(() => (metrics.some((r) => num(r.conversion_value) > 0) ? ["ad_spend", "conversion_value"] : ["ad_spend"]));

    useEffect(() => {
        if (!cur) {
            onLedeChange?.(null);
            return;
        }
        let text = `Pinterest delivered ${fmtInt(cur.impressions)} impressions, ${fmtInt(cur.saves)} saves and ${fmtInt(cur.clicks)} outbound clicks for ${fmtKr(cur.spend)}`;
        if (prev && num(prev.clicks) > 0) {
            const pct = ((cur.clicks - prev.clicks) / prev.clicks) * 100;
            text += ` (clicks ${pct > 0 ? "+" : ""}${fmtDec(pct, 1)}% ${vs})`;
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

    const funnel = useMemo(() => pinFunnel(cur), [cur]);
    const weekdays = useMemo(() => pinWeekdays(metrics), [metrics]);

    const attention = useMemo(() => {
        const items = [];
        if (prev && num(prev.ctr) > 0) {
            const pct = ((cur.ctr - prev.ctr) / prev.ctr) * 100;
            if (pct <= -10) items.push({ id: "ctr", tone: "bad", text: `Click-through rate fell ${fmtDec(Math.abs(pct), 1)}% ${vs}, from ${fmtDec(prev.ctr, 2)}% to ${fmtDec(cur.ctr, 2)}%. The pins may be tiring or the audience may have widened.` });
            else if (pct >= 10) items.push({ id: "ctr", tone: "ok", text: `Click-through rate is up ${fmtDec(pct, 1)}% ${vs}, from ${fmtDec(prev.ctr, 2)}% to ${fmtDec(cur.ctr, 2)}%.` });
        }
        if (prev && num(prev.saves) > 0) {
            const pct = ((cur.saves - prev.saves) / prev.saves) * 100;
            if (Math.abs(pct) >= 15) items.push({ id: "saves", tone: pct > 0 ? "ok" : "warn", text: `Saves ${pct > 0 ? "rose" : "fell"} ${fmtDec(Math.abs(pct), 1)}% ${vs}. Saves feed later visits, so they often show up in clicks and orders with a delay.` });
        }
        if (!tracksValue) {
            items.push({ id: "value", tone: "warn", text: "No checkout value came back from Pinterest. Check that the Pinterest tag sends checkout events with a value, otherwise ROAS cannot be shown." });
        } else if (prev && num(prev.roas) > 0 && cur.roas != null) {
            const pct = ((cur.roas - prev.roas) / prev.roas) * 100;
            if (pct <= -10) items.push({ id: "roas", tone: "bad", text: `ROAS fell ${fmtDec(Math.abs(pct), 1)}% ${vs}, from ${fmtDec(prev.roas, 2)} to ${fmtDec(cur.roas, 2)}.` });
            else if (pct >= 10) items.push({ id: "roas", tone: "ok", text: `ROAS is up ${fmtDec(pct, 1)}% ${vs}, from ${fmtDec(prev.roas, 2)} to ${fmtDec(cur.roas, 2)}.` });
        }
        const withSpend = campaigns.filter((c) => isNum(c.ad_spend));
        const totalImp = campaigns.reduce((s, c) => s + num(c.impressions), 0);
        const totalSpend = withSpend.reduce((s, c) => s + num(c.ad_spend), 0);
        const weak = campaigns.filter((c) => pinCampaignStatus(c, num(cur.ctr) / 100, totalImp).id === "weak");
        if (weak.length > 0) {
            const spend = weak.reduce((s, c) => s + num(c.ad_spend), 0);
            items.push({
                id: "weak",
                tone: "warn",
                text: `${fmtInt(weak.length)} ${weak.length === 1 ? "campaign has" : "campaigns have"} a click-through rate under half the account average${totalSpend > 0 ? ` and ${weak.length === 1 ? "takes" : "take"} ${fmtShare(spend / totalSpend, 0)} of spend` : ""}.`,
                action: { label: "Review campaigns", tab: "campaigns" },
            });
        }
        return items.slice(0, 5);
    }, [prev, cur, vs, tracksValue, campaigns]);

    if (!cur) return <div className="apex-sx-alert">No Pinterest data for this period.</div>;

    const chips = CHART_CHIPS.filter((c) => !c.needsValue || tracksValue);
    const outOfWindow = win?.rangeAllowed === false;

    return (
        <div className="apex-sx-stack">
            {outOfWindow ? (
                <div className="apex-sx-alert">
                    Pinterest only returns analytics for the last 90 days{win?.earliest ? ` (from ${win.earliest})` : ""}. This range starts earlier, so the numbers below are empty. Pick a range inside the window.
                </div>
            ) : comparisonMethod !== COMPARISON_METHOD.NONE && windowPrev?.rangeAllowed === false ? (
                <div className="apex-sx-alert">The comparison period is older than Pinterest&apos;s 90-day analytics window, so changes cannot be shown. Choose a comparison inside the window.</div>
            ) : null}

            <div className="apex-ov-grid apex-ov-grid--hero">
                <ServiceKpi hero neutral label="Ad spend" value={fmtInt(cur.spend)} unit="kr." cur={cur.spend} prev={pv("spend")} vs={vs} caption="Pinterest ads" />
                <ServiceKpi label="Revenue" icon={FiBarChart2} value={tracksValue ? fmtInt(cur.revenue) : "-"} unit="kr." cur={cur.revenue} prev={pv("revenue")} vs={vs} caption={tracksValue ? "Checkout value" : "No checkout value tracked"} />
                <ServiceKpi label="ROAS" icon={FiTrendingUp} value={cur.roas != null ? fmtDec(cur.roas, 2) : "-"} cur={cur.roas} prev={pv("roas")} vs={vs} caption="Revenue per kr. spent" />
                <ServiceKpi label="Checkouts" icon={FiShoppingCart} value={fmtInt(cur.conversions)} cur={cur.conversions} prev={pv("conversions")} vs={vs} caption={isNum(cur.aov) ? `Avg. order ${fmtInt(cur.aov)} kr.` : "Pinterest-attributed"} />
            </div>

            <div className="apex-ov-grid apex-sx-grid-4">
                <ServiceKpi label="Impressions" icon={FiEye} value={fmtInt(cur.impressions)} cur={cur.impressions} prev={pv("impressions")} vs={vs} caption={`CPM ${fmtDec(cur.cpm, 2)} kr.`} />
                <ServiceKpi label="Outbound clicks" icon={FiMousePointer} value={fmtInt(cur.clicks)} cur={cur.clicks} prev={pv("clicks")} vs={vs} caption={`CPC ${fmtDec(cur.cpc, 2)} kr.`} />
                <ServiceKpi label="Saves" icon={FiBookmark} value={fmtInt(cur.saves)} cur={cur.saves} prev={pv("saves")} vs={vs} caption={isNum(cur.costPerSave) ? `${fmtDec(cur.costPerSave, 2)} kr. per save` : "Pins saved to boards"} />
                <ServiceKpi label="Click-through rate" icon={FiPercent} value={fmtDec(cur.ctr, 2)} unit="%" cur={cur.ctr} prev={pv("ctr")} vs={vs} caption="Outbound clicks per impression" />
            </div>

            <section className="apex-ov-card apex-sx-chartcard">
                <div className="apex-ov-card__head">
                    <h3>Performance over time</h3>
                    <div className="apex-sx-chips" role="group" aria-label="Chart metrics">
                        {chips.map((c) => (
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
                    key={`chart-${selectedMetrics.join("|")}`}
                    variant="cobalt"
                    hideChartToggle
                    title=""
                    chartType="line"
                    height={300}
                    chartOptions={chart.options}
                    chartSeries={chart.series}
                />
                <p className="apex-mk-note">
                    {realValues
                        ? "Select other metrics to compare them. Spend and revenue share one axis; any other mix is scaled to each metric's own maximum."
                        : "Each metric is scaled to its own maximum (0 to 100%) so the curves share one axis. Hover for the real values."}
                </p>
            </section>

            <div className="apex-ov-grid apex-sx-split">
                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>From pin to purchase</h3>
                        <span className="apex-ov-sub">Impressions, saves, clicks, checkouts</span>
                    </div>
                    <div className="apex-em-funnel">
                        {funnel.map((s, i) => (
                            <div key={s.id} className="apex-em-funnel__row">
                                <div className="apex-em-funnel__top">
                                    <span className="apex-em-funnel__name">
                                        <i style={{ background: FUNNEL_COLORS[i] }} aria-hidden />
                                        {s.label}
                                    </span>
                                    <b>{fmtInt(s.value)}</b>
                                </div>
                                <div className="apex-ov-bar">
                                    <i style={{ width: `${Math.max(0.6, Math.sqrt(s.ofImpressions ?? 0) * 100)}%`, background: FUNNEL_COLORS[i] }} />
                                </div>
                                <div className="apex-em-funnel__cap">
                                    {i === 0
                                        ? "Times your pins were shown"
                                        : i === 1
                                          ? `${fmtDec((s.ofImpressions ?? 0) * 1000, 1)} saves per 1.000 impressions`
                                          : `${fmtDec((s.fromPrev ?? 0) * 100, i === 3 ? 1 : 1)}% of ${funnel[i - 1].label.toLowerCase()}`}
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="apex-mk-note">Bars use a square-root scale so the small steps stay visible. Saves are not a step every buyer takes; many people click straight through, and saved pins can bring visits later.</p>
                </section>

                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>Saves and clicks</h3>
                        <span className="apex-ov-sub">How people use your pins</span>
                    </div>
                    <div className="apex-sp-tiles apex-pin-tiles">
                        <div className="apex-sp-tile">
                            <span className="apex-ov-ic"><FiBookmark aria-hidden /></span>
                            <small>Save rate</small>
                            <b>{fmtDec(cur.saveRate, 2)}%</b>
                        </div>
                        <div className="apex-sp-tile">
                            <span className="apex-ov-ic"><FiMousePointer aria-hidden /></span>
                            <small>Clicks per save</small>
                            <b>{isNum(cur.clicksPerSave) ? fmtDec(cur.clicksPerSave, 1) : "-"}</b>
                        </div>
                        <div className="apex-sp-tile">
                            <span className="apex-ov-ic"><FiActivity aria-hidden /></span>
                            <small>Checkout rate</small>
                            <b>{isNum(cur.convRate) ? `${fmtDec(cur.convRate, 2)}%` : "-"}</b>
                        </div>
                        <div className="apex-sp-tile">
                            <span className="apex-ov-ic"><FiDollarSign aria-hidden /></span>
                            <small>Cost per save</small>
                            <b>{isNum(cur.costPerSave) ? `${fmtDec(cur.costPerSave, 2)} kr.` : "-"}</b>
                        </div>
                    </div>
                    <p className="apex-mk-note">Save rate is saves per impression, checkout rate is checkouts per outbound click. Pinterest attributes checkouts with its own window, so they can differ from your store.</p>
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
                        <span className="apex-ov-sub">Avg. outbound clicks per weekday</span>
                    </div>
                    {weekdays.enough ? (
                        <>
                            <div className="apex-sx-week">
                                {weekdays.days.map((d) => (
                                    <div key={d.label} className={`apex-sx-week__day${d.isBest ? " is-best" : ""}`} title={`${d.label}: ${fmtInt(d.avgClicks)} clicks, ${fmtInt(d.avgSaves)} saves`}>
                                        <span className="apex-sx-week__val">{compact(d.avgClicks)}</span>
                                        <div className="apex-sx-week__bar">
                                            <i style={{ height: `${Math.max(4, d.index * 100)}%` }} />
                                        </div>
                                        <span className="apex-sx-week__lbl">{d.label}</span>
                                        <span className="apex-sx-week__roas">{fmtDec(d.ctr, 2)}%</span>
                                    </div>
                                ))}
                            </div>
                            <p className="apex-mk-note">
                                Bars show average outbound clicks, the number below each day is its click-through rate. Most clicks come on {weekdays.best.label} and fewest on {weekdays.worst.label}.
                            </p>
                        </>
                    ) : (
                        <p className="apex-mk-note apex-sx-empty-note">Pick a range of at least two weeks to see which weekdays perform best.</p>
                    )}
                </section>
            </div>
        </div>
    );
}
