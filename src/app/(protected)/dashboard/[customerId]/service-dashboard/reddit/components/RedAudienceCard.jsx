"use client";

import React from "react";
import { ServiceTag, fmtDec, fmtInt, fmtPctPoints, fmtShare, num } from "@/components/dashboard/ServiceParts";

const IMPRESSION_COLOR = "#2563EB";
const RESULT_COLOR = "#EA580C";

/** Share of reach against share of clicks (or purchases) per row, with a verdict and the cost per click or purchase. */
export default function RedAudienceCard({ title, sub, rows, byPurchases, limit = 10, note }) {
    const list = rows.slice(0, limit);
    return (
        <section className="apex-ov-card">
            <div className="apex-ov-card__head">
                <h3>{title}</h3>
                <span className="apex-ov-sub">{sub}</span>
            </div>
            {list.length === 0 ? (
                <p className="apex-mk-note apex-sx-empty-note">Reddit did not return this breakdown for the period.</p>
            ) : (
                <div className="apex-sp-deliv apex-red-deliv">
                    {list.map((r) => (
                        <div key={r.id} className="apex-sp-deliv__row">
                            <div className="apex-sp-deliv__name">
                                <b title={r.name}>{r.name}</b>
                                <ServiceTag tone={r.verdict.tone}>{r.verdict.label}</ServiceTag>
                            </div>
                            <div className="apex-sp-deliv__bars">
                                <div className="apex-sp-pair">
                                    <span>Reach</span>
                                    <div className="apex-ov-bar">
                                        <i style={{ width: `${Math.min(100, r.impShare * 100)}%`, background: IMPRESSION_COLOR }} />
                                    </div>
                                    <b>{fmtShare(r.impShare, 0)}</b>
                                </div>
                                <div className="apex-sp-pair">
                                    <span>{byPurchases ? "Purchases" : "Clicks"}</span>
                                    <div className="apex-ov-bar">
                                        <i style={{ width: `${Math.min(100, r.resShare * 100)}%`, background: RESULT_COLOR }} />
                                    </div>
                                    <b>{fmtShare(r.resShare, 0)}</b>
                                </div>
                            </div>
                            <div className="apex-sp-deliv__stat">
                                <small>{byPurchases ? "CPA" : "CTR"}</small>
                                <b>{byPurchases ? (r.costPerLead != null ? fmtDec(r.costPerLead, 0) : "-") : fmtPctPoints(num(r.ctr) * 100, 2)}</b>
                            </div>
                            <div className="apex-sp-deliv__stat">
                                <small>{byPurchases ? "Spend" : "CPC"}</small>
                                <b>{byPurchases ? fmtInt(r.ad_spend) : r.cpc != null ? fmtDec(r.cpc, 2) : "-"}</b>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {note ? <p className="apex-mk-note">{note}</p> : null}
        </section>
    );
}
