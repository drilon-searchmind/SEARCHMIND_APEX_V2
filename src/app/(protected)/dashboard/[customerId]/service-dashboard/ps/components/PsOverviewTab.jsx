"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
    FiActivity,
    FiArrowRight,
    FiBarChart2,
    FiEye,
    FiHeart,
    FiMousePointer,
    FiShoppingCart,
    FiTarget,
    FiTrendingUp,
    FiUsers,
} from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
import { COMMERCE_CHART_CHROME, METRIC_CHART_PALETTE } from "@/components/dashboard/chartColors";
import { hexWithAlpha } from "@/lib/charts/chartSeriesColors";
import { resolveDailyComparisonDate, COMPARISON_METHOD } from "@/lib/dateRangeComparison";
import { CHART_METRIC_LABELS, getDailyMetricValue, normalizeSeriesValues } from "@/lib/facebookPsDashboardUtils";
import { campaignStatus, weekdayEfficiency } from "@/lib/ppcAnalytics";
import { FATIGUE_FREQUENCY, creativeStatus, funnelStages, placementDelivery, summarizePs } from "@/lib/psAnalytics";
import {
    DeltaChip,
    ServiceDonut,
    ServiceKpi,
    ServiceTag,
    compact,
    fmtDec,
    fmtInt,
    fmtKr,
    fmtPctPoints,
    fmtShare,
    isNum,
    num,
    vsCaption,
} from "@/components/dashboard/ServiceParts";

const CHART_CHIPS = [
    { key: "ad_spend", label: "Spend" },
    { key: "conversion_value", label: "Revenue" },
    { key: "roas", label: "ROAS" },
    { key: "conversions", label: "Conversions" },
    { key: "link_clicks", label: "Link clicks" },
    { key: "impressions", label: "Impressions" },
    { key: "ctr", label: "CTR" },
    { key: "cpm", label: "CPM" },
    { key: "cpc", label: "CPC" },
    { key: "cpa", label: "CPA" },
    { key: "conv_rate", label: "Conv. rate" },
];

/** Metrics measured in kr. can share one axis and be shown with real values together. */
const MONEY_KEYS = new Set(["ad_spend", "conversion_value"]);

const STAGE_COLORS = { prospecting: "#2563EB", retargeting: "#EA580C", other: "#7C3AED" };
const CUSTOMER_COLORS = { new: "#0891B2", returning: "#CA8A04" };

function formatMetric(key, value) {
    if (!isNum(value)) return "-";
    if (key === "ad_spend" || key === "conversion_value" || key === "cpa") return fmtKr(value);
    if (key === "cpm" || key === "cpc") return `${fmtDec(value, 2)} kr.`;
    if (key === "roas") return fmtDec(value, 2);
    if (key === "ctr" || key === "conv_rate") return fmtPctPoints(value, 2);
    return fmtInt(value);
}

function axisFormat(key, v) {
    if (key === "ctr" || key === "conv_rate") return `${fmtDec(v, 1)}%`;
    if (key === "roas" || key === "cpc" || key === "cpm") return fmtDec(v, 1);
    return compact(v);
}

