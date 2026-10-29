"use client";

import React, { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
    FiActivity,
    FiBarChart2,
    FiDollarSign,
    FiMousePointer,
    FiPercent,
    FiShoppingCart,
    FiTarget,
    FiTrendingUp,
    FiArrowRight,
} from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
import { COMMERCE_CHART_CHROME, METRIC_CHART_PALETTE } from "@/components/dashboard/chartColors";
import { hexWithAlpha } from "@/lib/charts/chartSeriesColors";
import { resolveDailyComparisonDate, COMPARISON_METHOD } from "@/lib/dateRangeComparison";
import {
    getPpcDailyMetricValue,
    normalizeSeriesValues,
    PPC_CHART_METRIC_LABELS,
} from "@/lib/googlePpcDashboardUtils";
import {
    campaignStatus,
    impressionShareBreakdown,
    summarizePpc,
    weekdayEfficiency,
    wastedTerms,
} from "@/lib/ppcAnalytics";
import {
    DeltaChip,
    ServiceDonut,
    ServiceKpi,
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
    { key: "conversions_value", label: "Revenue" },
    { key: "roas", label: "ROAS" },
    { key: "conversions", label: "Conversions" },
    { key: "clicks", label: "Clicks" },
    { key: "impressions", label: "Impressions" },
    { key: "ctr", label: "CTR" },
    { key: "cpc", label: "CPC" },
    { key: "cpa", label: "CPA" },
    { key: "conv_rate", label: "Conv. rate" },
];

/** Metrics measured in kr. can share one axis and be shown with real values together. */
const MONEY_KEYS = new Set(["ad_spend", "conversions_value"]);

/** Won share of impressions and the two ways to lose it. */
const IS_COLORS = { won: "#2F8434", budget: "#CA8A04", rank: "#DC2626", other: "#C9D3C6" };

const TYPE_COLORS = { brand: "#EA580C", generic: "#2563EB", other: "#7C3AED" };
const CUSTOMER_COLORS = { new: "#0891B2", returning: "#CA8A04" };

function formatMetric(key, value) {
    if (!isNum(value)) return "-";
    if (key === "ad_spend" || key === "conversions_value" || key === "cpa") return fmtKr(value);
    if (key === "cpc") return `${fmtDec(value, 2)} kr.`;
    if (key === "roas") return fmtDec(value, 2);
    if (key === "ctr" || key === "conv_rate" || key === "impression_share") return fmtPctPoints(value, 2);
    return fmtInt(value);
}

function axisFormat(key, v) {
    if (key === "ctr" || key === "conv_rate" || key === "impression_share") return `${fmtDec(v, 1)}%`;
    if (key === "roas") return fmtDec(v, 1);
    if (key === "cpc") return fmtDec(v, 1);
    return compact(v);
}

