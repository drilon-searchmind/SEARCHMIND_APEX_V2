/**
 * Derived insights for the Reddit Ads dashboard. Pure functions over the dashboard payload.
 * Reddit is mostly a traffic and awareness channel, so click-through and cost per click carry the
 * story; purchases and ROAS are only used when the account's Reddit pixel returns them. Status is
 * always against the account's own numbers, never an outside benchmark.
 */

import { audienceRows, costStatus } from "@/lib/liAnalytics";
import { pinCampaignStatus } from "@/lib/pinAnalytics";

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sum = (rows, key) => (rows || []).reduce((s, r) => s + n(r[key]), 0);

export function summarizeRed(rows) {
    if (!rows?.length) return null;
    const spend = sum(rows, "ad_spend");
    const revenue = sum(rows, "conversion_value");
    const impressions = sum(rows, "impressions");
    const clicks = sum(rows, "clicks");
    const purchases = sum(rows, "purchases");
    const adds = sum(rows, "adds_to_cart");
    return {
        spend,
        revenue,
        impressions,
        clicks,
        purchases,
        adds,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
        cpc: clicks > 0 ? spend / clicks : null,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
        cpa: purchases > 0 ? spend / purchases : null,
        roas: spend > 0 && revenue > 0 ? revenue / spend : null,
        aov: purchases > 0 && revenue > 0 ? revenue / purchases : null,
        tracksPurchases: purchases > 0,
        tracksValue: revenue > 0 && purchases > 0,
    };
}

/**
 * Video viewing from the account totals: how many video starts reach each quarter. Rates are shares of
 * video starts, and the view rate is video starts per impression.
 */
export function videoFunnel(account, impressions) {
    if (!account || n(account.video_started) <= 0) return null;
    const started = n(account.video_started);
    const steps = [
        { id: "started", label: "Video started", value: started },
        { id: "q1", label: "Watched 25%", value: n(account.video_25) },
        { id: "q2", label: "Watched 50%", value: n(account.video_50) },
        { id: "q3", label: "Watched 75%", value: n(account.video_75) },
        { id: "q4", label: "Watched to the end", value: n(account.video_100) },
    ].map((s) => ({ ...s, ofStarted: started > 0 ? s.value / started : null }));
    return {
        steps,
        startRate: n(impressions) > 0 ? started / n(impressions) : null,
        withSound: started > 0 ? n(account.video_with_sound) / started : null,
        completion: started > 0 ? n(account.video_100) / started : null,
    };
}

/** Status of a campaign, ad group or ad: cost per purchase when purchases are tracked, click-through otherwise. */
export function redStatus(row, summary, totals) {
    if (summary?.tracksPurchases) {
        const s = costStatus({ ad_spend: row.ad_spend, leads: row.purchases, conversions: 0 }, n(summary.cpa), totals.spend);
        return s.id === "none" ? { id: "none", label: "No purchases", tone: "bad" } : s;
    }
    return pinCampaignStatus(row, n(summary?.ctr) / 100, totals.impressions);
}

/** Community, interest or keyword rows with share of reach against share of clicks (or purchases when tracked). */
export function redAudienceRows(rows, { byPurchases }) {
    const mapped = (rows || []).map((r) => ({ ...r, leads: r.purchases, conversions: 0 }));
    return audienceRows(mapped, { byLeads: byPurchases }).map((r) => ({
        ...r,
        cpc: n(r.clicks) > 0 ? n(r.ad_spend) / n(r.clicks) : null,
    }));
}

/**
 * Communities (or other rows) that spent real money and clicked well under the account average. These are
 * candidates for the exclusion list in Reddit Ads Manager. Needs enough volume to be fair.
 */
export function exclusionCandidates(rows, { minSpendShare = 0.01, maxIndex = 0.6 } = {}) {
    return (rows || [])
        .filter((r) => r.impShare >= 0.02 && n(r.ad_spend) > 0 && r.index != null && r.index < maxIndex && r.verdict.label !== "Low volume")
        .sort((a, b) => n(b.ad_spend) - n(a.ad_spend))
        .filter((r) => r.impShare >= minSpendShare);
}
