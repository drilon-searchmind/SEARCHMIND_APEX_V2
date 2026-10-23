"use client";

import React, { useEffect, useMemo } from "react";
import GraphCard from "@/components/dashboard/GraphCard";
import { COMMERCE_CHART_CHROME, METRIC_CHART_PALETTE } from "@/components/dashboard/chartColors";
import { COMPARISON_METHOD } from "@/lib/dateRangeComparison";
import { campaignStatus, groupByType, summarizePpc } from "@/lib/ppcAnalytics";
import {
    DeltaChip,
    ServiceKpi,
    ServiceTag,
    fmtDec,
    fmtInt,
    fmtKr,
    fmtPctPoints,
    fmtShare,
    isNum,
    num,
    vsCaption,
} from "@/components/dashboard/ServiceParts";
import { FiAward, FiAlertTriangle } from "react-icons/fi";
import PpcTable from "./PpcTable";

const MAP_LIMIT = 10;

export default function PpcCampaignsTab({ data, comparisonMethod, comparisonLabel, onLedeChange }) {
    const { metrics, campaigns, campaignsPrev } = data;
    const hasPrev = comparisonMethod !== COMPARISON_METHOD.NONE && campaignsPrev.length > 0;
    const vs = vsCaption(comparisonLabel);

    const summary = useMemo(() => summarizePpc(metrics), [metrics]);
    const accountRoas = num(summary?.roas);
    const totalSpend = campaigns.reduce((s, c) => s + num(c.ad_spend), 0);
    const totalRevenue = campaigns.reduce((s, c) => s + num(c.conversions_value), 0);
    const prevByName = useMemo(() => Object.fromEntries(campaignsPrev.map((c) => [c.campaign_name, c])), [campaignsPrev]);

    const rows = useMemo(
        () =>
            campaigns.map((c) => ({
                ...c,
                id: c.campaign_name,
                status: campaignStatus(c, accountRoas, totalSpend),
                spendShare: totalSpend > 0 ? num(c.ad_spend) / totalSpend : 0,
                revenueShare: totalRevenue > 0 ? num(c.conversions_value) / totalRevenue : 0,
                prev: prevByName[c.campaign_name] || null,
            })),
        [campaigns, accountRoas, totalSpend, totalRevenue, prevByName]
    );

    const types = useMemo(() => groupByType(campaigns), [campaigns]);
    const best = useMemo(
        () => [...rows].filter((r) => r.spendShare >= 0.03).sort((a, b) => num(b.roas) - num(a.roas))[0],
        [rows]
    );
    const flagged = rows.filter((r) => r.status.id === "cut" || r.status.id === "watch");
    const flaggedSpend = flagged.reduce((s, r) => s + num(r.ad_spend), 0);

    useEffect(() => {
        if (!rows.length) {
            onLedeChange?.(null);
            return;
        }
        let text = `${fmtInt(rows.length)} campaigns spent ${fmtKr(totalSpend)}`;
        if (best) text += `, ${best.campaign_name} leads at a ROAS of ${fmtDec(best.roas, 2)}`;
        onLedeChange?.(`${text}.`);
    }, [rows, totalSpend, best, onLedeChange]);

    const mapRows = useMemo(() => [...rows].sort((a, b) => num(b.ad_spend) - num(a.ad_spend)).slice(0, MAP_LIMIT), [rows]);

    const map = useMemo(() => {
        const series = mapRows.map((r) => ({
            name: r.campaign_name,
            data: [{ x: Math.round(num(r.ad_spend)), y: Number(num(r.roas).toFixed(2)), z: Math.round(num(r.conversions_value)) }],
        }));
        const colors = mapRows.map((_, i) => METRIC_CHART_PALETTE[i % METRIC_CHART_PALETTE.length]);
        const maxSpend = Math.max(...mapRows.map((r) => num(r.ad_spend)), 1);
        const maxRoas = Math.max(...mapRows.map((r) => num(r.roas)), accountRoas, 1);
        const xMax = Math.ceil((maxSpend * 1.18) / 1000) * 1000;
        const options = {
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: COMMERCE_CHART_CHROME.fontFamily },
            colors,
            fill: { opacity: 0.78 },
            stroke: { width: 2, colors: ["#ffffff"] },
            plotOptions: { bubble: { minBubbleRadius: 9, maxBubbleRadius: 38 } },
            dataLabels: { enabled: false },
            grid: { borderColor: COMMERCE_CHART_CHROME.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
            xaxis: {
                type: "numeric",
                min: 0,
                max: xMax,
                tickAmount: 5,
                title: { text: "Spend (kr.)", style: { color: COMMERCE_CHART_CHROME.axisLabel, fontWeight: 500 } },
                labels: { style: { colors: COMMERCE_CHART_CHROME.axisLabel }, formatter: (v) => `${fmtInt(Number(v) / 1000)}k` },
                axisTicks: { show: false },
                axisBorder: { show: true, color: COMMERCE_CHART_CHROME.grid },
                tooltip: { enabled: false },
            },
            yaxis: {
                min: 0,
                max: Math.ceil((maxRoas * 1.2) / 4) * 4,
                tickAmount: 4,
                forceNiceScale: true,
                title: { text: "ROAS", style: { color: COMMERCE_CHART_CHROME.axisLabel, fontWeight: 500 } },
                labels: { style: { colors: COMMERCE_CHART_CHROME.axisLabel }, formatter: (v) => fmtDec(v, 1) },
            },
            annotations: accountRoas
                ? {
                      yaxis: [
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
                      ],
                  }
                : {},
            legend: { show: true, position: "bottom", horizontalAlign: "left" },
            tooltip: {
                custom: ({ seriesIndex, w }) => {
                    const pt = w.config.series[seriesIndex].data[0];
                    const name = w.config.series[seriesIndex].name;
                    return `<div style="padding:10px 12px;font-size:12.5px;line-height:1.5;background:#111A12;color:#fff;border-radius:10px"><b>${name}</b><br/>Spend ${fmtKr(pt.x)}<br/>ROAS ${fmtDec(pt.y, 2)}<br/>Revenue ${fmtKr(pt.z)}</div>`;
                },
            },
        };
        return { series, options };
    }, [mapRows, accountRoas]);

    const columns = [
        {
            key: "campaign_name",
            label: "Campaign",
            left: true,
            sortValue: (r) => r.campaign_name,
            render: (r) => <span title={r.campaign_name}>{r.campaign_name}</span>,
        },
        {
            key: "status",
            label: "Status",
            sortValue: (r) => num(r.roas),
            render: (r) => <ServiceTag tone={r.status.tone}>{r.status.label}</ServiceTag>,
        },
        { key: "ad_spend", label: "Spend", sortValue: (r) => num(r.ad_spend), render: (r) => fmtKr(r.ad_spend) },
        {
            key: "spendShare",
            label: "Share of spend",
            sortValue: (r) => r.spendShare,
            render: (r) => (
                <span className="apex-px-share">
                    <span className="apex-ov-bar">
                        <i style={{ width: `${Math.min(100, r.spendShare * 100)}%` }} />
                    </span>
                    {fmtShare(r.spendShare, 0)}
                </span>
            ),
        },
        { key: "conversions_value", label: "Revenue", sortValue: (r) => num(r.conversions_value), render: (r) => fmtKr(r.conversions_value) },
        {
            key: "roas",
            label: "ROAS",
            sortValue: (r) => num(r.roas),
            render: (r) => (
                <span className="apex-px-cell">
                    {fmtDec(r.roas, 2)}
                    {hasPrev && r.prev ? <DeltaChip cur={r.roas} prev={r.prev.roas} compactSize /> : null}
                </span>
            ),
        },
        {
            key: "cpa",
            label: "CPA",
            sortValue: (r) => (isNum(r.cpa) && num(r.conversions) > 0 ? num(r.cpa) : Infinity),
            render: (r) => (num(r.conversions) > 0 ? fmtKr(r.cpa) : "-"),
        },
        { key: "conversions", label: "Conv.", sortValue: (r) => num(r.conversions), render: (r) => fmtInt(r.conversions) },
        { key: "ctr", label: "CTR", sortValue: (r) => num(r.ctr), render: (r) => fmtPctPoints(num(r.ctr) * 100, 2) },
        {
            key: "impression_share",
            label: "Imp. share",
            sortValue: (r) => (isNum(r.impression_share) ? num(r.impression_share) : -1),
            render: (r) => (isNum(r.impression_share) ? fmtPctPoints(num(r.impression_share) * 100, 0) : "-"),
        },
    ];

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-sx-grid-3">
                <ServiceKpi hero neutral label="Campaigns" value={fmtInt(rows.length)} caption={`${fmtKr(totalSpend)} spent`} />
                <ServiceKpi
                    label="Best campaign"
                    icon={FiAward}
                    value={best ? fmtDec(best.roas, 2) : "-"}
                    unit="ROAS"
                    caption={best ? best.campaign_name : "No campaign with enough spend"}
                />
                <ServiceKpi
                    label="Below target"
                    icon={FiAlertTriangle}
                    cost
                    value={fmtInt(flagged.length)}
                    unit={flagged.length === 1 ? "campaign" : "campaigns"}
                    caption={flagged.length ? `${fmtShare(totalSpend > 0 ? flaggedSpend / totalSpend : 0, 0)} of spend` : "Nothing far below account ROAS"}
                />
            </div>

            <div className="apex-ov-grid apex-sx-split">
                <section className="apex-ov-card apex-sx-chartcard">
                    <div className="apex-ov-card__head">
                        <h3>Campaign map</h3>
                        <span className="apex-ov-sub">Spend against ROAS, bubble size is revenue</span>
                    </div>
                    <GraphCard
                        variant="cobalt"
                        hideChartToggle
                        title=""
                        chartType="bubble"
                        height={340}
                        chartOptions={map.options}
                        chartSeries={map.series}
                    />
                    <p className="apex-mk-note">
                        Campaigns above the dashed line return more than the account average. Big bubbles far to the right and under the line are where spend works hardest against you.
                        {rows.length > MAP_LIMIT ? ` Showing the ${MAP_LIMIT} campaigns with the most spend.` : ""}
                    </p>
                </section>

                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>By campaign type</h3>
                        <span className="apex-ov-sub">Grouped by campaign name</span>
                    </div>
                    <div className="apex-px-types">
                        {types.map((t) => (
                            <div key={t.id} className="apex-px-type">
                                <div className="apex-px-type__top">
                                    <b>{t.label}</b>
                                    <span>{fmtInt(t.campaigns)} {t.campaigns === 1 ? "campaign" : "campaigns"}</span>
                                </div>
                                <div className="apex-px-type__grid">
                                    <div>
                                        <small>Spend</small>
                                        <b>{fmtKr(t.spend)}</b>
                                    </div>
                                    <div>
                                        <small>ROAS</small>
                                        <b>{fmtDec(t.roas, 2)}</b>
                                    </div>
                                    <div>
                                        <small>CPA</small>
                                        <b>{t.cpa != null ? fmtKr(t.cpa) : "-"}</b>
                                    </div>
                                </div>
                                <div className="apex-ov-bar">
                                    <i style={{ width: `${totalSpend > 0 ? (t.spend / totalSpend) * 100 : 0}%` }} />
                                </div>
                                <div className="apex-px-type__cap">{fmtShare(totalSpend > 0 ? t.spend / totalSpend : 0, 0)} of spend</div>
                            </div>
                        ))}
                    </div>
                    <p className="apex-mk-note">Brand campaigns usually look best on ROAS because they catch people who already know you. Judge generic and shopping on their own.</p>
                </section>
            </div>

            <PpcTable
                title="Campaign scorecard"
                subtitle={`Status compares each campaign's ROAS with the account average (${fmtDec(accountRoas, 2)}): Scale at 1,25x or more, Healthy from 0,85x, Watch from 0,5x, Cut back below. Campaigns under 1% of spend are Low volume.${hasPrev ? ` ROAS arrows compare ${vs}.` : ""}`}
                columns={columns}
                rows={rows}
                rowKey={(r) => r.id}
                initialSort={{ key: "ad_spend", dir: "desc" }}
                emptyText="No campaign data for this period."
            />
        </div>
    );
}
