"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FiAward, FiCheck, FiCopy, FiSlash, FiUsers } from "react-icons/fi";
import ServiceTable from "@/components/dashboard/ServiceTable";
import { exclusionCandidates, redAudienceRows, summarizeRed } from "@/lib/redAnalytics";
import { ServiceKpi, fmtDec, fmtInt, fmtKr, fmtPctPoints, fmtShare, num } from "@/components/dashboard/ServiceParts";
import RedAudienceCard from "./RedAudienceCard";

export default function RedCommunitiesTab({ data, onLedeChange }) {
    const { audience, metrics, warnings } = data;
    const summary = useMemo(() => summarizeRed(metrics), [metrics]);
    const byPurchases = !!summary?.tracksPurchases;
    const [copied, setCopied] = useState(false);

    const communities = useMemo(() => redAudienceRows(audience?.community || [], { byPurchases }), [audience, byPurchases]);
    const interests = useMemo(() => redAudienceRows(audience?.interest || [], { byPurchases }), [audience, byPurchases]);
    const keywords = useMemo(() => redAudienceRows(audience?.keyword || [], { byPurchases }), [audience, byPurchases]);

    const eligible = communities.filter((r) => r.impShare >= 0.02 && r.index != null);
    const best = useMemo(() => [...eligible].sort((a, b) => b.index - a.index)[0], [eligible]);
    const cheapest = useMemo(() => [...eligible].filter((r) => r.cpc != null).sort((a, b) => a.cpc - b.cpc)[0], [eligible]);
    const candidates = useMemo(() => exclusionCandidates(communities), [communities]);
    const candidateSpend = candidates.reduce((s, r) => s + num(r.ad_spend), 0);
    const totalSpend = communities.reduce((s, r) => s + num(r.ad_spend), 0);

    useEffect(() => {
        if (!communities.length) {
            onLedeChange?.(null);
            return;
        }
        onLedeChange?.(best ? `${best.name} clicks best, at ${fmtDec(best.index, 1)}x its share of reach. ${fmtInt(communities.length)} communities got traffic.` : `${fmtInt(communities.length)} communities got traffic.`);
    }, [communities, best, onLedeChange]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(candidates.map((r) => r.name.replace(/^r\//i, "")).join("\n"));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    const columns = [
        { key: "name", label: "Community", left: true, sortValue: (r) => r.name, render: (r) => <span title={r.name}>{r.name}</span> },
        { key: "ad_spend", label: "Spend", sortValue: (r) => num(r.ad_spend), render: (r) => fmtKr(r.ad_spend) },
        { key: "impShare", label: "Share of reach", sortValue: (r) => r.impShare, render: (r) => fmtShare(r.impShare, 1) },
        { key: "ctr", label: "CTR", sortValue: (r) => num(r.ctr), className: () => "is-neg", render: (r) => fmtPctPoints(num(r.ctr) * 100, 2) },
        { key: "cpc", label: "CPC", sortValue: (r) => (r.cpc == null ? Infinity : r.cpc), render: (r) => (r.cpc == null ? "-" : `${fmtDec(r.cpc, 2)} kr.`) },
    ];

    if (!communities.length && !interests.length && !keywords.length) {
        return (
            <div className="apex-sx-alert">
                Reddit returned no community or targeting breakdown for this period.
                {warnings.length ? ` ${warnings.map((w) => w.message).slice(0, 1).join("")}` : ""}
            </div>
        );
    }

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-ov-grid--hero">
                <ServiceKpi hero neutral label="Communities" value={fmtInt(communities.length)} caption={`Top ${fmtInt(communities.length)} by spend`} />
                <ServiceKpi label="Clicks best" icon={FiAward} value={best ? best.name : "-"} caption={best ? `${fmtDec(best.index, 1)}x its share of reach` : "Not enough reach to compare"} />
                <ServiceKpi label="Cheapest clicks" icon={FiUsers} value={cheapest ? fmtDec(cheapest.cpc, 2) : "-"} unit="kr." caption={cheapest ? cheapest.name : "Not enough reach to compare"} />
                <ServiceKpi label="Spend on weak communities" icon={FiSlash} cost value={fmtInt(candidateSpend)} unit="kr." caption={`${fmtShare(totalSpend > 0 ? candidateSpend / totalSpend : 0, 0)} of community spend, ${fmtInt(candidates.length)} communities`} />
            </div>

            <section className="apex-ov-card">
                <div className="apex-ov-card__head">
                    <h3>How to read this</h3>
                </div>
                <p className="apex-mk-note apex-sx-empty-note">
                    Each row compares a group&apos;s share of reach with its share of {byPurchases ? "purchases" : "clicks"}. Over-indexes means 1,3x or more, Under-indexes below 0,6x, and groups under 3% of reach are Low volume. Communities are the subreddits your ads
                    were shown in; Reddit lets you exclude communities in Ads Manager, so the list at the bottom is a starting point, not an automatic cut. Check what the community is about before you exclude it.
                </p>
            </section>

            <RedAudienceCard title="Communities" sub="Subreddits by spend" rows={communities} byPurchases={byPurchases} limit={15} />

            <div className="apex-ov-grid apex-sx-split-even">
                <RedAudienceCard title="Interests" sub="Reddit interest targeting" rows={interests} byPurchases={byPurchases} limit={10} />
                <RedAudienceCard title="Keywords" sub="Keyword targeting" rows={keywords} byPurchases={byPurchases} limit={10} note="[Automated targeting] is Reddit choosing where to show the ad for you." />
            </div>

            <ServiceTable
                title="Exclusion candidates"
                subtitle="Communities with real reach that click well under the account average. Copy the names and review them before adding them to the exclusion list in Reddit Ads Manager."
                columns={columns}
                rows={candidates}
                rowKey={(r) => r.id}
                initialSort={{ key: "ad_spend", dir: "desc" }}
                pageSize={8}
                emptyText="No community clicks far under the account average."
                actions={
                    candidates.length ? (
                        <button type="button" className="apex-sx-btn" onClick={copy}>
                            {copied ? <FiCheck aria-hidden /> : <FiCopy aria-hidden />}
                            {copied ? "Copied" : "Copy names"}
                        </button>
                    ) : null
                }
            />
        </div>
    );
}
