"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
    FiActivity,
    FiArrowRight,
    FiEye,
    FiHeart,
    FiMousePointer,
    FiPercent,
    FiShoppingCart,
    FiTarget,
    FiUserPlus,
    FiUsers,
} from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
import { COMMERCE_CHART_CHROME, METRIC_CHART_PALETTE } from "@/components/dashboard/chartColors";
import { hexWithAlpha } from "@/lib/charts/chartSeriesColors";
import { resolveDailyComparisonDate, COMPARISON_METHOD } from "@/lib/dateRangeComparison";
import { normalizeSeriesValues } from "@/lib/emDashboardUtils";
import { costStatus, liFunnel, liWeekdays, summarizeLi } from "@/lib/liAnalytics";
import {
    ServiceKpi,
    compact,
    fmtDec,
    fmtInt,
    fmtKr,
    isNum,
    num,
    vsCaption,
} from "@/components/dashboard/ServiceParts";

const CHART_CHIPS = [
    { key: "ad_spend", label: "Spend" },
    { key: "leads", label: "Leads" },
    { key: "lead_form_opens", label: "Form opens" },
    { key: "conversions", label: "Web conversions" },
    { key: "impressions", label: "Impressions" },
    { key: "clicks", label: "Clicks" },
    { key: "ctr", label: "CTR" },
    { key: "cpc", label: "CPC" },
    { key: "cpm", label: "CPM" },
];

const FUNNEL_COLORS = ["#111A12", "#2F8434", "#5DBB58", "#A9EDA2", "#7C3AED"];

