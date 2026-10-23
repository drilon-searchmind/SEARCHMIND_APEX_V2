"use client";

import React, { useEffect, useMemo } from "react";
import { FiAward, FiPercent, FiRepeat } from "react-icons/fi";
import ServiceTable from "@/components/dashboard/ServiceTable";
import { emRates, groupStats, mergeRows, rpeStatus } from "@/lib/emAnalytics";
import {
    ServiceKpi,
    ServiceTag,
    fmtDec,
    fmtInt,
    fmtKr,
    fmtPctPoints,
    fmtShare,
    num,
} from "@/components/dashboard/ServiceParts";

export default function EmFlowsTab({ data, onLedeChange }) {
    const { topFlows, flowTotals, campaignTotals, flowsLoading, flowsError } = data;
    const stats = useMemo(() => groupStats(topFlows), [topFlows]);
    const totalRevenue = num(flowTotals?.conversion_value) + num(campaignTotals?.conversion_value);
    const totalRecipients = num(flowTotals?.recipients) + num(campaignTotals?.recipients);

    const rows = useMemo(
        () =>
            topFlows.map((f, i) => ({
                ...f,
                id: f.flow_id || `${f.flow_name}-${i}`,
                rates: emRates(f),
                status: rpeStatus(f, stats.rpe, stats.recipients),
                revenueShare: stats.revenue > 0 ? num(f.conversion_value) / stats.revenue : 0,
            })),
        [topFlows, stats]
    );

    const top = rows[0];
    const bestRpe = useMemo(() => [...rows].filter((r) => r.status.id !== "low").sort((a, b) => num(b.rates.rpe) - num(a.rates.rpe))[0], [rows]);
    const merged = useMemo(() => mergeRows(flowTotals, null), [flowTotals]);

    useEffect(() => {
        if (!rows.length) {
            onLedeChange?.(null);
            return;
        }
        let text = `${fmtInt(rows.length)} flows earned ${fmtKr(stats.revenue)}`;
        if (top) text += `, ${top.flow_name} the most`;
        onLedeChange?.(`${text}.`);
    }, [rows, stats, top, onLedeChange]);

    const columns = [
        { key: "flow_name", label: "Flow", left: true, sortValue: (r) => r.flow_name, render: (r) => <span title={r.flow_name}>{r.flow_name}</span> },
        { key: "status", label: "Status", sortValue: (r) => num(r.rates.rpe), render: (r) => <ServiceTag tone={r.status.tone}>{r.status.label}</ServiceTag> },
        { key: "recipients", label: "Sent", sortValue: (r) => num(r.recipients), render: (r) => fmtInt(r.recipients) },
        { key: "conversion_value", label: "Revenue", sortValue: (r) => num(r.conversion_value), render: (r) => fmtKr(r.conversion_value) },
        {
            key: "revenueShare",
            label: "Share of flow revenue",
            sortValue: (r) => r.revenueShare,
            render: (r) => (
                <span className="apex-sx-share">
                    <span className="apex-ov-bar">
                        <i style={{ width: `${Math.min(100, r.revenueShare * 100)}%` }} />
                    </span>
                    {fmtShare(r.revenueShare, 0)}
                </span>
            ),
        },
        { key: "rpe", label: "Per email", sortValue: (r) => num(r.rates.rpe), render: (r) => `${fmtDec(r.rates.rpe, 2)} kr.` },
        { key: "conversions", label: "Orders", sortValue: (r) => num(r.conversions), render: (r) => fmtInt(r.conversions) },
        { key: "openRate", label: "Open", sortValue: (r) => num(r.rates.openRate), render: (r) => fmtPctPoints(num(r.rates.openRate) * 100, 1) },
        { key: "clickRate", label: "Click", sortValue: (r) => num(r.rates.clickRate), render: (r) => fmtPctPoints(num(r.rates.clickRate) * 100, 2) },
        { key: "unsubPerK", label: "Unsubs / 1.000", sortValue: (r) => num(r.rates.unsubPerK), render: (r) => fmtDec(r.rates.unsubPerK, 2) },
    ];

    if (flowsLoading) return <div className="apex-sx-alert apex-em-partial">Loading flow numbers from Klaviyo. Campaigns and the overview are already available.</div>;
    if (flowsError) return <div className="apex-sx-error">Flow numbers could not be loaded: {flowsError}</div>;
    if (!rows.length) return <div className="apex-sx-alert">No flow emails were sent in this period.</div>;

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-ov-grid--hero">
                <ServiceKpi hero neutral label="Flow revenue" value={fmtInt(stats.revenue)} unit="kr." caption={`${fmtInt(merged?.conversions)} orders`} />
                <ServiceKpi label="Share of email revenue" icon={FiPercent} value={fmtDec(totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : null, 0)} unit="%" caption={`${fmtShare(totalRecipients > 0 ? stats.recipients / totalRecipients : 0, 0)} of emails sent`} />
                <ServiceKpi label="Revenue per email" icon={FiRepeat} value={fmtDec(stats.rpe, 2)} unit="kr." caption="Across all flows" />
                <ServiceKpi label="Top earner" icon={FiAward} value={top ? fmtShare(top.revenueShare, 0) : "-"} caption={top ? `${top.flow_name}, of flow revenue` : "No flow revenue"} />
            </div>

            <section className="apex-ov-card">
                <div className="apex-ov-card__head">
                    <h3>Where flow revenue comes from</h3>
                    <span className="apex-ov-sub">Share of flow revenue against share of flow emails</span>
                </div>
                <div className="apex-sp-deliv">
                    {rows.map((r) => {
                        const sendShare = stats.recipients > 0 ? num(r.recipients) / stats.recipients : 0;
                        return (
                            <div key={r.id} className="apex-sp-deliv__row">
                                <div className="apex-sp-deliv__name">
                                    <b>{r.flow_name}</b>
                                    <ServiceTag tone={r.status.tone}>{r.status.label}</ServiceTag>
                                </div>
                                <div className="apex-sp-deliv__bars">
                                    <div className="apex-sp-pair">
                                        <span>Emails</span>
                                        <div className="apex-ov-bar">
                                            <i style={{ width: `${sendShare * 100}%`, background: "#2563EB" }} />
                                        </div>
                                        <b>{fmtShare(sendShare, 0)}</b>
                                    </div>
                                    <div className="apex-sp-pair">
                                        <span>Revenue</span>
                                        <div className="apex-ov-bar">
                                            <i style={{ width: `${r.revenueShare * 100}%`, background: "#EA580C" }} />
                                        </div>
                                        <b>{fmtShare(r.revenueShare, 0)}</b>
                                    </div>
                                </div>
                                <div className="apex-sp-deliv__stat">
                                    <small>Per email</small>
                                    <b>{fmtDec(r.rates.rpe, 2)}</b>
                                </div>
                                <div className="apex-sp-deliv__stat">
                                    <small>Orders</small>
                                    <b>{fmtInt(r.conversions)}</b>
                                </div>
                            </div>
                        );
                    })}
                </div>
                {bestRpe ? (
                    <p className="apex-sx-callout">
                        <b>{bestRpe.flow_name}</b> earns the most per email (<b>{fmtDec(bestRpe.rates.rpe, 2)} kr.</b>) against {fmtDec(stats.rpe, 2)} kr. across all flows. Flows that earn well per email are the ones
                        worth feeding with more entrants, for example through a wider trigger or a better sign-up flow.
                    </p>
                ) : null}
            </section>

            <ServiceTable
                title="Flow scorecard"
                subtitle={`Status compares revenue per email with the flow average (${fmtDec(stats.rpe, 2)} kr.): Winner at 1,25x or more, Solid from 0,75x, Soft from 0,4x, Weak below. Flows under 1% of flow volume are Low volume. Flow totals are grouped from Klaviyo's per-message report.`}
                columns={columns}
                rows={rows}
                rowKey={(r) => r.id}
                initialSort={{ key: "conversion_value", dir: "desc" }}
                searchKey="flow_name"
                searchPlaceholder="Search flows"
                emptyText="No flows match."
            />
        </div>
    );
}
