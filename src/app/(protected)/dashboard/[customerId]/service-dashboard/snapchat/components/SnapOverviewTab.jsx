"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
    FiActivity,
    FiArrowRight,
    FiBarChart2,
    FiEye,
    FiMousePointer,
    FiPercent,
    FiPlay,
    FiShare2,
    FiShoppingBag,
    FiShoppingCart,
    FiTarget,
    FiTrendingUp,
} from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
import { COMMERCE_CHART_CHROME, METRIC_CHART_PALETTE } from "@/components/dashboard/chartColors";
import { hexWithAlpha } from "@/lib/charts/chartSeriesColors";
import { resolveDailyComparisonDate, COMPARISON_METHOD } from "@/lib/dateRangeComparison";
import { normalizeSeriesValues } from "@/lib/emDashboardUtils";
import { liWeekdays } from "@/lib/liAnalytics";
import { engagementTotals, snapFunnel, summarizeSnap } from "@/lib/snapAnalytics";
import { ServiceKpi, compact, fmtDec, fmtInt, fmtKr, fmtPctPoints, isNum, num, vsCaption } from "@/components/dashboard/ServiceParts";

const CHART_CHIPS = [
    { key: "ad_spend", label: "Spend" },
    { key: "purchase_value", label: "Revenue", needsValue: true },
    { key: "roas", label: "ROAS", needsValue: true },
    { key: "purchases", label: "Purchases" },
    { key: "adds_to_cart", label: "Adds to cart" },
    { key: "impressions", label: "Impressions" },
    { key: "clicks", label: "Swipe-ups" },
    { key: "ctr", label: "CTR" },
    { key: "cpm", label: "CPM" },
    { key: "cpc", label: "CPC" },
];

const MONEY_KEYS = new Set(["ad_spend", "purchase_value"]);
const FUNNEL_COLORS = ["#111A12", "#2F8434", "#5DBB58", "#A9EDA2"];

