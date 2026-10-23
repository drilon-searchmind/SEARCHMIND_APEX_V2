"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FiCopy, FiCheck, FiSlash, FiPercent, FiAward } from "react-icons/fi";
import { pickTermWinnersLosers } from "@/lib/googlePpcDashboardUtils";
import { wastedTerms, wordInsights } from "@/lib/ppcAnalytics";
import {
    ServiceKpi,
    fmtDec,
    fmtInt,
    fmtKr,
    fmtShare,
    num,
} from "@/components/dashboard/ServiceParts";
import PpcTable from "./PpcTable";

const MIN_SPEND = 50;

function TermList({ rows, tone }) {
    if (!rows.length) return <p className="apex-mk-note apex-sx-empty-note">No search terms with enough spend (from {fmtKr(MIN_SPEND)}).</p>;
    return (
        <div className="apex-px-terms">
            {rows.map((r, i) => (
                <div key={`${r.search_term}-${i}`} className="apex-px-term">
                    <div className="apex-px-term__main">
                        <b title={r.search_term}>{r.search_term}</b>
                        <small title={r.campaign_name}>{r.campaign_name}</small>
                    </div>
                    <span className="apex-px-term__spend">{fmtKr(r.spend)}</span>
                    <span className={`apex-px-term__roas is-${tone}`}>{fmtDec(r.roas, 2)}</span>
                </div>
            ))}
        </div>
    );
}

