"use client";

import React, { useEffect, useMemo } from "react";
import { FiGlobe, FiLayout, FiUsers } from "react-icons/fi";
import { redAudienceRows, summarizeRed } from "@/lib/redAnalytics";
import { ServiceKpi, fmtDec } from "@/components/dashboard/ServiceParts";
import RedAudienceCard from "./RedAudienceCard";

const SECTIONS = [
    { key: "gender", title: "Gender", sub: "As Reddit reports it", limit: 6, icon: FiUsers },
    { key: "country", title: "Country", sub: "Where the ads ran", limit: 10, icon: FiGlobe },
    { key: "placement", title: "Placement", sub: "Feed against comments page", limit: 6, icon: FiLayout },
];

export default function RedAudienceTab({ data, onLedeChange }) {
    const { audience, metrics, warnings } = data;
    const summary = useMemo(() => summarizeRed(metrics), [metrics]);
    const byPurchases = !!summary?.tracksPurchases;

    const tables = useMemo(() => Object.fromEntries(SECTIONS.map((s) => [s.key, redAudienceRows(audience?.[s.key] || [], { byPurchases })])), [audience, byPurchases]);

    const best = useMemo(
        () =>
            SECTIONS.map((s) => {
                const top = tables[s.key].filter((r) => r.index != null && r.impShare >= 0.03 && r.name !== "Unknown").sort((a, b) => b.index - a.index)[0];
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
                Reddit returned no audience breakdown for this period.
                {warnings.length ? ` ${warnings.map((w) => w.message).slice(0, 1).join("")}` : ""}
            </div>
        );
    }

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-sx-grid-3">
                {best.map((b, i) => (
                    <ServiceKpi key={b.key} hero={i === 0} neutral label={`Best by ${b.title.toLowerCase()}`} icon={b.icon} value={b.row.name} caption={`${fmtDec(b.row.index, 1)}x its share of reach in ${byPurchases ? "purchases" : "clicks"}`} />
                ))}
            </div>

            <div className="apex-ov-grid apex-sx-split-even">
                {SECTIONS.slice(0, 2).map((s) => (
                    <RedAudienceCard key={s.key} title={s.title} sub={s.sub} rows={tables[s.key]} byPurchases={byPurchases} limit={s.limit} />
                ))}
            </div>
            <RedAudienceCard
                title="Placement"
                sub="Feed against comments page"
                rows={tables.placement}
                byPurchases={byPurchases}
                limit={6}
                note="The comments page shows the ad below a post's comments. It is usually cheaper per click and lower in click-through than the feed."
            />
        </div>
    );
}
