/**
 * Deterministic demo data for the Microsoft (Bing) Ads dashboard (illustrative, not real customer data).
 * It returns exactly the fields fetchBingAdsDashboardMetrics can return: daily campaign performance
 * (spend, impressions, clicks, conversions, revenue), campaign totals, search queries, device and
 * network split and impression share. Everything is built from per-campaign daily rows, so the parts agree.
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

/** Indexed by Date#getUTCDay() (0 = Sunday). Search on Bing skews to working days and desktop. */
const WEEKDAY_DEMAND = [0.82, 1.08, 1.1, 1.06, 1.04, 0.96, 0.84];

const DAILY_SPEND = 1900;

/** cpc in kr., ctr = click rate, cr = conversion rate per click, is = impression share, aov = revenue per conversion */
const CAMPAIGNS = [
    { name: "Search - Brand", share: 0.1, cpc: 2.3, ctr: 0.19, cr: 0.09, aov: 640, is: 0.88, lostBudget: 0.01, lostRank: 0.11 },
    { name: "Search - Generic Sofas", share: 0.24, cpc: 4.2, ctr: 0.047, cr: 0.024, aov: 650, is: 0.46, lostBudget: 0.22, lostRank: 0.32 },
    { name: "Search - Generic Lighting", share: 0.14, cpc: 3.1, ctr: 0.058, cr: 0.026, aov: 520, is: 0.55, lostBudget: 0.08, lostRank: 0.37 },
    { name: "Shopping - Products", share: 0.22, cpc: 2.5, ctr: 0.021, cr: 0.022, aov: 590, is: 0.61, lostBudget: 0.13, lostRank: 0.26 },
    { name: "Performance Max - All", share: 0.2, cpc: 2.9, ctr: 0.017, cr: 0.019, aov: 610, is: 0.58, lostBudget: 0.16, lostRank: 0.26 },
    { name: "Audience - Remarketing", share: 0.1, cpc: 3.6, ctr: 0.012, cr: 0.047, aov: 640, is: 0.4, lostBudget: 0.05, lostRank: 0.55 },
];

/** [term, weight, conversion factor, cpc factor] per campaign (0 conversions = money with no return) */
const TERMS = {
    "Search - Brand": [
        ["dims studio", 0.5, 1.2, 0.8],
        ["dims møbler", 0.25, 1, 1],
        ["dims studio tilbud", 0.15, 1.3, 1],
        ["dims studio kundeservice", 0.1, 0, 0.8],
    ],
    "Search - Generic Sofas": [
        ["sofa", 0.2, 0.9, 1.1],
        ["3 personers sofa", 0.16, 1.25, 1],
        ["hjørnesofa", 0.14, 1.1, 1.05],
        ["velour sofa", 0.12, 1.4, 0.95],
        ["sofa tilbud", 0.12, 0.8, 1],
        ["billige sofaer", 0.1, 0.25, 1.1],
        ["sofa leasing", 0.08, 0, 1.1],
        ["sofa brugt", 0.08, 0, 0.9],
    ],
    "Search - Generic Lighting": [
        ["design lampe", 0.24, 1.2, 1],
        ["pendel lampe", 0.2, 1.1, 1],
        ["loftslampe", 0.16, 1, 1.05],
        ["gulvlampe", 0.16, 1.15, 0.95],
        ["diy lampe", 0.12, 0, 0.8],
        ["lampe reparation", 0.12, 0, 0.8],
    ],
    "Shopping - Products": [
        ["nordiske møbler", 0.25, 1.1, 1],
        ["møbler online", 0.25, 0.85, 1.1],
        ["sidebord marmor", 0.2, 1.3, 0.95],
        ["reol egetræ", 0.18, 1.15, 1],
        ["puf til stue", 0.12, 0.1, 0.9],
    ],
};

const TERM_COVERAGE = 0.62;

/** Device split of spend and return, normalised so the parts add up to the account totals */
const DEVICES = [
    ["Computer", 0.58, 1.12, 1.15],
    ["Smartphone", 0.34, 0.82, 0.8],
    ["Tablet", 0.08, 0.95, 1.0],
];
const NETWORKS = [
    ["Microsoft sites and select traffic", 0.86, 1.05, 1.1],
    ["Syndicated search partners", 0.14, 0.7, 0.55],
];

function campaignDay(c, date) {
    const dow = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    const key = `${c.name}|${date}`;
    const growth = 1 + dayIndex(date) * 0.0001;
    const spend = DAILY_SPEND * c.share * growth * wiggle(`s|${key}`, 0.12) * WEEKDAY_DEMAND[dow];
    const clicks = spend / (c.cpc * wiggle(`c|${key}`, 0.07));
    const impressions = clicks / (c.ctr * wiggle(`i|${key}`, 0.06));
    const conversions = clicks * c.cr * wiggle(`v|${key}`, 0.2);
    const revenue = conversions * c.aov * wiggle(`a|${key}`, 0.1);
    return {
        ad_spend: Math.round(spend * 100) / 100,
        impressions: Math.round(impressions),
        clicks: Math.round(clicks),
        conversions: Math.round(conversions * 100) / 100,
        conversion_value: Math.round(revenue * 100) / 100,
    };
}