function dailyValue(row, key) {
    if (!row) return null;
    if (key === "ctr") return row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0;
    const v = row[key];
    return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function formatMetric(key, value) {
    if (!isNum(value)) return "-";
    if (key === "ad_spend") return fmtKr(value);
    if (key === "cpc" || key === "cpm") return `${fmtDec(value, 2)} kr.`;
    if (key === "ctr") return `${fmtDec(value, 2)}%`;
    return fmtInt(value);
}

function axisFormat(key, v) {
    if (key === "ctr") return `${fmtDec(v, 1)}%`;
    if (key === "cpc" || key === "cpm") return fmtDec(v, 1);
    return compact(v);
}

export default function LiOverviewTab({ data, appliedRange, comparisonMethod, comparisonLabel, onLedeChange, onGoTo }) {
    const { metrics, metricsPrev, campaigns, reach } = data;
    const vs = vsCaption(comparisonLabel);

    const cur = useMemo(() => summarizeLi(metrics, reach), [metrics, reach]);
    const hasPrev = comparisonMethod !== COMPARISON_METHOD.NONE && metricsPrev.length > 0;
    const prev = useMemo(() => (hasPrev ? summarizeLi(metricsPrev) : null), [hasPrev, metricsPrev]);
    const pv = (key) => (prev ? prev[key] : null);
    const leadsMode = !!cur?.hasLeads;

    const [selectedMetrics, setSelectedMetrics] = useState(() => (metrics.some((r) => num(r.leads) > 0) ? ["ad_spend", "leads"] : ["ad_spend"]));

    useEffect(() => {
        if (!cur) {
            onLedeChange?.(null);
            return;
        }
        let text = `LinkedIn spent ${fmtKr(cur.spend)}`;
        if (cur.leads > 0) text += ` and brought ${fmtInt(cur.leads)} leads at ${fmtDec(cur.cpl, 0)} kr. each`;
        else if (cur.conversions > 0) text += ` and brought ${fmtInt(cur.conversions)} web conversions`;
        else text += ` for ${fmtInt(cur.clicks)} clicks`;
        if (prev && num(prev.costPerResult) > 0 && num(cur.costPerResult) > 0) {
            const pct = ((cur.costPerResult - prev.costPerResult) / prev.costPerResult) * 100;
            text += ` (cost per result ${pct > 0 ? "+" : ""}${fmtDec(pct, 1)}% ${vs})`;
        }
        onLedeChange?.(`${text}.`);
    }, [cur, prev, vs, onLedeChange]);

    // Spend is in kr., everything else counts something, so a mixed selection is scaled
    const single = selectedMetrics.length === 1;

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
            series.push({ name: label, type: single ? "area" : "line", data: single ? curRaw : normalizeSeriesValues(curRaw) });
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
                series.push({ name: `${label} (${(vs || "").replace("vs ", "")})`, type: "line", data: single ? prevRaw : normalizeSeriesValues(prevRaw) });
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
            yaxis: single
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
    }, [metrics, metricsPrev, selectedMetrics, single, hasPrev, comparisonMethod, appliedRange.startDate, appliedRange.endDate, vs]);

    const toggleMetric = (key) =>
        setSelectedMetrics((list) => {
            if (list.includes(key)) return list.length > 1 ? list.filter((k) => k !== key) : list;
            return [...list, key];
        });

    const funnel = useMemo(() => liFunnel(cur), [cur]);
    const weekdays = useMemo(() => liWeekdays(metrics, leadsMode ? "leads" : "clicks"), [metrics, leadsMode]);
    const totalSpend = num(cur?.spend);

    const attention = useMemo(() => {
        const items = [];
        if (prev && num(prev.costPerResult) > 0 && num(cur.costPerResult) > 0) {
            const pct = ((cur.costPerResult - prev.costPerResult) / prev.costPerResult) * 100;
            if (pct >= 15) items.push({ id: "cpr", tone: "bad", text: `Cost per result rose ${fmtDec(pct, 1)}% ${vs}, from ${fmtDec(prev.costPerResult, 0)} to ${fmtDec(cur.costPerResult, 0)} kr.` });
            else if (pct <= -15) items.push({ id: "cpr", tone: "ok", text: `Cost per result fell ${fmtDec(Math.abs(pct), 1)}% ${vs}, from ${fmtDec(prev.costPerResult, 0)} to ${fmtDec(cur.costPerResult, 0)} kr.` });
        }
        if (isNum(cur.formCompletion) && cur.formOpens >= 30) {
            if (cur.formCompletion < 25) items.push({ id: "form", tone: "warn", text: `Only ${fmtDec(cur.formCompletion, 0)}% of people who open a Lead Gen Form submit it. Fewer fields or a clearer offer in the form usually helps more than more reach.` });
        }
        const stat = campaigns.map((c) => ({ c, status: costStatus(c, num(cur.costPerResult), totalSpend) }));
        const bad = stat.filter((x) => x.status.id === "weak" || x.status.id === "none");
        if (bad.length > 0) {
            const spend = bad.reduce((s, x) => s + num(x.c.ad_spend), 0);
            items.push({
                id: "campaigns",
                tone: "warn",
                text: `${fmtInt(bad.length)} ${bad.length === 1 ? "campaign costs" : "campaigns cost"} well over your account cost per result, or ${bad.length === 1 ? "has" : "have"} no results, and ${bad.length === 1 ? "takes" : "take"} ${fmtDec(totalSpend > 0 ? (spend / totalSpend) * 100 : 0, 0)}% of spend.`,
                action: { label: "Review campaigns", tab: "campaigns" },
            });
        }
        const strong = stat.filter((x) => x.status.id === "strong").sort((a, b) => num(b.c.leads) + num(b.c.conversions) - (num(a.c.leads) + num(a.c.conversions)))[0];
        if (strong) {
            items.push({ id: "strong", tone: "ok", text: `${strong.c.campaign_name} delivers results at a cost well under the account average, so it is the first place to add budget.`, action: { label: "Open campaigns", tab: "campaigns" } });
        }
        if (weekdays.enough && weekdays.bestCost) {
            items.push({ id: "week", tone: "ok", text: `${weekdays.bestCost.label} is the cheapest day for ${leadsMode ? "leads" : "clicks"}, at ${fmtDec(weekdays.bestCost.cost, 2)} kr. each. Weekends are usually quiet for B2B.` });
        }
        return items.slice(0, 5);
    }, [prev, cur, vs, campaigns, totalSpend, weekdays, leadsMode]);

    if (!cur) return <div className="apex-sx-alert">No LinkedIn data for this period.</div>;

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-ov-grid--hero">
                <ServiceKpi hero neutral label="Ad spend" value={fmtInt(cur.spend)} unit="kr." cur={cur.spend} prev={pv("spend")} vs={vs} caption="LinkedIn Ads" />
                <ServiceKpi label="Leads" icon={FiUserPlus} value={fmtInt(cur.leads)} cur={cur.leads} prev={pv("leads")} vs={vs} caption={cur.formOpens > 0 ? `${fmtInt(cur.formOpens)} form opens` : "Lead Gen Form submits"} />
                <ServiceKpi label="Cost per lead" icon={FiTarget} cost value={isNum(cur.cpl) ? fmtInt(cur.cpl) : "-"} unit="kr." cur={cur.cpl} prev={pv("cpl")} goodUp={false} vs={vs} caption="CPL" />
                <ServiceKpi label="Web conversions" icon={FiShoppingCart} value={fmtInt(cur.conversions)} cur={cur.conversions} prev={pv("conversions")} vs={vs} caption={isNum(cur.costPerConversion) ? `${fmtInt(cur.costPerConversion)} kr. each` : "Insight Tag events"} />
            </div>

            <div className="apex-ov-grid apex-sx-grid-4">
                <ServiceKpi label="Impressions" icon={FiEye} value={fmtInt(cur.impressions)} cur={cur.impressions} prev={pv("impressions")} vs={vs} caption={`CPM ${fmtDec(cur.cpm, 0)} kr.`} />
                <ServiceKpi label="Clicks" icon={FiMousePointer} value={fmtInt(cur.clicks)} cur={cur.clicks} prev={pv("clicks")} vs={vs} caption={`CPC ${fmtDec(cur.cpc, 2)} kr.`} />
                <ServiceKpi label="Click-through rate" icon={FiPercent} value={fmtDec(cur.ctr, 2)} unit="%" cur={cur.ctr} prev={pv("ctr")} vs={vs} caption="Landing page clicks per impression" />
                <ServiceKpi label="Form completion" icon={FiActivity} value={isNum(cur.formCompletion) ? fmtDec(cur.formCompletion, 0) : "-"} unit="%" cur={cur.formCompletion} prev={pv("formCompletion")} vs={vs} caption="Leads per form open" />
            </div>

            <section className="apex-ov-card apex-sx-chartcard">
                <div className="apex-ov-card__head">
                    <h3>Performance over time</h3>
                    <div className="apex-sx-chips" role="group" aria-label="Chart metrics">
                        {CHART_CHIPS.map((c) => (
                            <button key={c.key} type="button" className={`apex-perf-chip${selectedMetrics.includes(c.key) ? " is-active" : ""}`} aria-pressed={selectedMetrics.includes(c.key)} onClick={() => toggleMetric(c.key)}>
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>
                <GraphCard key={`chart-${selectedMetrics.join("|")}`} variant="cobalt" hideChartToggle title="" chartType="line" height={300} chartOptions={chart.options} chartSeries={chart.series} />
                <p className="apex-mk-note">
                    {single ? "Select other metrics to compare them." : "Each metric is scaled to its own maximum (0 to 100%) so the curves share one axis. Hover for the real values."} Dips on weekends are normal for B2B.
                </p>
            </section>

            <div className="apex-ov-grid apex-sx-split">
                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>From impression to lead</h3>
                        <span className="apex-ov-sub">Where people drop out</span>
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
                                <div className="apex-em-funnel__cap">{i === 0 ? "Times your ads were shown" : `${fmtDec((s.fromPrev ?? 0) * 100, s.id === "leads" || s.id === "web" ? 1 : 1)}% of ${(s.fromLabel || "").toLowerCase()}`}</div>
                            </div>
                        ))}
                    </div>
                    <p className="apex-mk-note">Bars use a square-root scale so the small steps stay visible. Lead Gen Form leads and website conversions are separate outcomes and can overlap.</p>
                </section>

                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>Reach and engagement</h3>
                        <span className="apex-ov-sub">Whole period</span>
                    </div>
                    {cur.reach != null ? (
                        <div className="apex-sp-tiles apex-li-tiles">
                            <div className="apex-sp-tile">
                                <span className="apex-ov-ic"><FiUsers aria-hidden /></span>
                                <small>Members reached</small>
                                <b>{compact(cur.reach)}</b>
                            </div>
                            <div className="apex-sp-tile">
                                <span className="apex-ov-ic"><FiEye aria-hidden /></span>
                                <small>Frequency</small>
                                <b>{isNum(cur.frequency) ? fmtDec(cur.frequency, 2) : "-"}</b>
                            </div>
                            <div className="apex-sp-tile">
                                <span className="apex-ov-ic"><FiHeart aria-hidden /></span>
                                <small>Engagement rate</small>
                                <b>{isNum(cur.engagementRate) ? `${fmtDec(cur.engagementRate, 2)}%` : "-"}</b>
                            </div>
                            <div className="apex-sp-tile">
                                <span className="apex-ov-ic"><FiTarget aria-hidden /></span>
                                <small>Cost per member reached</small>
                                <b>{cur.reach > 0 ? `${fmtDec(cur.spend / cur.reach, 2)} kr.` : "-"}</b>
                            </div>
                        </div>
                    ) : (
                        <p className="apex-mk-note apex-sx-empty-note">LinkedIn returns unique reach for ranges up to 92 days. Pick a shorter range to see it.</p>
                    )}
                    <p className="apex-mk-note">Reach is LinkedIn&apos;s approximate unique members. Engagement counts clicks, reactions, comments, shares and follows.</p>
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
                        <span className="apex-ov-sub">Avg. {leadsMode ? "leads" : "clicks"} per weekday</span>
                    </div>
                    {weekdays.enough ? (
                        <>
                            <div className="apex-sx-week">
                                {weekdays.days.map((d) => (
                                    <div key={d.label} className={`apex-sx-week__day${d.isBest ? " is-best" : ""}`} title={`${d.label}: ${fmtDec(d.avg, 1)} ${leadsMode ? "leads" : "clicks"}`}>
                                        <span className="apex-sx-week__val">{fmtDec(d.avg, d.avg < 10 ? 1 : 0)}</span>
                                        <div className="apex-sx-week__bar">
                                            <i style={{ height: `${Math.max(4, d.index * 100)}%` }} />
                                        </div>
                                        <span className="apex-sx-week__lbl">{d.label}</span>
                                        <span className="apex-sx-week__roas">{d.cost != null ? fmtDec(d.cost, 1) : "-"}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="apex-mk-note">Bars show the average per day, the number below each is the cost in kr. per {leadsMode ? "lead" : "click"}.</p>
                        </>
                    ) : (
                        <p className="apex-mk-note apex-sx-empty-note">Pick a range of at least two weeks to see which weekdays perform best.</p>
                    )}
                </section>
            </div>
        </div>
    );
}

