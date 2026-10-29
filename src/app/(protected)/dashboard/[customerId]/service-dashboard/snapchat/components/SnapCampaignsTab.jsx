"use client";

import React, { useEffect, useMemo } from "react";
import { FiAlertTriangle, FiAward } from "react-icons/fi";
import GraphCard from "@/components/dashboard/GraphCard";
import { COMMERCE_CHART_CHROME } from "@/components/dashboard/chartColors";
import ServiceTable from "@/components/dashboard/ServiceTable";
import { COMPARISON_METHOD } from "@/lib/dateRangeComparison";
import { costStatus } from "@/lib/liAnalytics";
import { pinCampaignStatus } from "@/lib/pinAnalytics";
import { summarizeSnap } from "@/lib/snapAnalytics";
import { DeltaChip, ServiceKpi, ServiceTag, compact, fmtDec, fmtInt, fmtKr, fmtPctPoints, fmtShare, isNum, num, vsCaption } from "@/components/dashboard/ServiceParts";

const STATUS_COLORS = { strong: "#2F8434", solid: "#7DBB6F", low: "#94A3B8", soft: "#CA8A04", weak: "#DC2626", none: "#7F1D1D" };
const STATUS_ORDER = ["strong", "solid", "low", "soft", "weak", "none"];
const STATUS_LABEL = { strong: "Strong", solid: "Solid", low: "Low volume", soft: "Soft", weak: "Weak", none: "No purchases" };

