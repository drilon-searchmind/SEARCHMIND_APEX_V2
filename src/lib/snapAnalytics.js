/**
 * Derived insights for the Snapchat Ads dashboard. Pure functions over the dashboard payload.
 * Snapchat reports swipe-ups, adds to cart and purchases (Pixel and Conversions API) with its own
 * attribution windows, so everything here is "as Snapchat attributes it". Status is judged against
 * the account's own numbers, never an outside benchmark.
 */

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sum = (rows, key) => (rows || []).reduce((s, r) => s + n(r[key]), 0);

export function summarizeSnap(rows) {
    if (!rows?.length) return null;
    const spend = sum(rows, "ad_spend");
    const revenue = sum(rows, "purchase_value");
    const impressions = sum(rows, "impressions");
    const swipes = sum(rows, "clicks");
    const purchases = sum(rows, "purchases");
    const adds = sum(rows, "adds_to_cart");
    return {
        spend,
        revenue,
        impressions,
        swipes,
        purchases,
        adds,
        roas: spend > 0 && revenue > 0 ? revenue / spend : null,
        aov: purchases > 0 && revenue > 0 ? revenue / purchases : null,
        ctr: impressions > 0 ? (swipes / impressions) * 100 : null,
        cpc: swipes > 0 ? spend / swipes : null,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
        cpa: purchases > 0 ? spend / purchases : null,
        cartToPurchase: adds > 0 ? (purchases / adds) * 100 : null,
        swipeToCart: swipes > 0 ? (adds / swipes) * 100 : null,
        tracksPurchases: purchases > 0,
        tracksValue: revenue > 0,
    };
}

/** Impressions to swipe-ups to adds to cart to purchases, each with the share from the step before. */
export function snapFunnel(summary) {
    if (!summary) return [];
    const steps = [
        { id: "impressions", label: "Impressions", value: summary.impressions },
        { id: "swipes", label: "Swipe-ups", value: summary.swipes },
    ];
    if (summary.adds > 0) steps.push({ id: "adds", label: "Adds to cart", value: summary.adds });
    steps.push({ id: "purchases", label: "Purchases", value: summary.purchases });
    return steps.map((s, i) => ({
        ...s,
        ofImpressions: steps[0].value > 0 ? s.value / steps[0].value : null,
        fromPrev: i > 0 && steps[i - 1].value > 0 ? s.value / steps[i - 1].value : null,
        fromLabel: i > 0 ? steps[i - 1].label : null,
    }));
}

/** Account-level video and engagement totals from the campaign detail (all additive). */
export function engagementTotals(campaigns) {
    const list = campaigns || [];
    const has = list.some((c) => c.video_views != null || c.shares != null);
    if (!has) return null;
    const impressions = sum(list, "impressions");
    const videoViews = sum(list, "video_views");
    const completes = sum(list, "video_completes");
    const q1 = sum(list, "quartile_1");
    const q3 = sum(list, "quartile_3");
    const withFreq = list.filter((c) => c.frequency != null && n(c.impressions) > 0);
    const freqWeight = sum(withFreq, "impressions");
    return {
        videoViews,
        completes,
        viewRate: impressions > 0 ? videoViews / impressions : null,
        completionRate: videoViews > 0 ? completes / videoViews : null,
        q1Rate: videoViews > 0 ? q1 / videoViews : null,
        q3Rate: videoViews > 0 ? q3 / videoViews : null,
        shares: sum(list, "shares"),
        saves: sum(list, "saves_total"),
        storyOpens: sum(list, "story_opens"),
        frequency: freqWeight > 0 ? withFreq.reduce((s, c) => s + n(c.frequency) * n(c.impressions), 0) / freqWeight : null,
    };
}

/**
 * Snapchat reports overlapping age buckets (for example "35+" next to "35-44"). Drop an open-ended bucket
 * when finer buckets that start at the same age exist, so shares do not count people twice.
 */
export function dedupeAgeBuckets(rows) {
    const list = rows || [];
    const starts = (id) => String(id).match(/^(\d+)/)?.[1];
    return list.filter((r) => {
        const id = String(r.id);
        if (!/^\d+\+$/.test(id)) return true;
        const from = starts(id);
        return !list.some((o) => o !== r && String(o.id).startsWith(`${from}-`));
    });
}