export default function PpcTermsTab({ data, onLedeChange }) {
    const { searchTerms } = data;
    const [copied, setCopied] = useState(false);

    const waste = useMemo(() => wastedTerms(searchTerms, { minSpend: MIN_SPEND }), [searchTerms]);
    const { winners, losers } = useMemo(() => pickTermWinnersLosers(searchTerms, { minSpend: MIN_SPEND, limit: 5 }), [searchTerms]);
    const words = useMemo(() => wordInsights(searchTerms), [searchTerms]);
    const total = useMemo(() => searchTerms.reduce((s, t) => s + num(t.spend), 0), [searchTerms]);
    const below1 = useMemo(
        () => searchTerms.filter((t) => num(t.spend) >= MIN_SPEND && num(t.roas) < 1).reduce((s, t) => s + num(t.spend), 0),
        [searchTerms]
    );

    useEffect(() => {
        if (!searchTerms.length) {
            onLedeChange?.(null);
            return;
        }
        let text = `${fmtInt(searchTerms.length)} search terms cost ${fmtKr(total)}`;
        if (waste.rows.length) text += `, of which ${fmtKr(waste.spend)} never converted`;
        onLedeChange?.(`${text}.`);
    }, [searchTerms, total, waste, onLedeChange]);

    const copyNegatives = async () => {
        const text = waste.rows.map((r) => r.search_term).join("\n");
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setCopied(false);
        }
    };

    const rows = useMemo(
        () => searchTerms.map((t, i) => ({ ...t, id: `${t.search_term}|${t.campaign_name}|${i}` })),
        [searchTerms]
    );

    const termColumns = [
        { key: "search_term", label: "Search term", left: true, sortValue: (r) => r.search_term, render: (r) => <span title={r.search_term}>{r.search_term}</span> },
        { key: "campaign_name", label: "Campaign", left: true, className: () => "is-muted", sortValue: (r) => r.campaign_name, render: (r) => <span title={r.campaign_name}>{r.campaign_name}</span> },
        { key: "spend", label: "Spend", sortValue: (r) => num(r.spend), render: (r) => fmtKr(r.spend) },
        { key: "clicks", label: "Clicks", sortValue: (r) => num(r.clicks), render: (r) => fmtInt(r.clicks) },
        { key: "conversions", label: "Conv.", sortValue: (r) => num(r.conversions), render: (r) => fmtInt(r.conversions) },
        { key: "revenue", label: "Revenue", sortValue: (r) => num(r.revenue), render: (r) => fmtKr(r.revenue) },
        {
            key: "roas",
            label: "ROAS",
            sortValue: (r) => num(r.roas),
            className: (r) => (num(r.spend) >= MIN_SPEND ? (num(r.roas) < 1 ? "is-neg" : num(r.roas) >= 4 ? "is-pos" : "") : ""),
            render: (r) => fmtDec(r.roas, 2),
        },
    ];

    const wasteColumns = [
        { key: "search_term", label: "Search term", left: true, sortValue: (r) => r.search_term },
        { key: "campaign_name", label: "Campaign", left: true, className: () => "is-muted", sortValue: (r) => r.campaign_name },
        { key: "spend", label: "Spend", sortValue: (r) => num(r.spend), render: (r) => fmtKr(r.spend) },
        { key: "clicks", label: "Clicks", sortValue: (r) => num(r.clicks), render: (r) => fmtInt(r.clicks) },
    ];

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-ov-grid--hero">
                <ServiceKpi hero neutral label="Search terms" value={fmtInt(searchTerms.length)} caption={`${fmtKr(total)} spend`} />
                <ServiceKpi
                    label="Spend with no conversions"
                    icon={FiSlash}
                    cost
                    value={fmtInt(waste.spend)}
                    unit="kr."
                    caption={`${fmtInt(waste.rows.length)} terms from ${fmtKr(MIN_SPEND)} spend`}
                />
                <ServiceKpi label="Share of spend wasted" icon={FiPercent} cost value={fmtDec(waste.share * 100, 1)} unit="%" caption="Terms with no conversions" />
                <ServiceKpi
                    label="Spend under ROAS 1"
                    icon={FiAward}
                    cost
                    value={fmtInt(below1)}
                    unit="kr."
                    caption="Terms that cost more than they return"
                />
            </div>

            <div className="apex-ov-grid apex-sx-split-even">
                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>Term winners</h3>
                        <span className="apex-ov-sub">Highest ROAS, from {fmtKr(MIN_SPEND)} spend</span>
                    </div>
                    <TermList rows={winners} tone="pos" />
                    <p className="apex-mk-note">Candidates for exact match, their own ad group or a higher bid.</p>
                </section>
                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>Term losers</h3>
                        <span className="apex-ov-sub">Lowest ROAS, from {fmtKr(MIN_SPEND)} spend</span>
                    </div>
                    <TermList rows={losers} tone="neg" />
                    <p className="apex-mk-note">Candidates for negative keywords, lower bids or tighter match types.</p>
                </section>
            </div>

            <div className="apex-ov-grid apex-sx-split-even">
                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>Words that earn and waste</h3>
                        <span className="apex-ov-sub">Words in at least two terms</span>
                    </div>
                    {words.wasters.length + words.earners.length === 0 ? (
                        <p className="apex-mk-note apex-sx-empty-note">Not enough repeated words to find patterns.</p>
                    ) : (
                        <div className="apex-px-words">
                            {[
                                { id: "wasters", title: "Costing you", rows: words.wasters, tone: "neg" },
                                { id: "earners", title: "Earning for you", rows: words.earners, tone: "pos" },
                            ].map((col) => (
                                <div key={col.id}>
                                    <div className="apex-px-words__title">{col.title}</div>
                                    {col.rows.length === 0 ? (
                                        <p className="apex-mk-note">None.</p>
                                    ) : (
                                        col.rows.map((w) => (
                                            <div key={w.word} className="apex-px-word">
                                                <b>{w.word}</b>
                                                <small>{fmtInt(w.terms)} terms</small>
                                                <span>{fmtKr(w.spend)}</span>
                                                <span className={`apex-px-term__roas is-${col.tone}`}>{fmtDec(w.roas, 2)}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    <p className="apex-mk-note">Spend and ROAS are summed over every term containing the word. A word that wastes money across several terms is a strong negative keyword candidate.</p>
                </section>

                <PpcTable
                    title="Negative keyword candidates"
                    subtitle={`Terms with ${fmtKr(MIN_SPEND)} or more in spend and no conversions. Check intent before excluding.`}
                    columns={wasteColumns}
                    rows={waste.rows.map((r, i) => ({ ...r, id: `w-${r.search_term}-${i}` }))}
                    rowKey={(r) => r.id}
                    initialSort={{ key: "spend", dir: "desc" }}
                    pageSize={6}
                    emptyText="No search terms spent money without converting."
                    actions={
                        waste.rows.length ? (
                            <button type="button" className="apex-px-btn" onClick={copyNegatives}>
                                {copied ? <FiCheck aria-hidden /> : <FiCopy aria-hidden />}
                                {copied ? "Copied" : "Copy terms"}
                            </button>
                        ) : null
                    }
                />
            </div>

            <PpcTable
                title="All search terms"
                subtitle="Sort by any column or search for a term."
                columns={termColumns}
                rows={rows}
                rowKey={(r) => r.id}
                initialSort={{ key: "spend", dir: "desc" }}
                pageSize={15}
                searchKey="search_term"
                searchPlaceholder="Search terms"
                emptyText="No search terms for this period."
            />
        </div>
    );
}
