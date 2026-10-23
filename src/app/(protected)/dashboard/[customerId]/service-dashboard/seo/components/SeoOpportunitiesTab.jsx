"use client";

import React, { useEffect, useMemo } from "react";
import { FiTarget, FiTrendingUp, FiLayers, FiAlertTriangle } from "react-icons/fi";
import CobaltLoader from "@/components/ui/CobaltLoader";
import SeoInsightsTable from "./SeoInsightsTable";
import { snippetGaps, strikingDistance } from "@/lib/seoAnalytics";
import { useSeoInsightsData } from "./useSeoInsightsData";
import { SeoKpi, SeoTag, fmtDec, fmtInt, fmtKr, fmtPctPoints, isNum, num } from "./SeoParts";

const VOLUME_COLUMNS = [
    { key: "keyword", label: "Keyword", align: "left" },
    { key: "position", label: "Pos.", align: "right", format: "number", numDigits: 1 },
    { key: "volume", label: "Volume", align: "right", format: "number" },
    { key: "clicks_now", label: "Clicks now", align: "right", format: "number" },
    { key: "potential_clicks", label: "Potential", align: "right", format: "number" },
    { key: "uplift", label: "Uplift", align: "right", format: "uplift" },
    { key: "value_now", label: "Value now", align: "right", format: "money" },
    { key: "value_potential", label: "Value (potential)", align: "right", type: "valuePotential" },
    { key: "spend_saved", label: "Spend saved", align: "right", format: "money" },
];

const CANNIBAL_COLUMNS = [
    { key: "keyword", label: "Keyword", align: "left" },
    { key: "url_count", label: "URLs", align: "right", format: "number" },
    { key: "strongest_url", label: "Strongest URL", align: "left" },
    { key: "position_spread_label", label: "Position spread", align: "right", type: "positionSpread" },
    { key: "clicks", label: "Clicks", align: "right", format: "number" },
];

