/**
 * Deterministic demo data for the Paid Social (Meta) dashboard (illustrative, not real customer data).
 * Built bottom-up from per-campaign daily rows, so daily totals, campaigns, funnel split, placements
 * and ads all agree with each other for any date range.
 */

import { eachDayInclusive, numHash } from "@/lib/demoAdMetrics";
import { classifyCampaignFunnel } from "@/lib/facebookPsDashboardUtils";

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

/** Indexed by Date#getUTCDay() (0 = Sunday) */
const WEEKDAY_DEMAND = [1.1, 0.97, 1.02, 1.0, 0.98, 0.9, 1.0];
const WEEKDAY_ROAS = [1.05, 0.99, 1.01, 1.0, 0.99, 0.95, 0.99];

const DAILY_SPEND = 3800;

/** cpm = cost per 1000 impressions, ctr = link click-through, cr = conversion rate per link click */
const CAMPAIGNS = [
    { name: "Prospecting - Lookalike 1%", share: 0.2, roas: 3.4, cpm: 48, ctr: 0.016, cr: 0.018, freq: 1.9, eng: 0.028 },
    { name: "Prospecting - Broad", share: 0.17, roas: 2.6, cpm: 38, ctr: 0.012, cr: 0.014, freq: 1.7, eng: 0.024 },
    { name: "Prospecting - Video views", share: 0.08, roas: 1.3, cpm: 22, ctr: 0.008, cr: 0.007, freq: 2.2, eng: 0.05 },
    { name: "Retargeting - Cart abandoners", share: 0.14, roas: 9.2, cpm: 85, ctr: 0.031, cr: 0.06, freq: 4.1, eng: 0.035 },
    { name: "Retargeting - Viewed content", share: 0.12, roas: 5.1, cpm: 66, ctr: 0.022, cr: 0.035, freq: 3.4, eng: 0.031 },
    { name: "Catalog - Best sellers", share: 0.17, roas: 4.6, cpm: 52, ctr: 0.018, cr: 0.022, freq: 2.4, eng: 0.026 },
    { name: "Advantage+ - Sales", share: 0.12, roas: 3.8, cpm: 44, ctr: 0.015, cr: 0.019, freq: 2.1, eng: 0.027 },
];

/** [placement, spend weight, ROAS factor, CPM factor, engagement factor] */
const PLACEMENTS = [
    ["instagram feed", 0.27, 1.12, 1.1, 1.0],
    ["facebook feed", 0.24, 1.0, 1.0, 0.8],
    ["instagram reels", 0.17, 0.92, 0.7, 1.5],
    ["instagram stories", 0.12, 0.8, 0.75, 0.9],
    ["facebook stories", 0.07, 0.62, 0.7, 0.7],
    ["audience network", 0.05, 0.38, 0.35, 0.3],
    ["messenger", 0.08, 1.3, 1.3, 0.6],
];

/** [ad name, spend weight, ROAS factor, frequency] */
const ADS = [
    ["Catalog_Carousel_Bestsellers", 0.14, 1.15, 2.3],
    ["UGC_Unboxing_V1", 0.1, 1.3, 2.0],
    ["UGC_Unboxing_V2", 0.08, 1.05, 2.8],
    ["Lifestyle_Livingroom_Static", 0.09, 0.95, 2.6],
    ["Video_Brand_Story_15s", 0.08, 0.55, 2.4],
    ["Offer_Free_Shipping_Banner", 0.07, 0.8, 3.7],
    ["Retarget_Cart_Reminder", 0.1, 1.9, 4.2],
    ["Retarget_Social_Proof", 0.07, 1.35, 3.6],
    ["Dynamic_Product_Feed", 0.09, 1.1, 2.9],
    ["Collection_Spring_Reel", 0.06, 1.2, 1.8],
    ["Influencer_Collab_Reel", 0.05, 0.7, 1.9],
    ["Testimonial_Carousel", 0.04, 1.0, 3.1],
    ["Sale_Countdown_Static", 0.03, 0.45, 4.6],
    ["Gift_Guide_Video", 0.02, 0.35, 1.5],
];

