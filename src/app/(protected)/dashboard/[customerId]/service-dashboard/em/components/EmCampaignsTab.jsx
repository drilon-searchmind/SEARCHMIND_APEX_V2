"use client";

import React, { useEffect, useMemo } from "react";
import { FiAward, FiSend, FiUserX } from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
import { COMMERCE_CHART_CHROME } from "@/components/dashboard/chartColors";
import ServiceTable from "@/components/dashboard/ServiceTable";
import { emRates, groupStats, rpeStatus } from "@/lib/emAnalytics";
import {
    ServiceKpi,
    ServiceTag,
    compact,
    fmtDec,
    fmtInt,
    fmtKr,
    fmtPctPoints,
    num,
} from "@/components/dashboard/ServiceParts";

const STATUS_COLORS = { winner: "#2F8434", solid: "#7DBB6F", low: "#94A3B8", soft: "#CA8A04", weak: "#DC2626" };
const STATUS_ORDER = ["winner", "solid", "low", "soft", "weak"];
const STATUS_LABEL = { winner: "Winner", solid: "Solid", low: "Low volume", soft: "Soft", weak: "Weak" };

function CampaignList({ rows, tone, empty }) {
    if (!rows.length) return <p className="apex-mk-note apex-sx-empty-note">{empty}</p>;
    return (
        <div className="apex-sx-terms">
            {rows.map((r) => (
                <div key={r.id} className="apex-sx-term">
                    <div className="apex-sx-term__main">
                        <b title={r.campaign_name}>{r.campaign_name}</b>
                        <small>{fmtInt(r.recipients)} sent</small>
                    </div>
                    <span className="apex-sx-term__spend">{fmtKr(r.conversion_value)}</span>
                    <span className={`apex-sx-term__roas is-${tone}`}>{fmtDec(r.rates.rpe, 2)}</span>
                </div>
            ))}
        </div>
    );
}

