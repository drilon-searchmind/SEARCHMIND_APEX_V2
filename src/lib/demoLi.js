/**
 * Deterministic demo data for the LinkedIn Ads dashboard (illustrative, not real customer data).
 * It returns exactly the fields fetchLinkedInDashboardMetrics returns with extras on: daily account
 * metrics, campaign and ad totals (with Lead Gen Form opens and leads), reach and demographic pivots
 * (job function, seniority, company size, industry). Campaigns are the source, so every part agrees.
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

/** Indexed by Date#getUTCDay() (0 = Sunday). B2B delivery and response fall off at weekends. */
const WEEKDAY_DEMAND = [0.42, 1.14, 1.16, 1.12, 1.08, 0.9, 0.38];

const DAILY_SPEND = 2400;

/** cpm in kr. per 1.000 impressions, ctr = landing page click rate, open = form opens per click, submit = leads per open, web = web conversions per click */
const CAMPAIGNS = [
    { name: "Lead Gen - Whitepaper", share: 0.26, cpm: 410, ctr: 0.0062, open: 0.55, submit: 0.34, web: 0 },
    { name: "Lead Gen - Webinar", share: 0.17, cpm: 380, ctr: 0.0071, open: 0.5, submit: 0.41, web: 0 },
    { name: "Website - Demo requests", share: 0.2, cpm: 460, ctr: 0.0049, open: 0, submit: 0, web: 0.042 },
    { name: "Awareness - Thought leadership", share: 0.15, cpm: 210, ctr: 0.0028, open: 0, submit: 0, web: 0.006 },
    { name: "Retargeting - Site visitors", share: 0.1, cpm: 340, ctr: 0.0112, open: 0.38, submit: 0.3, web: 0.03 },
    { name: "ABM - Target accounts", share: 0.12, cpm: 560, ctr: 0.0054, open: 0.42, submit: 0.22, web: 0.018 },
];

/** [ad name, format, campaign index, spend weight within campaign, CTR factor, form factor] */
const ADS = [
    ["Whitepaper - Cover image", "Image / Document", 0, 0.4, 1.0, 1.0],
    ["Whitepaper - Customer quote", "Image / Document", 0, 0.3, 1.2, 1.1],
    ["Whitepaper - Lead form", "Lead Gen Form", 0, 0.3, 0.9, 1.25],
    ["Webinar - Speaker video", "Video / UGC", 1, 0.45, 0.85, 1.0],
    ["Webinar - Agenda carousel", "Image / Document", 1, 0.3, 1.1, 0.95],
    ["Webinar - Lead form", "Lead Gen Form", 1, 0.25, 1.0, 1.3],
    ["Demo - Product walkthrough", "Video / UGC", 2, 0.5, 0.95, 1.0],
    ["Demo - ROI numbers", "Image / Document", 2, 0.3, 1.25, 1.0],
    ["Demo - Sponsored article", "Sponsored", 2, 0.2, 0.7, 0.8],
    ["Thought leadership - CEO post", "Sponsored", 3, 0.6, 0.9, 1.0],
    ["Thought leadership - Report teaser", "Image / Document", 3, 0.4, 1.15, 1.0],
    ["Retargeting - Case study", "Image / Document", 4, 0.55, 1.1, 1.0],
    ["Retargeting - Lead form", "Lead Gen Form", 4, 0.45, 0.95, 1.2],
    ["ABM - Account list message", "Sponsored", 5, 1, 1.0, 1.0],
];

function campaignDay(c, date) {
    const dow = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    const key = `${c.name}|${date}`;
    const growth = 1 + dayIndex(date) * 0.0001;
    const spend = DAILY_SPEND * c.share * growth * wiggle(`s|${key}`, 0.12) * WEEKDAY_DEMAND[dow];
    const impressions = (spend / (c.cpm * wiggle(`m|${key}`, 0.08))) * 1000;
    const clicks = impressions * c.ctr * wiggle(`k|${key}`, 0.1);
    const formOpens = clicks * c.open * wiggle(`o|${key}`, 0.12);
    const leads = formOpens * c.submit * wiggle(`l|${key}`, 0.2);
    const conversions = clicks * c.web * wiggle(`w|${key}`, 0.25);
    return {
        ad_spend: Math.round(spend * 100) / 100,
        impressions: Math.round(impressions),
        clicks: Math.round(clicks),
        lead_form_opens: Math.round(formOpens),
        leads: Math.round(leads),
        conversions: Math.round(conversions * 10) / 10,
    };
}

