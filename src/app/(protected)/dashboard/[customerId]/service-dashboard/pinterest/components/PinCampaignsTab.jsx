"use client";

import React, { useEffect, useMemo } from "react";
import { FiAward, FiBookmark, FiLayers } from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
import { COMMERCE_CHART_CHROME } from "@/components/dashboard/chartColors";
import ServiceTable from "@/components/dashboard/ServiceTable";
import { COMPARISON_METHOD } from "@/lib/dateRangeComparison";
import { pinCampaignStatus, summarizePin } from "@/lib/pinAnalytics";
import {
    DeltaChip,
    ServiceKpi,
    ServiceTag,
    compact,
    fmtDec,
    fmtInt,
    fmtKr,
    fmtPctPoints,
    isNum,
    num,
    vsCaption,
} from "@/components/dashboard/ServiceParts";

const STATUS_COLORS = { strong: "#2F8434", solid: "#7DBB6F", low: "#94A3B8", soft: "#CA8A04", weak: "#DC2626" };
const STATUS_ORDER = ["strong", "solid", "low", "soft", "weak"];
const STATUS_LABEL = { strong: "Strong", solid: "Solid", low: "Low volume", soft: "Soft", weak: "Weak" };

function CampaignList({ rows, tone, empty }) {
    if (!rows.length) return <p className="apex-mk-note apex-sx-empty-note">{empty}</p>;
    return (
        <div className="apex-sx-terms">
            {rows.map((r) => (
                <div key={r.id} className="apex-sx-term">
                    <div className="apex-sx-term__main">
                        <b title={r.campaign_name}>{r.campaign_name}</b>
                        <small>{fmtInt(r.impressions)} impressions</small>
                    </div>
                    <span className="apex-sx-term__spend">{fmtInt(r.clicks)} clicks</span>
                    <span className={`apex-sx-term__roas is-${tone}`}>{fmtDec(num(r.ctr) * 100, 2)}%</span>
                </div>
            ))}
        </div>
    );
}

