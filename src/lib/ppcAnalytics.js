/**
 * Derived insights for the PPC dashboard. Pure functions over the Google Ads dashboard payload.
 * Anything labelled as an estimate is a simple proportional projection, not a forecast.
 */

import { aggregatePpcPeriodFromDaily, classifyBrandGeneric } from "@/lib/googlePpcDashboardUtils";

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Period totals and ratios from the daily rows. */
export function summarizePpc(rows) {
    if (!rows?.length) return null;
    const agg = (key) => aggregatePpcPeriodFromDaily(rows, key);
    const spend = agg("ad_spend");
    const revenue = agg("conversions_value");
    const clicks = agg("clicks");
    const impressions = agg("impressions");
    const conversions = agg("conversions");
    return {
        spend,
        revenue,
        clicks,
        impressions,
        conversions,
        roas: agg("roas"),
        cpa: agg("cpa"),
        cpc: agg("cpc"),
        ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
        conv_rate: agg("conv_rate"),
        aov: conversions > 0 ? revenue / conversions : null,
        impression_share: agg("impression_share"),
        is_lost_budget: agg("is_lost_budget"),
        is_lost_rank: agg("is_lost_rank"),
    };
}

/**
 * Impression share diagnosis: where the auctions you could have entered went.
 * Shares are in percent; the remainder (other reasons, rounding) is kept separate.
 */
export function impressionShareBreakdown(summary) {
    if (!summary || summary.impression_share == null) return null;
    const won = n(summary.impression_share);
    const budget = n(summary.is_lost_budget);
    const rank = n(summary.is_lost_rank);
    const other = Math.max(0, 100 - won - budget - rank);
    const dominant = budget >= rank ? "budget" : "rank";
    // Estimate: clicks scale with impression share, so winning the budget-lost share at the same
    // click and revenue yield would add clicks * lost / won.
    const extraClicks = won > 0 ? (n(summary.clicks) * budget) / won : 0;
    const revPerClick = n(summary.clicks) > 0 ? n(summary.revenue) / n(summary.clicks) : 0;
    const costPerClick = n(summary.cpc);
    return {
        won,
        budget,
        rank,
        other,
        dominant,
        estExtraClicks: extraClicks,
        estExtraRevenue: extraClicks * revPerClick,
        estExtraSpend: extraClicks * costPerClick,
    };
}

/**
 * Status of a campaign relative to the account's own ROAS (no external benchmark):
 * scale / healthy / watch / cut. Needs enough spend to say anything.
 */
export function campaignStatus(campaign, accountRoas, totalSpend) {
    const spend = n(campaign.ad_spend);
    if (!accountRoas || totalSpend <= 0 || spend / totalSpend < 0.01) {
        return { id: "low", label: "Low volume", tone: "neutral" };
    }
    const ratio = n(campaign.roas) / accountRoas;
    if (ratio >= 1.25) return { id: "scale", label: "Scale", tone: "ok" };
    if (ratio >= 0.85) return { id: "healthy", label: "Healthy", tone: "ok" };
    if (ratio >= 0.5) return { id: "watch", label: "Watch", tone: "warn" };
    return { id: "cut", label: "Cut back", tone: "bad" };
}

/** Group campaigns into brand / generic / other by name (same rule as the spend split). */
export function groupByType(campaigns) {
    const groups = {
        brand: { id: "brand", label: "Brand", campaigns: 0, spend: 0, revenue: 0, conversions: 0, clicks: 0 },
        generic: { id: "generic", label: "Generic", campaigns: 0, spend: 0, revenue: 0, conversions: 0, clicks: 0 },
        other: { id: "other", label: "Shopping, PMax and other", campaigns: 0, spend: 0, revenue: 0, conversions: 0, clicks: 0 },
    };
    for (const c of campaigns || []) {
        const g = groups[classifyBrandGeneric(c.campaign_name)];
        g.campaigns += 1;
        g.spend += n(c.ad_spend);
        g.revenue += n(c.conversions_value);
        g.conversions += n(c.conversions);
        g.clicks += n(c.clicks);
    }
    return Object.values(groups)
        .filter((g) => g.campaigns > 0)
        .map((g) => ({
            ...g,
            roas: g.spend > 0 ? g.revenue / g.spend : null,
            cpa: g.conversions > 0 ? g.spend / g.conversions : null,
        }));
}

