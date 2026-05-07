/**
 * Deterministic demo metrics for any [startDate, endDate] (ad dashboards).
 */

import { APEX_RADAR_CHANNEL_GOOGLE_ADS } from "@/lib/apexRadarChannels";
import { getFacebookApexRadarSettings, getGoogleApexRadarSettings } from "@/lib/apexRadarCustomerSettings";
import {
    buildOverviewRowFromRollups,
    computeDateWindows,
    computeLog10WeeklyFloors,
    computeSpendDayOverDayFromDaily,
    getUtcCalendarSpendDodRange,
    maxIso,
    minIso,
    rollupDaily,
} from "@/lib/apexRadarFacebookOverview";

export function eachDayInclusive(startDate, endDate) {
    const out = [];
    const d = new Date(`${startDate}T12:00:00.000Z`);
    const end = new Date(`${endDate}T12:00:00.000Z`);
    while (d <= end) {
        out.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
}

export function numHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    return Math.abs(h);
}

/** Aligns with demo merged daily pool: gradual growth from 2025-01-01 so comparisons vs prior periods trend up. */
function dayIndexFrom20250101(dateStr) {
    const t = new Date(`${dateStr}T12:00:00.000Z`).getTime();
    const origin = Date.UTC(2025, 0, 1);
    return Math.max(0, Math.floor((t - origin) / 86400000));
}

/** Per-date 0.85–1.12 multiplier so series aren’t perfectly aligned (different % vs prior period per metric). */
function dateWiggle(date, salt) {
    const x = numHash(`${salt}-${date}`);
    return 0.85 + 0.27 * (x % 1000) / 1000;
}

function googlePpcRow(date) {
    const di = dayIndexFrom20250101(date);
    const revScale = 1 + di * 0.000065;
    const spendScale = 1 + di * 0.00004;
    const wRev = dateWiggle(date, "gcr-v");
    const wSpend = dateWiggle(date, "gcs-v");
    const h = numHash(`ppc-${date}`);
    const clicks = Math.round((200 + (h % 50)) * (1 + di * 0.00008) * dateWiggle(date, "gclk"));
    const impressions = Math.round((8000 + (h % 1000)) * (1 + di * 0.00006) * dateWiggle(date, "gimp"));
    const conversions = Math.round((12 + (h % 8)) * (1 + di * 0.0001) * dateWiggle(date, "gconv"));
    const conversions_value = Math.round((3800 + (h % 500)) * revScale * wRev);
    const ad_spend = Math.round((1150 + (h % 160)) * spendScale * wSpend);
    return {
        date,
        clicks,
        impressions,
        conversions,
        conversions_value,
        ad_spend,
        roas: ad_spend > 0 ? conversions_value / ad_spend : 0,
        aov: conversions > 0 ? conversions_value / conversions : 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? ad_spend / clicks : 0,
        conv_rate: clicks > 0 ? conversions / clicks : 0,
    };
}

function facebookRow(date) {
    const di = dayIndexFrom20250101(date);
    const revScale = 1 + di * 0.000065;
    const spendScale = 1 + di * 0.00004;
    const wRev = dateWiggle(date, "fcr-v");
    const wSpend = dateWiggle(date, "fcs-v");
    const h = numHash(`fb-${date}`);
    const clicks = Math.round((300 + (h % 40)) * (1 + di * 0.00008) * dateWiggle(date, "fclk"));
    const impressions = Math.round((12000 + (h % 800)) * (1 + di * 0.00006) * dateWiggle(date, "fimp"));
    const conversions = Math.round((18 + (h % 10)) * (1 + di * 0.0001) * dateWiggle(date, "fconv"));
    const conversion_value = Math.round((5200 + (h % 400)) * revScale * wRev);
    const ad_spend = Math.round((950 + (h % 120)) * spendScale * wSpend);
    return {
        date,
        clicks,
        impressions,
        conversions,
        conversion_value,
        ad_spend,
        roas: ad_spend > 0 ? conversion_value / ad_spend : 0,
        aov: conversions > 0 ? conversion_value / conversions : 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? ad_spend / clicks : 0,
        cpm: impressions > 0 ? (ad_spend / impressions) * 1000 : 0,
        conv_rate: clicks > 0 ? conversions / clicks : 0,
        purchase_roas: [{ value: ad_spend > 0 ? conversion_value / ad_spend : 0 }],
        actions: [{ action_type: "offsite_conversion.purchase", value: String(conversions) }],
    };
}