function campaignDay(c, date) {
    const dow = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    const growth = 1 + dayIndex(date) * 0.0001;
    const key = `${c.name}|${date}`;
    const ad_spend = DAILY_SPEND * c.share * growth * wiggle(`s|${key}`, 0.12) * (0.92 + (WEEKDAY_DEMAND[dow] - 1) * 0.5);
    const impressions = (ad_spend / (c.cpm * wiggle(`m|${key}`, 0.08))) * 1000;
    const link_clicks = impressions * c.ctr * wiggle(`k|${key}`, 0.08);
    const conversions = link_clicks * c.cr * wiggle(`v|${key}`, 0.18) * WEEKDAY_DEMAND[dow];
    const roasDay = c.roas * wiggle(`r|${key}`, 0.1) * WEEKDAY_ROAS[dow] * (1 + dayIndex(date) * 0.00004);
    const dayFreq = c.freq * wiggle(`f|${key}`, 0.06);
    return {
        campaign_name: c.name,
        date,
        ad_spend: Math.round(ad_spend),
        impressions: Math.round(impressions),
        link_clicks: Math.round(link_clicks),
        clicks: Math.round(link_clicks * 1.18),
        conversions: Math.round(conversions * 10) / 10,
        conversion_value: Math.round(ad_spend * roasDay),
        reach: Math.round(impressions / dayFreq),
        engagement: Math.round(impressions * c.eng * wiggle(`e|${key}`, 0.1)),
    };
}

function withRatios(row) {
    const { clicks, link_clicks, impressions, conversions, conversion_value, ad_spend, reach, engagement } = row;
    return {
        ...row,
        frequency: reach > 0 ? impressions / reach : 0,
        roas: ad_spend > 0 ? conversion_value / ad_spend : 0,
        aov: conversions > 0 ? conversion_value / conversions : 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: link_clicks > 0 ? ad_spend / link_clicks : 0,
        cpm: impressions > 0 ? (ad_spend / impressions) * 1000 : 0,
        conv_rate: link_clicks > 0 ? conversions / link_clicks : 0,
        cpa: conversions > 0 ? ad_spend / conversions : 0,
        engagement_rate: impressions > 0 ? engagement / impressions : 0,
    };
}

const sum = (rows, key) => rows.reduce((s, r) => s + (r[key] || 0), 0);

function totalsOf(rows) {
    return {
        ad_spend: sum(rows, "ad_spend"),
        impressions: sum(rows, "impressions"),
        link_clicks: sum(rows, "link_clicks"),
        clicks: sum(rows, "clicks"),
        conversions: Math.round(sum(rows, "conversions") * 10) / 10,
        conversion_value: sum(rows, "conversion_value"),
        reach: sum(rows, "reach"),
        engagement: sum(rows, "engagement"),
    };
}

