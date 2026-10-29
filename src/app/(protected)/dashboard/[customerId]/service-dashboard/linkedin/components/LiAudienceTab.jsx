"use client";

import React, { useEffect, useMemo } from "react";
import { FiAward, FiBriefcase, FiLayers, FiUsers } from "react-icons/fi";
import { audienceRows, summarizeLi } from "@/lib/liAnalytics";
import { ServiceKpi, ServiceTag, fmtDec, fmtInt, fmtPctPoints, fmtShare, num } from "@/components/dashboard/ServiceParts";

const SECTIONS = [
    { key: "job_function", title: "Job function", sub: "What people do", limit: 10, icon: FiBriefcase },
    { key: "seniority", title: "Seniority", sub: "How senior they are", limit: 10, icon: FiAward },
    { key: "company_size", title: "Company size", sub: "Employees at their company", limit: 10, icon: FiUsers },
    { key: "industry", title: "Industry", sub: "Top 15 by impressions", limit: 10, icon: FiLayers },
];

const IMPRESSION_COLOR = "#2563EB";
const RESULT_COLOR = "#EA580C";

function AudienceCard({ title, sub, rows, byLeads, limit }) {
    const list = rows.slice(0, limit);
    return (
        <section className="apex-ov-card">
            <div className="apex-ov-card__head">
                <h3>{title}</h3>
                <span className="apex-ov-sub">{sub}</span>
            </div>
            {list.length === 0 ? (
                <p className="apex-mk-note apex-sx-empty-note">LinkedIn did not return this breakdown for the period.</p>
            ) : (
                <div className="apex-sp-deliv apex-li-deliv">
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
                                    <span>{byLeads ? "Leads" : "Clicks"}</span>
                                    <div className="apex-ov-bar">
                                        <i style={{ width: `${Math.min(100, r.resShare * 100)}%`, background: RESULT_COLOR }} />
                                    </div>
                                    <b>{fmtShare(r.resShare, 0)}</b>
                                </div>
                            </div>
                            <div className="apex-sp-deliv__stat">
                                <small>{byLeads ? "CPL" : "CTR"}</small>
                                <b>{byLeads ? (r.costPerLead != null ? fmtDec(r.costPerLead, 0) : "-") : fmtPctPoints(num(r.ctr) * 100, 2)}</b>
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

export default function LiAudienceTab({ data, onLedeChange }) {
    const { demographics, metrics, reach } = data;
    const summary = useMemo(() => summarizeLi(metrics, reach), [metrics, reach]);
    const byLeads = !!summary?.hasLeads;

    const tables = useMemo(
        () => Object.fromEntries(SECTIONS.map((s) => [s.key, audienceRows(demographics?.[s.key] || [], { byLeads })])),
        [demographics, byLeads]
    );

    // The strongest responder per breakdown, from groups with enough reach to mean something
    const best = useMemo(
        () =>
            SECTIONS.map((s) => {
                const top = tables[s.key].filter((r) => r.index != null && r.impShare >= 0.03).sort((a, b) => b.index - a.index)[0];
                return top ? { ...s, row: top } : null;
            }).filter(Boolean),
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
                LinkedIn returned no audience breakdown for this period.
                {data.warnings.length ? ` ${data.warnings.map((w) => w.message).slice(0, 1).join("")}` : ""}
            </div>
        );
    }

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-sx-grid-4">
                {best.slice(0, 4).map((b, i) => (
                    <ServiceKpi
                        key={b.key}
                        hero={i === 0}
                        neutral
                        label={`Best by ${b.title.toLowerCase()}`}
                        icon={b.icon}
                        value={b.row.name}
                        caption={`${fmtDec(b.row.index, 1)}x its share of reach in ${byLeads ? "leads" : "clicks"}`}
                    />
                ))}
            </div>

            <section className="apex-ov-card">
                <div className="apex-ov-card__head">
                    <h3>How to read this</h3>
                </div>
                <p className="apex-mk-note apex-sx-empty-note">
                    Each row compares a group&apos;s share of reach (people who saw the ads) with its share of {byLeads ? "leads" : "clicks"}. Over-indexes means 1,3x or more, Under-indexes below 0,6x. Groups under 3% of reach are Low volume. LinkedIn only reports members who
                    can be matched to a profile, and small groups can swing a lot, so look for patterns across the four breakdowns rather than a single row.
                </p>
            </section>

            <div className="apex-ov-grid apex-sx-split-even">
                {SECTIONS.slice(0, 2).map((s) => (
                    <AudienceCard key={s.key} title={s.title} sub={s.sub} rows={tables[s.key]} byLeads={byLeads} limit={s.limit} />
                ))}
            </div>
            <div className="apex-ov-grid apex-sx-split-even">
                {SECTIONS.slice(2).map((s) => (
                    <AudienceCard key={s.key} title={s.title} sub={s.sub} rows={tables[s.key]} byLeads={byLeads} limit={s.limit} />
                ))}
            </div>
        </div>
    );
}
