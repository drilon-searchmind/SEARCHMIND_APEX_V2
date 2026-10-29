/**
 * Deterministic demo data for the Snapchat Ads dashboard (illustrative, not real customer data).
 * It returns exactly the fields the live route returns with extras on: daily account metrics,
 * campaign totals with video, engagement and frequency detail, and the six audience breakdowns
 * (gender, age, country, region, OS, device make). Campaigns are the source, so every part agrees.
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

/** Indexed by Date#getUTCDay() (0 = Sunday). A young, mobile audience: evenings and weekends run higher. */
const WEEKDAY_DEMAND = [1.2, 0.92, 0.94, 0.97, 1.02, 1.12, 1.18];

const DAILY_SPEND = 1300;

/**
 * cpm in kr. per 1.000 impressions, ctr = swipe rate, atc = adds to cart per swipe, buy = purchases per swipe,
 * video = share of impressions that are video views, complete = completions per video view, freq = frequency
 */
const CAMPAIGNS = [
    { name: "Prospecting - Video", share: 0.3, cpm: 28, ctr: 0.0052, atc: 0.09, buy: 0.014, aov: 640, video: 0.62, complete: 0.34, freq: 2.1 },
    { name: "Retargeting - Cart", share: 0.16, cpm: 58, ctr: 0.0135, atc: 0.22, buy: 0.052, aov: 680, video: 0.2, complete: 0.4, freq: 4.4 },
    { name: "Collection ads", share: 0.22, cpm: 36, ctr: 0.0094, atc: 0.13, buy: 0.027, aov: 610, video: 0.1, complete: 0.3, freq: 2.8 },
    { name: "Story ads - Lookalike", share: 0.2, cpm: 31, ctr: 0.0071, atc: 0.1, buy: 0.018, aov: 600, video: 0.45, complete: 0.36, freq: 2.4 },
    { name: "Awareness - Spotlight", share: 0.12, cpm: 17, ctr: 0.0021, atc: 0.04, buy: 0.004, aov: 520, video: 0.7, complete: 0.28, freq: 1.7 },
];

function campaignDay(c, date) {
    const dow = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    const key = `${c.name}|${date}`;
    const growth = 1 + dayIndex(date) * 0.0001;
    const spend = DAILY_SPEND * c.share * growth * wiggle(`s|${key}`, 0.12) * WEEKDAY_DEMAND[dow];
    const impressions = (spend / (c.cpm * wiggle(`m|${key}`, 0.08))) * 1000;
    const swipes = impressions * c.ctr * wiggle(`k|${key}`, 0.1);
    const adds = swipes * c.atc * wiggle(`a|${key}`, 0.15);
    const purchases = swipes * c.buy * wiggle(`p|${key}`, 0.22);
    const value = purchases * c.aov * wiggle(`v|${key}`, 0.1);
    return { ad_spend: spend, impressions, clicks: swipes, adds_to_cart: adds, purchases, purchase_value: value };
}

const KEYS = ["ad_spend", "impressions", "clicks", "adds_to_cart", "purchases", "purchase_value"];
const sum = (rows) => Object.fromEntries(KEYS.map((k) => [k, rows.reduce((s, r) => s + (r[k] || 0), 0)]));

function dayRow(date, t) {
    const ad_spend = Math.round(t.ad_spend * 100) / 100;
    const purchases = Math.round(t.purchases);
    const purchase_value = Math.round(t.purchase_value * 100) / 100;
    const impressions = Math.round(t.impressions);
    const clicks = Math.round(t.clicks);
    return {
        date,
        ad_spend,
        impressions,
        clicks,
        saves: clicks,
        conversions: purchases,
        purchases,
        purchase_value,
        conversion_value: purchase_value,
        adds_to_cart: Math.round(t.adds_to_cart),
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? ad_spend / clicks : 0,
        cpm: impressions > 0 ? (ad_spend / impressions) * 1000 : 0,
        roas: ad_spend > 0 ? purchase_value / ad_spend : 0,
        purchase_roas: ad_spend > 0 ? purchase_value / ad_spend : 0,
        aov: purchases > 0 ? purchase_value / purchases : 0,
    };
}

