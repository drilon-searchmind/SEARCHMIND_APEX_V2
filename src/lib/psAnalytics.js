/**
 * Derived insights for the Paid Social (Meta) dashboard. Pure functions over the dashboard payload.
 * Estimates are simple proportional projections, not forecasts, and are labelled as such in the UI.
 */

import { aggregatePeriodFromDaily, classifyCampaignFunnel } from "@/lib/facebookPsDashboardUtils";

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Frequency from which a creative is flagged as a fatigue risk (rule of thumb, not a Meta threshold). */
export const FATIGUE_FREQUENCY = 3.5;

export function summarizePs(rows, accountSummary) {
    if (!rows?.length) return null;
    const agg = (key) => aggregatePeriodFromDaily(rows, key);
    const spend = agg("ad_spend");
    const revenue = agg("conversion_value");
    const impressions = agg("impressions");
    const linkClicks = agg("link_clicks");
    const conversions = agg("conversions");
    return {
        spend,
        revenue,
        impressions,
        link_clicks: linkClicks,
        conversions,
        roas: agg("roas"),
        cpa: agg("cpa"),
        cpm: agg("cpm"),
        cpc: agg("cpc"),
        ctr: impressions > 0 ? (linkClicks / impressions) * 100 : null,
        conv_rate: agg("conv_rate"),
        aov: conversions > 0 ? revenue / conversions : null,
        reach: accountSummary?.period_reach ?? agg("reach"),
        frequency: accountSummary?.period_frequency ?? agg("frequency"),
        engagement_rate: agg("engagement_rate"),
    };
}

/** Prospecting, retargeting and other stages from campaign totals. */
export function funnelStages(campaigns) {
    const base = (id, label) => ({ id, label, campaigns: 0, spend: 0, revenue: 0, conversions: 0, impressions: 0, reach: 0 });
    const stages = {
        prospecting: base("prospecting", "Prospecting"),
        retargeting: base("retargeting", "Retargeting"),
        other: base("other", "Catalog and Advantage+"),
    };
    for (const c of campaigns || []) {
        const s = stages[classifyCampaignFunnel(c.campaign_name)];
        s.campaigns += 1;
        s.spend += n(c.ad_spend);
        s.revenue += n(c.conversion_value);
        s.conversions += n(c.conversions);
        s.impressions += n(c.impressions);
        s.reach += n(c.reach);
    }
    const totalSpend = Object.values(stages).reduce((s, x) => s + x.spend, 0);
    const totalRevenue = Object.values(stages).reduce((s, x) => s + x.revenue, 0);
    return Object.values(stages)
        .filter((s) => s.campaigns > 0)
        .map((s) => ({
            ...s,
            spendShare: totalSpend > 0 ? s.spend / totalSpend : 0,
            revenueShare: totalRevenue > 0 ? s.revenue / totalRevenue : 0,
            roas: s.spend > 0 ? s.revenue / s.spend : null,
            cpa: s.conversions > 0 ? s.spend / s.conversions : null,
            frequency: s.reach > 0 ? s.impressions / s.reach : null,
        }));
}

/** Creative status against the account ROAS, with a separate fatigue flag from frequency. */
export function creativeStatus(ad, accountRoas, totalSpend) {
    const spend = n(ad.spend);
    const fatigue = ad.frequency != null && n(ad.frequency) >= FATIGUE_FREQUENCY;
    let status;
    if (!accountRoas || totalSpend <= 0 || spend / totalSpend < 0.01) {
        status = { id: "low", label: "Low volume", tone: "neutral" };
    } else {
        const ratio = n(ad.roas) / accountRoas;
        if (ratio >= 1.25) status = { id: "scale", label: "Scale", tone: "ok" };
        else if (ratio >= 0.85) status = { id: "healthy", label: "Healthy", tone: "ok" };
        else if (ratio >= 0.5) status = { id: "watch", label: "Watch", tone: "warn" };
        else status = { id: "pause", label: "Pause or refresh", tone: "bad" };
    }
    return { status, fatigue };
}

/** Spend and ROAS grouped by how often people have seen the ad. */
export function frequencyBands(ads) {
    const defs = [
        { id: "low", label: "Under 2", test: (f) => f < 2 },
        { id: "mid", label: "2 to 3", test: (f) => f >= 2 && f < 3 },
        { id: "high", label: "3 to 3,5", test: (f) => f >= 3 && f < FATIGUE_FREQUENCY },
        { id: "fatigue", label: "3,5 and above", test: (f) => f >= FATIGUE_FREQUENCY },
    ];
    const rows = (ads || []).filter((a) => a.frequency != null);
    const total = rows.reduce((s, a) => s + n(a.spend), 0);
    return defs.map((d) => {
        const list = rows.filter((a) => d.test(n(a.frequency)));
        const spend = list.reduce((s, a) => s + n(a.spend), 0);
        const revenue = list.reduce((s, a) => s + n(a.revenue), 0);
        return {
            ...d,
            ads: list.length,
            spend,
            spendShare: total > 0 ? spend / total : 0,
            roas: spend > 0 ? revenue / spend : null,
        };
    });
}

/**
 * Delivery per placement: share of spend against share of revenue.
 * An index above 1 means the placement returns more than its share of spend.
 */
export function placementDelivery(placements) {
    const totalSpend = (placements || []).reduce((s, p) => s + n(p.ad_spend), 0);
    const totalRevenue = (placements || []).reduce((s, p) => s + n(p.conversion_value), 0);
    return (placements || []).map((p) => {
        const spendShare = totalSpend > 0 ? n(p.ad_spend) / totalSpend : 0;
        const revenueShare = totalRevenue > 0 ? n(p.conversion_value) / totalRevenue : 0;
        const index = spendShare > 0 ? revenueShare / spendShare : null;
        let verdict = { id: "even", label: "In line", tone: "neutral" };
        if (spendShare >= 0.03 && index != null) {
            if (index >= 1.2) verdict = { id: "over", label: "Over-delivers", tone: "ok" };
            else if (index < 0.6) verdict = { id: "under", label: "Weak return", tone: "bad" };
            else if (index < 0.85) verdict = { id: "soft", label: "Under-delivers", tone: "warn" };
        } else if (spendShare < 0.03) {
            verdict = { id: "low", label: "Low volume", tone: "neutral" };
        }
        return { ...p, id: p.placement, spendShare, revenueShare, index, verdict };
    });
}

/**
 * Estimate: move a share of spend from the weakest placement with real volume to the strongest,
 * at each placement's current ROAS. Marginal returns usually fall as spend grows, so treat this as
 * an upper bound.
 */
export function placementShiftEstimate(delivery, share = 0.25) {
    const real = delivery.filter((d) => d.spendShare >= 0.03 && n(d.roas) > 0);
    if (real.length < 2) return null;
    const best = real.reduce((a, b) => (n(b.roas) > n(a.roas) ? b : a));
    const worst = real.reduce((a, b) => (n(b.roas) < n(a.roas) ? b : a));
    if (best.placement === worst.placement || n(best.roas) <= n(worst.roas)) return null;
    const moved = n(worst.ad_spend) * share;
    return {
        from: worst.placement,
        to: best.placement,
        moved,
        share,
        extraRevenue: moved * (n(best.roas) - n(worst.roas)),
        fromRoas: n(worst.roas),
        toRoas: n(best.roas),
    };
}
