"use client";

import React from "react";
import { SiMeta } from "react-icons/si";
import HeroKpi, { nf0, nf2, pctChange } from "./HeroKpi";
import AuraMonthlyMetricChart from "./AuraMonthlyMetricChart";
import { metaTabBlock, monthlyMetaMetrics } from "./auraSheetLogic";

/** Dropdown options, as in the sheet. The first chart starts on CAC, the second on CTR. */
const RESULT_METRICS = [
    { key: "cac", label: "CAC", format: "number" },
    { key: "adSpend", label: "Ad Spend", format: "number" },
    { key: "conversions", label: "Conversions", format: "number" },
];
const TRAFFIC_METRICS = [
    { key: "cpc", label: "CPC", format: "decimal" },
    { key: "clicks", label: "Clicks", format: "number" },
    { key: "impressions", label: "Impressions", format: "number" },
    { key: "ctr", label: "CTR", format: "percent" },
    { key: "cpm", label: "CPM", format: "number" },
];

const pct = (v) => (v == null ? null : `${nf2.format(v * 100)}%`);

/**
 * Meta tab: KPIs for the selected period (against the comparison period) and two monthly charts
 * (this year against last year). Like the sheet, "Clicks" are Meta link clicks, CTR = link clicks / impressions,
 * CPC = spend / link clicks, CPM = spend / impressions x 1000 and CAC = spend / conversions.
 */
export default function AuraMetaTab({ meta, metaPrev, comparable, configured, spend }) {
    if (!configured) {
        return <p className="apex-ppc-chart-note">Meta is not set up for this customer. Add a valid Meta ad account ID in Config.</p>;
    }

    const now = metaTabBlock(meta);
    const hasPrev = metaPrev.length > 0 && comparable;
    const prev = hasPrev ? metaTabBlock(metaPrev) : null;
    const change = (key) => (prev ? pctChange(now[key], prev[key]) : null);

    const monthlyCurrent = spend ? monthlyMetaMetrics(spend.current.meta) : null;
    const monthlyPrevious = spend ? monthlyMetaMetrics(spend.previous.meta) : null;
    const monthlyReady = !spend || (spend.current.spendOk && spend.previous.spendOk);

    return (
        <div className="aura-tab">
            <h2 className="aura-tab__title">
                <SiMeta aria-hidden="true" /> Meta
            </h2>

            <section className="aura-hero" aria-label="Meta results">
                <HeroKpi label="Conversions" value={nf0.format(now.conversions)} change={change("conversions")} />
                <HeroKpi label="Ad Spend" value={nf0.format(now.spend)} change={change("spend")} lowerIsBetter />
                <HeroKpi label="CAC" value={now.cpa == null ? "N/A" : nf0.format(now.cpa)} change={change("cpa")} lowerIsBetter />
            </section>

            {monthlyReady ? (
                <AuraMonthlyMetricChart
                    metrics={RESULT_METRICS}
                    defaultKey="cac"
                    current={monthlyCurrent}
                    previous={monthlyPrevious}
                    ariaLabel="Meta cost and results per month"
                />
            ) : (
                <p className="apex-ppc-chart-note">Monthly Meta data could not be loaded right now.</p>
            )}

            <section className="aura-hero aura-hero--5" aria-label="Meta traffic">
                <HeroKpi label="CPC" value={now.cpc == null ? "N/A" : nf2.format(now.cpc)} change={change("cpc")} lowerIsBetter />
                <HeroKpi label="Clicks" value={nf0.format(now.clicks)} change={change("clicks")} />
                <HeroKpi label="Impressions" value={nf0.format(now.impressions)} change={change("impressions")} />
                <HeroKpi label="CTR" value={pct(now.ctr) ?? "N/A"} change={change("ctr")} />
                <HeroKpi label="CPM" value={now.cpm == null ? "N/A" : nf0.format(now.cpm)} change={change("cpm")} lowerIsBetter />
            </section>

            {monthlyReady ? (
                <AuraMonthlyMetricChart
                    metrics={TRAFFIC_METRICS}
                    defaultKey="ctr"
                    current={monthlyCurrent}
                    previous={monthlyPrevious}
                    ariaLabel="Meta traffic per month"
                />
            ) : null}
        </div>
    );
}