function withRatios(row) {
    const { impressions, clicks, ad_spend, conversions, conversion_value } = row;
    return {
        ...row,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? ad_spend / clicks : 0,
        cpm: impressions > 0 ? (ad_spend / impressions) * 1000 : 0,
        roas: ad_spend > 0 ? conversion_value / ad_spend : 0,
        cpa: conversions > 0 ? ad_spend / conversions : 0,
    };
}

const KEYS = ["ad_spend", "impressions", "clicks", "conversions", "conversion_value"];
const sum = (rows) => Object.fromEntries(KEYS.map((k) => [k, rows.reduce((s, r) => s + (r[k] || 0), 0)]));

export function getDemoBingDashboardForRange(startDate, endDate) {
    const days = eachDayInclusive(startDate, endDate);
    const perCampaign = CAMPAIGNS.map((c) => days.map((d) => campaignDay(c, d)));

    const metrics_by_date = days.map((date, i) => {
        const t = sum(perCampaign.map((l) => l[i]));
        const { ctr, cpc, cpm } = withRatios(t);
        return { date, ...t, ctr, cpc, cpm };
    });

    const totals = perCampaign.map((l) => sum(l));
    const top_campaigns = CAMPAIGNS.map((c, ci) => {
        const t = withRatios(totals[ci]);
        return {
            campaign_name: c.name,
            clicks: t.clicks,
            impressions: t.impressions,
            conversions: t.conversions,
            ad_spend: t.ad_spend,
            conversion_value: t.conversion_value,
            roas: t.roas,
            ctr: t.ctr,
        };
    }).sort((a, b) => b.clicks - a.clicks);

    const campaigns_by_date = [];
    CAMPAIGNS.forEach((c, ci) =>
        days.forEach((date, i) => {
            const r = perCampaign[ci][i];
            campaigns_by_date.push({ date, campaign_name: c.name, ad_spend: r.ad_spend, clicks: r.clicks, impressions: r.impressions, conversions: r.conversions });
        })
    );

    const search_terms = [];
    CAMPAIGNS.forEach((c, ci) => {
        const list = TERMS[c.name];
        if (!list) return;
        const camp = withRatios(totals[ci]);
        const aov = camp.conversions > 0 ? camp.conversion_value / camp.conversions : 0;
        list.forEach(([term, weight, convFactor, cpcFactor]) => {
            const spend = camp.ad_spend * TERM_COVERAGE * weight * wiggle(`t|${term}`, 0.12);
            const clicks = spend / (c.cpc * cpcFactor);
            const impressions = clicks / (c.ctr * wiggle(`ti|${term}`, 0.15));
            const conversions = clicks * c.cr * convFactor * wiggle(`tv|${term}`, 0.1);
            const revenue = conversions * aov;
            search_terms.push({
                search_term: term,
                campaign_name: c.name,
                spend: Math.round(spend * 100) / 100,
                clicks: Math.round(clicks),
                impressions: Math.round(impressions),
                conversions: Math.round(conversions * 100) / 100,
                revenue: Math.round(revenue * 100) / 100,
                roas: spend > 0 ? revenue / spend : 0,
            });
        });
    });
    search_terms.sort((a, b) => b.spend - a.spend);

    const acc = sum(metrics_by_date);
    const split = (defs) => {
        const spendW = defs.reduce((s, d) => s + d[1], 0);
        const revNorm = defs.reduce((s, d) => s + d[1] * d[2], 0);
        const ctrNorm = defs.reduce((s, d) => s + d[1] * d[3], 0);
        const accCtr = acc.impressions > 0 ? acc.clicks / acc.impressions : 0;
        return defs
            .map(([name, w, roasF, ctrF]) => {
                const ad_spend = acc.ad_spend * (w / spendW);
                const conversion_value = (acc.conversion_value * (w * roasF)) / revNorm;
                const ctr = accCtr * (ctrF / (ctrNorm / spendW));
                const clicks = acc.clicks * (w / spendW);
                const impressions = clicks / ctr;
                const conversions = acc.conversion_value > 0 ? (conversion_value / acc.conversion_value) * acc.conversions : 0;
                return {
                    name,
                    ad_spend: Math.round(ad_spend * 100) / 100,
                    clicks: Math.round(clicks),
                    impressions: Math.round(impressions),
                    conversions: Math.round(conversions * 100) / 100,
                    conversion_value: Math.round(conversion_value * 100) / 100,
                    roas: ad_spend > 0 ? conversion_value / ad_spend : 0,
                    ctr,
                    cpc: clicks > 0 ? ad_spend / clicks : 0,
                };
            })
            .sort((a, b) => b.ad_spend - a.ad_spend);
    };

    // Impression-weighted account share, the same way the live fetcher builds it (percent values)
    const impTotal = totals.reduce((s, t) => s + t.impressions, 0) || 1;
    const weighted = (key) => (CAMPAIGNS.reduce((s, c, i) => s + c[key] * totals[i].impressions, 0) / impTotal) * 100;

    return {
        metrics_by_date,
        top_campaigns,
        campaigns_by_date,
        search_terms,
        device_split: split(DEVICES),
        network_split: split(NETWORKS),
        impression_share: { impression_share: weighted("is"), is_lost_budget: weighted("lostBudget"), is_lost_rank: weighted("lostRank") },
        warnings: [],
    };
}
