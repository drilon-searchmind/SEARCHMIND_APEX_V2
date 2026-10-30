/**
 * Deterministic demo data for the Reddit Ads dashboard (illustrative, not real customer data).
 * It returns exactly the fields the live route returns with extras on: daily account metrics,
 * campaign totals, ad groups and ads with names, account reach and video funnel, and the audience
 * breakdowns (communities, interests, keywords, gender, country, placement). Everything is split
 * from the same campaign rows, so every part agrees.
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

/** Indexed by Date#getUTCDay() (0 = Sunday). Reddit evenings and weekends run a little higher. */
const WEEKDAY_DEMAND = [1.12, 0.96, 0.97, 0.98, 0.98, 1.0, 1.08];

const DAILY_SPEND = 1100;

/** cpm in kr. per 1.000 impressions, ctr = click rate, buy = purchases per click (0 = not tracked), video = share of impressions with a video start */
const CAMPAIGNS = [
    { id: "demo-red-1", name: "Traffic - Interior communities", objective: "CLICKS", share: 0.34, cpm: 22, ctr: 0.0062, buy: 0.016, atc: 0.07, aov: 620, video: 0.1, freq: 2.4 },
    { id: "demo-red-2", name: "Conversions - Best sellers", objective: "CONVERSIONS", share: 0.26, cpm: 31, ctr: 0.0049, buy: 0.034, atc: 0.12, aov: 640, video: 0.05, freq: 2.9 },
    { id: "demo-red-3", name: "Awareness - Video", objective: "VIDEO_VIEWABLE_IMPRESSIONS", share: 0.2, cpm: 12, ctr: 0.0021, buy: 0.003, atc: 0.03, aov: 560, video: 0.74, freq: 3.6 },
    { id: "demo-red-4", name: "Retargeting - Visitors", objective: "CONVERSIONS", share: 0.12, cpm: 44, ctr: 0.0098, buy: 0.058, atc: 0.2, aov: 660, video: 0.08, freq: 5.1 },
    { id: "demo-red-5", name: "Conversation placement test", objective: "CLICKS", share: 0.08, cpm: 18, ctr: 0.0035, buy: 0.01, atc: 0.05, aov: 580, video: 0.04, freq: 2.0 },
];

function campaignDay(c, date) {
    const dow = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    const key = `${c.id}|${date}`;
    const growth = 1 + dayIndex(date) * 0.0001;
    const spend = DAILY_SPEND * c.share * growth * wiggle(`s|${key}`, 0.12) * WEEKDAY_DEMAND[dow];
    const impressions = (spend / (c.cpm * wiggle(`m|${key}`, 0.08))) * 1000;
    const clicks = impressions * c.ctr * wiggle(`k|${key}`, 0.1);
    const purchases = clicks * c.buy * wiggle(`p|${key}`, 0.25);
    const adds = clicks * c.atc * wiggle(`a|${key}`, 0.18);
    const value = purchases * c.aov * wiggle(`v|${key}`, 0.1);
    return { ad_spend: spend, impressions, clicks, purchases, adds_to_cart: adds, purchase_value: value };
}

const KEYS = ["ad_spend", "impressions", "clicks", "purchases", "adds_to_cart", "purchase_value"];
const sum = (rows) => Object.fromEntries(KEYS.map((k) => [k, rows.reduce((s, r) => s + (r[k] || 0), 0)]));

function dayRow(date, t) {
    const ad_spend = Math.round(t.ad_spend * 100) / 100;
    const impressions = Math.round(t.impressions);
    const clicks = Math.round(t.clicks);
    const purchases = Math.round(t.purchases);
    const value = Math.round(t.purchase_value * 100) / 100;
    return {
        date,
        ad_spend,
        impressions,
        clicks,
        saves: 0,
        conversions: purchases,
        purchases,
        adds_to_cart: Math.round(t.adds_to_cart),
        conversion_value: value,
        purchase_value: value,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? ad_spend / clicks : 0,
        cpm: impressions > 0 ? (ad_spend / impressions) * 1000 : 0,
        roas: ad_spend > 0 ? value / ad_spend : 0,
        aov: purchases > 0 ? value / purchases : 0,
    };
}

function entityRow(base, t) {
    const impressions = Math.round(t.impressions);
    const clicks = Math.round(t.clicks);
    const ad_spend = Math.round(t.ad_spend * 100) / 100;
    const purchase_value = Math.round(t.purchase_value * 100) / 100;
    return {
        ...base,
        impressions,
        clicks,
        ad_spend,
        purchases: Math.round(t.purchases),
        adds_to_cart: Math.round(t.adds_to_cart),
        purchase_value,
        ctr: impressions > 0 ? clicks / impressions : 0,
        roas: ad_spend > 0 && purchase_value > 0 ? purchase_value / ad_spend : 0,
    };
}