/** Search terms that cost money and never converted. */
export function wastedTerms(terms, { minSpend = 50 } = {}) {
    const total = (terms || []).reduce((s, t) => s + n(t.spend), 0);
    const rows = (terms || [])
        .filter((t) => n(t.spend) >= minSpend && n(t.conversions) === 0)
        .sort((a, b) => n(b.spend) - n(a.spend));
    const spend = rows.reduce((s, t) => s + n(t.spend), 0);
    return { rows, spend, share: total > 0 ? spend / total : 0, totalSpend: total };
}

const STOP_WORDS = new Set(["til", "og", "i", "på", "af", "for", "med", "the", "and", "of", "en", "et", "den", "det"]);

/**
 * Break search terms into words and rank them: which words soak up spend without return,
 * and which ones carry the revenue. A word needs to appear in at least two terms.
 */
export function wordInsights(terms, { minTerms = 2, limit = 6 } = {}) {
    const map = new Map();
    for (const t of terms || []) {
        const words = new Set(
            String(t.search_term || "")
                .toLowerCase()
                .split(/[^\p{L}\p{N}]+/u)
                .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
        );
        for (const w of words) {
            const cur = map.get(w) || { word: w, terms: 0, spend: 0, revenue: 0, conversions: 0, clicks: 0 };
            cur.terms += 1;
            cur.spend += n(t.spend);
            cur.revenue += n(t.revenue);
            cur.conversions += n(t.conversions);
            cur.clicks += n(t.clicks);
            map.set(w, cur);
        }
    }
    const rows = [...map.values()]
        .filter((r) => r.terms >= minTerms && r.spend > 0)
        .map((r) => ({ ...r, roas: r.revenue / r.spend }));
    const wasters = [...rows].filter((r) => r.roas < 1).sort((a, b) => b.spend * (1 - b.roas) - a.spend * (1 - a.roas));
    const earners = [...rows].filter((r) => r.roas >= 1).sort((a, b) => b.revenue - a.revenue);
    return { wasters: wasters.slice(0, limit), earners: earners.slice(0, limit) };
}

/** Average spend, revenue and ROAS per weekday. Needs two weeks for a fair average. */
export function weekdayEfficiency(rows, { spendKey = "ad_spend", revenueKey = "conversions_value" } = {}) {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    if (!rows?.length || rows.length < 14) return { enough: false, days: [] };
    const buckets = labels.map((label) => ({ label, spend: 0, revenue: 0, count: 0 }));
    for (const r of rows) {
        const idx = (new Date(`${r.date}T12:00:00Z`).getUTCDay() + 6) % 7;
        buckets[idx].spend += n(r[spendKey]);
        buckets[idx].revenue += n(r[revenueKey]);
        buckets[idx].count += 1;
    }
    const days = buckets.map((b) => ({
        label: b.label,
        avgSpend: b.count ? b.spend / b.count : 0,
        avgRevenue: b.count ? b.revenue / b.count : 0,
        roas: b.spend > 0 ? b.revenue / b.spend : 0,
    }));
    const maxRevenue = Math.max(...days.map((d) => d.avgRevenue), 1);
    const best = days.reduce((a, b) => (b.roas > a.roas ? b : a), days[0]);
    const worst = days.reduce((a, b) => (b.roas < a.roas ? b : a), days[0]);
    return {
        enough: true,
        best,
        worst,
        days: days.map((d) => ({ ...d, index: d.avgRevenue / maxRevenue, isBest: d.label === best.label })),
    };
}