function pinterestRow(date) {
    const di = dayIndexFrom20250101(date);
    const revScale = 1 + di * 0.000065;
    const spendScale = 1 + di * 0.00004;
    const wRev = dateWiggle(date, "pcr-v");
    const wSpend = dateWiggle(date, "pcs-v");
    const h = numHash(`pin-${date}`);
    const ad_spend = Math.round((520 + (h % 65)) * spendScale * wSpend);
    const impressions = Math.round((110000 + (h % 5000)) * (1 + di * 0.00005) * dateWiggle(date, "pimp"));
    const clicks = Math.round((2200 + (h % 200)) * (1 + di * 0.00007) * dateWiggle(date, "pclk"));
    const conversions = Math.round((14 + (h % 6)) * (1 + di * 0.0001) * dateWiggle(date, "pconv"));
    const conversion_value = Math.round((1850 + (h % 200)) * revScale * wRev);
    return {
        date,
        conversion_value,
        ad_spend,
        conversions,
        impressions,
        clicks,
        saves: 180 + (h % 30),
        roas: ad_spend > 0 ? conversion_value / ad_spend : 0,
        aov: conversions > 0 ? conversion_value / conversions : 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? ad_spend / clicks : 0,
        cpm: impressions > 0 ? (ad_spend / impressions) * 1000 : 0,
    };
}

export function getDemoGooglePpcDashboardForRange(startDate, endDate) {
    const days = eachDayInclusive(startDate, endDate);
    return {
        metrics_by_date: days.map(googlePpcRow),
        top_campaigns: [
            { campaign_name: "Search — Brand", clicks: 5000, impressions: 120000, ctr: 0.04 },
            { campaign_name: "PMax — Demo", clicks: 3200, impressions: 90000, ctr: 0.035 },
        ],
        campaigns_by_date: [],
    };
}

export function getDemoFacebookCampaignInsightsForRange(startDate, endDate) {
    const days = eachDayInclusive(startDate, endDate);
    return {
        metrics_by_date: days.map(facebookRow),
        top_campaigns: [
            {
                campaign_name: "Prospecting — Demo",
                clicks: 4000,
                impressions: 95000,
                conversions: 120,
                ctr: 0.042,
            },
        ],
        campaigns_by_date: [],
    };
}

export function getDemoPinterestDashboardForRange(startDate, endDate) {
    const days = eachDayInclusive(startDate, endDate);
    return {
        metrics_by_date: days.map(pinterestRow),
        top_campaigns: [
            {
                campaign_name: "Pinterest — Awareness",
                clicks: 2100,
                impressions: 110000,
                ctr: 0.019,
                saves: 180,
            },
        ],
        campaigns_by_date: [],
    };
}

function snapchatRow(date) {
    const di = dayIndexFrom20250101(date);
    const revScale = 1 + di * 0.000065;
    const spendScale = 1 + di * 0.00004;
    const wRev = dateWiggle(date, "scr-v");
    const wSpend = dateWiggle(date, "scs-v");
    const h = numHash(`snap-${date}`);
    const impressions = Math.round((88000 + (h % 4200)) * (1 + di * 0.00006) * dateWiggle(date, "simp"));
    const clicks = Math.round((1900 + (h % 180)) * (1 + di * 0.00008) * dateWiggle(date, "sclk"));
    const ad_spend = Math.round((480 + (h % 72)) * spendScale * wSpend);
    const conversions = Math.round((11 + (h % 6)) * (1 + di * 0.00008) * dateWiggle(date, "sconv"));
    const conversion_value = Math.round((1650 + (h % 180)) * revScale * wRev);
    const saves = Math.round(clicks * 0.92);
    const purchases = conversions;
    const purchase_value = conversion_value;
    const adds_to_cart = Math.round((12 + (h % 40)) * (1 + di * 0.00005) * dateWiggle(date, "scart"));
    const purchase_roas = ad_spend > 0 ? purchase_value / ad_spend : 0;
    return {
        date,
        conversion_value,
        purchase_value,
        ad_spend,
        conversions,
        purchases,
        adds_to_cart,
        impressions,
        clicks,
        saves,
        roas: purchase_roas,
        purchase_roas,
        aov: conversions > 0 ? conversion_value / conversions : 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? ad_spend / clicks : 0,
        cpm: impressions > 0 ? (ad_spend / impressions) * 1000 : 0,
    };
}

