"use client";

import React, { useEffect, useMemo } from "react";
import { FiAlertTriangle, FiAward } from "react-icons/fi";
import ServiceTable from "@/components/dashboard/ServiceTable";
import { COMPARISON_METHOD } from "@/lib/dateRangeComparison";
import { placementDelivery, placementShiftEstimate } from "@/lib/psAnalytics";
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

export default function PsPlacementsTab({ data, comparisonMethod, comparisonLabel, onLedeChange }) {
    const { placements, placementsPrev } = data;
    const hasPrev = comparisonMethod !== COMPARISON_METHOD.NONE && placementsPrev.length > 0;
    const vs = vsCaption(comparisonLabel);
    const prevByName = useMemo(() => Object.fromEntries(placementsPrev.map((p) => [p.placement, p])), [placementsPrev]);

    const delivery = useMemo(() => placementDelivery(placements).map((d) => ({ ...d, prev: prevByName[d.placement] || null })), [placements, prevByName]);
    const totalSpend = delivery.reduce((s, d) => s + num(d.ad_spend), 0);
    const real = delivery.filter((d) => d.spendShare >= 0.03 && num(d.roas) > 0);
    const best = real.length ? real.reduce((a, b) => (num(b.roas) > num(a.roas) ? b : a)) : null;
    const weak = delivery.filter((d) => d.verdict.id === "under" || d.verdict.id === "soft");
    const weakShare = weak.reduce((s, d) => s + d.spendShare, 0);
    const shift = useMemo(() => placementShiftEstimate(delivery), [delivery]);
    const sorted = useMemo(() => [...delivery].sort((a, b) => num(b.ad_spend) - num(a.ad_spend)), [delivery]);

    useEffect(() => {
        if (!delivery.length) {
            onLedeChange?.(null);
            return;
        }
        let text = `${fmtInt(delivery.length)} placements spent ${fmtKr(totalSpend)}`;
        if (best) text += `, ${best.placement} returns the most at a ROAS of ${fmtDec(best.roas, 2)}`;
        onLedeChange?.(`${text}.`);
    }, [delivery, totalSpend, best, onLedeChange]);

    const columns = [
        { key: "placement", label: "Placement", left: true, sortValue: (r) => r.placement, render: (r) => <span className="apex-sp-cap">{r.placement}</span> },
        { key: "verdict", label: "Delivery", sortValue: (r) => num(r.index), render: (r) => <ServiceTag tone={r.verdict.tone}>{r.verdict.label}</ServiceTag> },
        { key: "ad_spend", label: "Spend", sortValue: (r) => num(r.ad_spend), render: (r) => fmtKr(r.ad_spend) },
        { key: "conversion_value", label: "Revenue", sortValue: (r) => num(r.conversion_value), render: (r) => fmtKr(r.conversion_value) },
        {
            key: "roas",
            label: "ROAS",
            sortValue: (r) => num(r.roas),
            render: (r) => (
                <span className="apex-sx-cell">
                    {fmtDec(r.roas, 2)}
                    {hasPrev && r.prev ? <DeltaChip cur={r.roas} prev={r.prev.roas} compactSize /> : null}
                </span>
            ),
        },
        { key: "cpa", label: "CPA", sortValue: (r) => (num(r.conversions) > 0 ? num(r.cpa) : Infinity), render: (r) => (num(r.conversions) > 0 ? fmtKr(r.cpa) : "-") },
        { key: "cpm", label: "CPM", sortValue: (r) => num(r.cpm), render: (r) => `${fmtDec(r.cpm, 1)} kr.` },
        { key: "ctr", label: "CTR", sortValue: (r) => num(r.ctr), render: (r) => fmtPctPoints(num(r.ctr) * 100, 2) },
        { key: "frequency", label: "Freq.", sortValue: (r) => (isNum(r.frequency) ? num(r.frequency) : -1), render: (r) => (isNum(r.frequency) ? fmtDec(r.frequency, 1) : "-") },
    ];

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-sx-grid-3">
                <ServiceKpi hero neutral label="Placements" value={fmtInt(delivery.length)} caption={`${fmtKr(totalSpend)} spent`} />
                <ServiceKpi label="Best placement" icon={FiAward} value={best ? fmtDec(best.roas, 2) : "-"} unit="ROAS" caption={best ? best.placement : "No placement with enough spend"} />
                <ServiceKpi
                    label="Spend on weak placements"
                    icon={FiAlertTriangle}
                    cost
                    value={fmtShare(weakShare, 0)}
                    caption={weak.length ? `${weak.map((w) => w.placement).join(", ")}` : "No placement under-delivers"}
                />
            </div>

            <section className="apex-ov-card">
                <div className="apex-ov-card__head">
                    <h3>Delivery by placement</h3>
                    <span className="apex-ov-sub">Share of spend against share of revenue</span>
                </div>
                <div className="apex-sp-deliv">
                    {sorted.map((d) => (
                        <div key={d.id} className="apex-sp-deliv__row">
                            <div className="apex-sp-deliv__name">
                                <b className="apex-sp-cap">{d.placement}</b>
                                <ServiceTag tone={d.verdict.tone}>{d.verdict.label}</ServiceTag>
                            </div>
                            <div className="apex-sp-deliv__bars">
                                <div className="apex-sp-pair">
                                    <span>Spend</span>
                                    <div className="apex-ov-bar">
                                        <i style={{ width: `${d.spendShare * 100}%`, background: "#2563EB" }} />
                                    </div>
                                    <b>{fmtShare(d.spendShare, 0)}</b>
                                </div>
                                <div className="apex-sp-pair">
                                    <span>Revenue</span>
                                    <div className="apex-ov-bar">
                                        <i style={{ width: `${d.revenueShare * 100}%`, background: "#EA580C" }} />
                                    </div>
                                    <b>{fmtShare(d.revenueShare, 0)}</b>
                                </div>
                            </div>
                            <div className="apex-sp-deliv__stat">
                                <small>ROAS</small>
                                <b>{fmtDec(d.roas, 2)}</b>
                            </div>
                            <div className="apex-sp-deliv__stat">
                                <small>CPA</small>
                                <b>{num(d.conversions) > 0 ? fmtKr(d.cpa) : "-"}</b>
                            </div>
                        </div>
                    ))}
                </div>
                {shift ? (
                    <p className="apex-sx-callout">
                        Moving {fmtShare(shift.share, 0)} of <b className="apex-sp-cap">{shift.from}</b> spend ({fmtKr(shift.moved)}, ROAS {fmtDec(shift.fromRoas, 2)}) to{" "}
                        <b className="apex-sp-cap">{shift.to}</b> (ROAS {fmtDec(shift.toRoas, 2)}) would add roughly <b>{fmtKr(shift.extraRevenue)}</b> in revenue (estimate). Returns usually fall as spend
                        grows on one placement, so treat this as an upper bound and test it in steps. Automatic placements may also limit what you can control.
                    </p>
                ) : null}
            </section>

            <ServiceTable
                title="Placement performance"
                subtitle={`Delivery compares a placement's share of revenue with its share of spend: Over-delivers at 1,2x or more, In line from 0,85x, Under-delivers from 0,6x, Weak return below. Placements under 3% of spend are Low volume.${hasPrev ? ` ROAS arrows compare ${vs}.` : ""}`}
                columns={columns}
                rows={delivery}
                rowKey={(r) => r.id}
                initialSort={{ key: "ad_spend", dir: "desc" }}
                emptyText="No placement data for this period."
            />
        </div>
    );
}

