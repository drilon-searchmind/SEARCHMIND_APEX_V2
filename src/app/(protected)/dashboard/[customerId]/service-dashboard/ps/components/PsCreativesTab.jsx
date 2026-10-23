"use client";

import React, { useEffect, useMemo } from "react";
import { FiAlertTriangle, FiAward, FiTrendingDown } from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
import { COMMERCE_CHART_CHROME } from "@/components/dashboard/chartColors";
import ServiceTable from "@/components/dashboard/ServiceTable";
import { FATIGUE_FREQUENCY, creativeStatus, frequencyBands, summarizePs } from "@/lib/psAnalytics";
import {
    ServiceKpi,
    ServiceTag,
    fmtDec,
    fmtInt,
    fmtKr,
    fmtPctPoints,
    fmtShare,
    isNum,
    num,
} from "@/components/dashboard/ServiceParts";

const MIN_SPEND = 100;
const STATUS_COLORS = { scale: "#2F8434", healthy: "#7DBB6F", low: "#94A3B8", watch: "#CA8A04", pause: "#DC2626" };
const STATUS_ORDER = ["scale", "healthy", "low", "watch", "pause"];
const STATUS_LABEL = { scale: "Scale", healthy: "Healthy", low: "Low volume", watch: "Watch", pause: "Pause or refresh" };
const BAND_COLORS = ["#A9EDA2", "#5DBB58", "#CA8A04", "#DC2626"];

function CreativeList({ rows, tone }) {
    if (!rows.length) return <p className="apex-mk-note apex-sx-empty-note">No creatives with enough spend (from {fmtKr(MIN_SPEND)}).</p>;
    return (
        <div className="apex-sx-terms">
            {rows.map((r) => (
                <div key={r.id} className="apex-sx-term">
                    <div className="apex-sx-term__main">
                        <b title={r.creative}>{r.creative}</b>
                        <small>{isNum(r.frequency) ? `Frequency ${fmtDec(r.frequency, 1)}` : "No frequency data"}</small>
                    </div>
                    <span className="apex-sx-term__spend">{fmtKr(r.spend)}</span>
                    <span className={`apex-sx-term__roas is-${tone}`}>{fmtDec(r.roas, 2)}</span>
                </div>
            ))}
        </div>
    );
}

