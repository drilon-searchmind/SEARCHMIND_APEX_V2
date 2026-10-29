"use client";

import React, { useEffect, useMemo } from "react";
import { FiAward, FiAlertTriangle } from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
import { COMMERCE_CHART_CHROME } from "@/components/dashboard/chartColors";
import ServiceTable from "@/components/dashboard/ServiceTable";
import { costStatus, summarizeLi } from "@/lib/liAnalytics";
import { ServiceKpi, ServiceTag, compact, fmtDec, fmtInt, fmtKr, fmtPctPoints, fmtShare, isNum, num } from "@/components/dashboard/ServiceParts";

const STATUS_COLORS = { strong: "#2F8434", solid: "#7DBB6F", low: "#94A3B8", soft: "#CA8A04", weak: "#DC2626", none: "#7F1D1D" };
const STATUS_ORDER = ["strong", "solid", "low", "soft", "weak", "none"];
const STATUS_LABEL = { strong: "Strong", solid: "Solid", low: "Low volume", soft: "Soft", weak: "Weak", none: "No results" };

export default function LiCampaignsTab({ data, onLedeChange }) {
    const { metrics, campaigns, reach } = data;
    const summary = useMemo(() => summarizeLi(metrics, reach), [metrics, reach]);
    const accountCpr = num(summary?.costPerResult);
    const totalSpend = campaigns.reduce((s, c) => s + num(c.ad_spend), 0);

    const rows = useMemo(
        () =>
            campaigns.map((c, i) => {
                const results = num(c.leads) + num(c.conversions);
                return {
                    ...c,
                    id: c.campaign_id || `${c.campaign_name}-${i}`,
                    results,
                    costPerResult: results > 0 ? num(c.ad_spend) / results : null,
                    cpl: num(c.leads) > 0 ? num(c.ad_spend) / num(c.leads) : null,
                    formCompletion: num(c.lead_form_opens) > 0 ? (num(c.leads) / num(c.lead_form_opens)) * 100 : null,
                    spendShare: totalSpend > 0 ? num(c.ad_spend) / totalSpend : 0,
                    status: costStatus(c, accountCpr, totalSpend),
                };
            }),
        [campaigns, accountCpr, totalSpend]
    );

    const best = useMemo(() => [...rows].filter((r) => r.costPerResult != null && r.spendShare >= 0.03).sort((a, b) => a.costPerResult - b.costPerResult)[0], [rows]);
    const flagged = rows.filter((r) => r.status.id === "weak" || r.status.id === "none");
    const flaggedSpend = flagged.reduce((s, r) => s + num(r.ad_spend), 0);

    useEffect(() => {
        if (!rows.length) {
            onLedeChange?.(null);
            return;
        }
        let text = `${fmtInt(rows.length)} campaigns spent ${fmtKr(totalSpend)}`;
        if (best) text += `, ${best.campaign_name} is cheapest per result at ${fmtDec(best.costPerResult, 0)} kr.`;
        onLedeChange?.(`${text}.`);
    }, [rows, totalSpend, best, onLedeChange]);

    const map = useMemo(() => {
        const withResult = rows.filter((r) => r.costPerResult != null && num(r.ad_spend) > 0);
        const series = STATUS_ORDER.map((id) => ({
            name: STATUS_LABEL[id],
            data: withResult.filter((r) => r.status.id === id).map((r) => ({ x: Math.round(num(r.ad_spend)), y: Number(r.costPerResult.toFixed(1)), z: Math.max(1, Math.round(r.results)), name: r.campaign_name })),
        })).filter((s) => s.data.length > 0);
        const colors = series.map((s) => STATUS_COLORS[STATUS_ORDER.find((id) => STATUS_LABEL[id] === s.name)]);
        const maxX = Math.max(...withResult.map((r) => num(r.ad_spend)), 1);
        const maxY = Math.max(...withResult.map((r) => r.costPerResult), accountCpr, 1);
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
                max: Math.ceil((maxY * 1.2) / 100) * 100,
                tickAmount: 4,
                forceNiceScale: true,
                title: { text: "Cost per result (kr.)", style: { color: COMMERCE_CHART_CHROME.axisLabel, fontWeight: 500 } },
                labels: { style: { colors: COMMERCE_CHART_CHROME.axisLabel }, formatter: (v) => fmtInt(v) },
            },
            annotations: accountCpr
                ? {
                      yaxis: [
                          {
                              y: Number(accountCpr.toFixed(1)),
                              borderColor: "#111A12",
                              strokeDashArray: 4,
                              label: {
                                  text: `Account ${fmtDec(accountCpr, 0)} kr.`,
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
                    return `<div style="padding:10px 12px;font-size:12.5px;line-height:1.5;background:#111A12;color:#fff;border-radius:10px"><b>${pt.name}</b><br/>Spend ${fmtKr(pt.x)}<br/>Cost per result ${fmtDec(pt.y, 0)} kr.<br/>Results ${fmtInt(pt.z)}</div>`;
                },
            },
        };
        return { series, options, count: withResult.length };
    }, [rows, accountCpr]);

    const columns = [
        { key: "campaign_name", label: "Campaign", left: true, sortValue: (r) => r.campaign_name, render: (r) => <span title={r.campaign_name}>{r.campaign_name}</span> },
        { key: "status", label: "Status", sortValue: (r) => (r.costPerResult == null ? Infinity : r.costPerResult), render: (r) => <ServiceTag tone={r.status.tone}>{r.status.label}</ServiceTag> },
        { key: "ad_spend", label: "Spend", sortValue: (r) => num(r.ad_spend), render: (r) => fmtKr(r.ad_spend) },
        { key: "leads", label: "Leads", sortValue: (r) => num(r.leads), render: (r) => fmtInt(r.leads) },
        { key: "cpl", label: "CPL", sortValue: (r) => (r.cpl == null ? Infinity : r.cpl), render: (r) => (r.cpl == null ? "-" : fmtKr(r.cpl)) },
        { key: "formCompletion", label: "Form completion", sortValue: (r) => (r.formCompletion == null ? -1 : r.formCompletion), render: (r) => (r.formCompletion == null ? "-" : fmtPctPoints(r.formCompletion, 0)) },
        { key: "conversions", label: "Web conv.", sortValue: (r) => num(r.conversions), render: (r) => fmtInt(r.conversions) },
        { key: "costPerResult", label: "Per result", sortValue: (r) => (r.costPerResult == null ? Infinity : r.costPerResult), render: (r) => (r.costPerResult == null ? "-" : fmtKr(r.costPerResult)) },
        { key: "impressions", label: "Impressions", sortValue: (r) => num(r.impressions), render: (r) => fmtInt(r.impressions) },
        { key: "ctr", label: "CTR", sortValue: (r) => num(r.ctr), render: (r) => fmtPctPoints(num(r.ctr) * 100, 2) },
    ];

    if (!rows.length) return <div className="apex-sx-alert">No campaign data for this period.</div>;

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-sx-grid-3">
                <ServiceKpi hero neutral label="Campaigns" value={fmtInt(rows.length)} caption={`${fmtKr(totalSpend)} spent`} />
                <ServiceKpi label="Cheapest per result" icon={FiAward} value={best ? fmtDec(best.costPerResult, 0) : "-"} unit="kr." caption={best ? best.campaign_name : "No campaign with enough spend"} />
                <ServiceKpi
                    label="Costly or no results"
                    icon={FiAlertTriangle}
                    cost
                    value={fmtInt(flagged.length)}
                    unit={flagged.length === 1 ? "campaign" : "campaigns"}
                    caption={flagged.length ? `${fmtShare(totalSpend > 0 ? flaggedSpend / totalSpend : 0, 0)} of spend` : "Nothing far above account cost"}
                />
            </div>

            <section className="apex-ov-card apex-sx-chartcard">
                <div className="apex-ov-card__head">
                    <h3>Campaign map</h3>
                    <span className="apex-ov-sub">Spend against cost per result, bubble size is results</span>
                </div>
                {map.count ? (
                    <GraphCard variant="cobalt" hideChartToggle title="" chartType="bubble" height={340} chartOptions={map.options} chartSeries={map.series} />
                ) : (
                    <p className="apex-mk-note apex-sx-empty-note">No campaign has leads or web conversions in this period.</p>
                )}
                <p className="apex-mk-note">A result is a Lead Gen Form lead or a web conversion. Campaigns under the dashed line cost less per result than the account. Big bubbles far to the right and above it are where spend works hardest against you.</p>
            </section>

            <ServiceTable
                title="Campaign scorecard"
                subtitle={`Status compares cost per result with the account (${isNum(accountCpr) && accountCpr > 0 ? fmtDec(accountCpr, 0) : "-"} kr.): Strong at 1,25x better or more, Solid from 0,85x, Soft from 0,5x, Weak below. Spend with no results is flagged. Campaigns under 1% of spend are Low volume.`}
                columns={columns}
                rows={rows}
                rowKey={(r) => r.id}
                initialSort={{ key: "ad_spend", dir: "desc" }}
                pageSize={12}
                searchKey="campaign_name"
                searchPlaceholder="Search campaigns"
                emptyText="No campaigns match."
            />
        </div>
    );
}
