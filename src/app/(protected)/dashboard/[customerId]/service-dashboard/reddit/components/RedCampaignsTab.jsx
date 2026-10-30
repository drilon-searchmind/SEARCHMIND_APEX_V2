"use client";

import React, { useEffect, useMemo } from "react";
import { FiAlertTriangle, FiAward } from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
import { COMMERCE_CHART_CHROME } from "@/components/dashboard/chartColors";
import ServiceTable from "@/components/dashboard/ServiceTable";
import { COMPARISON_METHOD } from "@/lib/dateRangeComparison";
import { redStatus, summarizeRed } from "@/lib/redAnalytics";
import { DeltaChip, ServiceKpi, ServiceTag, compact, fmtDec, fmtInt, fmtKr, fmtPctPoints, fmtShare, num, vsCaption } from "@/components/dashboard/ServiceParts";

const STATUS_COLORS = { strong: "#2F8434", solid: "#7DBB6F", low: "#94A3B8", soft: "#CA8A04", weak: "#DC2626", none: "#7F1D1D" };
const STATUS_ORDER = ["strong", "solid", "low", "soft", "weak", "none"];
const STATUS_LABEL = { strong: "Strong", solid: "Solid", low: "Low volume", soft: "Soft", weak: "Weak", none: "No purchases" };

