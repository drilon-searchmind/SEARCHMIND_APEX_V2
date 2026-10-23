/**
 * Deterministic demo data for the Google Ads PPC dashboard (illustrative, not real customer data).
 * Everything is built bottom-up from per-campaign daily rows, so daily totals, campaign totals,
 * brand/generic split and search terms stay consistent with each other for any date range.
 */

import { eachDayInclusive, numHash } from "@/lib/demoAdMetrics";

const ORIGIN = Date.UTC(2025, 0, 1);

function dayIndex(date) {
    const t = new Date(`${date}T12:00:00.000Z`).getTime();
    return Math.max(0, Math.floor((t - ORIGIN) / 86400000));
}

/** 0..1 from a string seed */
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

/** 1 +/- spread, seeded */
function wiggle(seed, spread) {
    return 1 + (rnd(seed) - 0.5) * 2 * spread;
}

/** Mon..Sun demand shape, indexed by Date#getUTCDay() (0 = Sunday) */
const WEEKDAY_DEMAND = [1.12, 0.98, 1.04, 1.02, 0.97, 0.86, 0.92];
const WEEKDAY_ROAS = [1.06, 0.99, 1.02, 1.01, 0.98, 0.94, 0.97];

const DAILY_SPEND = 5200;

const CAMPAIGNS = [
    { name: "Brand - Search", share: 0.09, roas: 10.5, cpc: 2.1, ctr: 0.17, cr: 0.085, is: 0.86, lostBudget: 0.01, lostRank: 0.13 },
    { name: "Generic - Sofas", share: 0.2, roas: 4.3, cpc: 5.6, ctr: 0.05, cr: 0.021, is: 0.54, lostBudget: 0.27, lostRank: 0.19 },
    { name: "Generic - Lighting", share: 0.11, roas: 3.6, cpc: 3.4, ctr: 0.061, cr: 0.024, is: 0.61, lostBudget: 0.09, lostRank: 0.3 },
    { name: "Generic - Tables and Chairs", share: 0.14, roas: 4.9, cpc: 4.8, ctr: 0.054, cr: 0.026, is: 0.57, lostBudget: 0.22, lostRank: 0.21 },
    { name: "Competitor - Search", share: 0.06, roas: 1.7, cpc: 4.1, ctr: 0.031, cr: 0.011, is: 0.38, lostBudget: 0.04, lostRank: 0.58 },
    { name: "Shopping - All products", share: 0.16, roas: 5.2, cpc: 2.9, ctr: 0.021, cr: 0.019, is: 0.66, lostBudget: 0.12, lostRank: 0.22 },
    { name: "PMax - Best sellers", share: 0.17, roas: 6.1, cpc: 3.1, ctr: 0.018, cr: 0.026, is: 0.7, lostBudget: 0.19, lostRank: 0.11 },
    { name: "PMax - New arrivals", share: 0.07, roas: 2.4, cpc: 3.6, ctr: 0.015, cr: 0.012, is: 0.52, lostBudget: 0.05, lostRank: 0.43 },
];

/**
 * Search terms per campaign: weight = share of the campaign's term spend,
 * conv/cpc = multipliers against the campaign average (0 conversions = money with no return).
 */
