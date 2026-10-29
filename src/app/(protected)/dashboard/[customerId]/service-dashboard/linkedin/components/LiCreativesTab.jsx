"use client";

import React, { useEffect, useMemo } from "react";
import { FiAward, FiImage } from "react-icons/fi";
import ServiceTable from "@/components/dashboard/ServiceTable";
import { costStatus, formatSummary, summarizeLi } from "@/lib/liAnalytics";
import { ServiceKpi, ServiceTag, fmtDec, fmtInt, fmtKr, fmtPctPoints, fmtShare, num } from "@/components/dashboard/ServiceParts";

export default function LiCreativesTab({ data, onLedeChange }) {
    const { ads, metrics, reach, warnings } = data;
    const summary = useMemo(() => summarizeLi(metrics, reach), [metrics, reach]);
    const accountCpr = num(summary?.costPerResult);
    const totalSpend = ads.reduce((s, a) => s + num(a.ad_spend), 0);
    const formats = useMemo(() => formatSummary(ads), [ads]);

    const rows = useMemo(
        () =>
            ads.map((a, i) => {
                const results = num(a.leads) + num(a.conversions);
                return {
                    ...a,
                    id: a.creative_id || `${a.creative_name}-${i}`,
                    results,
                    costPerResult: results > 0 ? num(a.ad_spend) / results : null,
                    cpl: num(a.leads) > 0 ? num(a.ad_spend) / num(a.leads) : null,
                    spendShare: totalSpend > 0 ? num(a.ad_spend) / totalSpend : 0,
                    status: costStatus(a, accountCpr, totalSpend),
                };
            }),
        [ads, accountCpr, totalSpend]
    );

    const best = useMemo(() => [...rows].filter((r) => r.costPerResult != null && r.spendShare >= 0.03).sort((a, b) => a.costPerResult - b.costPerResult)[0], [rows]);
    const bestCtr = useMemo(() => [...rows].filter((r) => r.spendShare >= 0.03).sort((a, b) => num(b.ctr) - num(a.ctr))[0], [rows]);

    useEffect(() => {
        if (!rows.length) {
            onLedeChange?.(null);
            return;
        }
        let text = `${fmtInt(rows.length)} ads in ${fmtInt(formats.length)} formats spent ${fmtKr(totalSpend)}`;
        if (best) text += `, ${best.creative_name} is cheapest per result`;
        onLedeChange?.(`${text}.`);
    }, [rows, formats, totalSpend, best, onLedeChange]);

    const columns = [
        { key: "creative_name", label: "Ad", left: true, sortValue: (r) => r.creative_name, render: (r) => <span title={r.creative_name}>{r.creative_name}</span> },
        { key: "format", label: "Format", left: true, className: () => "is-muted", sortValue: (r) => r.format, render: (r) => r.format },
        { key: "status", label: "Status", sortValue: (r) => (r.costPerResult == null ? Infinity : r.costPerResult), render: (r) => <ServiceTag tone={r.status.tone}>{r.status.label}</ServiceTag> },
        { key: "ad_spend", label: "Spend", sortValue: (r) => num(r.ad_spend), render: (r) => fmtKr(r.ad_spend) },
        { key: "leads", label: "Leads", sortValue: (r) => num(r.leads), render: (r) => fmtInt(r.leads) },
        { key: "cpl", label: "CPL", sortValue: (r) => (r.cpl == null ? Infinity : r.cpl), render: (r) => (r.cpl == null ? "-" : fmtKr(r.cpl)) },
        { key: "conversions", label: "Web conv.", sortValue: (r) => num(r.conversions), render: (r) => fmtInt(r.conversions) },
        { key: "impressions", label: "Impressions", sortValue: (r) => num(r.impressions), render: (r) => fmtInt(r.impressions) },
        { key: "ctr", label: "CTR", sortValue: (r) => num(r.ctr), render: (r) => fmtPctPoints(num(r.ctr) * 100, 2) },
    ];

    if (!rows.length) {
        const w = warnings.find((x) => x.part === "ads")?.message;
        return <div className="apex-sx-alert">No ad-level data for this period.{w ? ` ${w}` : ""}</div>;
    }

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-sx-grid-3">
                <ServiceKpi hero neutral label="Ads" value={fmtInt(rows.length)} caption={`${fmtKr(totalSpend)} spent in ${fmtInt(formats.length)} formats`} />
                <ServiceKpi label="Cheapest per result" icon={FiAward} value={best ? fmtDec(best.costPerResult, 0) : "-"} unit="kr." caption={best ? best.creative_name : "No ad with enough spend"} />
                <ServiceKpi label="Best click-through" icon={FiImage} value={bestCtr ? fmtDec(num(bestCtr.ctr) * 100, 2) : "-"} unit="%" caption={bestCtr ? bestCtr.creative_name : "No ad with enough spend"} />
            </div>

            <section className="apex-ov-card">
                <div className="apex-ov-card__head">
                    <h3>By ad format</h3>
                    <span className="apex-ov-sub">Which format earns its spend</span>
                </div>
                <div className="apex-li-formats">
                    {formats.map((f) => (
                        <div key={f.format} className="apex-li-format">
                            <div className="apex-li-format__top">
                                <b>{f.format}</b>
                                <span>{fmtInt(f.ads)} {f.ads === 1 ? "ad" : "ads"}</span>
                            </div>
                            <div className="apex-sx-type__grid">
                                <div>
                                    <small>Spend</small>
                                    <b>{fmtKr(f.ad_spend)}</b>
                                </div>
                                <div>
                                    <small>CTR</small>
                                    <b>{fmtPctPoints(f.ctr * 100, 2)}</b>
                                </div>
                                <div>
                                    <small>CPL</small>
                                    <b>{f.cpl != null ? fmtKr(f.cpl) : "-"}</b>
                                </div>
                            </div>
                            <div className="apex-ov-bar">
                                <i style={{ width: `${f.spendShare * 100}%` }} />
                            </div>
                            <div className="apex-sx-type__cap">{fmtShare(f.spendShare, 0)} of ad spend</div>
                        </div>
                    ))}
                </div>
                <p className="apex-mk-note">Formats are read from each creative&apos;s setup in LinkedIn: Lead Gen Form ads, video, image or document, and other sponsored content.</p>
            </section>

            <ServiceTable
                title="Ad scorecard"
                subtitle={`Status compares cost per result with the account (${accountCpr > 0 ? fmtDec(accountCpr, 0) : "-"} kr.): Strong at 1,25x better or more, Solid from 0,85x, Soft from 0,5x, Weak below. Spend with no results is flagged. Ads under 1% of spend are Low volume.`}
                columns={columns}
                rows={rows}
                rowKey={(r) => r.id}
                initialSort={{ key: "ad_spend", dir: "desc" }}
                pageSize={12}
                searchKey="creative_name"
                searchPlaceholder="Search ads"
                emptyText="No ads match."
            />
        </div>
    );
}