export function getDemoSnapchatDashboardForRange(startDate, endDate) {
    const days = eachDayInclusive(startDate, endDate);
    return {
        metrics_by_date: days.map(snapchatRow),
        top_campaigns: [
            {
                campaign_name: "Snapchat — Reach",
                clicks: 1780,
                impressions: 92000,
                ctr: 0.019,
                saves: 1620,
                ad_spend: 4200.5,
                purchases: 38,
                adds_to_cart: 102,
                purchase_value: 15230.75,
            },
            {
                campaign_name: "Snapchat — Conversions demo",
                clicks: 1120,
                impressions: 64000,
                ctr: 0.0175,
                saves: 1010,
                ad_spend: 2890,
                purchases: 24,
                adds_to_cart: 68,
                purchase_value: 9800,
            },
        ],
        campaigns_by_date: [],
    };
}

function redditRow(date) {
    const di = dayIndexFrom20250101(date);
    const spendScale = 1 + di * 0.00004;
    const h = numHash(`reddit-${date}`);
    const impressions = Math.round((62000 + (h % 3800)) * (1 + di * 0.00005) * dateWiggle(date, "rimp"));
    const clicks = Math.round((1100 + (h % 140)) * (1 + di * 0.00007) * dateWiggle(date, "rclk"));
    const ad_spend = Math.round((320 + (h % 55)) * spendScale * dateWiggle(date, "rsp"));
    const conversions = Math.round((9 + (h % 5)) * (1 + di * 0.00008) * dateWiggle(date, "rcv"));
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpc = clicks > 0 ? ad_spend / clicks : 0;
    const cpm = impressions > 0 ? (ad_spend / impressions) * 1000 : 0;
    return {
        date,
        ad_spend,
        impressions,
        clicks,
        saves: 0,
        conversions,
        conversion_value: 0,
        ctr,
        cpc,
        cpm,
        roas: 0,
        aov: 0,
    };
}

export function getDemoRedditDashboardForRange(startDate, endDate) {
    const days = eachDayInclusive(startDate, endDate);
    return {
        metrics_by_date: days.map(redditRow),
        top_campaigns: [
            {
                campaign_name: "Reddit — Conversions demo",
                clicks: 980,
                impressions: 52000,
                ctr: 0.0188,
                saves: 980,
                ad_spend: 2100.75,
            },
            {
                campaign_name: "Reddit — Reach",
                clicks: 760,
                impressions: 48000,
                ctr: 0.0158,
                saves: 760,
                ad_spend: 1680,
            },
        ],
        campaigns_by_date: [],
    };
}

function bingRow(date) {
    const di = dayIndexFrom20250101(date);
    const revScale = 1 + di * 0.000065;
    const spendScale = 1 + di * 0.00004;
    const wRev = dateWiggle(date, "bcr-v");
    const wSpend = dateWiggle(date, "bcs-v");
    const h = numHash(`bing-${date}`);
    const ad_spend = Math.round((680 + (h % 72)) * spendScale * wSpend);
    const impressions = Math.round((95000 + (h % 4200)) * (1 + di * 0.00005) * dateWiggle(date, "bimp"));
    const clicks = Math.round((1900 + (h % 180)) * (1 + di * 0.00007) * dateWiggle(date, "bclk"));
    const conversions = Math.round((16 + (h % 7)) * (1 + di * 0.0001) * dateWiggle(date, "bconv"));
    const conversion_value = Math.round((2400 + (h % 220)) * revScale * wRev);
    return {
        date,
        conversion_value,
        ad_spend,
        conversions,
        impressions,
        clicks,
        roas: ad_spend > 0 ? conversion_value / ad_spend : 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? ad_spend / clicks : 0,
        cpm: impressions > 0 ? (ad_spend / impressions) * 1000 : 0,
    };
}