/** [name, weight of impressions, click factor, purchase factor, cost factor] */
const COMMUNITIES = [
    ["r/malelivingspace", 0.13, 1.25, 1.2, 1.1], ["r/DesignMyRoom", 0.11, 1.35, 1.3, 1.1], ["r/interiordesign", 0.1, 1.1, 1.15, 1.1], ["r/HomeDecorating", 0.09, 1.0, 1.0, 1.0],
    ["r/CozyPlaces", 0.08, 0.9, 0.7, 0.85], ["r/AmateurRoomPorn", 0.07, 1.15, 1.0, 1.0], ["r/organization", 0.06, 0.8, 0.6, 0.8], ["r/Denmark", 0.06, 0.95, 1.1, 1.0],
    ["r/Scandinavia", 0.05, 1.05, 1.1, 1.0], ["r/HomeImprovement", 0.05, 0.85, 0.7, 0.9], ["r/DIY", 0.04, 0.7, 0.3, 0.75], ["r/CasualConversation", 0.04, 0.55, 0.2, 0.7],
    ["r/Futurology", 0.03, 0.5, 0.1, 0.7], ["r/apartment", 0.05, 1.1, 0.9, 0.95], ["r/Frugal", 0.04, 0.75, 0.2, 0.7],
];
const INTERESTS = [
    ["Home & Garden", 0.24, 1.2, 1.2, 1.1], ["Interior Design", 0.2, 1.3, 1.3, 1.1], ["Shopping", 0.12, 0.9, 0.9, 1.0], ["Lifestyle", 0.1, 0.85, 0.7, 0.9],
    ["DIY & Crafts", 0.08, 0.8, 0.5, 0.8], ["General Entertainment", 0.1, 0.55, 0.2, 0.7], ["Technology", 0.06, 0.6, 0.3, 0.8], ["Finance", 0.05, 0.6, 0.2, 0.9], ["Travel", 0.05, 0.8, 0.5, 0.85],
];
const KEYWORDS = [
    ["[Automated targeting]", 0.34, 1.0, 1.0, 1.0], ["scandinavian furniture", 0.16, 1.3, 1.4, 1.15], ["sofa", 0.14, 1.1, 1.1, 1.1], ["pendant lamp", 0.1, 1.2, 1.2, 1.0],
    ["dining table", 0.09, 1.05, 1.0, 1.0], ["cheap furniture", 0.07, 0.8, 0.2, 0.8], ["ikea hack", 0.06, 0.7, 0.1, 0.7], ["room ideas", 0.04, 1.0, 0.6, 0.8],
];
const GENDER = [["Men", 0.56, 1.0, 0.95, 1.0], ["Women", 0.36, 1.05, 1.15, 1.0], ["Unknown", 0.08, 0.8, 0.6, 0.9]];
const COUNTRY = [["Denmark", 0.34, 1.0, 1.25, 1.1], ["Sweden", 0.16, 1.0, 1.0, 1.0], ["Germany", 0.17, 0.95, 0.9, 0.95], ["Norway", 0.1, 1.0, 1.1, 1.1], ["Netherlands", 0.09, 0.95, 0.8, 0.95], ["United Kingdom", 0.08, 0.9, 0.6, 0.9], ["France", 0.06, 0.9, 0.5, 0.85]];
const PLACEMENT = [["Feed", 0.82, 1.0, 1.05, 1.05], ["Comments Page", 0.18, 0.85, 0.75, 0.7]];

/** Split account totals over categories so impressions, clicks, spend and purchases add up to the account. */
function splitAudience(defs, acc) {
    const impW = defs.reduce((s, d) => s + d[1], 0);
    const clickNorm = defs.reduce((s, d) => s + d[1] * d[2], 0);
    const buyNorm = defs.reduce((s, d) => s + d[1] * d[3], 0);
    const costNorm = defs.reduce((s, d) => s + d[1] * d[4], 0);
    return defs
        .map(([name, w, clickF, buyF, costF]) =>
            entityRow(
                { id: name, name },
                {
                    impressions: acc.impressions * (w / impW),
                    clicks: (acc.clicks * (w * clickF)) / clickNorm,
                    ad_spend: (acc.ad_spend * (w * costF)) / costNorm,
                    purchases: (acc.purchases * (w * buyF)) / buyNorm,
                    adds_to_cart: (acc.adds_to_cart * (w * clickF)) / clickNorm,
                    purchase_value: acc.purchases > 0 ? (acc.purchase_value * ((acc.purchases * (w * buyF)) / buyNorm)) / acc.purchases : 0,
                }
            )
        )
        .sort((a, b) => b.ad_spend - a.ad_spend);
}