function ratios(row) {
    const { impressions, clicks, ad_spend } = row;
    return {
        ...row,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? ad_spend / clicks : 0,
        cpm: impressions > 0 ? (ad_spend / impressions) * 1000 : 0,
    };
}

const KEYS = ["ad_spend", "impressions", "clicks", "lead_form_opens", "leads", "conversions"];
const sum = (rows) => Object.fromEntries(KEYS.map((k) => [k, rows.reduce((s, r) => s + (r[k] || 0), 0)]));

/** [name, impression weight, CTR factor, lead factor, cost factor] */
const FUNCTIONS = [
    ["Sales", 0.12, 1.1, 1.3, 1.1], ["Marketing", 0.14, 1.2, 1.2, 1.0], ["Business Development", 0.09, 1.05, 1.1, 1.0],
    ["Operations", 0.09, 0.9, 0.9, 0.95], ["Information Technology", 0.1, 0.95, 0.85, 1.0], ["Finance", 0.07, 0.8, 0.8, 1.05],
    ["Engineering", 0.08, 0.85, 0.7, 0.95], ["Consulting", 0.06, 1.0, 1.0, 1.0], ["Human Resources", 0.05, 0.9, 0.7, 0.9],
    ["Entrepreneurship", 0.05, 1.15, 1.1, 0.9], ["Program and Project Management", 0.05, 0.9, 0.85, 1.0], ["Education", 0.04, 0.7, 0.4, 0.8],
    ["Healthcare Services", 0.03, 0.8, 0.5, 0.85], ["Product Management", 0.03, 1.0, 1.0, 1.0],
];
const SENIORITY = [
    ["Manager", 0.26, 1.05, 1.1, 1.0], ["Senior", 0.24, 1.0, 0.95, 0.95], ["Director", 0.14, 1.1, 1.3, 1.15], ["Entry", 0.13, 0.85, 0.6, 0.85],
    ["CXO", 0.09, 1.0, 1.15, 1.4], ["VP", 0.06, 1.05, 1.2, 1.3], ["Owner", 0.05, 1.2, 1.2, 1.05], ["Partner", 0.02, 1.0, 1.0, 1.3], ["Training", 0.01, 0.6, 0.3, 0.7],
];
const COMPANY_SIZE = [
    ["1 to 10 employees", 0.08, 0.9, 0.8, 0.85], ["11 to 50 employees", 0.16, 1.1, 1.15, 0.95], ["51 to 200 employees", 0.24, 1.15, 1.25, 1.0],
    ["201 to 500 employees", 0.18, 1.0, 1.0, 1.0], ["501 to 1.000 employees", 0.12, 0.95, 0.9, 1.05], ["1.001 to 5.000 employees", 0.1, 0.9, 0.85, 1.1],
    ["5.001 to 10.000 employees", 0.04, 0.85, 0.7, 1.15], ["10.001 or more employees", 0.08, 0.8, 0.65, 1.2],
];
const INDUSTRIES = [
    ["Software Development", 0.14, 1.1, 1.2, 1.1], ["IT Services and IT Consulting", 0.12, 1.05, 1.1, 1.0], ["Marketing Services", 0.08, 1.2, 1.15, 1.0],
    ["Business Consulting and Services", 0.08, 1.0, 1.0, 1.05], ["Financial Services", 0.07, 0.85, 0.9, 1.2], ["Retail", 0.06, 0.95, 0.8, 0.9],
    ["Manufacturing", 0.06, 0.8, 0.75, 0.95], ["Wholesale", 0.05, 0.9, 0.9, 0.9], ["Higher Education", 0.04, 0.7, 0.4, 0.8],
    ["Advertising Services", 0.05, 1.15, 1.1, 1.0], ["Hospitals and Health Care", 0.04, 0.75, 0.5, 0.9], ["Construction", 0.04, 0.8, 0.7, 0.9],
    ["Telecommunications", 0.03, 0.9, 0.9, 1.1], ["Insurance", 0.03, 0.85, 0.8, 1.15], ["Real Estate", 0.03, 0.85, 0.7, 0.85],
];