/** Microsoft Advertising / Bing Ads — same response shape as Pinterest dashboard (metrics_by_date + top_campaigns). */
export function getDemoBingDashboardForRange(startDate, endDate) {
    const days = eachDayInclusive(startDate, endDate);
    return {
        metrics_by_date: days.map(bingRow),
        top_campaigns: [
            {
                campaign_name: "Search — Brand (Bing)",
                clicks: 4200,
                impressions: 98000,
                conversions: 88,
                ctr: 0.043,
            },
            {
                campaign_name: "Audience — Remarketing",
                clicks: 2100,
                impressions: 76000,
                conversions: 52,
                ctr: 0.028,
            },
        ],
        campaigns_by_date: [],
    };
}

export function getDemoKlaviyoDashboardForRange(startDate, endDate, prevStartDate, prevEndDate) {
    const curDays = eachDayInclusive(startDate, endDate);
    const metrics_by_date = curDays.map((date) => {
        const di = dayIndexFrom20250101(date);
        const revScale = 1 + di * 0.000055;
        const w = dateWiggle(date, "kl-v");
        const h = numHash(`kl-${date}`);
        const recipients = Math.round((1500 + (h % 100)) * (1 + di * 0.00005) * dateWiggle(date, "klr"));
        const opens = Math.round((400 + (h % 50)) * (1 + di * 0.00006) * dateWiggle(date, "klo"));
        const clicks = Math.round((200 + (h % 50)) * (1 + di * 0.00006) * dateWiggle(date, "klc"));
        const conversions = Math.round((10 + (h % 8)) * (1 + di * 0.00008) * dateWiggle(date, "klx"));
        const conversion_value = Math.round((3400 + (h % 1000)) * revScale * w);
        const unsubscribes = 5 + (h % 5);
        return {
            date,
            recipients,
            opens,
            clicks,
            conversions,
            conversion_value,
            unsubscribes,
            open_rate: recipients > 0 ? opens / recipients : 0,
            click_rate: recipients > 0 ? clicks / recipients : 0,
        };
    });

    let metrics_by_date_prev = [];
    if (prevStartDate && prevEndDate) {
        const prevDays = eachDayInclusive(prevStartDate, prevEndDate);
        metrics_by_date_prev = prevDays.map((date) => {
            const h = numHash(`kl-prev-${date}`);
            const recipients = 1400 + (h % 90);
            const opens = 380 + (h % 45);
            const clicks = 190 + (h % 45);
            const conversions = 9 + (h % 7);
            const conversion_value = 3800 + (h % 900);
            const unsubscribes = 5 + (h % 4);
            return {
                date,
                recipients,
                opens,
                clicks,
                conversions,
                conversion_value,
                unsubscribes,
                open_rate: recipients > 0 ? opens / recipients : 0,
                click_rate: recipients > 0 ? clicks / recipients : 0,
            };
        });
    }

    return {
        metrics_by_date,
        metrics_by_date_prev,
        top_campaigns: [
            {
                campaign_name: "abc123…",
                campaign_id: "cmp_demo_1",
                recipients: 12000,
                opens: 4000,
                clicks: 800,
                open_rate: 0.33,
                click_rate: 0.067,
                conversions: 90,
                conversion_value: 32000,
                unsubscribes: 12,
            },
        ],
    };
}