export function getDemoRedditDashboardForRange(startDate, endDate) {
    const days = eachDayInclusive(startDate, endDate);
    const perCampaign = CAMPAIGNS.map((c) => days.map((d) => campaignDay(c, d)));
    const totals = perCampaign.map((l) => sum(l));

    const metrics_by_date = days.map((date, i) => dayRow(date, sum(perCampaign.map((l) => l[i]))));

    const top_campaigns = CAMPAIGNS.map((c, ci) =>
        entityRow({ campaign_id: c.id, campaign_name: c.name, saves: Math.round(totals[ci].clicks), objective: c.objective, status: ci === 4 ? "PAUSED" : "ACTIVE" }, totals[ci])
    ).sort((a, b) => b.ad_spend - a.ad_spend);

    const acc = sum(metrics_by_date.map((r) => ({ ad_spend: r.ad_spend, impressions: r.impressions, clicks: r.clicks, purchases: r.purchases, adds_to_cart: r.adds_to_cart, purchase_value: r.purchase_value })));

    // Ad groups: two per campaign, one stronger than the other
    const ad_groups = [];
    CAMPAIGNS.forEach((c, ci) => {
        [["Communities", 0.6, 1.1], ["Interests", 0.4, 0.88]].forEach(([label, w, q]) => {
            const t = totals[ci];
            ad_groups.push(
                entityRow(
                    { id: `${c.id}-ag-${label.toLowerCase()}`, name: `${c.name.split(" - ")[0]} - ${label}`, campaign_id: c.id, campaign_name: c.name, status: "ACTIVE", objective: c.objective },
                    {
                        impressions: t.impressions * w,
                        clicks: t.clicks * w * q,
                        ad_spend: t.ad_spend * w,
                        purchases: t.purchases * w * q,
                        adds_to_cart: t.adds_to_cart * w * q,
                        purchase_value: t.purchase_value * w * q,
                    }
                )
            );
        });
    });
    ad_groups.sort((a, b) => b.ad_spend - a.ad_spend);

    // Ads: three per campaign with different strength
    const ads = [];
    CAMPAIGNS.forEach((c, ci) => {
        [["Image - Living room", 0.45, 1.05], ["Video - Room tour", 0.35, 0.9], ["Carousel - Best sellers", 0.2, 1.15]].forEach(([label, w, q]) => {
            const t = totals[ci];
            ads.push(
                entityRow(
                    {
                        id: `${c.id}-ad-${label.split(" ")[0].toLowerCase()}`,
                        name: label,
                        campaign_id: c.id,
                        campaign_name: c.name,
                        ad_group_name: `${c.name.split(" - ")[0]} - Communities`,
                        status: "ACTIVE",
                        objective: c.objective,
                    },
                    {
                        impressions: t.impressions * w,
                        clicks: t.clicks * w * q,
                        ad_spend: t.ad_spend * w,
                        purchases: t.purchases * w * q,
                        adds_to_cart: t.adds_to_cart * w * q,
                        purchase_value: t.purchase_value * w * q,
                    }
                )
            );
        });
    });
    ads.sort((a, b) => b.ad_spend - a.ad_spend);

    const videoStarted = Math.round(CAMPAIGNS.reduce((s, c, i) => s + totals[i].impressions * c.video, 0));
    const freqWeight = CAMPAIGNS.reduce((s, c, i) => s + totals[i].impressions * c.freq, 0);
    const reach = Math.round(acc.impressions / (freqWeight / Math.max(acc.impressions, 1)) / 1.15);

    return {
        metrics_by_date,
        top_campaigns,
        campaigns_by_date: [],
        account: {
            reach,
            frequency: acc.impressions / Math.max(reach, 1),
            video_started: videoStarted,
            video_25: Math.round(videoStarted * 0.46),
            video_50: Math.round(videoStarted * 0.27),
            video_75: Math.round(videoStarted * 0.17),
            video_100: Math.round(videoStarted * 0.11),
            video_with_sound: Math.round(videoStarted * 0.18),
        },
        ad_groups,
        ads: ads.slice(0, 50),
        audience: {
            community: splitAudience(COMMUNITIES, acc),
            interest: splitAudience(INTERESTS, acc),
            keyword: splitAudience(KEYWORDS, acc),
            gender: splitAudience(GENDER, acc),
            country: splitAudience(COUNTRY, acc),
            placement: splitAudience(PLACEMENT, acc),
        },
        spend_currency: "DKK",
        warnings: [],
    };
}