export default function PpcOverviewTab({
    platform = "Google Ads",
    impressionShare = null,
    extra = null,
    data,
    appliedRange,
    comparisonMethod,
    comparisonLabel,
    onLedeChange,
    onGoTo,
}) {
    const { metrics, metricsPrev, campaigns, searchTerms, brandGeneric, accountSummary } = data;
    const [selectedMetrics, setSelectedMetrics] = useState(["ad_spend", "conversions_value"]);
    const [hoverType, setHoverType] = useState(null);
    const [hoverCustomer, setHoverCustomer] = useState(null);

    const hasPrev = comparisonMethod !== COMPARISON_METHOD.NONE && metricsPrev.length > 0;
    const vs = vsCaption(comparisonLabel);

    const cur = useMemo(() => summarizePpc(metrics), [metrics]);
    const prev = useMemo(() => (hasPrev ? summarizePpc(metricsPrev) : null), [hasPrev, metricsPrev]);
    const pv = (key) => (prev ? prev[key] : null);

    useEffect(() => {
        if (!cur) {
            onLedeChange?.(null);
            return;
        }
        let text = `${platform} turned ${fmtKr(cur.spend)} of spend into ${fmtKr(cur.revenue)} of revenue at a ROAS of ${fmtDec(cur.roas, 2)}`;
        if (prev && num(prev.roas) > 0) {
            const pct = ((cur.roas - prev.roas) / prev.roas) * 100;
            text += ` (${pct > 0 ? "+" : ""}${fmtDec(pct, 1)}% ${vs})`;
        }
        onLedeChange?.(`${text}.`);
    }, [cur, prev, vs, platform, onLedeChange]);

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
            const label = PPC_CHART_METRIC_LABELS[key] || CHART_CHIPS.find((c) => c.key === key)?.label || key;
            const color = METRIC_CHART_PALETTE[idx % METRIC_CHART_PALETTE.length];
            const curRaw = dates.map((d) => getPpcDailyMetricValue(byDate[d], key));
            series.push({
                name: label,
                type: single ? "area" : "line",
                data: realValues ? curRaw : normalizeSeriesValues(curRaw),
            });
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
                    return getPpcDailyMetricValue(prevDate ? prevByDate[prevDate] : null, key);
                });
                series.push({
                    name: `${label} (${(vs || "").replace("vs ", "")})`,
                    type: "line",
                    data: realValues ? prevRaw : normalizeSeriesValues(prevRaw),
                });
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

    // ── Impression share over time (stacked, percent) ──
    const isChart = useMemo(() => {
        const rows = metrics.filter((r) => typeof r.impression_share === "number");
        if (!rows.length) return null;
        const dates = rows.map((r) => r.date);
        const pct = (key) => rows.map((r) => Number(((r[key] || 0) * 100).toFixed(1)));
        const series = [
            { name: "Won", data: pct("impression_share") },
            { name: "Lost to budget", data: pct("is_lost_budget") },
            { name: "Lost to rank", data: pct("is_lost_rank") },
        ];
        const colors = [IS_COLORS.won, IS_COLORS.budget, IS_COLORS.rank];
        const options = {
            chart: { stacked: true, toolbar: { show: false }, zoom: { enabled: false }, fontFamily: COMMERCE_CHART_CHROME.fontFamily },
            colors,
            stroke: { width: 1.5, curve: "smooth" },
            fill: { type: "solid", opacity: 0.85 },
            dataLabels: { enabled: false },
            xaxis: {
                categories: dates,
                tickAmount: 4,
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
            yaxis: { min: 0, max: 100, tickAmount: 4, labels: { formatter: (v) => `${Math.round(v)}%` } },
            grid: { borderColor: COMMERCE_CHART_CHROME.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
            legend: { show: false },
            tooltip: {
                theme: "dark",
                shared: true,
                intersect: false,
                x: { formatter: (v, o) => (dates[o?.dataPointIndex] ? dayjs(dates[o.dataPointIndex]).format("ddd, D MMM") : v) },
                y: { formatter: (v) => `${fmtDec(v, 1)}%` },
            },
        };
        return { series, options };
    }, [metrics]);

    // ── Insights ──
    const isBreakdown = useMemo(() => impressionShareBreakdown(impressionShare && cur ? { ...cur, ...impressionShare } : cur), [cur, impressionShare]);
    const waste = useMemo(() => wastedTerms(searchTerms), [searchTerms]);
    const weekdays = useMemo(() => weekdayEfficiency(metrics), [metrics]);
    const totalSpend = num(cur?.spend);
    const statuses = useMemo(
        () => campaigns.map((c) => ({ campaign: c, status: campaignStatus(c, num(cur?.roas), totalSpend) })),
        [campaigns, cur, totalSpend]
    );

    const typeTotals = useMemo(() => {
        const t = { brand: 0, generic: 0, other: 0 };
        for (const d of brandGeneric) {
            t.brand += num(d.brand_spend);
            t.generic += num(d.generic_spend);
            t.other += num(d.other_spend);
        }
        return t;
    }, [brandGeneric]);
    const typeSum = typeTotals.brand + typeTotals.generic + typeTotals.other;
    const typeItems = [
        { id: "brand", name: "Brand", value: typeTotals.brand, color: TYPE_COLORS.brand },
        { id: "generic", name: "Generic", value: typeTotals.generic, color: TYPE_COLORS.generic },
        { id: "other", name: "Shopping, PMax, other", value: typeTotals.other, color: TYPE_COLORS.other },
    ].filter((i) => i.value > 0);
    const typeFocus = typeItems.find((i) => i.id === hoverType) || typeItems[0];

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
            if (pct <= -10) {
                items.push({ id: "roas", tone: "bad", text: `ROAS fell ${fmtDec(Math.abs(pct), 1)}% ${vs}, from ${fmtDec(prev.roas, 2)} to ${fmtDec(cur.roas, 2)}.` });
            } else if (pct >= 10) {
                items.push({ id: "roas", tone: "ok", text: `ROAS is up ${fmtDec(pct, 1)}% ${vs}, from ${fmtDec(prev.roas, 2)} to ${fmtDec(cur.roas, 2)}.` });
            }
        }
        if (waste.rows.length > 0 && waste.share >= 0.02) {
            items.push({
                id: "waste",
                tone: "warn",
                text: `${fmtKr(waste.spend)} (${fmtShare(waste.share, 1)} of search term spend) went to ${fmtInt(waste.rows.length)} terms with no conversions.`,
                action: { label: "Review search terms", tab: "terms" },
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
        const scale = statuses
            .filter((s) => s.status.id === "scale")
            .sort((a, b) => num(b.campaign.roas) - num(a.campaign.roas))[0];
        if (scale) {
            items.push({
                id: "scale",
                tone: "ok",
                text: `${scale.campaign.campaign_name} returns a ROAS of ${fmtDec(scale.campaign.roas, 2)} against ${fmtDec(cur.roas, 2)} for the account, so there is room to give it more.`,
                action: { label: "Open campaigns", tab: "campaigns" },
            });
        }
        if (isBreakdown && isBreakdown.budget >= 8) {
            items.push({
                id: "budget",
                tone: "warn",
                text: `${fmtDec(isBreakdown.budget, 1)}% of eligible impressions were lost because budgets ran out.`,
            });
        }
        return items.slice(0, 5);
    }, [prev, cur, vs, waste, statuses, totalSpend, isBreakdown]);

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-ov-grid--hero">
                <ServiceKpi hero neutral label="Ad spend" value={fmtInt(cur.spend)} unit="kr." cur={cur.spend} prev={pv("spend")} vs={vs} caption={platform} />
                <ServiceKpi label="Revenue" icon={FiBarChart2} value={fmtInt(cur.revenue)} unit="kr." cur={cur.revenue} prev={pv("revenue")} vs={vs} caption="Conversion value" />
                <ServiceKpi label="ROAS" icon={FiTrendingUp} value={fmtDec(cur.roas, 2)} cur={cur.roas} prev={pv("roas")} vs={vs} caption="Revenue per kr. spent" />
                <ServiceKpi label="Conversions" icon={FiShoppingCart} value={fmtInt(cur.conversions)} cur={cur.conversions} prev={pv("conversions")} vs={vs} caption={isNum(cur.aov) ? `Avg. order ${fmtInt(cur.aov)} kr.` : "Completed goals"} />
            </div>

            <div className="apex-ov-grid apex-sx-grid-4">
                <ServiceKpi label="Cost per conversion" icon={FiTarget} cost value={fmtInt(cur.cpa)} unit="kr." cur={cur.cpa} prev={pv("cpa")} goodUp={false} vs={vs} caption="CPA" />
                <ServiceKpi label="Cost per click" icon={FiMousePointer} cost value={fmtDec(cur.cpc, 2)} unit="kr." cur={cur.cpc} prev={pv("cpc")} goodUp={false} vs={vs} caption="CPC" />
                <ServiceKpi label="Click-through rate" icon={FiPercent} value={fmtDec(cur.ctr, 2)} unit="%" cur={cur.ctr} prev={pv("ctr")} vs={vs} caption={`${compact(cur.clicks)} clicks, ${compact(cur.impressions)} impressions`} />
                <ServiceKpi label="Conversion rate" icon={FiActivity} value={fmtDec(cur.conv_rate, 2)} unit="%" cur={cur.conv_rate} prev={pv("conv_rate")} vs={vs} caption="Conversions per click" />
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
                        <h3>Impression share</h3>
                        <span className="apex-ov-sub">Share of eligible impressions</span>
                    </div>
                    {isBreakdown ? (
                        <>
                            <div className="apex-px-isbar" role="img" aria-label="Won, lost to budget, lost to rank">
                                <i style={{ width: `${isBreakdown.won}%`, background: IS_COLORS.won }} />
                                <i style={{ width: `${isBreakdown.budget}%`, background: IS_COLORS.budget }} />
                                <i style={{ width: `${isBreakdown.rank}%`, background: IS_COLORS.rank }} />
                                <i style={{ width: `${isBreakdown.other}%`, background: IS_COLORS.other }} />
                            </div>
                            <div className="apex-px-isrows">
                                {[
                                    { id: "won", label: "Won", value: isBreakdown.won, prevKey: "impression_share", goodUp: true, cap: "Your ads were shown" },
                                    { id: "budget", label: "Lost to budget", value: isBreakdown.budget, prevKey: "is_lost_budget", goodUp: false, cap: "Budget ran out before the auction" },
                                    { id: "rank", label: "Lost to rank", value: isBreakdown.rank, prevKey: "is_lost_rank", goodUp: false, cap: "Ad rank too low (bid, quality)" },
                                ].map((r) => (
                                    <div key={r.id} className="apex-px-isrow">
                                        <span className="apex-px-isrow__name">
                                            <i style={{ background: IS_COLORS[r.id] }} aria-hidden />
                                            {r.label}
                                        </span>
                                        <span className="apex-px-isrow__cap">{r.cap}</span>
                                        <b>{fmtDec(r.value, 1)}%</b>
                                        <DeltaChip cur={r.value} prev={pv(r.prevKey)} mode="pp" goodUp={r.goodUp} compactSize />
                                    </div>
                                ))}
                            </div>
                            {isChart ? (
                                <div className="apex-sx-chartcard apex-px-ischart">
                                    <GraphCard
                                        variant="cobalt"
                                        hideChartToggle
                                        title=""
                                        chartType="area"
                                        height={190}
                                        chartOptions={isChart.options}
                                        chartSeries={isChart.series}
                                    />
                                </div>
                            ) : null}
                            <p className="apex-sx-callout">
                                {isBreakdown.dominant === "budget" && isBreakdown.budget >= 5 ? (
                                    <>
                                        Budget is your bigger leak. Winning the budget-lost share at today&apos;s yield would add roughly{" "}
                                        <b>{fmtInt(isBreakdown.estExtraClicks)} clicks</b> and <b>{fmtInt(isBreakdown.estExtraRevenue)} kr. revenue</b> for about{" "}
                                        <b>{fmtInt(isBreakdown.estExtraSpend)} kr. extra spend</b> (estimate, assumes the same click value and cost).
                                    </>
                                ) : isBreakdown.rank >= 5 ? (
                                    <>
                                        Rank is your bigger leak, so a larger budget would not help much. Better ads, landing pages and bids move this share (estimate based on the reported shares).
                                    </>
                                ) : (
                                    <>You are winning most of the auctions you are eligible for.</>
                                )}
                            </p>
                        </>
                    ) : (
                        <p className="apex-mk-note apex-sx-empty-note">{platform} did not return impression share for this period.</p>
                    )}
                </section>

                <div className="apex-sx-col">
                    <section className="apex-ov-card">
                        <div className="apex-ov-card__head">
                            <h3>Spend by campaign type</h3>
                        </div>
                        {typeSum > 0 ? (
                            <div className="apex-sx-mix">
                                <ServiceDonut
                                    items={typeItems}
                                    centerSmall={typeFocus?.name}
                                    centerBig={fmtShare(typeFocus ? typeFocus.value / typeSum : 0, 0)}
                                    active={hoverType}
                                    onHover={setHoverType}
                                />
                                <div className="apex-sx-mix__list">
                                    {typeItems.map((m) => (
                                        <div key={m.id} className="apex-sx-mix__row" onMouseEnter={() => setHoverType(m.id)} onMouseLeave={() => setHoverType(null)}>
                                            <i style={{ background: m.color }} aria-hidden />
                                            <span>{m.name}</span>
                                            <b>{fmtKr(m.value)}</b>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="apex-mk-note apex-sx-empty-note">No spend split available for this period.</p>
                        )}
                    </section>

                    {customerItems.length > 0 ? (
                        <section className="apex-ov-card">
                            <div className="apex-ov-card__head">
                                <h3>Customer mix</h3>
                                <span className="apex-ov-sub">Conversions</span>
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

            {extra}

            <div className="apex-ov-grid apex-sx-split-even">
                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>What to look at</h3>
                        <span className="apex-ov-sub">Based on this period</span>
                    </div>
                    {attention.length === 0 ? (
                        <p className="apex-mk-note apex-sx-empty-note">Nothing stands out in this period. Spend, return and search terms look in balance.</p>
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
                                    <div
                                        key={d.label}
                                        className={`apex-sx-week__day${d.isBest ? " is-best" : ""}`}
                                        title={`${d.label}: ${fmtInt(d.avgRevenue)} kr. revenue, ROAS ${fmtDec(d.roas, 2)}`}
                                    >
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