/** Demo ad-level rows for PPC / PS Ads performance tables */
export function getDemoGoogleAdsAdPerformanceForRange(startDate, endDate) {
    const days = eachDayInclusive(startDate, endDate).length || 1;
    const seed = [
        { name: "BF_DPA_All_products_singleimage", rev: 425286, spend: 18109 },
        { name: "PMAX_Retail_Shopping", rev: 198400, spend: 9200 },
        { name: "Search_Brand_Exact", rev: 156200, spend: 4100 },
        { name: "DemandGen_Video_Prospecting", rev: 89200, spend: 5600 },
    ];
    const ads = seed.map((s, i) => {
        const h = numHash(`gad-${s.name}-${days}`);
        const impressions = Math.round(80000 + (h % 20000) + i * 5000);
        const clicks = Math.round(4000 + (h % 800) + i * 200);
        const conversions = Math.round(180 + (h % 40));
        const revenue = Math.round(s.rev * (0.85 + (h % 20) / 100));
        const spend = Math.round(s.spend * (0.9 + (h % 15) / 100));
        const roas = spend > 0 ? revenue / spend : 0;
        const allVal = revenue * 1.08;
        const poas = spend > 0 ? allVal / spend : roas;
        return {
            platform: "google",
            ad_id: String(1000 + i),
            ad_name: s.name,
            revenue,
            roas,
            poas,
            ad_spend: spend,
            impressions,
            clicks,
            ctr: impressions > 0 ? clicks / impressions : 0,
            conv_rate_clicks: clicks > 0 ? conversions / clicks : 0,
            conv_rate_impressions: impressions > 0 ? conversions / impressions : 0,
        };
    });
    return {
        ads,
        currency: "DKK",
        adPerformanceNote: null,
    };
}

/**
 * Deterministic Apex Radar overview row (Facebook) for demo customers.
 * Mirrors the nested shape from `mockOverviewData` / API overview.
 */
/** Deterministic Meta-shaped daily rows for demo overview (matches purchase action types used in production). */
function syntheticMetaDailyForDemo(customerId, startIso, endIso) {
    const days = eachDayInclusive(startIso, endIso);
    return days.map((date) => {
        const h = numHash(`fb-d-${customerId}-${date}`);
        const conv = Math.max(1, Math.round((3 + (h % 8)) * dateWiggle(date, "dc")));
        const val = Math.round(conv * (240 + (h % 60)));
        const spend = Math.round(280 + (h % 180));
        const impr = 12000 + (h % 800);
        const clicks = 300 + (h % 40);
        return {
            date_start: date,
            spend,
            impressions: impr,
            clicks,
            frequency: impr > 0 ? 1.15 + (h % 20) / 100 : null,
            ctr: impr > 0 ? (clicks / impr) * 100 : null,
            actions: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: String(conv) }],
            action_values: [{ action_type: "offsite_conversion.fb_pixel_purchase", value: String(val) }],
        };
    });
}

export function buildDemoApexRadarFacebookOverviewRow(customer, startDate, endDate) {
    const id = String(customer._id);
    const w = computeDateWindows(startDate, endDate);
    const dod = getUtcCalendarSpendDodRange();
    const fetchSinceDemo = minIso(w.fetchSince, dod.calendarDayBeforeYesterday);
    const fetchUntilDemo = maxIso(endDate, dod.calendarYesterday);
    const daily = syntheticMetaDailyForDemo(id, fetchSinceDemo, fetchUntilDemo);
    const r2 = rollupDaily(daily, w.win2.from, w.win2.to);
    const r7 = rollupDaily(daily, w.win7.from, w.win7.to);
    const r30 = rollupDaily(daily, w.win30.from, w.win30.to);
    const rMonthToDate = rollupDaily(daily, w.monthStart, endDate);
    const endRow = daily.find((d) => d.date_start === endDate);
    const spendOnEndDate = endRow != null ? parseFloat(endRow.spend || 0) : 0;
    const apex = getFacebookApexRadarSettings(customer);
    const { minExpected7d, minExpected30d } = computeLog10WeeklyFloors(daily, apex.targetMetricType);

    const row = buildOverviewRowFromRollups(customer, startDate, endDate, {
        r2,
        r7,
        r30,
        rMonthToDate,
        spendOnEndDate,
        minExpected7d,
        minExpected30d,
        win2: w.win2,
        win7: w.win7,
        win30: w.win30,
    });
    const spendDayOverDay = computeSpendDayOverDayFromDaily(daily);
    return {
        ...row,
        spendDayOverDay,
        ads: { ...row.ads, adFatigue: null },
        apexRadarMeta: { channel: "facebook", demo: true },
    };
}