function objectiveLabel(o) {
    if (!o) return "-";
    return String(o).replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

function enrich(list, summary, totals) {
    const totalSpend = totals.spend;
    return list.map((r, i) => ({
        ...r,
        rowId: `${r.id || r.campaign_id || r.name}-${i}`,
        label: r.campaign_name || r.name,
        cpc: num(r.clicks) > 0 ? num(r.ad_spend) / num(r.clicks) : null,
        cpa: num(r.purchases) > 0 ? num(r.ad_spend) / num(r.purchases) : null,
        roas: num(r.ad_spend) > 0 && num(r.purchase_value) > 0 ? num(r.purchase_value) / num(r.ad_spend) : null,
        spendShare: totalSpend > 0 ? num(r.ad_spend) / totalSpend : 0,
        status: redStatus(r, summary, totals),
    }));
}

export default function RedCampaignsTab({ data, comparisonMethod, comparisonLabel, onLedeChange }) {
    const { metrics, campaigns, campaignsPrev, adGroups } = data;
    const summary = useMemo(() => summarizeRed(metrics), [metrics]);
    const byPurchases = !!summary?.tracksPurchases;
    const totals = useMemo(() => ({ spend: campaigns.reduce((s, c) => s + num(c.ad_spend), 0), impressions: campaigns.reduce((s, c) => s + num(c.impressions), 0) }), [campaigns]);
    const hasPrev = comparisonMethod !== COMPARISON_METHOD.NONE && campaignsPrev.length > 0;
    const vs = vsCaption(comparisonLabel);
    const prevById = useMemo(() => Object.fromEntries(campaignsPrev.map((c) => [String(c.campaign_id), c])), [campaignsPrev]);

    const rows = useMemo(() => enrich(campaigns, summary, totals).map((r) => ({ ...r, prev: prevById[String(r.campaign_id)] || null })), [campaigns, summary, totals, prevById]);
    const groups = useMemo(() => enrich(adGroups, summary, totals), [adGroups, summary, totals]);

    const eligible = rows.filter((r) => r.spendShare >= 0.03);
    const best = useMemo(() => (byPurchases ? [...eligible].filter((r) => r.cpa != null).sort((a, b) => a.cpa - b.cpa)[0] : [...eligible].sort((a, b) => num(b.ctr) - num(a.ctr))[0]), [eligible, byPurchases]);
    const flagged = rows.filter((r) => r.status.id === "weak" || r.status.id === "none");
    const flaggedSpend = flagged.reduce((s, r) => s + num(r.ad_spend), 0);
    const useRoas = !!summary?.tracksValue && rows.some((r) => r.roas != null);

    useEffect(() => {
        if (!rows.length) {
            onLedeChange?.(null);
            return;
        }
        let text = `${fmtInt(rows.length)} campaigns spent ${fmtKr(totals.spend)}`;
        if (best) text += byPurchases ? `, ${best.label} is cheapest per purchase at ${fmtDec(best.cpa, 0)} kr` : `, ${best.label} has the best click-through rate`;
        onLedeChange?.(`${text}.`);
    }, [rows, totals, best, byPurchases, onLedeChange]);

    const map = useMemo(() => {
        const pts = rows.filter((r) => num(r.ad_spend) > 0 && num(r.impressions) > 0 && (!useRoas || r.roas != null));
        const yOf = (r) => (useRoas ? r.roas : num(r.ctr) * 100);
        const series = STATUS_ORDER.map((id) => ({
            name: STATUS_LABEL[id],
            data: pts.filter((r) => r.status.id === id).map((r) => ({ x: Math.round(num(r.ad_spend)), y: Number(yOf(r).toFixed(2)), z: Math.max(1, Math.round(num(r.clicks))), name: r.label })),
        })).filter((s) => s.data.length > 0);
        const colors = series.map((s) => STATUS_COLORS[STATUS_ORDER.find((id) => STATUS_LABEL[id] === s.name)]);
        const maxX = Math.max(...pts.map((r) => num(r.ad_spend)), 1);
        const accRef = useRoas ? num(summary?.roas) : num(summary?.ctr);
        const maxY = Math.max(...pts.map(yOf), accRef, 0.1);
        const yTitle = useRoas ? "ROAS" : "Click-through rate (%)";
        const options = {
            chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: COMMERCE_CHART_CHROME.fontFamily },
            colors,
            fill: { opacity: 0.78 },
            stroke: { width: 2, colors: ["#ffffff"] },
            plotOptions: { bubble: { minBubbleRadius: 9, maxBubbleRadius: 36 } },
            dataLabels: { enabled: false },
            grid: { borderColor: COMMERCE_CHART_CHROME.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
            xaxis: {
                type: "numeric",
                min: 0,
                max: Math.ceil((maxX * 1.18) / 1000) * 1000,
                tickAmount: 5,
                title: { text: "Spend (kr.)", style: { color: COMMERCE_CHART_CHROME.axisLabel, fontWeight: 500 } },
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
                title: { text: yTitle, style: { color: COMMERCE_CHART_CHROME.axisLabel, fontWeight: 500 } },
                labels: { style: { colors: COMMERCE_CHART_CHROME.axisLabel }, formatter: (v) => fmtDec(v, 1) },
            },
            annotations: accRef
                ? {
                      yaxis: [
                          {
                              y: Number(accRef.toFixed(2)),
                              borderColor: "#111A12",
                              strokeDashArray: 4,
                              label: {
                                  text: `Account ${fmtDec(accRef, 2)}`,
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
                    return `<div style="padding:10px 12px;font-size:12.5px;line-height:1.5;background:#111A12;color:#fff;border-radius:10px"><b>${pt.name}</b><br/>Spend ${fmtKr(pt.x)}<br/>${yTitle} ${fmtDec(pt.y, 2)}<br/>Clicks ${fmtInt(pt.z)}</div>`;
                },
            },
        };
        return { series, options, count: pts.length, yTitle };
    }, [rows, useRoas, summary]);

    const columnsFor = (withDelta) => [
        { key: "label", label: "Name", left: true, sortValue: (r) => r.label, render: (r) => <span title={r.label}>{r.label}</span> },
        { key: "status", label: "Status", sortValue: (r) => (byPurchases ? (r.cpa == null ? Infinity : r.cpa) : -num(r.ctr)), render: (r) => <ServiceTag tone={r.status.tone}>{r.status.label}</ServiceTag> },
        { key: "ad_spend", label: "Spend", sortValue: (r) => num(r.ad_spend), render: (r) => fmtKr(r.ad_spend) },
        { key: "clicks", label: "Clicks", sortValue: (r) => num(r.clicks), render: (r) => fmtInt(r.clicks) },
        {
            key: "ctr",
            label: "CTR",
            sortValue: (r) => num(r.ctr),
            render: (r) => (
                <span className="apex-sx-cell">
                    {fmtPctPoints(num(r.ctr) * 100, 2)}
                    {withDelta && hasPrev && r.prev ? <DeltaChip cur={r.ctr} prev={r.prev.ctr} compactSize /> : null}
                </span>
            ),
        },
        { key: "cpc", label: "CPC", sortValue: (r) => (r.cpc == null ? Infinity : r.cpc), render: (r) => (r.cpc == null ? "-" : `${fmtDec(r.cpc, 2)} kr.`) },
        { key: "impressions", label: "Impressions", sortValue: (r) => num(r.impressions), render: (r) => fmtInt(r.impressions) },
        ...(byPurchases
            ? [
                  { key: "purchases", label: "Purchases", sortValue: (r) => num(r.purchases), render: (r) => fmtInt(r.purchases) },
                  { key: "cpa", label: "CPA", sortValue: (r) => (r.cpa == null ? Infinity : r.cpa), render: (r) => (r.cpa == null ? "-" : fmtKr(r.cpa)) },
              ]
            : []),
        { key: "objective", label: "Objective", left: true, className: () => "is-muted", sortValue: (r) => r.objective || "", render: (r) => objectiveLabel(r.objective) },
    ];

    if (!rows.length) return <div className="apex-sx-alert">No campaign data for this period.</div>;

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-sx-grid-3">
                <ServiceKpi hero neutral label="Campaigns" value={fmtInt(rows.length)} caption={`${fmtKr(totals.spend)} spent`} />
                <ServiceKpi
                    label={byPurchases ? "Cheapest per purchase" : "Best click-through"}
                    icon={FiAward}
                    value={best ? (byPurchases ? fmtDec(best.cpa, 0) : fmtDec(num(best.ctr) * 100, 2)) : "-"}
                    unit={byPurchases ? "kr." : "%"}
                    caption={best ? best.label : "No campaign with enough spend"}
                />
                <ServiceKpi
                    label="Behind the account"
                    icon={FiAlertTriangle}
                    cost
                    value={fmtInt(flagged.length)}
                    unit={flagged.length === 1 ? "campaign" : "campaigns"}
                    caption={flagged.length ? `${fmtShare(totals.spend > 0 ? flaggedSpend / totals.spend : 0, 0)} of spend` : "Nothing far off the account"}
                />
            </div>

            <section className="apex-ov-card apex-sx-chartcard">
                <div className="apex-ov-card__head">
                    <h3>Campaign map</h3>
                    <span className="apex-ov-sub">Spend against {useRoas ? "ROAS" : "click-through rate"}, bubble size is clicks</span>
                </div>
                {map.count ? <GraphCard variant="cobalt" hideChartToggle title="" chartType="bubble" height={340} chartOptions={map.options} chartSeries={map.series} /> : <p className="apex-mk-note apex-sx-empty-note">No campaign has enough data for the map.</p>}
                <p className="apex-mk-note">Campaigns above the dashed line beat the account. Big bubbles far to the right and under it are where spend works hardest against you.</p>
            </section>

            <ServiceTable
                title="Campaign scorecard"
                subtitle={
                    byPurchases
                        ? `Status compares cost per purchase with the account (${fmtDec(num(summary?.cpa), 0)} kr.): Strong at 1,25x better or more, Solid from 0,85x, Soft from 0,5x, Weak below.${hasPrev ? ` CTR arrows compare ${vs}.` : ""}`
                        : `No purchases were tracked, so status compares click-through with the account (${fmtDec(num(summary?.ctr), 2)}%): Strong at 1,25x or more, Solid from 0,85x, Soft from 0,5x, Weak below. Campaigns under 1% of impressions are Low volume.${hasPrev ? ` CTR arrows compare ${vs}.` : ""}`
                }
                columns={columnsFor(true)}
                rows={rows}
                rowKey={(r) => r.rowId}
                initialSort={{ key: "ad_spend", dir: "desc" }}
                pageSize={10}
                searchKey="label"
                searchPlaceholder="Search campaigns"
                emptyText="No campaigns match."
            />

            {groups.length ? (
                <ServiceTable
                    title="Ad groups"
                    subtitle="Ad groups carry the targeting and the budget in Reddit, so this is where to see which audience setup works."
                    columns={columnsFor(false)}
                    rows={groups}
                    rowKey={(r) => r.rowId}
                    initialSort={{ key: "ad_spend", dir: "desc" }}
                    pageSize={10}
                    searchKey="label"
                    searchPlaceholder="Search ad groups"
                    emptyText="No ad groups match."
                />
            ) : null}
        </div>
    );
}