const TERMS = {
    "Brand - Search": [
        ["dims studio", 0.46, 1.2, 0.8],
        ["dims", 0.22, 1.1, 0.9],
        ["dims møbler", 0.16, 1, 1],
        ["dims studio tilbud", 0.08, 1.3, 1],
        ["dims studio anmeldelser", 0.05, 0.4, 0.9],
        ["dims studio kundeservice", 0.03, 0, 0.8],
    ],
    "Generic - Sofas": [
        ["sofa", 0.17, 0.9, 1.15],
        ["3 personers sofa", 0.14, 1.25, 1],
        ["hjørnesofa", 0.12, 1.15, 1.05],
        ["velour sofa", 0.1, 1.4, 0.95],
        ["chaiselong sofa", 0.09, 1.1, 1],
        ["sofa tilbud", 0.09, 0.8, 1.05],
        ["billige sofaer", 0.1, 0.25, 1.1],
        ["gratis fragt sofa", 0.07, 0.3, 1],
        ["sofa leasing", 0.06, 0, 1.1],
        ["sofa brugt", 0.06, 0, 0.9],
    ],
    "Generic - Lighting": [
        ["design lampe", 0.2, 1.2, 1],
        ["pendel lampe", 0.18, 1.1, 1],
        ["loftslampe", 0.14, 1, 1.05],
        ["gulvlampe", 0.14, 1.15, 0.95],
        ["lampe til stue", 0.12, 0.9, 1],
        ["bordlampe messing", 0.08, 1.3, 0.9],
        ["diy lampe", 0.08, 0, 0.8],
        ["lampe reparation", 0.06, 0, 0.8],
    ],
    "Generic - Tables and Chairs": [
        ["spisebord", 0.18, 1, 1.1],
        ["spisebordsstole", 0.15, 1.2, 1],
        ["egetræ spisebord", 0.13, 1.35, 1],
        ["plankebord", 0.1, 1.2, 0.95],
        ["runde spisebord", 0.1, 1.05, 1],
        ["barstole", 0.12, 0.9, 1.05],
        ["stole billigt", 0.12, 0.2, 1.1],
        ["kontorstol gratis", 0.1, 0, 0.9],
    ],
    "Competitor - Search": [
        ["ikea sofa", 0.28, 0.2, 1.1],
        ["bolia sofa", 0.22, 1.5, 1],
        ["jysk spisebord", 0.18, 0, 0.9],
        ["hay lampe", 0.18, 1.3, 1],
        ["boconcept tilbud", 0.14, 0.3, 1],
    ],
    "Shopping - All products": [
        ["nordiske møbler", 0.2, 1.1, 1],
        ["møbler online", 0.2, 0.85, 1.1],
        ["skandinavisk design", 0.14, 1.2, 1],
        ["sidebord marmor", 0.14, 1.3, 0.95],
        ["reol egetræ", 0.12, 1.15, 1],
        ["sengebord", 0.1, 0.9, 1],
        ["puf til stue", 0.1, 0.1, 0.9],
    ],
};

const TERM_COVERAGE = 0.68;

function campaignDay(c, date, day) {
    const dow = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    const growth = 1 + dayIndex(date) * 0.00012;
    const key = `${c.name}|${date}`;
    const ad_spend = DAILY_SPEND * c.share * growth * wiggle(`s|${key}`, 0.12) * (0.9 + (WEEKDAY_DEMAND[dow] - 1) * 0.6);
    const clicks = (ad_spend / (c.cpc * wiggle(`c|${key}`, 0.07))) * 1;
    const impressions = clicks / (c.ctr * wiggle(`i|${key}`, 0.06));
    const conversions = clicks * c.cr * wiggle(`v|${key}`, 0.18) * WEEKDAY_DEMAND[dow];
    const roasDay = c.roas * wiggle(`r|${key}`, 0.1) * WEEKDAY_ROAS[dow] * (1 + dayIndex(date) * 0.00005);
    const conversions_value = ad_spend * roasDay;
    return {
        campaign_name: c.name,
        date,
        ad_spend: Math.round(ad_spend),
        clicks: Math.round(clicks),
        impressions: Math.round(impressions),
        conversions: Math.round(conversions * 10) / 10,
        conversions_value: Math.round(conversions_value),
        impression_share: Math.min(0.97, Math.max(0.2, c.is * wiggle(`is|${key}`, 0.05))),
        is_lost_budget: Math.max(0, c.lostBudget * wiggle(`lb|${key}`, 0.2)),
        is_lost_rank: Math.max(0, c.lostRank * wiggle(`lr|${key}`, 0.15)),
        _idx: day,
    };
}

function withRatios(row) {
    const { clicks, impressions, conversions, conversions_value, ad_spend } = row;
    return {
        ...row,
        roas: ad_spend > 0 ? conversions_value / ad_spend : 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? ad_spend / clicks : 0,
        conv_rate: clicks > 0 ? conversions / clicks : 0,
        cpa: conversions > 0 ? ad_spend / conversions : 0,
    };
}

function sum(rows, key) {
    return rows.reduce((s, r) => s + (r[key] || 0), 0);
}

function classify(name) {
    const n = name.toLowerCase();
    if (/\bbrand\b/.test(n)) return "brand";
    if (/generic/.test(n)) return "generic";
    return "other";
}

