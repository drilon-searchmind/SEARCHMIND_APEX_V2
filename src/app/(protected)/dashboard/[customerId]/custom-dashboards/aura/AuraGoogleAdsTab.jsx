"use client";

import React from "react";
import { SiGoogleads } from "react-icons/si";
import HeroKpi, { nf0, nf2, pctChange } from "./HeroKpi";
import AuraMonthlyMetricChart from "./AuraMonthlyMetricChart";
import { googleAdsBlock, monthlyGoogleMetrics } from "./auraSheetLogic";

/** Dropdown options, as in the sheet: the first chart is about cost and results, the second about traffic and rates. */
const RESULT_METRICS = [
    { key: "adSpend", label: "Ad Spend", format: "number" },
    { key: "cac", label: "CAC", format: "number" },
    { key: "conversions", label: "Conversions", format: "number" },
];
const TRAFFIC_METRICS = [
    { key: "impressions", label: "Impressions", format: "number" },
    { key: "clicks", label: "Clicks", format: "number" },
    { key: "ctr", label: "CTR", format: "percent" },
    { key: "cpc", label: "CPC", format: "decimal" },
    { key: "convRate", label: "Conv. Rate", format: "percent" },
];

const pct = (v) => (v == null ? null : `${nf2.format(v * 100)}%`);

/**
 * Google Ads tab: KPIs for the selected period (against the comparison period) and two monthly charts
 * (this year against last year). In the sheet CAC here is ad spend / Google Ads conversions.
 */
export default function AuraGoogleAdsTab({ google, googlePrev, comparable, configured, spend }) {
    if (!configured) {
        return <p className="apex-ppc-chart-note">Google Ads is not set up for this customer. Add a valid Google Ads customer ID in Config.</p>;
    }

    const now = googleAdsBlock(google);
    const hasPrev = googlePrev.length > 0 && comparable;
    const prev = hasPrev ? googleAdsBlock(googlePrev) : null;
    const change = (key) => (prev ? pctChange(now[key], prev[key]) : null);

    const monthlyCurrent = spend ? monthlyGoogleMetrics(spend.current.google) : null;
    const monthlyPrevious = spend ? monthlyGoogleMetrics(spend.previous.google) : null;
    const monthlyReady = spend && spend.current.spendOk && spend.previous.spendOk;

    return (
        <div className="aura-tab">
            <h2 className="aura-tab__title">
                <SiGoogleads aria-hidden="true" /> Google Ads
            </h2>

            <section className="aura-hero" aria-label="Google Ads results">
                <HeroKpi label="Conversions" value={nf0.format(now.conversions)} change={change("conversions")} />
                <HeroKpi label="Ad Spend" value={nf0.format(now.spend)} change={change("spend")} lowerIsBetter />
                <HeroKpi label="CAC" value={now.cpa == null ? "N/A" : nf0.format(now.cpa)} change={change("cpa")} lowerIsBetter />
            </section>

            {monthlyReady || !spend ? (
                <AuraMonthlyMetricChart
                    metrics={RESULT_METRICS}
                    defaultKey="adSpend"
                    current={monthlyCurrent}
                    previous={monthlyPrevious}
                    ariaLabel="Google Ads cost and results per month"
                />
            ) : (
                <p className="apex-ppc-chart-note">Monthly Google Ads data could not be loaded right now.</p>
            )}

            <section className="aura-hero aura-hero--5" aria-label="Google Ads traffic">
                <HeroKpi label="Impressions" value={nf0.format(now.impressions)} change={change("impressions")} />
                <HeroKpi label="Clicks" value={nf0.format(now.clicks)} change={change("clicks")} />
                <HeroKpi label="CTR" value={pct(now.ctr) ?? "N/A"} change={change("ctr")} />
                <HeroKpi label="CPC" value={now.cpc == null ? "N/A" : nf2.format(now.cpc)} change={change("cpc")} lowerIsBetter />
                <HeroKpi label="Conv. Rate" value={pct(now.convRate) ?? "N/A"} change={change("convRate")} />
            </section>

            {monthlyReady || !spend ? (
                <AuraMonthlyMetricChart
                    metrics={TRAFFIC_METRICS}
                    defaultKey="clicks"
                    current={monthlyCurrent}
                    previous={monthlyPrevious}
                    ariaLabel="Google Ads traffic per month"
                />
            ) : null}
        </div>
    );
}