export default function SeoOpportunitiesTab({
    siteUrl,
    customerId,
    startDate,
    endDate,
    appliedCompareRange,
    comparisonMethod,
    keywordSettingsVersion = 0,
    onLedeChange,
}) {
    const { data, loading, error } = useSeoInsightsData({
        siteUrl,
        customerId,
        startDate,
        endDate,
        appliedCompareRange,
        comparisonMethod,
        keywordSettingsVersion,
    });

    const view = useMemo(() => {
        if (!data) return null;
        const vp = data.volumePotential || [];
        const upliftClicks = vp.reduce((s, r) => s + num(r.uplift), 0);
        const hasValue = vp.some((r) => isNum(r.value_uplift));
        const upliftValue = hasValue ? vp.reduce((s, r) => s + num(r.value_uplift), 0) : null;
        return {
            vp,
            upliftClicks,
            upliftValue,
            striking: strikingDistance(data.keywordOverview, 10),
            strikingTotal: (data.keywordOverview || []).filter((r) => r.position > 10 && r.position <= 20).length,
            gaps: snippetGaps(data.keywordOverview),
            cannibal: data.cannibalization || [],
        };
    }, [data]);

    useEffect(() => {
        if (!view) {
            onLedeChange?.(null);
            return;
        }
        onLedeChange?.(
            view.vp.length
                ? `${fmtInt(view.vp.length)} keywords sit just below the top three. Moving them up is worth about ${fmtInt(view.upliftClicks)} extra clicks a month.`
                : "No keywords in positions 4 to 10 for this period."
        );
    }, [view, onLedeChange]);

    if (!siteUrl) {
        return <div className="apex-seo-alert">Add a Google Search Console property in Property Settings to load opportunities.</div>;
    }
    if (loading) {
        return (
            <div className="apex-perf-loading">
                <CobaltLoader variant="block" title="Finding opportunities" request="POST /api/seo-dashboard/insights" />
            </div>
        );
    }
    if (error) return <div className="apex-seo-error">{error}</div>;
    if (!view) return null;

    const appliedFilters = data.appliedFilters || [];

    return (
        <div className="apex-sx-stack">
            <div className="apex-ov-grid apex-ov-grid--hero">
                <SeoKpi
                    hero
                    label="Extra clicks within reach"
                    value={fmtInt(view.upliftClicks)}
                    caption="A month, if keywords in positions 4 to 10 reached the top 3"
                />
                <SeoKpi
                    label="Value within reach"
                    icon={FiTrendingUp}
                    value={isNum(view.upliftValue) ? fmtInt(view.upliftValue) : "-"}
                    unit="kr."
                    caption={isNum(view.upliftValue) ? "A month, at your revenue per click" : "Needs GA4 revenue data"}
                />
                <SeoKpi
                    label="Page two keywords"
                    icon={FiLayers}
                    value={fmtInt(view.strikingTotal)}
                    caption="Positions 11 to 20, the next to reach page one"
                />
                <SeoKpi
                    label="Cannibalized keywords"
                    icon={FiAlertTriangle}
                    cost
                    value={fmtInt(view.cannibal.length)}
                    caption="Several of your URLs compete for them"
                />
            </div>

            <SeoInsightsTable
                title="Volume potential"
                subtitle="Keywords in position 4 to 10. Potential assumes top-3 click-through rates; volume falls back to impressions times four when no keyword volume is available."
                columns={VOLUME_COLUMNS}
                rows={view.vp}
                pageSize={10}
                filterSectionId="volume-potential"
                defaultSortKey="uplift"
                appliedFilters={appliedFilters}
            />

            <div className="apex-ov-grid apex-sx-split-even">
                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>Striking distance</h3>
                        <span className="apex-ov-sub">Page two, biggest volume first</span>
                    </div>
                    {view.striking.length ? (
                        <div className="apex-mk-tbl-wrap">
                            <table className="apex-sx-tbl">
                                <thead>
                                    <tr>
                                        <th>Keyword</th>
                                        <th>Pos.</th>
                                        <th>Volume</th>
                                        <th>Clicks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {view.striking.map((r) => (
                                        <tr key={r.id || r.keyword}>
                                            <td title={r.keyword}>{r.keyword}</td>
                                            <td>{fmtDec(r.position, 1)}</td>
                                            <td>{fmtInt(r.volume)}</td>
                                            <td>{fmtInt(r.clicks)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="apex-mk-note apex-sx-empty-note">No keywords in positions 11 to 20 for this period.</p>
                    )}
                    <p className="apex-mk-note">A small push on content or internal links is often enough to move these onto page one.</p>
                </section>

                <section className="apex-ov-card">
                    <div className="apex-ov-card__head">
                        <h3>Snippet gaps</h3>
                        <span className="apex-ov-sub">CTR below your own norm</span>
                    </div>
                    {view.gaps.length ? (
                        <div className="apex-mk-tbl-wrap">
                            <table className="apex-sx-tbl">
                                <thead>
                                    <tr>
                                        <th>Keyword</th>
                                        <th>Pos.</th>
                                        <th>CTR</th>
                                        <th>Peer CTR</th>
                                        <th>Extra clicks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {view.gaps.map((r) => (
                                        <tr key={r.keyword}>
                                            <td title={r.keyword}>{r.keyword}</td>
                                            <td>{fmtDec(r.position, 1)}</td>
                                            <td className="is-neg">{fmtPctPoints(r.ctr, 1)}</td>
                                            <td>{fmtPctPoints(r.peerCtr, 1)}</td>
                                            <td>
                                                <SeoTag tone="ok">+{fmtInt(r.extraClicks)}</SeoTag>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="apex-mk-note apex-sx-empty-note">
                            <FiTarget aria-hidden /> No top-10 keyword is clicked noticeably less than its peers.
                        </p>
                    )}
                    <p className="apex-mk-note">
                        Compares each top-10 keyword with the median CTR of your keywords in the same rank band. Extra clicks is an estimate: search volume times the CTR gap. Worth a better title or meta description.
                    </p>
                </section>
            </div>

            <SeoInsightsTable
                title="Keyword cannibalization"
                subtitle="Keywords where several of your URLs compete with each other. Consolidate or differentiate them so one page can win."
                columns={CANNIBAL_COLUMNS}
                rows={view.cannibal}
                pageSize={10}
                expandable
                expandField="urls"
                filterSectionId="cannibalization"
                defaultSortKey="clicks"
                appliedFilters={appliedFilters}
            />
        </div>
    );
}