export default function SnapCampaignsTab({ data, comparisonMethod, comparisonLabel, onLedeChange }) {
    const { metrics, campaigns, campaignsPrev } = data;
    const summary = useMemo(() => summarizeSnap(metrics), [metrics]);
    const byPurchases = !!summary?.tracksPurchases;
    const accountCpa = num(summary?.cpa);
    const accountCtr = num(summary?.ctr) / 100;
    const totalSpend = campaigns.reduce((s, c) => s + num(c.ad_spend), 0);
    const totalImpressions = campaigns.reduce((s, c) => s + num(c.impressions), 0);
    const hasPrev = comparisonMethod !== COMPARISON_METHOD.NONE && campaignsPrev.length > 0;
    const vs = vsCaption(comparisonLabel);
    const prevById = useMemo(() => Object.fromEntries(campaignsPrev.map((c) => [String(c.campaign_id), c])), [campaignsPrev]);

    const rows = useMemo(
        () =>
            campaigns.map((c, i) => {
                const purchases = num(c.purchases);
                const cpa = purchases > 0 ? num(c.ad_spend) / purchases : null;
                let status;
                if (byPurchases) {
                    status = costStatus({ ad_spend: c.ad_spend, leads: c.purchases, conversions: 0 }, accountCpa, totalSpend);
                    if (status.id === "none") status = { id: "none", label: "No purchases", tone: "bad" };
                } else {
                    status = pinCampaignStatus(c, accountCtr, totalImpressions);
                }
                return {
                    ...c,
                    id: c.campaign_id || `${c.campaign_name}-${i}`,
                    cpa,
                    roas: num(c.ad_spend) > 0 && num(c.purchase_value) > 0 ? num(c.purchase_value) / num(c.ad_spend) : null,
                    cartToPurchase: num(c.adds_to_cart) > 0 ? (purchases / num(c.adds_to_cart)) * 100 : null,
                    completion: num(c.video_views) > 0 ? num(c.video_completes) / num(c.video_views) : null,
                    spendShare: totalSpend > 0 ? num(c.ad_spend) / totalSpend : 0,
                    status,
                    prev: prevById[String(c.campaign_id)] || null,
                };
            }),
        [campaigns, byPurchases, accountCpa, accountCtr, totalSpend, totalImpressions, prevById]
    );

    const hasRoas = rows.some((r) => r.roas != null);
    const eligible = rows.filter((r) => r.spendShare >= 0.03);
    const best = useMemo(
        () => (byPurchases ? [...eligible].filter((r) => r.cpa != null).sort((a, b) => a.cpa - b.cpa)[0] : [...eligible].sort((a, b) => num(b.ctr) - num(a.ctr))[0]),
        [eligible, byPurchases]
    );
    const flagged = rows.filter((r) => r.status.id === "weak" || r.status.id === "none");
    const flaggedSpend = flagged.reduce((s, r) => s + num(r.ad_spend), 0);

    useEffect(() => {
        if (!rows.length) {
            onLedeChange?.(null);
            return;
        }
        let text = `${fmtInt(rows.length)} campaigns spent ${fmtKr(totalSpend)}`;
        if (best) text += byPurchases ? `, ${best.campaign_name} is cheapest per purchase at ${fmtDec(best.cpa, 0)} kr.` : `, ${best.campaign_name} has the best swipe-up rate`;
        onLedeChange?.(`${text}.`);
    }, [rows, totalSpend, best, byPurchases, onLedeChange]);

    const map = useMemo(() => {
        const useRoas = hasRoas;
        const pts = rows.filter((r) => num(r.ad_spend) > 0 && (useRoas ? r.roas != null : num(r.impressions) > 0));
        const yOf = (r) => (useRoas ? r.roas : num(r.ctr) * 100);
        const series = STATUS_ORDER.map((id) => ({
            name: STATUS_LABEL[id],
            data: pts.filter((r) => r.status.id === id).map((r) => ({ x: Math.round(num(r.ad_spend)), y: Number(yOf(r).toFixed(2)), z: Math.max(1, Math.round(useRoas ? num(r.purchases) : num(r.clicks))), name: r.campaign_name })),
        })).filter((s) => s.data.length > 0);
        const colors = series.map((s) => STATUS_COLORS[STATUS_ORDER.find((id) => STATUS_LABEL[id] === s.name)]);
        const maxX = Math.max(...pts.map((r) => num(r.ad_spend)), 1);
        const accRef = useRoas ? num(summary?.roas) : accountCtr * 100;
        const maxY = Math.max(...pts.map(yOf), accRef, 0.1);
        const yTitle = useRoas ? "ROAS" : "Swipe-up rate (%)";
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
                    return `<div style="padding:10px 12px;font-size:12.5px;line-height:1.5;background:#111A12;color:#fff;border-radius:10px"><b>${pt.name}</b><br/>Spend ${fmtKr(pt.x)}<br/>${yTitle} ${fmtDec(pt.y, 2)}<br/>${useRoas ? "Purchases" : "Swipe-ups"} ${fmtInt(pt.z)}</div>`;
                },
            },
        };
        return { series, options, count: pts.length, useRoas };
    }, [rows, hasRoas, summary, accountCtr]);

    const columns = [
        { key: "campaign_name", label: "Campaign", left: true, sortValue: (r) => r.campaign_name, render: (r) => <span title={r.campaign_name}>{r.campaign_name}</span> },
        { key: "status", label: "Status", sortValue: (r) => (byPurchases ? (r.cpa == null ? Infinity : r.cpa) : -num(r.ctr)), render: (r) => <ServiceTag tone={r.status.tone}>{r.status.label}</ServiceTag> },
        { key: "ad_spend", label: "Spend", sortValue: (r) => num(r.ad_spend), render: (r) => fmtKr(r.ad_spend) },
        { key: "purchases", label: "Purchases", sortValue: (r) => num(r.purchases), render: (r) => fmtInt(r.purchases) },
        { key: "cpa", label: "CPA", sortValue: (r) => (r.cpa == null ? Infinity : r.cpa), render: (r) => (r.cpa == null ? "-" : fmtKr(r.cpa)) },
        ...(hasRoas
            ? [
                  {
                      key: "roas",
                      label: "ROAS",
                      sortValue: (r) => (r.roas == null ? -1 : r.roas),
                      render: (r) => (
                          <span className="apex-sx-cell">
                              {r.roas == null ? "-" : fmtDec(r.roas, 2)}
                              {hasPrev && r.prev && r.roas != null && num(r.prev.ad_spend) > 0 && num(r.prev.purchase_value) > 0 ? <DeltaChip cur={r.roas} prev={num(r.prev.purchase_value) / num(r.prev.ad_spend)} compactSize /> : null}
                          </span>
                      ),
                  },
              ]
            : []),
        { key: "adds_to_cart", label: "Adds to cart", sortValue: (r) => num(r.adds_to_cart), render: (r) => fmtInt(r.adds_to_cart) },
        { key: "clicks", label: "Swipe-ups", sortValue: (r) => num(r.clicks), render: (r) => fmtInt(r.clicks) },
        { key: "ctr", label: "Swipe rate", sortValue: (r) => num(r.ctr), render: (r) => fmtPctPoints(num(r.ctr) * 100, 2) },
        { key: "completion", label: "Video watched to end", sortValue: (r) => (r.completion == null ? -1 : r.completion), render: (r) => (r.completion == null ? "-" : fmtPctPoints(r.completion * 100, 0)) },
        { key: "frequency", label: "Freq.", sortValue: (r) => (isNum(r.frequency) ? num(r.frequency) : -1), render: (r) => (isNum(r.frequency) ? fmtDec(r.frequency, 1) : "-") },
    ];

    if (!rows.length) return <div className="apex-sx-alert">No campaign data for this period.</div>;

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-sx-grid-3">
                <ServiceKpi hero neutral label="Campaigns" value={fmtInt(rows.length)} caption={`${fmtKr(totalSpend)} spent`} />
                <ServiceKpi
                    label={byPurchases ? "Cheapest per purchase" : "Best swipe-up rate"}
                    icon={FiAward}
                    value={best ? (byPurchases ? fmtDec(best.cpa, 0) : fmtDec(num(best.ctr) * 100, 2)) : "-"}
                    unit={byPurchases ? "kr." : "%"}
                    caption={best ? best.campaign_name : "No campaign with enough spend"}
                />
                <ServiceKpi
                    label={byPurchases ? "Costly or no purchases" : "Weak campaigns"}
                    icon={FiAlertTriangle}
                    cost
                    value={fmtInt(flagged.length)}
                    unit={flagged.length === 1 ? "campaign" : "campaigns"}
                    caption={flagged.length ? `${fmtShare(totalSpend > 0 ? flaggedSpend / totalSpend : 0, 0)} of spend` : "Nothing far off the account"}
                />
            </div>

            <section className="apex-ov-card apex-sx-chartcard">
                <div className="apex-ov-card__head">
                    <h3>Campaign map</h3>
                    <span className="apex-ov-sub">Spend against {map.useRoas ? "ROAS" : "swipe-up rate"}, bubble size is {map.useRoas ? "purchases" : "swipe-ups"}</span>
                </div>
                {map.count ? <GraphCard variant="cobalt" hideChartToggle title="" chartType="bubble" height={340} chartOptions={map.options} chartSeries={map.series} /> : <p className="apex-mk-note apex-sx-empty-note">No campaign has enough data for the map.</p>}
                <p className="apex-mk-note">Campaigns above the dashed line beat the account. Big bubbles far to the right and under it are where spend works hardest against you.{hasPrev ? ` ROAS arrows in the table compare ${vs}.` : ""}</p>
            </section>

            <ServiceTable
                title="Campaign scorecard"
                subtitle={
                    byPurchases
                        ? `Status compares cost per purchase with the account (${accountCpa > 0 ? fmtDec(accountCpa, 0) : "-"} kr.): Strong at 1,25x better or more, Solid from 0,85x, Soft from 0,5x, Weak below. Campaigns under 1% of spend are Low volume. Frequency is per campaign over the period and only shown for ranges up to 31 days.`
                        : `No purchases were tracked, so status compares swipe-up rate with the account (${fmtDec(accountCtr * 100, 2)}%): Strong at 1,25x or more, Solid from 0,85x, Soft from 0,5x, Weak below.`
                }
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