/** Split account totals over categories so impressions, clicks, spend and leads add up to the account. */
function splitDemographic(defs, acc) {
    const impW = defs.reduce((s, d) => s + d[1], 0);
    const clickNorm = defs.reduce((s, d) => s + d[1] * d[2], 0);
    const leadNorm = defs.reduce((s, d) => s + d[1] * d[3], 0);
    const costNorm = defs.reduce((s, d) => s + d[1] * d[4], 0);
    return defs
        .map(([name, w, ctrF, leadF, costF]) => {
            const impressions = Math.round(acc.impressions * (w / impW));
            const clicks = Math.round((acc.clicks * (w * ctrF)) / clickNorm);
            const leads = Math.round((acc.leads * (w * leadF)) / leadNorm);
            const spend = (acc.ad_spend * (w * costF)) / costNorm;
            return {
                id: name,
                name,
                impressions,
                clicks,
                ad_spend: Math.round(spend * 100) / 100,
                leads,
                conversions: Math.round(((acc.conversions * (w * ctrF)) / clickNorm) * 10) / 10,
                ctr: impressions > 0 ? clicks / impressions : 0,
            };
        })
        .sort((a, b) => b.impressions - a.impressions);
}

export function getDemoLiDashboardForRange(startDate, endDate) {
    const days = eachDayInclusive(startDate, endDate);
    const perCampaign = CAMPAIGNS.map((c) => days.map((d) => campaignDay(c, d)));

    const metrics_by_date = days.map((date, i) => ({
        date,
        ...ratios(sum(perCampaign.map((l) => l[i]))),
        conversion_value: 0,
        roas: 0,
        aov: 0,
    }));

    const totals = perCampaign.map((l) => sum(l));
    const top_campaigns = CAMPAIGNS.map((c, ci) => {
        const t = ratios(totals[ci]);
        return { campaign_id: `demo-li-${ci + 1}`, campaign_name: c.name, ...t };
    }).sort((a, b) => b.clicks - a.clicks);

    const top_ads = ADS.map(([name, format, ci, weight, ctrF, formF], i) => {
        const camp = totals[ci];
        const spend = camp.ad_spend * weight * wiggle(`ad|${name}`, 0.08);
        const impressions = camp.impressions * weight * wiggle(`ai|${name}`, 0.08);
        const clicks = impressions * (camp.clicks / Math.max(camp.impressions, 1)) * ctrF;
        const opens = clicks * (camp.lead_form_opens / Math.max(camp.clicks, 1)) * formF;
        const leads = opens * (camp.leads / Math.max(camp.lead_form_opens, 1)) * wiggle(`al|${name}`, 0.15);
        return {
            creative_id: String(4000 + i),
            creative_name: name,
            format,
            campaign_id: `demo-li-${ci + 1}`,
            campaign_name: CAMPAIGNS[ci].name,
            ad_spend: Math.round(spend * 100) / 100,
            impressions: Math.round(impressions),
            clicks: Math.round(clicks),
            lead_form_opens: Math.round(opens),
            leads: Math.round(leads),
            conversions: Math.round(clicks * CAMPAIGNS[ci].web * 10) / 10,
            ctr: impressions > 0 ? clicks / impressions : 0,
        };
    });

    const acc = sum(metrics_by_date);
    const reach = Math.round(acc.impressions / 1.9);

    return {
        metrics_by_date,
        top_campaigns,
        top_ads,
        campaigns_by_date: [],
        reach: { reach, total_engagements: Math.round(acc.clicks * 1.65), frequency: acc.impressions / reach },
        demographics: {
            job_function: splitDemographic(FUNCTIONS, acc),
            seniority: splitDemographic(SENIORITY, acc),
            company_size: splitDemographic(COMPANY_SIZE, acc),
            industry: splitDemographic(INDUSTRIES, acc),
        },
        warnings: [],
    };
}