export function getDemoPsDashboardForRange(startDate, endDate) {
    const days = eachDayInclusive(startDate, endDate);
    const perCampaign = CAMPAIGNS.map((c) => days.map((d) => campaignDay(c, d)));

    const metrics_by_date = days.map((date, i) => withRatios({ date, ...totalsOf(perCampaign.map((l) => l[i])) }));

    const campaigns_performance = CAMPAIGNS.map((c, ci) =>
        withRatios({ campaign_name: c.name, ...totalsOf(perCampaign[ci]) })
    );

    const top_campaigns = [...campaigns_performance]
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5)
        .map((c) => ({
            campaign_name: c.campaign_name,
            clicks: c.clicks,
            impressions: c.impressions,
            conversions: c.conversions,
            ctr: c.ctr,
        }));

    const funnel_spend_by_date = days.map((date, i) => {
        const out = { date, prospecting_spend: 0, retargeting_spend: 0, other_spend: 0 };
        CAMPAIGNS.forEach((c, ci) => {
            out[`${classifyCampaignFunnel(c.name)}_spend`] += perCampaign[ci][i].ad_spend;
        });
        return out;
    });

    // Placements: split the account totals so they add up to the same spend and revenue
    const acc = totalsOf(metrics_by_date);
    const wSum = PLACEMENTS.reduce((s, p) => s + p[1], 0);
    const revNorm = PLACEMENTS.reduce((s, p) => s + p[1] * p[2], 0);
    const cpmNorm = PLACEMENTS.reduce((s, p) => s + p[1] * p[3], 0);
    const engNorm = PLACEMENTS.reduce((s, p) => s + p[1] * p[4], 0);
    const accCpm = acc.impressions > 0 ? (acc.ad_spend / acc.impressions) * 1000 : 0;
    const accFreq = acc.reach > 0 ? acc.impressions / acc.reach : 2;
    const placements = PLACEMENTS.map(([placement, w, roasF, cpmF, engF]) => {
        const spendShare = w / wSum;
        const ad_spend = Math.round(acc.ad_spend * spendShare);
        const conversion_value = Math.round((acc.conversion_value * (w * roasF)) / revNorm);
        const cpm = accCpm * (cpmF / (cpmNorm / wSum));
        const impressions = Math.round((ad_spend / cpm) * 1000);
        const link_clicks = Math.round(impressions * 0.0155 * wiggle(`pl|${placement}`, 0.15));
        const conversions = Math.round(((conversion_value / (acc.conversion_value / Math.max(acc.conversions, 1))) * 10)) / 10;
        const frequency = accFreq * wiggle(`pf|${placement}`, 0.15);
        return withRatios({
            placement,
            ad_spend,
            impressions,
            link_clicks,
            clicks: Math.round(link_clicks * 1.18),
            conversions,
            conversion_value,
            reach: Math.round(impressions / frequency),
            engagement: Math.round(impressions * 0.028 * (engF / (engNorm / wSum))),
        });
    });

    // Ads: about 93% of spend sits in ads that can be named, the rest in dynamic or small ads
    const adWeights = ADS.reduce((s, a) => s + a[1], 0);
    const adRoasNorm = ADS.reduce((s, a) => s + a[1] * a[2], 0) / adWeights;
    const accRoas = acc.ad_spend > 0 ? acc.conversion_value / acc.ad_spend : 0;
    const ads = ADS.map(([name, w, roasF, freq], i) => {
        const spend = Math.round((acc.ad_spend * 0.93 * w) / adWeights);
        const roas = (accRoas * roasF) / adRoasNorm;
        const revenue = Math.round(spend * roas);
        const impressions = Math.round((spend / (accCpm * wiggle(`ac|${name}`, 0.2))) * 1000);
        const clicks = Math.round(impressions * 0.016 * wiggle(`ak|${name}`, 0.25));
        const conversions = Math.round((revenue / (acc.conversion_value / Math.max(acc.conversions, 1))) * 10) / 10;
        return {
            platform: "facebook",
            ad_id: String(3000 + i),
            ad_name: name,
            revenue,
            roas,
            poas: roas,
            ad_spend: spend,
            impressions,
            clicks,
            conversions,
            frequency: freq,
            ctr: impressions > 0 ? clicks / impressions : 0,
            conv_rate_clicks: clicks > 0 ? conversions / clicks : 0,
            conv_rate_impressions: impressions > 0 ? conversions / impressions : 0,
        };
    });

    return {
        insights: {
            metrics_by_date,
            top_campaigns,
            campaigns_by_date: [],
            campaigns_performance,
            placements,
            funnel_spend_by_date,
            account_summary: {
                new_customer_ratio: 61,
                recurring_customer_ratio: 39,
                period_reach: Math.round(acc.reach * 0.55),
                period_frequency: acc.reach > 0 ? acc.impressions / (acc.reach * 0.55) : null,
            },
        },
        ads: { ads, currency: "DKK", adPerformanceNote: null },
    };
}