export default function PsOverviewTab({ data, appliedRange, comparisonMethod, comparisonLabel, onLedeChange, onGoTo }) {
    const { metrics, metricsPrev, campaigns, placements, accountSummary, ads } = data;
    const [selectedMetrics, setSelectedMetrics] = useState(["ad_spend", "conversion_value"]);
    const [hoverCustomer, setHoverCustomer] = useState(null);

    const hasPrev = comparisonMethod !== COMPARISON_METHOD.NONE && metricsPrev.length > 0;
    const vs = vsCaption(comparisonLabel);

    const cur = useMemo(() => summarizePs(metrics, accountSummary), [metrics, accountSummary]);
    const prev = useMemo(() => (hasPrev ? summarizePs(metricsPrev) : null), [hasPrev, metricsPrev]);
    const pv = (key) => (prev ? prev[key] : null);

    useEffect(() => {
        if (!cur) {
            onLedeChange?.(null);
            return;
        }
        let text = `Meta ads turned ${fmtKr(cur.spend)} of spend into ${fmtKr(cur.revenue)} of revenue at a ROAS of ${fmtDec(cur.roas, 2)}`;
        if (prev && num(prev.roas) > 0) {
            const pct = ((cur.roas - prev.roas) / prev.roas) * 100;
            text += ` (${pct > 0 ? "+" : ""}${fmtDec(pct, 1)}% ${vs})`;
        }
        onLedeChange?.(`${text}.`);
    }, [cur, prev, vs, onLedeChange]);

    // ── Trend chart ──
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
            const label = CHART_METRIC_LABELS[key] || CHART_CHIPS.find((c) => c.key === key)?.label || key;
            const color = METRIC_CHART_PALETTE[idx % METRIC_CHART_PALETTE.length];
            const curRaw = dates.map((d) => getDailyMetricValue(byDate[d], key));
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
                    return getDailyMetricValue(prevDate ? prevByDate[prevDate] : null, key);
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

    // ── Insights ──
    const stages = useMemo(() => funnelStages(campaigns), [campaigns]);
    const weekdays = useMemo(
        () => weekdayEfficiency(metrics, { spendKey: "ad_spend", revenueKey: "conversion_value" }),
        [metrics]
    );
    const delivery = useMemo(() => placementDelivery(placements), [placements]);
    const totalSpend = num(cur?.spend);
    const statuses = useMemo(
        () => campaigns.map((c) => ({ campaign: c, status: campaignStatus({ ...c, ad_spend: c.ad_spend, roas: c.roas }, num(cur?.roas), totalSpend) })),
        [campaigns, cur, totalSpend]
    );
    const adTotal = useMemo(() => ads.reduce((s, a) => s + num(a.spend), 0), [ads]);
    const fatigued = useMemo(
        () => ads.filter((a) => creativeStatus(a, num(cur?.roas), adTotal).fatigue),
        [ads, cur, adTotal]
    );

    const newRatio = accountSummary?.new_customer_ratio;
    const recRatio = accountSummary?.recurring_customer_ratio;
    const customerItems =
        isNum(newRatio) && isNum(recRatio)
            ? [
                  { id: "new", name: "New customers", value: Number(newRatio), color: CUSTOMER_COLORS.new },
                  { id: "returning", name: "Returning customers", value: Number(recRatio), color: CUSTOMER_COLORS.returning },
              ]
            : [];
    const customerFocus = customerItems.find((i) => i.id === hoverCustomer) || customerItems[0];

    const attention = useMemo(() => {
        const items = [];
        if (prev && num(prev.roas) > 0) {
            const pct = ((cur.roas - prev.roas) / prev.roas) * 100;
            if (pct <= -10) items.push({ id: "roas", tone: "bad", text: `ROAS fell ${fmtDec(Math.abs(pct), 1)}% ${vs}, from ${fmtDec(prev.roas, 2)} to ${fmtDec(cur.roas, 2)}.` });
            else if (pct >= 10) items.push({ id: "roas", tone: "ok", text: `ROAS is up ${fmtDec(pct, 1)}% ${vs}, from ${fmtDec(prev.roas, 2)} to ${fmtDec(cur.roas, 2)}.` });
        }
        if (fatigued.length > 0) {
            const spend = fatigued.reduce((s, a) => s + num(a.spend), 0);
            items.push({
                id: "fatigue",
                tone: "warn",
                text: `${fmtInt(fatigued.length)} ${fatigued.length === 1 ? "creative has" : "creatives have"} passed a frequency of ${fmtDec(FATIGUE_FREQUENCY, 1)} and ${fatigued.length === 1 ? "carries" : "carry"} ${fmtKr(spend)} of spend. Check whether the audience is tiring of them.`,
                action: { label: "Open creatives", tab: "creatives" },
            });
        }
        const weak = delivery.filter((d) => d.verdict.id === "under");
        if (weak.length > 0) {
            const share = weak.reduce((s, d) => s + d.spendShare, 0);
            items.push({
                id: "placements",
                tone: "warn",
                text: `${weak.map((d) => d.placement).join(", ")} ${weak.length === 1 ? "takes" : "take"} ${fmtShare(share, 0)} of spend and return well under their share.`,
                action: { label: "Open placements", tab: "placements" },
            });
        }
        const cut = statuses.filter((s) => s.status.id === "cut" || s.status.id === "watch");
        if (cut.length > 0) {
            const spend = cut.reduce((s, x) => s + num(x.campaign.ad_spend), 0);
            items.push({
                id: "campaigns",
                tone: "warn",
                text: `${fmtInt(cut.length)} ${cut.length === 1 ? "campaign returns" : "campaigns return"} well below your account ROAS and ${cut.length === 1 ? "takes" : "take"} ${fmtShare(totalSpend > 0 ? spend / totalSpend : 0, 0)} of spend.`,
                action: { label: "Review campaigns", tab: "campaigns" },
            });
        }
        const scale = statuses.filter((s) => s.status.id === "scale").sort((a, b) => num(b.campaign.roas) - num(a.campaign.roas))[0];
        if (scale) {
            items.push({
                id: "scale",
                tone: "ok",
                text: `${scale.campaign.campaign_name} returns a ROAS of ${fmtDec(scale.campaign.roas, 2)} against ${fmtDec(cur.roas, 2)} for the account.`,
                action: { label: "Open campaigns", tab: "campaigns" },
            });
        }
        return items.slice(0, 5);
    }, [prev, cur, vs, fatigued, delivery, statuses, totalSpend]);

    const retargeting = stages.find((s) => s.id === "retargeting");
    const prospecting = stages.find((s) => s.id === "prospecting");

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-ov-grid--hero">
                <ServiceKpi hero neutral label="Ad spend" value={fmtInt(cur.spend)} unit="kr." cur={cur.spend} prev={pv("spend")} vs={vs} caption="Meta ads" />
                <ServiceKpi label="Revenue" icon={FiBarChart2} value={fmtInt(cur.revenue)} unit="kr." cur={cur.revenue} prev={pv("revenue")} vs={vs} caption="Purchase value" />
                <ServiceKpi label="ROAS" icon={FiTrendingUp} value={fmtDec(cur.roas, 2)} cur={cur.roas} prev={pv("roas")} vs={vs} caption="Revenue per kr. spent" />
                <ServiceKpi label="Conversions" icon={FiShoppingCart} value={fmtInt(cur.conversions)} cur={cur.conversions} prev={pv("conversions")} vs={vs} caption={isNum(cur.aov) ? `Avg. order ${fmtInt(cur.aov)} kr.` : "Purchases"} />
            </div>

            <div className="apex-ov-grid apex-sx-grid-4">
                <ServiceKpi label="Cost per purchase" icon={FiTarget} cost value={fmtInt(cur.cpa)} unit="kr." cur={cur.cpa} prev={pv("cpa")} goodUp={false} vs={vs} caption="CPA" />
                <ServiceKpi label="Cost per 1.000 views" icon={FiEye} cost value={fmtDec(cur.cpm, 1)} unit="kr." cur={cur.cpm} prev={pv("cpm")} goodUp={false} vs={vs} caption="CPM" />
                <ServiceKpi label="Link click-through" icon={FiMousePointer} value={fmtDec(cur.ctr, 2)} unit="%" cur={cur.ctr} prev={pv("ctr")} vs={vs} caption={`${compact(cur.link_clicks)} link clicks at ${fmtDec(cur.cpc, 2)} kr.`} />
                <ServiceKpi label="Conversion rate" icon={FiActivity} value={fmtDec(cur.conv_rate, 2)} unit="%" cur={cur.conv_rate} prev={pv("conv_rate")} vs={vs} caption="Purchases per link click" />
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
                        <h3>Funnel balance</h3>
                        <span className="apex-ov-sub">Share of spend against share of revenue</span>
                    </div>
                    {stages.length ? (
                        <>
                            <div className="apex-sp-stages">
                                {stages.map((s) => (
                                    <div key={s.id} className="apex-sp-stage">
                                        <div className="apex-sp-stage__top">
                                            <span className="apex-sp-stage__name">
                                                <i style={{ background: STAGE_COLORS[s.id] }} aria-hidden />
                                                {s.label}
                                            </span>
                                            <span>
                                                ROAS <b>{fmtDec(s.roas, 2)}</b>
                                            </span>
                                            <span>
                                                CPA <b>{s.cpa != null ? fmtKr(s.cpa) : "-"}</b>
                                            </span>
                                            <span>
                                                Freq. <b>{s.frequency != null ? fmtDec(s.frequency, 1) : "-"}</b>
                                            </span>
                                        </div>
                                        <div className="apex-sp-pair">
                                            <span>Spend</span>
                                            <div className="apex-ov-bar">
                                                <i style={{ width: `${s.spendShare * 100}%`, background: STAGE_COLORS[s.id] }} />
                                            </div>
                                            <b>{fmtShare(s.spendShare, 0)}</b>
                                        </div>
                                        <div className="apex-sp-pair">
                                            <span>Revenue</span>
                                            <div className="apex-ov-bar">
                                                <i style={{ width: `${s.revenueShare * 100}%`, background: hexWithAlpha(STAGE_COLORS[s.id], 0.55) }} />
                                            </div>
                                            <b>{fmtShare(s.revenueShare, 0)}</b>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {retargeting && prospecting ? (
                                <p className="apex-sx-callout">
                                    Retargeting brings <b>{fmtShare(retargeting.revenueShare, 0)}</b> of revenue on <b>{fmtShare(retargeting.spendShare, 0)}</b> of spend, while prospecting
                                    holds <b>{fmtShare(prospecting.spendShare, 0)}</b> of spend at a ROAS of <b>{fmtDec(prospecting.roas, 2)}</b>. Retargeting can only harvest the
                                    audience prospecting builds, so read the two together rather than cutting the lower ROAS.
                                </p>
                            ) : null}
                        </>
                    ) : (
                        <p className="apex-mk-note apex-sx-empty-note">No campaign data for this period.</p>
                    )}
                </section>

                <div className="apex-sx-col">
                    <section className="apex-ov-card">
                        <div className="apex-ov-card__head">
                            <h3>Audience</h3>
                            <span className="apex-ov-sub">Whole period</span>
                        </div>
                        <div className="apex-sp-tiles">
                            <div className="apex-sp-tile">
                                <span className="apex-ov-ic"><FiUsers aria-hidden /></span>
                                <small>Reach</small>
                                <b>{isNum(cur.reach) ? compact(cur.reach) : "-"}</b>
                            </div>
                            <div className="apex-sp-tile">
                                <span className="apex-ov-ic"><FiEye aria-hidden /></span>
                                <small>Frequency</small>
                                <b>{isNum(cur.frequency) ? fmtDec(cur.frequency, 2) : "-"}</b>
                                {isNum(cur.frequency) && cur.frequency >= FATIGUE_FREQUENCY ? <ServiceTag tone="warn">High</ServiceTag> : null}
                            </div>
                            <div className="apex-sp-tile">
                                <span className="apex-ov-ic"><FiHeart aria-hidden /></span>
                                <small>Engagement</small>
                                <b>{isNum(cur.engagement_rate) ? `${fmtDec(cur.engagement_rate, 2)}%` : "-"}</b>
                                <DeltaChip cur={cur.engagement_rate} prev={pv("engagement_rate")} compactSize />
                            </div>
                        </div>
                    </section>

                    {customerItems.length > 0 ? (
                        <section className="apex-ov-card">
                            <div className="apex-ov-card__head">
                                <h3>Customer mix</h3>
                                <span className="apex-ov-sub">Ads revenue</span>
                            </div>
                            <div className="apex-sx-mix">
                                <ServiceDonut
                                    items={customerItems}
                                    centerSmall={customerFocus?.name}
                                    centerBig={`${fmtDec(customerFocus?.value, 0)}%`}
                                    active={hoverCustomer}
                                    onHover={setHoverCustomer}
                                />
                                <div className="apex-sx-mix__list">
                                    {customerItems.map((m) => (
                                        <div key={m.id} className="apex-sx-mix__row" onMouseEnter={() => setHoverCustomer(m.id)} onMouseLeave={() => setHoverCustomer(null)}>
                                            <i style={{ background: m.color }} aria-hidden />
                                            <span>{m.name}</span>
                                            <b>{fmtDec(m.value, 0)}%</b>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>
                    ) : null}
                </div>
            </div>

            <div className="apex-ov-grid apex-sx-split-even">
                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>What to look at</h3>
                        <span className="apex-ov-sub">Based on this period</span>
                    </div>
                    {attention.length === 0 ? (
                        <p className="apex-mk-note apex-sx-empty-note">Nothing stands out in this period. Spend, return and creatives look in balance.</p>
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
                        <span className="apex-ov-sub">Avg. revenue per weekday</span>
                    </div>
                    {weekdays.enough ? (
                        <>
                            <div className="apex-sx-week">
                                {weekdays.days.map((d) => (
                                    <div key={d.label} className={`apex-sx-week__day${d.isBest ? " is-best" : ""}`} title={`${d.label}: ${fmtInt(d.avgRevenue)} kr. revenue, ROAS ${fmtDec(d.roas, 2)}`}>
                                        <span className="apex-sx-week__val">{compact(d.avgRevenue)}</span>
                                        <div className="apex-sx-week__bar">
                                            <i style={{ height: `${Math.max(4, d.index * 100)}%` }} />
                                        </div>
                                        <span className="apex-sx-week__lbl">{d.label}</span>
                                        <span className="apex-sx-week__roas">{fmtDec(d.roas, 1)}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="apex-mk-note">
                                Bars show average revenue, the number below each day is its ROAS. ROAS is best on {weekdays.best.label} ({fmtDec(weekdays.best.roas, 2)}) and weakest on {weekdays.worst.label} ({fmtDec(weekdays.worst.roas, 2)}).
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
