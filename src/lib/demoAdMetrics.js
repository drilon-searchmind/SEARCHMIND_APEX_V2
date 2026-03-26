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

function googlePpcRow(date) {
    const h = numHash(`ppc-${date}`);
    const clicks = 200 + (h % 50);
    const impressions = 8000 + (h % 1000);
    const conversions = 12 + (h % 8);
    const conversions_value = 4500 + (h % 500);
    const ad_spend = 2100 + (h % 200);
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
    const h = numHash(`fb-${date}`);
    const clicks = 300 + (h % 40);
    const impressions = 12000 + (h % 800);
    const conversions = 18 + (h % 10);
    const conversion_value = 6200 + (h % 400);
    const ad_spend = 1800 + (h % 150);
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
    const h = numHash(`pin-${date}`);
    const ad_spend = 950 + (h % 80);
    const impressions = 110000 + (h % 5000);
    const clicks = 2200 + (h % 200);
    const conversions = 14 + (h % 6);
    const conversion_value = 2100 + (h % 200);
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

export function getDemoKlaviyoDashboardForRange(startDate, endDate, prevStartDate, prevEndDate) {
    const curDays = eachDayInclusive(startDate, endDate);
    const metrics_by_date = curDays.map((date) => {
        const h = numHash(`kl-${date}`);
        const recipients = 1500 + (h % 100);
        const opens = 400 + (h % 50);
        const clicks = 200 + (h % 50);
        const conversions = 10 + (h % 8);
        const conversion_value = 4000 + (h % 1000);
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