export default function EmCampaignsTab({ data, onLedeChange }) {
    const { topCampaigns, campaignTotals } = data;
    const stats = useMemo(() => groupStats(topCampaigns), [topCampaigns]);
    const totals = useMemo(() => emRates(campaignTotals), [campaignTotals]);

    const rows = useMemo(
        () =>
            topCampaigns.map((c, i) => ({
                ...c,
                id: c.campaign_id || `${c.campaign_name}-${i}`,
                rates: emRates(c),
                status: rpeStatus(c, stats.rpe, stats.recipients),
            })),
        [topCampaigns, stats]
    );

    const eligible = rows.filter((r) => r.status.id !== "low");
    const byRpe = useMemo(() => [...eligible].sort((a, b) => num(b.rates.rpe) - num(a.rates.rpe)), [eligible]);
    const best = byRpe[0];
    const top = byRpe.slice(0, 5);
    const bottom = [...byRpe].reverse().slice(0, 5);
    const unsubHigh = rows.filter((r) => num(r.recipients) >= 1000 && stats.unsubPerK && num(r.rates.unsubPerK) >= stats.unsubPerK * 2).length;

    useEffect(() => {
        if (!rows.length) {
            onLedeChange?.(null);
            return;
        }
        let text = `${fmtInt(rows.length)} campaigns sent ${fmtInt(stats.recipients)} emails and earned ${fmtKr(stats.revenue)}`;
        if (best) text += `, ${best.campaign_name} led at ${fmtDec(best.rates.rpe, 2)} kr. per email`;
        onLedeChange?.(`${text}.`);
    }, [rows, stats, best, onLedeChange]);

    const map = useMemo(() => {
        const series = STATUS_ORDER.map((id) => ({
            name: STATUS_LABEL[id],
            data: rows
                .filter((r) => r.status.id === id && num(r.recipients) > 0)
                .map((r) => ({ x: Math.round(num(r.recipients)), y: Number(num(r.rates.rpe).toFixed(2)), z: Math.round(num(r.conversion_value)), name: r.campaign_name })),
        })).filter((s) => s.data.length > 0);
        const colors = series.map((s) => STATUS_COLORS[STATUS_ORDER.find((id) => STATUS_LABEL[id] === s.name)]);
        const maxX = Math.max(...rows.map((r) => num(r.recipients)), 1);
        const maxY = Math.max(...rows.map((r) => num(r.rates.rpe)), stats.rpe || 0, 1);
        const options = {
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: COMMERCE_CHART_CHROME.fontFamily },
            colors,
            fill: { opacity: 0.78 },
            stroke: { width: 2, colors: ["#ffffff"] },
            plotOptions: { bubble: { minBubbleRadius: 8, maxBubbleRadius: 30 } },
            dataLabels: { enabled: false },
            grid: { borderColor: COMMERCE_CHART_CHROME.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
            xaxis: {
                type: "numeric",
                min: 0,
                max: Math.ceil((maxX * 1.15) / 2000) * 2000,
                tickAmount: 5,
                title: { text: "Emails sent", style: { color: COMMERCE_CHART_CHROME.axisLabel, fontWeight: 500 } },
                labels: { style: { colors: COMMERCE_CHART_CHROME.axisLabel }, formatter: (v) => compact(v) },
                axisTicks: { show: false },
                axisBorder: { show: true, color: COMMERCE_CHART_CHROME.grid },
                tooltip: { enabled: false },
            },
            yaxis: {
                min: 0,
                max: Math.ceil(maxY * 1.2),
                tickAmount: 4,
                forceNiceScale: true,
                title: { text: "Revenue per email (kr.)", style: { color: COMMERCE_CHART_CHROME.axisLabel, fontWeight: 500 } },
                labels: { style: { colors: COMMERCE_CHART_CHROME.axisLabel }, formatter: (v) => fmtDec(v, 1) },
            },
            annotations: stats.rpe
                ? {
                      yaxis: [
                          {
                              y: stats.rpe,
                              borderColor: "#111A12",
                              strokeDashArray: 4,
                              label: {
                                  text: `Campaign average ${fmtDec(stats.rpe, 2)}`,
                                  position: "left",
                                  textAnchor: "start",
                                  offsetY: -4,
                                  style: { color: "#ffffff", background: "#111A12", fontSize: "11px", padding: { left: 6, right: 6, top: 2, bottom: 2 } },
                              },
                          },
                      ],
                  }
                : {},
            legend: { show: true, position: "bottom", horizontalAlign: "left" },
            tooltip: {
                custom: ({ seriesIndex, dataPointIndex, w }) => {
                    const pt = w.config.series[seriesIndex].data[dataPointIndex];
                    return `<div style="padding:10px 12px;font-size:12.5px;line-height:1.5;background:#111A12;color:#fff;border-radius:10px"><b>${pt.name}</b><br/>Sent ${fmtInt(pt.x)}<br/>Revenue per email ${fmtDec(pt.y, 2)} kr.<br/>Revenue ${fmtKr(pt.z)}</div>`;
                },
            },
        };
        return { series, options };
    }, [rows, stats]);

    const columns = [
        { key: "campaign_name", label: "Campaign", left: true, sortValue: (r) => r.campaign_name, render: (r) => <span title={r.campaign_name}>{r.campaign_name}</span> },
        { key: "status", label: "Status", sortValue: (r) => num(r.rates.rpe), render: (r) => <ServiceTag tone={r.status.tone}>{r.status.label}</ServiceTag> },
        { key: "recipients", label: "Sent", sortValue: (r) => num(r.recipients), render: (r) => fmtInt(r.recipients) },
        { key: "conversion_value", label: "Revenue", sortValue: (r) => num(r.conversion_value), render: (r) => fmtKr(r.conversion_value) },
        { key: "rpe", label: "Per email", sortValue: (r) => num(r.rates.rpe), render: (r) => `${fmtDec(r.rates.rpe, 2)} kr.` },
        { key: "conversions", label: "Orders", sortValue: (r) => num(r.conversions), render: (r) => fmtInt(r.conversions) },
        { key: "openRate", label: "Open", sortValue: (r) => num(r.rates.openRate), render: (r) => fmtPctPoints(num(r.rates.openRate) * 100, 1) },
        { key: "clickRate", label: "Click", sortValue: (r) => num(r.rates.clickRate), render: (r) => fmtPctPoints(num(r.rates.clickRate) * 100, 2) },
        { key: "ctor", label: "Click-to-open", sortValue: (r) => num(r.rates.ctor), render: (r) => fmtPctPoints(num(r.rates.ctor) * 100, 1) },
        {
            key: "unsubPerK",
            label: "Unsubs / 1.000",
            sortValue: (r) => num(r.rates.unsubPerK),
            className: (r) => (stats.unsubPerK && num(r.recipients) >= 1000 && num(r.rates.unsubPerK) >= stats.unsubPerK * 2 ? "is-neg" : ""),
            render: (r) => fmtDec(r.rates.unsubPerK, 2),
        },
    ];

    if (!rows.length) return <div className="apex-sx-alert">No campaigns were sent in this period.</div>;

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-ov-grid--hero">
                <ServiceKpi hero neutral label="Campaigns sent" value={fmtInt(rows.length)} caption={`${fmtInt(stats.recipients)} emails`} />
                <ServiceKpi label="Campaign revenue" icon={FiAward} value={fmtInt(stats.revenue)} unit="kr." caption={totals ? `${fmtInt(totals.conversions)} orders` : "Placed orders"} />
                <ServiceKpi label="Revenue per email" icon={FiSend} value={fmtDec(stats.rpe, 2)} unit="kr." caption={`Median send: ${fmtDec(stats.medianRpe, 2)} kr.`} />
                <ServiceKpi label="Heavy unsubscribes" icon={FiUserX} cost value={fmtInt(unsubHigh)} unit={unsubHigh === 1 ? "campaign" : "campaigns"} caption="At 2x the campaign average or more" />
            </div>

            <div className="apex-ov-grid apex-sx-split">
                <section className="apex-ov-card apex-sx-chartcard">
                    <div className="apex-ov-card__head">
                        <h3>Campaign map</h3>
                        <span className="apex-ov-sub">Volume against revenue per email, bubble size is revenue</span>
                    </div>
                    <GraphCard variant="cobalt" hideChartToggle title="" chartType="bubble" height={340} chartOptions={map.options} chartSeries={map.series} />
                    <p className="apex-mk-note">
                        Sends above the dashed line earn more per email than your campaign average. Big sends under it are where a better audience or offer is worth the most.
                    </p>
                </section>

                <div className="apex-sx-col">
                    <section className="apex-ov-card">
                        <div className="apex-ov-card__head">
                            <h3>Best sends</h3>
                            <span className="apex-ov-sub">Revenue per email</span>
                        </div>
                        <CampaignList rows={top} tone="pos" empty="No campaigns with enough volume." />
                    </section>
                    <section className="apex-ov-card">
                        <div className="apex-ov-card__head">
                            <h3>Weakest sends</h3>
                            <span className="apex-ov-sub">Revenue per email</span>
                        </div>
                        <CampaignList rows={bottom} tone="neg" empty="No campaigns with enough volume." />
                    </section>
                </div>
            </div>

            <ServiceTable
                title="Campaign scorecard"
                subtitle={`Status compares revenue per email with the campaign average (${fmtDec(stats.rpe, 2)} kr.): Winner at 1,25x or more, Solid from 0,75x, Soft from 0,4x, Weak below. Sends under 1% of campaign volume are Low volume. Unsubscribes are marked at twice the campaign average or more.`}
                columns={columns}
                rows={rows}
                rowKey={(r) => r.id}
                initialSort={{ key: "conversion_value", dir: "desc" }}
                pageSize={12}
                searchKey="campaign_name"
                searchPlaceholder="Search campaigns"
                emptyText="No campaigns match."
            />
        </div>
    );
}