/** Deterministic Google-shaped daily rows (purchase action types aligned with `aggregateGoogleAdsMetricsToDaily`). */
function syntheticGoogleDailyForDemo(customerId, startIso, endIso) {
    const days = eachDayInclusive(startIso, endIso);
    return days.map((date) => {
        const h = numHash(`ga-d-${customerId}-${date}`);
        const conv = Math.max(1, Math.round((2 + (h % 7)) * dateWiggle(date, "dc")));
        const val = Math.round(conv * (230 + (h % 58)));
        const spend = Math.round(270 + (h % 175));
        const impr = 11500 + (h % 780);
        const clicks = 290 + (h % 36);
        return {
            date_start: date,
            spend,
            impressions: impr,
            clicks,
            frequency: null,
            ctr: impr > 0 ? (clicks / impr) * 100 : null,
            actions: [{ action_type: "purchase", value: String(conv) }],
            action_values: [{ action_type: "purchase", value: String(val) }],
        };
    });
}

export function buildDemoApexRadarGoogleAdsOverviewRow(customer, startDate, endDate) {
    const id = String(customer._id);
    const w = computeDateWindows(startDate, endDate);
    const dod = getUtcCalendarSpendDodRange();
    const fetchSinceDemo = minIso(w.fetchSince, dod.calendarDayBeforeYesterday);
    const fetchUntilDemo = maxIso(endDate, dod.calendarYesterday);
    const daily = syntheticGoogleDailyForDemo(id, fetchSinceDemo, fetchUntilDemo);
    const r2 = rollupDaily(daily, w.win2.from, w.win2.to);
    const r7 = rollupDaily(daily, w.win7.from, w.win7.to);
    const r30 = rollupDaily(daily, w.win30.from, w.win30.to);
    const rMonthToDate = rollupDaily(daily, w.monthStart, endDate);
    const endRow = daily.find((d) => d.date_start === endDate);
    const spendOnEndDate = endRow != null ? parseFloat(endRow.spend || 0) : 0;
    const apex = getGoogleApexRadarSettings(customer);
    const { minExpected7d, minExpected30d } = computeLog10WeeklyFloors(daily, apex.targetMetricType);

    const row = buildOverviewRowFromRollups(
        customer,
        startDate,
        endDate,
        {
            r2,
            r7,
            r30,
            rMonthToDate,
            spendOnEndDate,
            minExpected7d,
            minExpected30d,
            win2: w.win2,
            win7: w.win7,
            win30: w.win30,
        },
        {
            getApexSettings: getGoogleApexRadarSettings,
            channel: APEX_RADAR_CHANNEL_GOOGLE_ADS,
            defaultCustomerSettings: { google: {} },
        }
    );
    const spendDayOverDay = computeSpendDayOverDayFromDaily(daily);
    return {
        ...row,
        spendDayOverDay,
        ads: { ...row.ads, adFatigue: null },
        apexRadarMeta: { channel: APEX_RADAR_CHANNEL_GOOGLE_ADS, demo: true },
    };
}

export function getDemoFacebookAdsAdPerformanceForRange(since, until) {
    const days = eachDayInclusive(since, until).length || 1;
    const seed = [
        { name: "Catalog_Sales_Carousel", rev: 312000, spend: 14200 },
        { name: "Video_Views_TOF", rev: 145000, spend: 8900 },
        { name: "Remarketing_Dynamic", rev: 268000, spend: 12100 },
    ];
    const ads = seed.map((s, i) => {
        const h = numHash(`fbad-${s.name}-${days}`);
        const impressions = Math.round(120000 + (h % 30000));
        const clicks = Math.round(5500 + (h % 900));
        const conversions = Math.round(220 + (h % 50));
        const revenue = Math.round(s.rev * (0.88 + (h % 12) / 100));
        const spend = Math.round(s.spend * (0.92 + (h % 10) / 100));
        const roas = spend > 0 ? revenue / spend : 0;
        return {
            platform: "facebook",
            ad_id: String(2000 + i),
            ad_name: s.name,
            revenue,
            roas,
            poas: roas,
            ad_spend: spend,
            impressions,
            clicks,
            ctr: impressions > 0 ? clicks / impressions : 0,
            conv_rate_clicks: clicks > 0 ? conversions / clicks : 0,
            conv_rate_impressions: impressions > 0 ? conversions / impressions : 0,
        };
    });
    return { ads, currency: "DKK", adPerformanceNote: null };
}