export default function PsCreativesTab({ data, onLedeChange }) {
    const { ads, adError, metrics, accountSummary } = data;
    const summary = useMemo(() => summarizePs(metrics, accountSummary), [metrics, accountSummary]);
    const accountRoas = num(summary?.roas);
    const totalSpend = useMemo(() => ads.reduce((s, a) => s + num(a.spend), 0), [ads]);

    const rows = useMemo(
        () =>
            ads.map((a, i) => {
                const { status, fatigue } = creativeStatus(a, accountRoas, totalSpend);
                return { ...a, id: a.ad_id || `${a.creative}-${i}`, status, fatigue, spendShare: totalSpend > 0 ? num(a.spend) / totalSpend : 0 };
            }),
        [ads, accountRoas, totalSpend]
    );

    const eligible = rows.filter((r) => num(r.spend) >= MIN_SPEND && num(r.impressions) > 0);
    const byRoas = useMemo(() => [...eligible].sort((a, b) => num(b.roas) - num(a.roas)), [eligible]);
    const winners = byRoas.slice(0, 5);
    const losers = [...byRoas].reverse().slice(0, 5);
    const best = byRoas[0];
    const fatigued = rows.filter((r) => r.fatigue);
    const fatigueSpend = fatigued.reduce((s, r) => s + num(r.spend), 0);
    const belowSpend = rows.filter((r) => r.status.id === "watch" || r.status.id === "pause").reduce((s, r) => s + num(r.spend), 0);
    const bands = useMemo(() => frequencyBands(rows), [rows]);

    useEffect(() => {
        if (!rows.length) {
            onLedeChange?.(null);
            return;
        }
        let text = `${fmtInt(rows.length)} creatives spent ${fmtKr(totalSpend)}`;
        if (fatigued.length) text += `, ${fmtInt(fatigued.length)} of them past a frequency of ${fmtDec(FATIGUE_FREQUENCY, 1)}`;
        onLedeChange?.(`${text}.`);
    }, [rows, totalSpend, fatigued.length, onLedeChange]);

    const map = useMemo(() => {
        const withFreq = rows.filter((r) => isNum(r.frequency) && num(r.spend) > 0);
        const series = STATUS_ORDER.map((id) => ({
            name: STATUS_LABEL[id],
            data: withFreq
                .filter((r) => r.status.id === id)
                .map((r) => ({ x: Number(num(r.frequency).toFixed(2)), y: Number(num(r.roas).toFixed(2)), z: Math.round(num(r.spend)), name: r.creative })),
        })).filter((s) => s.data.length > 0);
        const colors = series.map((s) => STATUS_COLORS[STATUS_ORDER.find((id) => STATUS_LABEL[id] === s.name)]);
        const maxRoas = Math.max(...withFreq.map((r) => num(r.roas)), accountRoas, 1);
        const maxFreq = Math.max(...withFreq.map((r) => num(r.frequency)), FATIGUE_FREQUENCY, 1);
        const options = {
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: COMMERCE_CHART_CHROME.fontFamily },
            colors,
            fill: { opacity: 0.78 },
            stroke: { width: 2, colors: ["#ffffff"] },
            plotOptions: { bubble: { minBubbleRadius: 9, maxBubbleRadius: 34 } },
            dataLabels: { enabled: false },
            grid: { borderColor: COMMERCE_CHART_CHROME.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
            xaxis: {
                type: "numeric",
                min: 0,
                max: Math.ceil(maxFreq + 0.6),
                tickAmount: Math.ceil(maxFreq + 0.6),
                title: { text: "Frequency", style: { color: COMMERCE_CHART_CHROME.axisLabel, fontWeight: 500 } },
                labels: { style: { colors: COMMERCE_CHART_CHROME.axisLabel }, formatter: (v) => fmtDec(v, 0) },
                axisTicks: { show: false },
                axisBorder: { show: true, color: COMMERCE_CHART_CHROME.grid },
                tooltip: { enabled: false },
            },
            yaxis: {
                min: 0,
                max: Math.ceil((maxRoas * 1.2) / 2) * 2,
                tickAmount: 4,
                forceNiceScale: true,
                title: { text: "ROAS", style: { color: COMMERCE_CHART_CHROME.axisLabel, fontWeight: 500 } },
                labels: { style: { colors: COMMERCE_CHART_CHROME.axisLabel }, formatter: (v) => fmtDec(v, 1) },
            },
            annotations: {
                xaxis: [
                    {
                        x: FATIGUE_FREQUENCY,
                        borderColor: "#DC2626",
                        strokeDashArray: 4,
                        label: {
                            text: `Frequency ${fmtDec(FATIGUE_FREQUENCY, 1)}`,
                            orientation: "horizontal",
                            style: { color: "#ffffff", background: "#DC2626", fontSize: "11px", padding: { left: 6, right: 6, top: 2, bottom: 2 } },
                        },
                    },
                ],
                yaxis: accountRoas
                    ? [
                          {
                              y: accountRoas,
                              borderColor: "#111A12",
                              strokeDashArray: 4,
                              label: {
                                  text: `Account ROAS ${fmtDec(accountRoas, 2)}`,
                                  position: "left",
                                  textAnchor: "start",
                                  offsetY: -4,
                                  style: { color: "#ffffff", background: "#111A12", fontSize: "11px", padding: { left: 6, right: 6, top: 2, bottom: 2 } },
                              },
                          },
                      ]
                    : [],
            },
            legend: { show: true, position: "bottom", horizontalAlign: "left" },
            tooltip: {
                custom: ({ seriesIndex, dataPointIndex, w }) => {
                    const pt = w.config.series[seriesIndex].data[dataPointIndex];
                    return `<div style="padding:10px 12px;font-size:12.5px;line-height:1.5;background:#111A12;color:#fff;border-radius:10px"><b>${pt.name}</b><br/>Frequency ${fmtDec(pt.x, 1)}<br/>ROAS ${fmtDec(pt.y, 2)}<br/>Spend ${fmtKr(pt.z)}</div>`;
                },
            },
        };
        return { series, options, count: withFreq.length };
    }, [rows, accountRoas]);

    const columns = [
        { key: "creative", label: "Creative", left: true, sortValue: (r) => r.creative, render: (r) => <span title={r.creative}>{r.creative}</span> },
        {
            key: "status",
            label: "Status",
            sortValue: (r) => num(r.roas),
            render: (r) => (
                <span className="apex-sx-cell">
                    <ServiceTag tone={r.status.tone}>{r.status.label}</ServiceTag>
                    {r.fatigue ? <ServiceTag tone="warn">Fatigue risk</ServiceTag> : null}
                </span>
            ),
        },
        { key: "spend", label: "Spend", sortValue: (r) => num(r.spend), render: (r) => fmtKr(r.spend) },
        {
            key: "spendShare",
            label: "Share of spend",
            sortValue: (r) => r.spendShare,
            render: (r) => (
                <span className="apex-sx-share">
                    <span className="apex-ov-bar">
                        <i style={{ width: `${Math.min(100, r.spendShare * 100)}%` }} />
                    </span>
                    {fmtShare(r.spendShare, 0)}
                </span>
            ),
        },
        { key: "revenue", label: "Revenue", sortValue: (r) => num(r.revenue), render: (r) => fmtKr(r.revenue) },
        { key: "roas", label: "ROAS", sortValue: (r) => num(r.roas), render: (r) => fmtDec(r.roas, 2) },
        { key: "conversions", label: "Conv.", sortValue: (r) => num(r.conversions), render: (r) => fmtInt(r.conversions) },
        { key: "cpm", label: "CPM", sortValue: (r) => num(r.cpm), render: (r) => `${fmtDec(r.cpm, 1)} kr.` },
        { key: "ctr", label: "CTR", sortValue: (r) => num(r.ctr), render: (r) => fmtPctPoints(num(r.ctr) * 100, 2) },
        {
            key: "frequency",
            label: "Freq.",
            sortValue: (r) => (isNum(r.frequency) ? num(r.frequency) : -1),
            className: (r) => (r.fatigue ? "is-neg" : ""),
            render: (r) => (isNum(r.frequency) ? fmtDec(r.frequency, 1) : "-"),
        },
    ];

    if (adError || rows.length === 0) {
        return <div className="apex-sx-alert">{adError || "No ad-level data for this period."}</div>;
    }

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-ov-grid--hero">
                <ServiceKpi hero neutral label="Creatives" value={fmtInt(rows.length)} caption={`${fmtKr(totalSpend)} spend`} />
                <ServiceKpi label="Best creative" icon={FiAward} value={best ? fmtDec(best.roas, 2) : "-"} unit="ROAS" caption={best ? best.creative : "No creative with enough spend"} />
                <ServiceKpi
                    label="Fatigue risk"
                    icon={FiAlertTriangle}
                    cost
                    value={fmtInt(fatigued.length)}
                    unit={fatigued.length === 1 ? "creative" : "creatives"}
                    caption={fatigued.length ? `${fmtKr(fatigueSpend)} of spend` : `None above frequency ${fmtDec(FATIGUE_FREQUENCY, 1)}`}
                />
                <ServiceKpi label="Spend below target" icon={FiTrendingDown} cost value={fmtInt(belowSpend)} unit="kr." caption={`${fmtShare(totalSpend > 0 ? belowSpend / totalSpend : 0, 0)} on Watch or Pause creatives`} />
            </div>

            <div className="apex-ov-grid apex-sx-split">
                <section className="apex-ov-card apex-sx-chartcard">
                    <div className="apex-ov-card__head">
                        <h3>Fatigue map</h3>
                        <span className="apex-ov-sub">Frequency against ROAS, bubble size is spend</span>
                    </div>
                    {map.count ? (
                        <GraphCard variant="cobalt" hideChartToggle title="" chartType="bubble" height={340} chartOptions={map.options} chartSeries={map.series} />
                    ) : (
                        <p className="apex-mk-note apex-sx-empty-note">Meta did not return frequency per ad for this period.</p>
                    )}
                    <p className="apex-mk-note">
                        Creatives to the right of the red line have been shown to the same people often. If they also sit under the dashed ROAS line, the audience is likely tiring of them. {fmtDec(FATIGUE_FREQUENCY, 1)} is a rule of thumb, not a Meta limit.
                    </p>
                </section>

                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>Frequency pressure</h3>
                        <span className="apex-ov-sub">Where the spend sits</span>
                    </div>
                    <div className="apex-sp-bands">
                        {bands.map((b, i) => (
                            <div key={b.id} className="apex-sp-band">
                                <div className="apex-sp-band__top">
                                    <span className="apex-sp-band__name">
                                        <i style={{ background: BAND_COLORS[i] }} aria-hidden />
                                        Frequency {b.label}
                                    </span>
                                    <span>
                                        ROAS <b>{b.roas != null ? fmtDec(b.roas, 2) : "-"}</b>
                                    </span>
                                </div>
                                <div className="apex-ov-bar">
                                    <i style={{ width: `${b.spendShare * 100}%`, background: BAND_COLORS[i] }} />
                                </div>
                                <div className="apex-sp-band__cap">
                                    {fmtShare(b.spendShare, 0)} of creative spend, {fmtInt(b.ads)} {b.ads === 1 ? "creative" : "creatives"}
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="apex-mk-note">If ROAS drops as frequency rises, new creative is likely to help more than extra budget.</p>
                </section>
            </div>

            <div className="apex-ov-grid apex-sx-split-even">
                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>Creative winners</h3>
                        <span className="apex-ov-sub">Highest ROAS, from {fmtKr(MIN_SPEND)} spend</span>
                    </div>
                    <CreativeList rows={winners} tone="pos" />
                    <p className="apex-mk-note">Candidates to scale budget or to make variants of.</p>
                </section>
                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>Creative losers</h3>
                        <span className="apex-ov-sub">Lowest ROAS, from {fmtKr(MIN_SPEND)} spend</span>
                    </div>
                    <CreativeList rows={losers} tone="neg" />
                    <p className="apex-mk-note">Candidates to pause or refresh.</p>
                </section>
            </div>

            <ServiceTable
                title="Creative scorecard"
                subtitle={`Status compares each creative's ROAS with the account average (${fmtDec(accountRoas, 2)}): Scale at 1,25x or more, Healthy from 0,85x, Watch from 0,5x, Pause or refresh below. Fatigue risk means a frequency of ${fmtDec(FATIGUE_FREQUENCY, 1)} or more.`}
                columns={columns}
                rows={rows}
                rowKey={(r) => r.id}
                initialSort={{ key: "spend", dir: "desc" }}
                pageSize={12}
                searchKey="creative"
                searchPlaceholder="Search creatives"
                emptyText="No creatives match."
            />
        </div>
    );
}
