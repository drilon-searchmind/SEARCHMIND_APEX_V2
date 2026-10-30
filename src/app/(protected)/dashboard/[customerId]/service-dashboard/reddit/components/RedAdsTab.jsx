"use client";

import React, { useEffect, useMemo } from "react";
import { FiAward, FiImage } from "react-icons/fi";
import ServiceTable from "@/components/dashboard/ServiceTable";
import { redStatus, summarizeRed } from "@/lib/redAnalytics";
import { ServiceKpi, ServiceTag, fmtDec, fmtInt, fmtKr, fmtPctPoints, fmtShare, num } from "@/components/dashboard/ServiceParts";

export default function RedAdsTab({ data, onLedeChange }) {
    const { ads, metrics, warnings } = data;
    const summary = useMemo(() => summarizeRed(metrics), [metrics]);
    const byPurchases = !!summary?.tracksPurchases;
    const totals = useMemo(() => ({ spend: ads.reduce((s, a) => s + num(a.ad_spend), 0), impressions: ads.reduce((s, a) => s + num(a.impressions), 0) }), [ads]);

    const rows = useMemo(
        () =>
            ads.map((a) => ({
                ...a,
                cpc: num(a.clicks) > 0 ? num(a.ad_spend) / num(a.clicks) : null,
                cpa: num(a.purchases) > 0 ? num(a.ad_spend) / num(a.purchases) : null,
                spendShare: totals.spend > 0 ? num(a.ad_spend) / totals.spend : 0,
                status: redStatus(a, summary, totals),
            })),
        [ads, summary, totals]
    );

    const eligible = rows.filter((r) => r.spendShare >= 0.02);
    const best = useMemo(() => (byPurchases ? [...eligible].filter((r) => r.cpa != null).sort((a, b) => a.cpa - b.cpa)[0] : [...eligible].sort((a, b) => num(b.ctr) - num(a.ctr))[0]), [eligible, byPurchases]);
    const cheapest = useMemo(() => [...eligible].filter((r) => r.cpc != null).sort((a, b) => a.cpc - b.cpc)[0], [eligible]);
    const weak = rows.filter((r) => r.status.id === "weak" || r.status.id === "none");
    const weakSpend = weak.reduce((s, r) => s + num(r.ad_spend), 0);

    useEffect(() => {
        if (!rows.length) {
            onLedeChange?.(null);
            return;
        }
        let text = `${fmtInt(rows.length)} ads spent ${fmtKr(totals.spend)}`;
        if (best) text += `, ${best.name} leads`;
        onLedeChange?.(`${text}.`);
    }, [rows, totals, best, onLedeChange]);

    const columns = [
        { key: "name", label: "Ad", left: true, sortValue: (r) => r.name, render: (r) => <span title={r.name}>{r.name}</span> },
        { key: "campaign_name", label: "Campaign", left: true, className: () => "is-muted", sortValue: (r) => r.campaign_name || "", render: (r) => <span title={r.campaign_name || ""}>{r.campaign_name || "-"}</span> },
        { key: "status", label: "Status", sortValue: (r) => (byPurchases ? (r.cpa == null ? Infinity : r.cpa) : -num(r.ctr)), render: (r) => <ServiceTag tone={r.status.tone}>{r.status.label}</ServiceTag> },
        { key: "ad_spend", label: "Spend", sortValue: (r) => num(r.ad_spend), render: (r) => fmtKr(r.ad_spend) },
        { key: "clicks", label: "Clicks", sortValue: (r) => num(r.clicks), render: (r) => fmtInt(r.clicks) },
        { key: "ctr", label: "CTR", sortValue: (r) => num(r.ctr), render: (r) => fmtPctPoints(num(r.ctr) * 100, 2) },
        { key: "cpc", label: "CPC", sortValue: (r) => (r.cpc == null ? Infinity : r.cpc), render: (r) => (r.cpc == null ? "-" : `${fmtDec(r.cpc, 2)} kr.`) },
        { key: "impressions", label: "Impressions", sortValue: (r) => num(r.impressions), render: (r) => fmtInt(r.impressions) },
        ...(byPurchases
            ? [
                  { key: "purchases", label: "Purchases", sortValue: (r) => num(r.purchases), render: (r) => fmtInt(r.purchases) },
                  { key: "cpa", label: "CPA", sortValue: (r) => (r.cpa == null ? Infinity : r.cpa), render: (r) => (r.cpa == null ? "-" : fmtKr(r.cpa)) },
              ]
            : []),
    ];

    if (!rows.length) {
        const w = warnings.find((x) => x.part === "ads")?.message;
        return <div className="apex-sx-alert">No ad-level data for this period.{w ? ` ${w}` : ""}</div>;
    }

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-sx-grid-4">
                <ServiceKpi hero neutral label="Ads" value={fmtInt(rows.length)} caption={`${fmtKr(totals.spend)} spent, top 50 by spend`} />
                <ServiceKpi label={byPurchases ? "Cheapest per purchase" : "Best click-through"} icon={FiAward} value={best ? (byPurchases ? fmtDec(best.cpa, 0) : fmtDec(num(best.ctr) * 100, 2)) : "-"} unit={byPurchases ? "kr." : "%"} caption={best ? best.name : "No ad with enough spend"} />
                <ServiceKpi label="Cheapest clicks" icon={FiImage} value={cheapest ? fmtDec(cheapest.cpc, 2) : "-"} unit="kr." caption={cheapest ? cheapest.name : "No ad with enough spend"} />
                <ServiceKpi label="Behind the account" cost value={fmtInt(weak.length)} unit={weak.length === 1 ? "ad" : "ads"} caption={weak.length ? `${fmtShare(totals.spend > 0 ? weakSpend / totals.spend : 0, 0)} of ad spend` : "Nothing far off the account"} />
            </div>

            <ServiceTable
                title="Ad scorecard"
                subtitle={
                    byPurchases
                        ? `Status compares cost per purchase with the account (${fmtDec(num(summary?.cpa), 0)} kr.): Strong at 1,25x better or more, Solid from 0,85x, Soft from 0,5x, Weak below.`
                        : `No purchases were tracked, so status compares click-through with the account (${fmtDec(num(summary?.ctr), 2)}%): Strong at 1,25x or more, Solid from 0,85x, Soft from 0,5x, Weak below. Ads under 1% of impressions are Low volume.`
                }
                columns={columns}
                rows={rows}
                rowKey={(r) => r.id}
                initialSort={{ key: "ad_spend", dir: "desc" }}
                pageSize={12}
                searchKey="name"
                searchPlaceholder="Search ads"
                emptyText="No ads match."
            />
        </div>
    );
}
