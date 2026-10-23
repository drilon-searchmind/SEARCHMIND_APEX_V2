"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
    FiActivity,
    FiArrowRight,
    FiBarChart2,
    FiCalendar,
    FiMail,
    FiMousePointer,
    FiSend,
    FiShoppingCart,
    FiUserX,
} from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
import { COMMERCE_CHART_CHROME, METRIC_CHART_PALETTE } from "@/components/dashboard/chartColors";
import { hexWithAlpha } from "@/lib/charts/chartSeriesColors";
import { resolveDailyComparisonDate, COMPARISON_METHOD } from "@/lib/dateRangeComparison";
import { EM_CHART_METRIC_LABELS, getEmDailyMetricValue, normalizeSeriesValues } from "@/lib/emDashboardUtils";
import { campaignUpside, emRates, funnelSteps, groupStats, mergeRows, rpeStatus, sumRows } from "@/lib/emAnalytics";
import {
    ServiceDonut,
    ServiceKpi,
    ServiceTag,
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
    { key: "revenue", label: "Revenue" },
    { key: "conversions", label: "Orders" },
    { key: "emails_sent", label: "Emails sent" },
    { key: "opens", label: "Opens" },
    { key: "clicks", label: "Clicks" },
    { key: "open_rate", label: "Open rate" },
    { key: "click_rate", label: "Click rate" },
    { key: "rpe", label: "Revenue per email" },
    { key: "unsubscribes", label: "Unsubscribes" },
];

const CHANNEL_COLORS = { campaign: "#2563EB", flow: "#EA580C" };
const FUNNEL_COLORS = ["#111A12", "#2F8434", "#5DBB58", "#A9EDA2"];

function formatMetric(key, value) {
    if (!isNum(value)) return "-";
    if (key === "revenue") return fmtKr(value);
    if (key === "rpe") return `${fmtDec(value, 2)} kr.`;
    if (key === "open_rate" || key === "click_rate") return `${fmtDec(value, 1)}%`;
    return fmtInt(value);
}

function axisFormat(key, v) {
    if (key === "open_rate" || key === "click_rate") return `${fmtDec(v, 0)}%`;
    if (key === "rpe") return fmtDec(v, 1);
    return compact(v);
}

