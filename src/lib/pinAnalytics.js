/**
 * Derived insights for the Pinterest ads dashboard. Pure functions over the dashboard payload.
 * Only uses what the Pinterest analytics API returns: spend, impressions, outbound clicks, saves,
 * checkouts and checkout value. Anything labelled as an estimate is a proportional projection.
 */

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sum = (rows, key) => (rows || []).reduce((s, r) => s + n(r[key]), 0);

export function summarizePin(rows) {
    if (!rows?.length) return null;
    const spend = sum(rows, "ad_spend");
    const revenue = sum(rows, "conversion_value");
    const impressions = sum(rows, "impressions");
    const clicks = sum(rows, "clicks");
    const saves = sum(rows, "saves");
    const conversions = sum(rows, "conversions");
    return {
        spend,
        revenue,
        impressions,
        clicks,
        saves,
        conversions,
        roas: spend > 0 && revenue > 0 ? revenue / spend : null,
        aov: conversions > 0 && revenue > 0 ? revenue / conversions : null,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
        cpc: clicks > 0 ? spend / clicks : null,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
        saveRate: impressions > 0 ? (saves / impressions) * 100 : null,
        costPerSave: saves > 0 ? spend / saves : null,
        clicksPerSave: saves > 0 ? clicks / saves : null,
        convRate: clicks > 0 ? (conversions / clicks) * 100 : null,
        tracksValue: revenue > 0,
    };
}

/** Impressions to saves to outbound clicks to checkouts, each with the share that came from the step before. */
export function pinFunnel(summary) {
    if (!summary) return [];
    const steps = [
        { id: "impressions", label: "Impressions", value: summary.impressions },
        { id: "saves", label: "Saves", value: summary.saves },
        { id: "clicks", label: "Outbound clicks", value: summary.clicks },
        { id: "orders", label: "Checkouts", value: summary.conversions },
    ];
    return steps.map((s, i) => ({
        ...s,
        ofImpressions: steps[0].value > 0 ? s.value / steps[0].value : null,
        fromPrev: i > 0 && steps[i - 1].value > 0 ? s.value / steps[i - 1].value : null,
    }));
}

/**
 * Campaign status against the account's own click-through rate (no outside benchmark).
 * Campaigns under 1% of impressions are low volume.
 */
export function pinCampaignStatus(campaign, accountCtr, totalImpressions) {
    const impressions = n(campaign.impressions);
    if (!accountCtr || totalImpressions <= 0 || impressions / totalImpressions < 0.01) {
        return { id: "low", label: "Low volume", tone: "neutral" };
    }
    const ratio = n(campaign.ctr) / accountCtr;
    if (ratio >= 1.25) return { id: "strong", label: "Strong", tone: "ok" };
    if (ratio >= 0.85) return { id: "solid", label: "Solid", tone: "ok" };
    if (ratio >= 0.5) return { id: "soft", label: "Soft", tone: "warn" };
    return { id: "weak", label: "Weak", tone: "bad" };
}

/** Average clicks, saves and click-through per weekday. Needs two weeks for a fair average. */
export function pinWeekdays(rows) {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    if (!rows?.length || rows.length < 14) return { enough: false, days: [] };
    const buckets = labels.map((label) => ({ label, clicks: 0, saves: 0, impressions: 0, count: 0 }));
    for (const r of rows) {
        const idx = (new Date(`${r.date}T12:00:00Z`).getUTCDay() + 6) % 7;
        buckets[idx].clicks += n(r.clicks);
        buckets[idx].saves += n(r.saves);
        buckets[idx].impressions += n(r.impressions);
        buckets[idx].count += 1;
    }
    const days = buckets.map((b) => ({
        label: b.label,
        avgClicks: b.count ? b.clicks / b.count : 0,
        avgSaves: b.count ? b.saves / b.count : 0,
        ctr: b.impressions > 0 ? (b.clicks / b.impressions) * 100 : 0,
    }));
    const max = Math.max(...days.map((d) => d.avgClicks), 1);
    const best = days.reduce((a, b) => (b.avgClicks > a.avgClicks ? b : a), days[0]);
    const worst = days.reduce((a, b) => (b.avgClicks < a.avgClicks ? b : a), days[0]);
    return { enough: true, best, worst, days: days.map((d) => ({ ...d, index: d.avgClicks / max, isBest: d.label === best.label })) };
}