export function getDemoPpcDashboardForRange(startDate, endDate) {
    const days = eachDayInclusive(startDate, endDate);
    const perCampaignDaily = CAMPAIGNS.map((c) => days.map((d, i) => campaignDay(c, d, i)));
    const allRows = perCampaignDaily.flat();

    const metrics_by_date = days.map((date, i) => {
        const rows = perCampaignDaily.map((list) => list[i]);
        const imp = sum(rows, "impressions") || 1;
        const weighted = (key) => rows.reduce((s, r) => s + r[key] * r.impressions, 0) / imp;
        return withRatios({
            date,
            clicks: sum(rows, "clicks"),
            impressions: sum(rows, "impressions"),
            conversions: Math.round(sum(rows, "conversions") * 10) / 10,
            conversions_value: sum(rows, "conversions_value"),
            ad_spend: sum(rows, "ad_spend"),
            impression_share: weighted("impression_share"),
            is_lost_budget: weighted("is_lost_budget"),
            is_lost_rank: weighted("is_lost_rank"),
        });
    });

    const campaigns_performance = CAMPAIGNS.map((c, ci) => {
        const rows = perCampaignDaily[ci];
        const imp = sum(rows, "impressions") || 1;
        return withRatios({
            campaign_name: c.name,
            clicks: sum(rows, "clicks"),
            impressions: sum(rows, "impressions"),
            conversions: Math.round(sum(rows, "conversions") * 10) / 10,
            conversions_value: sum(rows, "conversions_value"),
            ad_spend: sum(rows, "ad_spend"),
            impression_share: rows.reduce((s, r) => s + r.impression_share * r.impressions, 0) / imp,
        });
    });

    const top_campaigns = [...campaigns_performance]
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 5)
        .map((c) => ({ campaign_name: c.campaign_name, clicks: c.clicks, impressions: c.impressions, ctr: c.ctr }));

    const campaigns_by_date = allRows.map((r) => {
        const { conversions_value, impression_share, is_lost_budget, is_lost_rank, _idx, ...live } = r;
        return {
            ...live,
            ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
            conv_rate: r.clicks > 0 ? r.conversions / r.clicks : 0,
            cpc: r.clicks > 0 ? r.ad_spend / r.clicks : 0,
        };
    });

    const search_terms = [];
    CAMPAIGNS.forEach((c, ci) => {
        const list = TERMS[c.name];
        if (!list) return;
        const camp = campaigns_performance[ci];
        const aov = camp.conversions > 0 ? camp.conversions_value / camp.conversions : 0;
        list.forEach(([term, weight, convFactor, cpcFactor]) => {
            const noise = wiggle(`t|${term}`, 0.12);
            const spend = camp.ad_spend * TERM_COVERAGE * weight * noise;
            const clicks = spend / (c.cpc * cpcFactor);
            const impressions = clicks / (c.ctr * wiggle(`ti|${term}`, 0.15));
            const conversions = clicks * c.cr * convFactor * wiggle(`tv|${term}`, 0.1);
            const revenue = conversions * aov;
            search_terms.push({
                search_term: term,
                campaign_name: c.name,
                spend: Math.round(spend),
                clicks: Math.round(clicks),
                impressions: Math.round(impressions),
                conversions: Math.round(conversions * 10) / 10,
                revenue: Math.round(revenue),
                roas: spend > 0 ? revenue / spend : 0,
            });
        });
    });

    const brand_generic_spend_by_date = days.map((date, i) => {
        const out = { date, brand_spend: 0, generic_spend: 0, other_spend: 0 };
        CAMPAIGNS.forEach((c, ci) => {
            out[`${classify(c.name)}_spend`] += perCampaignDaily[ci][i].ad_spend;
        });
        return out;
    });

    return {
        metrics_by_date,
        top_campaigns,
        campaigns_by_date,
        campaigns_performance,
        search_terms,
        brand_generic_spend_by_date,
        impression_share_daily: metrics_by_date.map((d) => ({
            date: d.date,
            impression_share: d.impression_share,
            is_lost_budget: d.is_lost_budget,
            is_lost_rank: d.is_lost_rank,
        })),
        account_summary: { new_customer_ratio: 58, recurring_customer_ratio: 42 },
    };
}
