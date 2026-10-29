"use client";

import React from "react";
import { ServiceTag, fmtDec, fmtKr, fmtPctPoints, fmtShare, num } from "@/components/dashboard/ServiceParts";

const SPEND_COLOR = "#2563EB";
const REVENUE_COLOR = "#EA580C";

/** Share of revenue against share of spend. An index above 1 means it returns more than its share of spend. */
function withDelivery(rows) {
    const spend = rows.reduce((s, r) => s + num(r.ad_spend), 0);
    const revenue = rows.reduce((s, r) => s + num(r.conversion_value), 0);
    return rows.map((r) => {
        const spendShare = spend > 0 ? num(r.ad_spend) / spend : 0;
        const revenueShare = revenue > 0 ? num(r.conversion_value) / revenue : 0;
        const index = spendShare > 0 ? revenueShare / spendShare : null;
        let verdict = { label: "In line", tone: "neutral" };
        if (spendShare < 0.03) verdict = { label: "Low volume", tone: "neutral" };
        else if (revenue <= 0) verdict = { label: "No value tracked", tone: "neutral" };
        else if (index >= 1.2) verdict = { label: "Over-delivers", tone: "ok" };
        else if (index < 0.6) verdict = { label: "Weak return", tone: "bad" };
        else if (index < 0.85) verdict = { label: "Under-delivers", tone: "warn" };
        return { ...r, spendShare, revenueShare, verdict };
    });
}

function SegmentCard({ title, sub, rows }) {
    const list = withDelivery(rows);
    return (
        <section className="apex-ov-card">
            <div className="apex-ov-card__head">
                <h3>{title}</h3>
                <span className="apex-ov-sub">{sub}</span>
            </div>
            <div className="apex-sp-deliv apex-bing-deliv">
                {list.map((r) => (
                    <div key={r.name} className="apex-sp-deliv__row">
                        <div className="apex-sp-deliv__name">
                            <b title={r.name}>{r.name}</b>
                            <ServiceTag tone={r.verdict.tone}>{r.verdict.label}</ServiceTag>
                        </div>
                        <div className="apex-sp-deliv__bars">
                            <div className="apex-sp-pair">
                                <span>Spend</span>
                                <div className="apex-ov-bar">
                                    <i style={{ width: `${r.spendShare * 100}%`, background: SPEND_COLOR }} />
                                </div>
                                <b>{fmtShare(r.spendShare, 0)}</b>
                            </div>
                            <div className="apex-sp-pair">
                                <span>Revenue</span>
                                <div className="apex-ov-bar">
                                    <i style={{ width: `${r.revenueShare * 100}%`, background: REVENUE_COLOR }} />
                                </div>
                                <b>{fmtShare(r.revenueShare, 0)}</b>
                            </div>
                        </div>
                        <div className="apex-sp-deliv__stat">
                            <small>ROAS</small>
                            <b>{num(r.conversion_value) > 0 ? fmtDec(r.roas, 2) : "-"}</b>
                        </div>
                        <div className="apex-sp-deliv__stat">
                            <small>CTR</small>
                            <b>{fmtPctPoints(num(r.ctr) * 100, 1)}</b>
                        </div>
                    </div>
                ))}
            </div>
            <p className="apex-mk-note">
                Spend {fmtKr(rows.reduce((s, r) => s + num(r.ad_spend), 0))} in total. Over-delivers is 1,2x of its spend share in revenue or more, Weak return is under 0,6x.
            </p>
        </section>
    );
}

export default function BingSegments({ deviceSplit, networkSplit }) {
    const hasDevice = deviceSplit?.length > 0;
    const hasNetwork = networkSplit?.length > 0;
    if (!hasDevice && !hasNetwork) return null;
    return (
        <div className="apex-ov-grid apex-sx-split-even">
            {hasDevice ? <SegmentCard title="Devices" sub="Where the clicks happen" rows={deviceSplit} /> : null}
            {hasNetwork ? <SegmentCard title="Networks" sub="Microsoft sites against partners" rows={networkSplit} /> : null}
        </div>
    );
}
