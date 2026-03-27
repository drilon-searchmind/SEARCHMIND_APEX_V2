/**
 * Deterministic demo metrics for any [startDate, endDate] (ad dashboards).
 */

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
