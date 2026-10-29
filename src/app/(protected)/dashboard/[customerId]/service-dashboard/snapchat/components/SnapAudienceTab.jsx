"use client";

import React, { useEffect, useMemo } from "react";
import { FiGlobe, FiSmartphone, FiUsers } from "react-icons/fi";
import { audienceRows } from "@/lib/liAnalytics";
import { dedupeAgeBuckets, summarizeSnap } from "@/lib/snapAnalytics";
import { ServiceKpi, ServiceTag, fmtDec, fmtInt, fmtPctPoints, fmtShare, num } from "@/components/dashboard/ServiceParts";

const SECTIONS = [
    { key: "gender", title: "Gender", sub: "As Snapchat reports it", limit: 6, icon: FiUsers },
    { key: "age", title: "Age", sub: "Age groups", limit: 8, icon: FiUsers },
    { key: "country", title: "Country", sub: "Where the ads ran", limit: 8, icon: FiGlobe },
    { key: "region", title: "Region", sub: "Top 8 by spend", limit: 8, icon: FiGlobe },
    { key: "os", title: "Operating system", sub: "iOS against Android", limit: 6, icon: FiSmartphone },
    { key: "device_make", title: "Device make", sub: "Top 8 by spend", limit: 8, icon: FiSmartphone },
];

const IMPRESSION_COLOR = "#2563EB";
const RESULT_COLOR = "#EA580C";

function AudienceCard({ title, sub, rows, byPurchases, limit }) {
    const list = rows.slice(0, limit);
    return (
        <section className="apex-ov-card">
            <div className="apex-ov-card__head">
                <h3>{title}</h3>
                <span className="apex-ov-sub">{sub}</span>
            </div>
            {list.length === 0 ? (
                <p className="apex-mk-note apex-sx-empty-note">Snapchat did not return this breakdown for the period.</p>
            ) : (
                <div className="apex-sp-deliv apex-snap-deliv">
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
                                    <span>{byPurchases ? "Purchases" : "Swipes"}</span>
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
                                <small>Spend</small>
                                <b>{fmtInt(r.ad_spend)}</b>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export default function SnapAudienceTab({ data, onLedeChange }) {
    const { audience, metrics, warnings } = data;
    const summary = useMemo(() => summarizeSnap(metrics), [metrics]);
    const byPurchases = !!summary?.tracksPurchases;

    const tables = useMemo(
        () =>
            Object.fromEntries(
                SECTIONS.map((s) => {
                    const raw = audience?.[s.key] || [];
                    const rows = (s.key === "age" ? dedupeAgeBuckets(raw) : raw).map((r) => ({ ...r, leads: r.purchases, conversions: 0 }));
                    return [s.key, audienceRows(rows, { byLeads: byPurchases })];
                })
            ),
        [audience, byPurchases]
    );

    const best = useMemo(
        () =>
            ["gender", "age", "country", "os"]
                .map((key) => {
                    const s = SECTIONS.find((x) => x.key === key);
                    const top = tables[key].filter((r) => r.index != null && r.impShare >= 0.03).sort((a, b) => b.index - a.index)[0];
                    return top ? { ...s, row: top } : null;
                })
                .filter(Boolean),
        [tables]
    );

    const has = SECTIONS.some((s) => tables[s.key].length > 0);

    useEffect(() => {
        if (!has) {
            onLedeChange?.(null);
            return;
        }
        const first = best[0];
        onLedeChange?.(first ? `${first.row.name} responds best by ${first.title.toLowerCase()}, at ${fmtDec(first.row.index, 1)}x its share of reach.` : null);
    }, [has, best, onLedeChange]);

    if (!has) {
        return (
            <div className="apex-sx-alert">
                Snapchat returned no audience breakdown for this period.
                {warnings.length ? ` ${warnings.map((w) => w.message).slice(0, 1).join("")}` : ""}
            </div>
        );
    }

    const pairs = [SECTIONS.slice(0, 2), SECTIONS.slice(2, 4), SECTIONS.slice(4)];

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-sx-grid-4">
                {best.slice(0, 4).map((b, i) => (
                    <ServiceKpi key={b.key} hero={i === 0} neutral label={`Best by ${b.title.toLowerCase()}`} icon={b.icon} value={b.row.name} caption={`${fmtDec(b.row.index, 1)}x its share of reach in ${byPurchases ? "purchases" : "swipes"}`} />
                ))}
            </div>

            <section className="apex-ov-card">
                <div className="apex-ov-card__head">
                    <h3>How to read this</h3>
                </div>
                <p className="apex-mk-note apex-sx-empty-note">
                    Each row compares a group&apos;s share of reach (who saw the ads) with its share of {byPurchases ? "purchases" : "swipe-ups"}. Over-indexes means 1,3x or more, Under-indexes below 0,6x, and groups under 3% of reach are Low volume. Snapchat sums these
                    per campaign, so very small groups can swing a lot. Overlapping age groups such as 35+ next to 35-44 are merged so people are not counted twice.
                </p>
            </section>

            {pairs.map((pair, i) => (
                <div key={i} className="apex-ov-grid apex-sx-split-even">
                    {pair.map((s) => (
                        <AudienceCard key={s.key} title={s.title} sub={s.sub} rows={tables[s.key]} byPurchases={byPurchases} limit={s.limit} />
                    ))}
                </div>
            ))}
        </div>
    );
}