/** [name, impression weight, swipe factor, purchase factor, cost factor] */
const GENDER = [["Female", 0.57, 1.05, 1.15, 1.0], ["Male", 0.43, 0.94, 0.85, 1.0]];
const AGE = [["13-17", 0.06, 1.2, 0.2, 0.7], ["18-20", 0.17, 1.1, 0.7, 0.9], ["21-24", 0.26, 1.05, 1.0, 1.0], ["25-34", 0.31, 0.95, 1.35, 1.1], ["35-44", 0.14, 0.85, 1.2, 1.15], ["45-54", 0.06, 0.7, 0.9, 1.1]];
const COUNTRY = [["Denmark", 0.62, 1.0, 1.1, 1.05], ["Sweden", 0.24, 1.0, 0.95, 0.95], ["Norway", 0.14, 0.95, 0.85, 1.0]];
const REGION = [
    ["Capital Region, Denmark", 0.26, 1.0, 1.2, 1.1], ["Central Denmark, Denmark", 0.14, 1.0, 1.0, 1.0], ["Southern Denmark, Denmark", 0.1, 0.95, 0.95, 0.95],
    ["Stockholm, Sweden", 0.12, 1.05, 1.0, 1.0], ["Vastra Gotaland, Sweden", 0.07, 0.95, 0.9, 0.95], ["Oslo, Norway", 0.08, 0.95, 0.9, 1.0],
    ["North Denmark, Denmark", 0.05, 0.9, 0.8, 0.9], ["Zealand, Denmark", 0.08, 0.95, 0.85, 0.95], ["Skane, Sweden", 0.06, 0.95, 0.9, 0.95], ["Viken, Norway", 0.04, 0.9, 0.8, 0.95],
];
const OS = [["iOS", 0.64, 1.0, 1.25, 1.1], ["Android", 0.36, 1.0, 0.7, 0.85]];
const MAKES = [["Apple", 0.64, 1.0, 1.25, 1.1], ["Samsung", 0.2, 1.0, 0.8, 0.9], ["Google", 0.04, 1.05, 0.9, 0.9], ["Xiaomi", 0.05, 0.9, 0.5, 0.7], ["Huawei", 0.02, 0.9, 0.4, 0.7], ["Other", 0.05, 0.9, 0.6, 0.75]];

/** Split account totals over categories so impressions, swipes, spend and purchases add up to the account. */
function splitAudience(defs, acc) {
    const impW = defs.reduce((s, d) => s + d[1], 0);
    const swipeNorm = defs.reduce((s, d) => s + d[1] * d[2], 0);
    const buyNorm = defs.reduce((s, d) => s + d[1] * d[3], 0);
    const costNorm = defs.reduce((s, d) => s + d[1] * d[4], 0);
    return defs
        .map(([name, w, swipeF, buyF, costF]) => {
            const impressions = Math.round(acc.impressions * (w / impW));
            const clicks = Math.round((acc.clicks * (w * swipeF)) / swipeNorm);
            const purchases = Math.round((acc.purchases * (w * buyF)) / buyNorm);
            const spend = (acc.ad_spend * (w * costF)) / costNorm;
            const value = acc.purchases > 0 ? (acc.purchase_value * purchases) / acc.purchases : 0;
            return {
                id: name.toLowerCase(),
                name,
                impressions,
                clicks,
                ad_spend: Math.round(spend * 100) / 100,
                purchases,
                purchase_value: Math.round(value * 100) / 100,
                ctr: impressions > 0 ? clicks / impressions : 0,
                roas: spend > 0 ? value / spend : 0,
            };
        })
        .sort((a, b) => b.ad_spend - a.ad_spend);
}

export function getDemoSnapDashboardForRange(startDate, endDate) {
    const days = eachDayInclusive(startDate, endDate);
    const perCampaign = CAMPAIGNS.map((c) => days.map((d) => campaignDay(c, d)));
    const totals = perCampaign.map((l) => sum(l));

    const metrics_by_date = days.map((date, i) => dayRow(date, sum(perCampaign.map((l) => l[i]))));

    const top_campaigns = CAMPAIGNS.map((c, ci) => {
        const t = totals[ci];
        const impressions = Math.round(t.impressions);
        const clicks = Math.round(t.clicks);
        const videoViews = Math.round(impressions * c.video * wiggle(`vv|${c.name}`, 0.06));
        const completes = Math.round(videoViews * c.complete * wiggle(`vc|${c.name}`, 0.08));
        const uniques = Math.round(impressions / (c.freq * wiggle(`fr|${c.name}`, 0.05)));
        return {
            campaign_id: `demo-snap-${ci + 1}`,
            campaign_name: c.name,
            clicks,
            impressions,
            saves: clicks,
            ctr: impressions > 0 ? clicks / impressions : 0,
            ad_spend: Math.round(t.ad_spend * 100) / 100,
            purchases: Math.round(t.purchases),
            adds_to_cart: Math.round(t.adds_to_cart),
            purchase_value: Math.round(t.purchase_value * 100) / 100,
            video_views: videoViews,
            video_completes: completes,
            quartile_1: Math.round(videoViews * 0.72),
            quartile_2: Math.round(videoViews * 0.5),
            quartile_3: Math.round(videoViews * 0.38),
            shares: Math.round(clicks * 0.012),
            saves_total: Math.round(clicks * 0.03),
            story_opens: Math.round(impressions * 0.004),
            uniques,
            frequency: uniques > 0 ? impressions / uniques : null,
        };
    }).sort((a, b) => b.ad_spend - a.ad_spend);

    const acc = sum(metrics_by_date.map((r) => ({ ad_spend: r.ad_spend, impressions: r.impressions, clicks: r.clicks, adds_to_cart: r.adds_to_cart, purchases: r.purchases, purchase_value: r.purchase_value })));

    return {
        metrics_by_date,
        top_campaigns,
        campaigns_by_date: [],
        audience: {
            gender: splitAudience(GENDER, acc),
            age: splitAudience(AGE, acc),
            country: splitAudience(COUNTRY, acc),
            region: splitAudience(REGION, acc),
            os: splitAudience(OS, acc),
            device_make: splitAudience(MAKES, acc),
        },
        warnings: [],
    };
}
