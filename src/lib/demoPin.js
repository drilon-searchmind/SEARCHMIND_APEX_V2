/**
 * Deterministic demo data for the Pinterest ads dashboard (illustrative, not real customer data).
 * It returns exactly the fields the live fetcher in pinterestApi.js can return: daily account
 * analytics (spend, impressions, outbound clicks, saves, checkouts, checkout value) and campaign
 * totals. Campaigns are the source, so daily totals and the campaign table always agree.
 */

import { eachDayInclusive, numHash } from "@/lib/demoAdMetrics";

const ORIGIN = Date.UTC(2025, 0, 1);

function dayIndex(date) {
    const t = new Date(`${date}T12:00:00.000Z`).getTime();
    return Math.max(0, Math.floor((t - ORIGIN) / 86400000));
}

function rnd(seed) {
    // numHash alone barely changes between neighbouring dates, so scramble it before use
    let h = numHash(seed);
    h ^= h >>> 16;
    h = Math.imul(h, 0x45d9f3b);
    h ^= h >>> 16;
    h = Math.imul(h, 0x45d9f3b);
    h ^= h >>> 16;
    return ((h >>> 0) % 10000) / 10000;
}

function wiggle(seed, spread) {
    return 1 + (rnd(seed) - 0.5) * 2 * spread;
}

/** Indexed by Date#getUTCDay() (0 = Sunday). People plan on Pinterest, so weekends run higher. */
const WEEKDAY_DEMAND = [1.18, 0.94, 0.96, 0.98, 0.97, 1.02, 1.12];

const DAILY_SPEND = 1500;

/** cpm in kr. per 1.000 impressions, ctr = outbound click rate, save = saves per impression, cr = checkouts per click */
const CAMPAIGNS = [
    { name: "Prospecting - Home inspiration", share: 0.26, cpm: 31, ctr: 0.0062, save: 0.0125, cr: 0.011, aov: 640 },
    { name: "Shopping - Catalog", share: 0.24, cpm: 44, ctr: 0.0118, save: 0.006, cr: 0.026, aov: 590 },
    { name: "Keywords - Living room", share: 0.14, cpm: 38, ctr: 0.0094, save: 0.009, cr: 0.017, aov: 610 },
    { name: "Awareness - Video pins", share: 0.12, cpm: 19, ctr: 0.0031, save: 0.014, cr: 0.004, aov: 540 },
    { name: "Retargeting - Site visitors", share: 0.1, cpm: 62, ctr: 0.0165, save: 0.004, cr: 0.052, aov: 650 },
    { name: "Seasonal - Autumn collection", share: 0.09, cpm: 36, ctr: 0.0072, save: 0.011, cr: 0.012, aov: 620 },
    { name: "Standard - Idea pins", share: 0.05, cpm: 24, ctr: 0.0021, save: 0.007, cr: 0.002, aov: 500 },
];

function campaignDay(c, date) {
    const dow = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    const key = `${c.name}|${date}`;
    const growth = 1 + dayIndex(date) * 0.0001;
    const spend = DAILY_SPEND * c.share * growth * wiggle(`s|${key}`, 0.12) * WEEKDAY_DEMAND[dow];
    const impressions = (spend / (c.cpm * wiggle(`m|${key}`, 0.08))) * 1000;
    const clicks = impressions * c.ctr * wiggle(`k|${key}`, 0.1);
    const saves = impressions * c.save * wiggle(`v|${key}`, 0.1);
    const checkouts = clicks * c.cr * wiggle(`c|${key}`, 0.2);
    return {
        ad_spend: Math.round(spend),
        impressions: Math.round(impressions),
        clicks: Math.round(clicks),
        saves: Math.round(saves),
        conversions: Math.round(checkouts),
        conversion_value: Math.round(checkouts * c.aov * wiggle(`a|${key}`, 0.1)),
    };
}

function ratios(row) {
    const { ad_spend, impressions, clicks, conversions, conversion_value } = row;
    return {
        ...row,
        roas: ad_spend > 0 ? conversion_value / ad_spend : 0,
        aov: conversions > 0 ? conversion_value / conversions : 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? ad_spend / clicks : 0,
        cpm: impressions > 0 ? (ad_spend / impressions) * 1000 : 0,
    };
}

const KEYS = ["ad_spend", "impressions", "clicks", "saves", "conversions", "conversion_value"];

function sum(rows) {
    const out = {};
    for (const k of KEYS) out[k] = rows.reduce((s, r) => s + (r[k] || 0), 0);
    return out;
}

export function getDemoPinDashboardForRange(startDate, endDate) {
    const days = eachDayInclusive(startDate, endDate);
    const perCampaign = CAMPAIGNS.map((c) => days.map((d) => campaignDay(c, d)));

    const metrics_by_date = days.map((date, i) => ratios({ date, ...sum(perCampaign.map((list) => list[i])) }));

    const top_campaigns = CAMPAIGNS.map((c, ci) => {
        const t = ratios(sum(perCampaign[ci]));
        return {
            campaign_name: c.name,
            campaign_id: `demo-pin-${ci + 1}`,
            ad_spend: t.ad_spend,
            impressions: t.impressions,
            clicks: t.clicks,
            saves: t.saves,
            conversions: t.conversions,
            conversion_value: t.conversion_value,
            roas: t.roas,
            ctr: t.ctr,
        };
    }).sort((a, b) => b.clicks - a.clicks);

    return {
        metrics_by_date,
        top_campaigns,
        campaigns_by_date: [],
        analytics_window: { rangeAllowed: true, earliest: null },
    };
}