function dailyValue(row, key) {
    if (!row) return null;
    if (key === "ctr") return row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
    const v = row[key];
    return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function formatMetric(key, value) {
    if (!isNum(value)) return "-";
    if (key === "ad_spend" || key === "purchase_value") return fmtKr(value);
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

export default function SnapOverviewTab({ data, appliedRange, comparisonMethod, comparisonLabel, onLedeChange, onGoTo }) {
    const { metrics, metricsPrev, campaigns } = data;
    const vs = vsCaption(comparisonLabel);
    const cur = useMemo(() => summarizeSnap(metrics), [metrics]);
    const hasPrev = comparisonMethod !== COMPARISON_METHOD.NONE && metricsPrev.length > 0;
    const prev = useMemo(() => (hasPrev ? summarizeSnap(metricsPrev) : null), [hasPrev, metricsPrev]);
    const pv = (key) => (prev ? prev[key] : null);
    const tracksValue = !!cur?.tracksValue;

    const [selectedMetrics, setSelectedMetrics] = useState(() => (metrics.some((r) => num(r.purchase_value) > 0) ? ["ad_spend", "purchase_value"] : ["ad_spend"]));

    useEffect(() => {
        if (!cur) {
            onLedeChange?.(null);
            return;
        }
        let text = `Snapchat spent ${fmtKr(cur.spend)}`;
        if (cur.purchases > 0) text += ` and drove ${fmtInt(cur.purchases)} purchases`;
        else text += ` for ${fmtInt(cur.swipes)} swipe-ups`;
        if (cur.roas != null) text += ` at a ROAS of ${fmtDec(cur.roas, 2)}`;
        if (prev && num(prev.cpa) > 0 && num(cur.cpa) > 0) {
            const pct = ((cur.cpa - prev.cpa) / prev.cpa) * 100;
            text += ` (cost per purchase ${pct > 0 ? "+" : ""}${fmtDec(pct, 1)}% ${vs})`;
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

    const funnel = useMemo(() => snapFunnel(cur), [cur]);
    const eng = useMemo(() => engagementTotals(campaigns), [campaigns]);
    const weekdays = useMemo(() => liWeekdays(metrics, cur?.tracksPurchases ? "purchases" : "clicks"), [metrics, cur]);

    const attention = useMemo(() => {
        const items = [];
        if (prev && num(prev.cpa) > 0 && num(cur.cpa) > 0) {
            const pct = ((cur.cpa - prev.cpa) / prev.cpa) * 100;
            if (pct >= 15) items.push({ id: "cpa", tone: "bad", text: `Cost per purchase rose ${fmtDec(pct, 1)}% ${vs}, from ${fmtDec(prev.cpa, 0)} to ${fmtDec(cur.cpa, 0)} kr.` });
            else if (pct <= -15) items.push({ id: "cpa", tone: "ok", text: `Cost per purchase fell ${fmtDec(Math.abs(pct), 1)}% ${vs}, from ${fmtDec(prev.cpa, 0)} to ${fmtDec(cur.cpa, 0)} kr.` });
        }
        if (isNum(cur.cartToPurchase) && cur.adds >= 30 && cur.cartToPurchase < 15) {
            items.push({ id: "cart", tone: "warn", text: `Only ${fmtDec(cur.cartToPurchase, 0)}% of adds to cart end in a purchase. Retargeting people who left a full cart is usually the cheapest win.` });
        }
        if (!cur.tracksPurchases) {
            items.push({ id: "pixel", tone: "warn", text: "No purchases came back from Snapchat. Check that the Snap Pixel or Conversions API sends purchase events, otherwise cost per purchase and ROAS cannot be shown." });
        } else if (!cur.tracksValue) {
            items.push({ id: "value", tone: "warn", text: "Purchases are tracked but without a value, so ROAS cannot be shown. Send the order value with the purchase event." });
        }
        const withFreq = campaigns.filter((c) => c.frequency != null && num(c.frequency) >= 4 && num(c.impressions) > 0);
        if (withFreq.length > 0) {
            items.push({ id: "freq", tone: "warn", text: `${fmtInt(withFreq.length)} ${withFreq.length === 1 ? "campaign shows" : "campaigns show"} its ads to the same people 4 times or more on average. That suits retargeting but can tire a cold audience.`, action: { label: "Open campaigns", tab: "campaigns" } });
        }
        if (eng && isNum(eng.completionRate) && eng.videoViews >= 500 && eng.completionRate < 0.2) {
            items.push({ id: "video", tone: "warn", text: `Only ${fmtDec(eng.completionRate * 100, 0)}% of video views are watched to the end. Put the message and the product in the first seconds.` });
        }
        return items.slice(0, 5);
    }, [prev, cur, vs, campaigns, eng]);

    if (!cur) return <div className="apex-sx-alert">No Snapchat data for this period.</div>;

    const chips = CHART_CHIPS.filter((c) => !c.needsValue || tracksValue);

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-ov-grid--hero">
                <ServiceKpi hero neutral label="Ad spend" value={fmtInt(cur.spend)} unit="kr." cur={cur.spend} prev={pv("spend")} vs={vs} caption="Snapchat Ads" />
                <ServiceKpi label="Revenue" icon={FiBarChart2} value={tracksValue ? fmtInt(cur.revenue) : "-"} unit="kr." cur={cur.revenue} prev={pv("revenue")} vs={vs} caption={tracksValue ? "Purchase value" : "No purchase value tracked"} />
                <ServiceKpi label="ROAS" icon={FiTrendingUp} value={cur.roas != null ? fmtDec(cur.roas, 2) : "-"} cur={cur.roas} prev={pv("roas")} vs={vs} caption="Revenue per kr. spent" />
                <ServiceKpi label="Purchases" icon={FiShoppingBag} value={fmtInt(cur.purchases)} cur={cur.purchases} prev={pv("purchases")} vs={vs} caption={isNum(cur.aov) ? `Avg. order ${fmtInt(cur.aov)} kr.` : "As Snapchat attributes them"} />
            </div>

            <div className="apex-ov-grid apex-sx-grid-4">
                <ServiceKpi label="Impressions" icon={FiEye} value={fmtInt(cur.impressions)} cur={cur.impressions} prev={pv("impressions")} vs={vs} caption={`CPM ${fmtDec(cur.cpm, 2)} kr.`} />
                <ServiceKpi label="Swipe-ups" icon={FiMousePointer} value={fmtInt(cur.swipes)} cur={cur.swipes} prev={pv("swipes")} vs={vs} caption={`CPC ${fmtDec(cur.cpc, 2)} kr.`} />
                <ServiceKpi label="Swipe-up rate" icon={FiPercent} value={fmtDec(cur.ctr, 2)} unit="%" cur={cur.ctr} prev={pv("ctr")} vs={vs} caption="Swipe-ups per impression" />
                <ServiceKpi label="Cost per purchase" icon={FiTarget} cost value={isNum(cur.cpa) ? fmtInt(cur.cpa) : "-"} unit="kr." cur={cur.cpa} prev={pv("cpa")} goodUp={false} vs={vs} caption="CPA" />
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
                        <h3>From snap to purchase</h3>
                        <span className="apex-ov-sub">Impressions, swipe-ups, carts, purchases</span>
                    </div>
                    <div className="apex-em-funnel">
                        {funnel.map((s, i) => (
                            <div key={s.id} className="apex-em-funnel__row">
                                <div className="apex-em-funnel__top">
                                    <span className="apex-em-funnel__name">
                                        <i style={{ background: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }} aria-hidden />
                                        {s.label}
                                    </span>
                                    <b>{fmtInt(s.value)}</b>
                                </div>
                                <div className="apex-ov-bar">
                                    <i style={{ width: `${Math.max(0.6, Math.sqrt(s.ofImpressions ?? 0) * 100)}%`, background: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }} />
                                </div>
                                <div className="apex-em-funnel__cap">{i === 0 ? "Times your snaps were shown" : `${fmtDec((s.fromPrev ?? 0) * 100, 1)}% of ${(s.fromLabel || "").toLowerCase()}`}</div>
                            </div>
                        ))}
                    </div>
                    <p className="apex-mk-note">Bars use a square-root scale so the small steps stay visible. Snapchat attributes purchases within 28 days of a swipe-up and 1 day of a view, so the numbers can differ from your store.</p>
                </section>

                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>Video and engagement</h3>
                        <span className="apex-ov-sub">Across campaigns</span>
                    </div>
                    {eng ? (
                        <div className="apex-sp-tiles apex-snap-tiles">
                            <div className="apex-sp-tile">
                                <span className="apex-ov-ic"><FiPlay aria-hidden /></span>
                                <small>Video views</small>
                                <b>{compact(eng.videoViews)}</b>
                            </div>
                            <div className="apex-sp-tile">
                                <span className="apex-ov-ic"><FiActivity aria-hidden /></span>
                                <small>Watched to the end</small>
                                <b>{isNum(eng.completionRate) ? fmtPctPoints(eng.completionRate * 100, 0) : "-"}</b>
                            </div>
                            <div className="apex-sp-tile">
                                <span className="apex-ov-ic"><FiShare2 aria-hidden /></span>
                                <small>Shares and saves</small>
                                <b>{compact(eng.shares + eng.saves)}</b>
                            </div>
                            <div className="apex-sp-tile">
                                <span className="apex-ov-ic"><FiShoppingCart aria-hidden /></span>
                                <small>Cart to purchase</small>
                                <b>{isNum(cur.cartToPurchase) ? fmtPctPoints(cur.cartToPurchase, 0) : "-"}</b>
                            </div>
                        </div>
                    ) : (
                        <p className="apex-mk-note apex-sx-empty-note">Snapchat did not return video and engagement detail for this period.</p>
                    )}
                    {eng && isNum(eng.q1Rate) ? (
                        <p className="apex-mk-note">
                            Of everyone who starts a video, {fmtDec(eng.q1Rate * 100, 0)}% reach a quarter, {fmtDec((eng.q3Rate ?? 0) * 100, 0)}% reach three quarters. {isNum(eng.frequency) ? `Average frequency is ${fmtDec(eng.frequency, 1)}.` : ""}
                        </p>
                    ) : null}
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
                        <span className="apex-ov-sub">Avg. {cur.tracksPurchases ? "purchases" : "swipe-ups"} per weekday</span>
                    </div>
                    {weekdays.enough ? (
                        <>
                            <div className="apex-sx-week">
                                {weekdays.days.map((d) => (
                                    <div key={d.label} className={`apex-sx-week__day${d.isBest ? " is-best" : ""}`} title={`${d.label}: ${fmtDec(d.avg, 1)}`}>
                                        <span className="apex-sx-week__val">{fmtDec(d.avg, d.avg < 10 ? 1 : 0)}</span>
                                        <div className="apex-sx-week__bar">
                                            <i style={{ height: `${Math.max(4, d.index * 100)}%` }} />
                                        </div>
                                        <span className="apex-sx-week__lbl">{d.label}</span>
                                        <span className="apex-sx-week__roas">{d.cost != null ? fmtDec(d.cost, 1) : "-"}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="apex-mk-note">Bars show the average per day, the number below each is the cost in kr. per {cur.tracksPurchases ? "purchase" : "swipe-up"}.</p>
                        </>
                    ) : (
                        <p className="apex-mk-note apex-sx-empty-note">Pick a range of at least two weeks to see which weekdays perform best.</p>
                    )}
                </section>
            </div>
        </div>
    );
}