export default function EmOverviewTab({ data, appliedRange, comparisonMethod, comparisonLabel, onLedeChange, onGoTo }) {
    const { campaignTotals, campaignTotalsPrev, topCampaigns, flowTotals, flowDaily, flowDailyPrev, upcoming, flowsLoading, flowsError, dailyLoading, prevLoading } = data;
    const [selectedMetrics, setSelectedMetrics] = useState(["revenue"]);
    const [hoverChannel, setHoverChannel] = useState(null);

    const vs = vsCaption(comparisonLabel);
    const flowPrevTotals = useMemo(() => sumRows(flowDailyPrev), [flowDailyPrev]);
    const hasPrev = comparisonMethod !== COMPARISON_METHOD.NONE && !!campaignTotalsPrev && flowDailyPrev.length > 0 && !!flowTotals;

    const total = useMemo(() => mergeRows(campaignTotals, flowTotals), [campaignTotals, flowTotals]);
    const totalPrev = useMemo(() => (hasPrev ? mergeRows(campaignTotalsPrev, flowPrevTotals) : null), [hasPrev, campaignTotalsPrev, flowPrevTotals]);
    const cur = useMemo(() => emRates(total), [total]);
    const prev = useMemo(() => emRates(totalPrev), [totalPrev]);
    const pv = (key) => (prev ? prev[key] : null);
    const campaignRates = useMemo(() => emRates(campaignTotals), [campaignTotals]);
    const flowRates = useMemo(() => emRates(flowTotals), [flowTotals]);

    useEffect(() => {
        if (!cur) {
            onLedeChange?.(null);
            return;
        }
        let text = `Email brought ${fmtKr(cur.revenue)} in revenue from ${fmtInt(cur.recipients)} emails`;
        if (prev && num(prev.revenue) > 0) {
            const pct = ((cur.revenue - prev.revenue) / prev.revenue) * 100;
            text += ` (${pct > 0 ? "+" : ""}${fmtDec(pct, 1)}% ${vs})`;
        }
        if (!flowTotals) text += ", campaigns only so far";
        onLedeChange?.(`${text}.`);
    }, [cur, prev, vs, flowTotals, onLedeChange]);

    // ── Daily flow chart ──
    const single = selectedMetrics.length === 1;
    const chart = useMemo(() => {
        if (flowDaily.length < 2) return null;
        const dates = flowDaily.map((r) => r.date);
        const byDate = Object.fromEntries(flowDaily.map((r) => [r.date, r]));
        const prevByDate = Object.fromEntries(flowDailyPrev.map((r) => [r.date, r]));
        const sortedPrevDates = flowDailyPrev.map((r) => r.date).sort();
        const hasCompare = comparisonMethod !== COMPARISON_METHOD.NONE && flowDailyPrev.length > 0;
        const series = [];
        const meta = [];
        selectedMetrics.forEach((key, idx) => {
            const label = EM_CHART_METRIC_LABELS[key] || key;
            const color = METRIC_CHART_PALETTE[idx % METRIC_CHART_PALETTE.length];
            const curRaw = dates.map((d) => getEmDailyMetricValue(byDate[d], key));
            series.push({ name: label, type: single ? "area" : "line", data: single ? curRaw : normalizeSeriesValues(curRaw) });
            meta.push({ key, raw: curRaw, color, prev: false });
            if (hasCompare) {
                const prevRaw = dates.map((d) => {
                    const prevDate = resolveDailyComparisonDate({
                        comparisonMethod,
                        currentDate: d,
                        appliedStartDate: appliedRange.startDate,
                        appliedEndDate: appliedRange.endDate,
                        sortedPrevKeys: sortedPrevDates,
                    });
                    return getEmDailyMetricValue(prevDate ? prevByDate[prevDate] : null, key);
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
    }, [flowDaily, flowDailyPrev, selectedMetrics, single, comparisonMethod, appliedRange.startDate, appliedRange.endDate, vs]);

    const toggleMetric = (key) =>
        setSelectedMetrics((list) => {
            if (list.includes(key)) return list.length > 1 ? list.filter((k) => k !== key) : list;
            return [...list, key];
        });

    // ── Insights ──
    const funnel = useMemo(() => funnelSteps(total), [total]);
    const campaignStats = useMemo(() => groupStats(topCampaigns), [topCampaigns]);
    const upside = useMemo(() => campaignUpside(topCampaigns), [topCampaigns]);

    const channelItems = [
        { id: "campaign", name: "Campaigns", value: num(campaignTotals?.conversion_value), color: CHANNEL_COLORS.campaign },
        { id: "flow", name: "Flows", value: num(flowTotals?.conversion_value), color: CHANNEL_COLORS.flow },
    ].filter((i) => i.value > 0);
    const channelSum = channelItems.reduce((s, i) => s + i.value, 0);
    const channelFocus = channelItems.find((i) => i.id === hoverChannel) || channelItems[0];

    const attention = useMemo(() => {
        const items = [];
        if (prev && num(prev.revenue) > 0) {
            const pct = ((cur.revenue - prev.revenue) / prev.revenue) * 100;
            if (pct <= -10) items.push({ id: "rev", tone: "bad", text: `Email revenue fell ${fmtDec(Math.abs(pct), 1)}% ${vs}, from ${fmtKr(prev.revenue)} to ${fmtKr(cur.revenue)}` });
            else if (pct >= 10) items.push({ id: "rev", tone: "ok", text: `Email revenue is up ${fmtDec(pct, 1)}% ${vs}, from ${fmtKr(prev.revenue)} to ${fmtKr(cur.revenue)}` });
        }
        if (flowRates && campaignRates && num(flowRates.recipients) > 0 && cur.revenue > 0) {
            const share = flowRates.revenue / cur.revenue;
            const sendShare = flowRates.recipients / cur.recipients;
            items.push({
                id: "flows",
                tone: "ok",
                text: `Flows bring ${fmtShare(share, 0)} of email revenue from ${fmtShare(sendShare, 0)} of the emails, at ${fmtDec(flowRates.rpe, 2)} kr. per email against ${fmtDec(campaignRates.rpe, 2)} kr. for campaigns.`,
                action: { label: "Open flows", tab: "flows" },
            });
        }
        const unsubHigh = topCampaigns
            .filter((c) => num(c.recipients) >= 1000 && campaignStats.unsubPerK && (num(c.unsubscribes) / num(c.recipients)) * 1000 >= campaignStats.unsubPerK * 2)
            .sort((a, b) => num(b.unsubscribes) / num(b.recipients) - num(a.unsubscribes) / num(a.recipients));
        if (unsubHigh.length > 0) {
            items.push({
                id: "unsub",
                tone: "warn",
                text: `${fmtInt(unsubHigh.length)} ${unsubHigh.length === 1 ? "campaign lost" : "campaigns lost"} unsubscribers at twice the campaign average or more, ${unsubHigh[0].campaign_name} the most.`,
                action: { label: "Open campaigns", tab: "campaigns" },
            });
        }
        const weak = topCampaigns.filter((c) => rpeStatus(c, campaignStats.rpe, campaignStats.recipients).id === "weak");
        if (weak.length > 0) {
            const sends = weak.reduce((s, c) => s + num(c.recipients), 0);
            items.push({
                id: "weak",
                tone: "warn",
                text: `${fmtInt(weak.length)} ${weak.length === 1 ? "campaign earned" : "campaigns earned"} under 40% of the average revenue per email and used ${fmtShare(campaignStats.recipients > 0 ? sends / campaignStats.recipients : 0, 0)} of campaign sends.`,
                action: { label: "Review campaigns", tab: "campaigns" },
            });
        }
        return items.slice(0, 5);
    }, [prev, cur, vs, flowRates, campaignRates, topCampaigns, campaignStats]);

    const scheduled = useMemo(
        () =>
            [...upcoming]
                .filter((c) => c.scheduledAt)
                .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)))
                .slice(0, 5),
        [upcoming]
    );

    if (!cur) {
        return <div className="apex-sx-alert">No email data for this period.</div>;
    }

    const chartNote = single
        ? "Klaviyo only reports a daily series for automated flows, so this chart shows flows. Campaigns are in the numbers above. Select more metrics to compare them."
        : "Each metric is scaled to its own maximum (0 to 100%) so the curves share one axis. Hover for the real values. Flows only, as Klaviyo has no daily series for campaigns.";

    return (
        <div className="apex-sx-stack">
            {flowsLoading || flowsError ? (
                <div className="apex-sx-alert apex-em-partial">
                    {flowsError ? `Flow numbers could not be loaded (${flowsError}). Showing campaigns only.` : "Showing campaigns first. Flow numbers are still loading and will be added to the totals."}
                </div>
            ) : null}

            <div className="apex-ov-grid apex-ov-grid--hero">
                <ServiceKpi hero neutral label="Email revenue" value={fmtInt(cur.revenue)} unit="kr." cur={cur.revenue} prev={pv("revenue")} vs={vs} caption={flowTotals ? "Campaigns and flows" : "Campaigns so far"} />
                <ServiceKpi label="Orders" icon={FiShoppingCart} value={fmtInt(cur.conversions)} cur={cur.conversions} prev={pv("conversions")} vs={vs} caption={isNum(cur.aov) ? `Avg. order ${fmtInt(cur.aov)} kr.` : "Placed orders"} />
                <ServiceKpi label="Emails sent" icon={FiSend} value={fmtInt(cur.recipients)} cur={cur.recipients} prev={pv("recipients")} vs={vs} neutral caption="Messages delivered" />
                <ServiceKpi label="Revenue per email" icon={FiBarChart2} value={fmtDec(cur.rpe, 2)} unit="kr." cur={cur.rpe} prev={pv("rpe")} vs={vs} caption="The yardstick for every send" />
            </div>

            <div className="apex-ov-grid apex-sx-grid-4">
                <ServiceKpi label="Open rate" icon={FiMail} value={fmtDec((cur.openRate ?? 0) * 100, 1)} unit="%" cur={cur.openRate} prev={pv("openRate")} vs={vs} caption="Includes Apple automatic opens" />
                <ServiceKpi label="Click rate" icon={FiMousePointer} value={fmtDec((cur.clickRate ?? 0) * 100, 2)} unit="%" cur={cur.clickRate} prev={pv("clickRate")} vs={vs} caption={`${compact(cur.clicks)} clicks`} />
                <ServiceKpi label="Click-to-open" icon={FiActivity} value={fmtDec((cur.ctor ?? 0) * 100, 1)} unit="%" cur={cur.ctor} prev={pv("ctor")} vs={vs} caption="Clicks per open" />
                <ServiceKpi label="Unsubscribes per 1.000" icon={FiUserX} cost value={fmtDec(cur.unsubPerK, 2)} unit="" cur={cur.unsubPerK} prev={pv("unsubPerK")} goodUp={false} vs={vs} caption={`${fmtInt(cur.unsubscribes)} unsubscribed`} />
            </div>

            <section className="apex-ov-card apex-sx-chartcard">
                <div className="apex-ov-card__head">
                    <h3>Flows over time</h3>
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
                {dailyLoading || (!chart && prevLoading) ? (
                    <div className="apex-em-skeleton" role="status" aria-live="polite">
                        <span className="apex-em-skeleton__bar" />
                        <p>Loading the daily series from Klaviyo. The rest of the page is ready to use.</p>
                    </div>
                ) : chart ? (
                    <>
                        <GraphCard
                            key={`chart-${selectedMetrics.join("|")}-${flowDailyPrev.length}`}
                            variant="cobalt"
                            hideChartToggle
                            title=""
                            chartType="line"
                            height={300}
                            chartOptions={chart.options}
                            chartSeries={chart.series}
                        />
                        <p className="apex-mk-note">
                            {chartNote}
                            {prevLoading ? " The comparison period is still loading." : ""}
                        </p>
                    </>
                ) : (
                    <p className="apex-mk-note apex-sx-empty-note">Klaviyo did not return a daily flow series for this period.</p>
                )}
            </section>

            <div className="apex-ov-grid apex-sx-split">
                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>From send to order</h3>
                        <span className="apex-ov-sub">All email in the period</span>
                    </div>
                    <div className="apex-em-funnel">
                        {funnel.map((s, i) => (
                            <div key={s.id} className="apex-em-funnel__row">
                                <div className="apex-em-funnel__top">
                                    <span className="apex-em-funnel__name">
                                        <i style={{ background: FUNNEL_COLORS[i] }} aria-hidden />
                                        {s.label}
                                    </span>
                                    <span>
                                        <b>{fmtInt(s.value)}</b>
                                    </span>
                                </div>
                                <div className="apex-ov-bar">
                                    <i style={{ width: `${Math.max(0.6, (s.ofSent ?? 0) * 100)}%`, background: FUNNEL_COLORS[i] }} />
                                </div>
                                <div className="apex-em-funnel__cap">
                                    {i === 0 ? "Everything Klaviyo delivered" : i === 1 ? `${fmtDec((s.ofSent ?? 0) * 100, 1)}% of emails sent` : `${fmtDec((s.fromPrev ?? 0) * 100, i === 3 ? 1 : 0)}% of ${funnel[i - 1].label.toLowerCase()}, ${fmtDec((s.ofSent ?? 0) * 100, 2)}% of sent`}
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="apex-mk-note">Opens count automatic opens from privacy features such as Apple Mail Privacy Protection, so clicks and orders are the steadier signals.</p>
                </section>

                <div className="apex-sx-col">
                    <section className="apex-ov-card">
                        <div className="apex-ov-card__head">
                            <h3>Campaigns or flows</h3>
                            <span className="apex-ov-sub">Share of revenue</span>
                        </div>
                        {channelSum > 0 && flowTotals ? (
                            <>
                                <div className="apex-sx-mix">
                                    <ServiceDonut
                                        items={channelItems}
                                        centerSmall={channelFocus?.name}
                                        centerBig={fmtShare(channelFocus ? channelFocus.value / channelSum : 0, 0)}
                                        active={hoverChannel}
                                        onHover={setHoverChannel}
                                    />
                                    <div className="apex-sx-mix__list">
                                        {channelItems.map((m) => (
                                            <div key={m.id} className="apex-sx-mix__row" onMouseEnter={() => setHoverChannel(m.id)} onMouseLeave={() => setHoverChannel(null)}>
                                                <i style={{ background: m.color }} aria-hidden />
                                                <span>{m.name}</span>
                                                <b>{fmtKr(m.value)}</b>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="apex-em-pair">
                                    <div>
                                        <small>Campaign revenue per email</small>
                                        <b>{fmtDec(campaignRates?.rpe, 2)} kr.</b>
                                    </div>
                                    <div>
                                        <small>Flow revenue per email</small>
                                        <b>{fmtDec(flowRates?.rpe, 2)} kr.</b>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <p className="apex-mk-note apex-sx-empty-note">{flowsLoading ? "Waiting for the flow numbers." : "No flow revenue in this period."}</p>
                        )}
                    </section>
                </div>
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
                    {upside ? (
                        <p className="apex-sx-callout">
                            If the {fmtInt(upside.count)} campaigns below the median ({fmtDec(upside.medianRpe, 2)} kr. per email) had reached it at their own volume, they would have added roughly{" "}
                            <b>{fmtKr(upside.extra)}</b> (estimate, an upper bound as audiences and offers differ).
                        </p>
                    ) : null}
                </section>

                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>Coming up</h3>
                        <span className="apex-ov-sub">Scheduled in Klaviyo, next 30 days</span>
                    </div>
                    {scheduled.length === 0 ? (
                        <p className="apex-mk-note apex-sx-empty-note">No scheduled campaigns were found. Planned sends will show here once they are scheduled in Klaviyo.</p>
                    ) : (
                        <ul className="apex-em-upcoming">
                            {scheduled.map((c) => (
                                <li key={c.id} className="apex-em-up">
                                    <span className="apex-em-up__date">
                                        <FiCalendar aria-hidden />
                                        <b>{dayjs(c.scheduledAt).format("ddd D MMM")}</b>
                                        <small>{dayjs(c.scheduledAt).format("HH:mm")}</small>
                                    </span>
                                    <span className="apex-em-up__main">
                                        <b title={c.name}>{c.name}</b>
                                        <small>{c.messages?.[0]?.subject || "No subject yet"}</small>
                                    </span>
                                    <ServiceTag tone="neutral">{(c.audiences?.included || []).slice(0, 1).join("") || "Audience not set"}</ServiceTag>
                                </li>
                            ))}
                        </ul>
                    )}
                    <p className="apex-mk-note">Read from Klaviyo as scheduled. Nothing here can be changed from Apex.</p>
                </section>
            </div>
        </div>
    );
}