export default function PinCampaignsTab({ data, comparisonMethod, comparisonLabel, onLedeChange }) {
    const { metrics, campaigns, campaignsPrev, windowPrev } = data;
    const summary = useMemo(() => summarizePin(metrics), [metrics]);
    const accountCtr = num(summary?.ctr) / 100;
    const totalImpressions = campaigns.reduce((s, c) => s + num(c.impressions), 0);
    const hasSpend = campaigns.some((c) => isNum(c.ad_spend));
    const hasPrev = comparisonMethod !== COMPARISON_METHOD.NONE && campaignsPrev.length > 0 && windowPrev?.rangeAllowed !== false;
    const vs = vsCaption(comparisonLabel);
    const prevByName = useMemo(() => Object.fromEntries(campaignsPrev.map((c) => [c.campaign_name, c])), [campaignsPrev]);

    const rows = useMemo(
        () =>
            campaigns.map((c, i) => ({
                ...c,
                id: c.campaign_id || `${c.campaign_name}-${i}`,
                status: pinCampaignStatus(c, accountCtr, totalImpressions),
                saveRate: num(c.impressions) > 0 ? (num(c.saves) / num(c.impressions)) * 100 : 0,
                cpc: hasSpend && num(c.clicks) > 0 ? num(c.ad_spend) / num(c.clicks) : null,
                prev: prevByName[c.campaign_name] || null,
            })),
        [campaigns, accountCtr, totalImpressions, hasSpend, prevByName]
    );

    const eligible = rows.filter((r) => r.status.id !== "low");
    const byCtr = useMemo(() => [...eligible].sort((a, b) => num(b.ctr) - num(a.ctr)), [eligible]);
    const bySaves = useMemo(() => [...rows].sort((a, b) => num(b.saveRate) - num(a.saveRate))[0], [rows]);
    const best = byCtr[0];
    const top = byCtr.slice(0, 5);
    const bottom = [...byCtr].reverse().slice(0, 5);

    useEffect(() => {
        if (!rows.length) {
            onLedeChange?.(null);
            return;
        }
        let text = `${fmtInt(rows.length)} campaigns delivered ${fmtInt(totalImpressions)} impressions`;
        if (best) text += `, ${best.campaign_name} clicks best at ${fmtDec(num(best.ctr) * 100, 2)}%`;
        onLedeChange?.(`${text}.`);
    }, [rows, totalImpressions, best, onLedeChange]);

    const map = useMemo(() => {
        const series = STATUS_ORDER.map((id) => ({
            name: STATUS_LABEL[id],
            data: rows
                .filter((r) => r.status.id === id && num(r.impressions) > 0)
                .map((r) => ({ x: Math.round(num(r.impressions)), y: Number((num(r.ctr) * 100).toFixed(3)), z: Math.round(num(r.clicks)), name: r.campaign_name })),
        })).filter((s) => s.data.length > 0);
        const colors = series.map((s) => STATUS_COLORS[STATUS_ORDER.find((id) => STATUS_LABEL[id] === s.name)]);
        const maxX = Math.max(...rows.map((r) => num(r.impressions)), 1);
        const maxY = Math.max(...rows.map((r) => num(r.ctr) * 100), accountCtr * 100, 0.1);
        const options = {
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: COMMERCE_CHART_CHROME.fontFamily },
            colors,
            fill: { opacity: 0.78 },
            stroke: { width: 2, colors: ["#ffffff"] },
            plotOptions: { bubble: { minBubbleRadius: 8, maxBubbleRadius: 34 } },
            dataLabels: { enabled: false },
            grid: { borderColor: COMMERCE_CHART_CHROME.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
            xaxis: {
                type: "numeric",
                min: 0,
                max: Math.ceil(maxX * 1.18),
                tickAmount: 5,
                title: { text: "Impressions", style: { color: COMMERCE_CHART_CHROME.axisLabel, fontWeight: 500 } },
                labels: { style: { colors: COMMERCE_CHART_CHROME.axisLabel }, formatter: (v) => compact(v) },
                axisTicks: { show: false },
                axisBorder: { show: true, color: COMMERCE_CHART_CHROME.grid },
                tooltip: { enabled: false },
            },
            yaxis: {
                min: 0,
                max: Number((maxY * 1.25).toFixed(2)),
                tickAmount: 4,
                forceNiceScale: true,
                title: { text: "Click-through rate (%)", style: { color: COMMERCE_CHART_CHROME.axisLabel, fontWeight: 500 } },
                labels: { style: { colors: COMMERCE_CHART_CHROME.axisLabel }, formatter: (v) => fmtDec(v, 2) },
            },
            annotations: accountCtr
                ? {
                      yaxis: [
                          {
                              y: Number((accountCtr * 100).toFixed(3)),
                              borderColor: "#111A12",
                              strokeDashArray: 4,
                              label: {
                                  text: `Account CTR ${fmtDec(accountCtr * 100, 2)}%`,
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
                    return `<div style="padding:10px 12px;font-size:12.5px;line-height:1.5;background:#111A12;color:#fff;border-radius:10px"><b>${pt.name}</b><br/>Impressions ${fmtInt(pt.x)}<br/>CTR ${fmtDec(pt.y, 2)}%<br/>Outbound clicks ${fmtInt(pt.z)}</div>`;
                },
            },
        };
        return { series, options };
    }, [rows, accountCtr]);

    const columns = [
        { key: "campaign_name", label: "Campaign", left: true, sortValue: (r) => r.campaign_name, render: (r) => <span title={r.campaign_name}>{r.campaign_name}</span> },
        { key: "status", label: "Status", sortValue: (r) => num(r.ctr), render: (r) => <ServiceTag tone={r.status.tone}>{r.status.label}</ServiceTag> },
        ...(hasSpend ? [{ key: "ad_spend", label: "Spend", sortValue: (r) => num(r.ad_spend), render: (r) => fmtKr(r.ad_spend) }] : []),
        { key: "impressions", label: "Impressions", sortValue: (r) => num(r.impressions), render: (r) => fmtInt(r.impressions) },
        { key: "clicks", label: "Outbound clicks", sortValue: (r) => num(r.clicks), render: (r) => fmtInt(r.clicks) },
        {
            key: "ctr",
            label: "CTR",
            sortValue: (r) => num(r.ctr),
            render: (r) => (
                <span className="apex-sx-cell">
                    {fmtPctPoints(num(r.ctr) * 100, 2)}
                    {hasPrev && r.prev ? <DeltaChip cur={r.ctr} prev={r.prev.ctr} compactSize /> : null}
                </span>
            ),
        },
        { key: "saves", label: "Saves", sortValue: (r) => num(r.saves), render: (r) => fmtInt(r.saves) },
        { key: "saveRate", label: "Save rate", sortValue: (r) => r.saveRate, render: (r) => fmtPctPoints(r.saveRate, 2) },
        ...(hasSpend
            ? [
                  { key: "cpc", label: "CPC", sortValue: (r) => (r.cpc == null ? Infinity : r.cpc), render: (r) => (r.cpc == null ? "-" : `${fmtDec(r.cpc, 2)} kr.`) },
                  { key: "conversions", label: "Checkouts", sortValue: (r) => num(r.conversions), render: (r) => fmtInt(r.conversions) },
                  { key: "roas", label: "ROAS", sortValue: (r) => num(r.roas), render: (r) => (num(r.conversion_value) > 0 ? fmtDec(r.roas, 2) : "-") },
              ]
            : []),
    ];

    if (!rows.length) return <div className="apex-sx-alert">No campaign data for this period.</div>;

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-ov-grid--hero">
                <ServiceKpi hero neutral label="Campaigns" value={fmtInt(rows.length)} caption={`${fmtInt(totalImpressions)} impressions`} />
                <ServiceKpi label="Best click-through" icon={FiAward} value={best ? fmtDec(num(best.ctr) * 100, 2) : "-"} unit="%" caption={best ? best.campaign_name : "No campaign with enough volume"} />
                <ServiceKpi label="Most saved" icon={FiBookmark} value={bySaves ? fmtDec(bySaves.saveRate, 2) : "-"} unit="%" caption={bySaves ? `${bySaves.campaign_name}, saves per impression` : "No saves"} />
                <ServiceKpi label="Account CTR" icon={FiLayers} value={fmtDec(accountCtr * 100, 2)} unit="%" caption={hasPrev ? `Compare campaigns ${vs}` : "Reference for every status"} />
            </div>

            <div className="apex-ov-grid apex-sx-split">
                <section className="apex-ov-card apex-sx-chartcard">
                    <div className="apex-ov-card__head">
                        <h3>Campaign map</h3>
                        <span className="apex-ov-sub">Reach against click-through, bubble size is clicks</span>
                    </div>
                    <GraphCard variant="cobalt" hideChartToggle title="" chartType="bubble" height={340} chartOptions={map.options} chartSeries={map.series} />
                    <p className="apex-mk-note">Campaigns above the dashed line click better than your account average. Big bubbles under it are where reach is not turning into visits.</p>
                </section>

                <div className="apex-sx-col">
                    <section className="apex-ov-card">
                        <div className="apex-ov-card__head">
                            <h3>Best clicking</h3>
                            <span className="apex-ov-sub">Click-through rate</span>
                        </div>
                        <CampaignList rows={top} tone="pos" empty="No campaigns with enough volume." />
                    </section>
                    <section className="apex-ov-card">
                        <div className="apex-ov-card__head">
                            <h3>Weakest clicking</h3>
                            <span className="apex-ov-sub">Click-through rate</span>
                        </div>
                        <CampaignList rows={bottom} tone="neg" empty="No campaigns with enough volume." />
                    </section>
                </div>
            </div>

            <ServiceTable
                title="Campaign scorecard"
                subtitle={`Status compares each campaign's click-through rate with the account (${fmtDec(accountCtr * 100, 2)}%): Strong at 1,25x or more, Solid from 0,85x, Soft from 0,5x, Weak below. Campaigns under 1% of impressions are Low volume.${hasSpend ? "" : " This account returned no spend per campaign, so only reach and engagement are shown."}`}
                columns={columns}
                rows={rows}
                rowKey={(r) => r.id}
                initialSort={{ key: "clicks", dir: "desc" }}
                pageSize={12}
                searchKey="campaign_name"
                searchPlaceholder="Search campaigns"
                emptyText="No campaigns match."
            />
        </div>
    );
}
