/**
 * Shared helpers for Paid Social (Meta) service dashboard metrics and tables.
 */

const PURCHASE_ACTION_TYPES = [
    "purchase",
    "omni_purchase",
    "offsite_conversion.fb_pixel_purchase",
];

const ENGAGEMENT_ACTION_TYPES = [
    "post_engagement",
    "page_engagement",
    "post_reaction",
    "post_comment",
    "post_save",
];

export function getActionValue(actions, actionTypes) {
    if (!actions) return 0;
    const types = Array.isArray(actionTypes) ? actionTypes : [actionTypes];
    let sum = 0;
    for (const row of actions) {
        if (types.includes(row.action_type)) {
            sum += parseFloat(row.value || 0);
        }
    }
    return sum;
}

export function getActionValueSum(actionValues, actionTypes) {
    if (!actionValues) return 0;
    const types = Array.isArray(actionTypes) ? actionTypes : [actionTypes];
    let sum = 0;
    for (const row of actionValues) {
        if (types.includes(row.action_type)) {
            sum += parseFloat(row.value || 0);
        }
    }
    return sum;
}

export function getPurchaseConversions(actions) {
    return getActionValue(actions, PURCHASE_ACTION_TYPES);
}

export function getPurchaseRevenue(actionValues) {
    return getActionValueSum(actionValues, PURCHASE_ACTION_TYPES);
}

export function getEngagementCount(actions) {
    return getActionValue(actions, ENGAGEMENT_ACTION_TYPES);
}

/** @typedef {'prospecting'|'retargeting'|'other'} FunnelBucket */
export function classifyCampaignFunnel(campaignName) {
    const n = String(campaignName || "").toLowerCase();
    if (/retarget|remarketing|rmk|rtg|mof|bof|warm|hot/.test(n)) return "retargeting";
    if (/prospect|tof|awareness|lookalike|lal|broad|acquisition|cold/.test(n)) return "prospecting";
    return "other";
}

export function mapInsightRowToMetrics(row) {
    const clicks = parseFloat(row.clicks || 0);
    const link_clicks = parseFloat(row.inline_link_clicks ?? row.link_clicks ?? clicks);
    const impressions = parseFloat(row.impressions || 0);
    const ad_spend = parseFloat(row.spend || 0);
    const conversions = getPurchaseConversions(row.actions);
    const conversion_value = getPurchaseRevenue(row.action_values);
    const engagement = getEngagementCount(row.actions);
    const reach = parseFloat(row.reach || 0);
    const frequency = parseFloat(row.frequency || 0);

    return {
        clicks,
        link_clicks,
        impressions,
        conversions,
        conversion_value,
        ad_spend,
        reach,
        frequency,
        engagement,
        roas: ad_spend > 0 ? conversion_value / ad_spend : 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? ad_spend / clicks : 0,
        cpm: impressions > 0 ? (ad_spend / impressions) * 1000 : 0,
        conv_rate: link_clicks > 0 ? conversions / link_clicks : clicks > 0 ? conversions / clicks : 0,
        cpa: conversions > 0 ? ad_spend / conversions : 0,
        engagement_rate: impressions > 0 ? engagement / impressions : 0,
    };
}

export function mapDailyMetricsRow(row) {
    const base = mapInsightRowToMetrics(row);
    return {
        date: row.date_start,
        ...base,
        aov: base.conversions > 0 ? base.conversion_value / base.conversions : 0,
    };
}

export function mapCampaignMetricsRow(row) {
    const base = mapInsightRowToMetrics(row);
    return {
        campaign_name: row.campaign_name || "Unknown",
        ...base,
    };
}

export function mapPlacementMetricsRow(row) {
    const base = mapInsightRowToMetrics(row);
    const placement =
        row.publisher_platform ||
        row.platform_position ||
        row.placement ||
        "Unknown";
    return {
        placement: String(placement).replace(/_/g, " "),
        ...base,
    };
}

export function mapCreativeAdRow(ad) {
    const spend = ad.ad_spend ?? ad.spend ?? 0;
    const impressions = ad.impressions ?? 0;
    const clicks = ad.clicks ?? 0;
    const conversions = ad.conversions ?? 0;
    const revenue = ad.revenue ?? ad.conversion_value ?? 0;
    const roas = spend > 0 ? revenue / spend : ad.roas ?? 0;
    return {
        creative: ad.ad_name || ad.creative || "Unknown",
        ad_id: ad.ad_id != null ? String(ad.ad_id) : undefined,
        spend,
        clicks,
        impressions,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
        ctr: impressions > 0 ? clicks / impressions : ad.ctr ?? 0,
        conversions,
        revenue,
        frequency: ad.frequency ?? null,
        roas,
    };
}

/** Normalize series to 0–100 for comparable chart shapes; keeps raw in parallel. */
export function normalizeSeriesValues(values) {
    const nums = values.map((v) => (typeof v === "number" && !Number.isNaN(v) ? v : null));
    const finite = nums.filter((v) => v !== null);
    const max = finite.length ? Math.max(...finite) : 0;
    if (max <= 0) return nums.map(() => 0);
    return nums.map((v) => (v === null ? null : Math.round((v / max) * 100)));
}

export const CHART_METRIC_KEYS = [
    "ad_spend",
    "link_clicks",
    "conversions",
    "conversion_value",
    "impressions",
    "roas",
    "cpm",
    "cpc",
    "conv_rate",
    "cpa",
];

export const CHART_METRIC_LABELS = {
    ad_spend: "Spend",
    link_clicks: "Link clicks",
    conversions: "Conversions",
    conversion_value: "Revenue",
    impressions: "Impressions",
    roas: "ROAS",
    cpm: "CPM",
    cpc: "CPC",
    conv_rate: "Conv. Rate",
    cpa: "CPA",
};

export function getDailyMetricValue(row, key) {
    if (!row) return null;
    if (key === "conv_rate") return (row.conv_rate ?? 0) * 100;
    if (key === "ctr") return (row.ctr ?? 0) * 100;
    if (key === "roas") return row.roas ?? 0;
    const v = row[key];
    return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

export function aggregatePeriodFromDaily(rows, key) {
    if (!rows?.length) return null;
    if (key === "conversion_value") {
        return rows.reduce((s, r) => s + (r.conversion_value || 0), 0);
    }
    if (key === "conversions") {
        return rows.reduce((s, r) => s + (r.conversions || 0), 0);
    }
    if (key === "ad_spend" || key === "link_clicks" || key === "impressions" || key === "reach" || key === "engagement") {
        return rows.reduce((s, r) => s + (r[key] || 0), 0);
    }
    if (key === "roas") {
        const spend = rows.reduce((s, r) => s + (r.ad_spend || 0), 0);
        const rev = rows.reduce((s, r) => s + (r.conversion_value || 0), 0);
        return spend > 0 ? rev / spend : null;
    }
    if (key === "cpm") {
        const spend = rows.reduce((s, r) => s + (r.ad_spend || 0), 0);
        const imp = rows.reduce((s, r) => s + (r.impressions || 0), 0);
        return imp > 0 ? (spend / imp) * 1000 : null;
    }
    if (key === "cpc") {
        const spend = rows.reduce((s, r) => s + (r.ad_spend || 0), 0);
        const clicks = rows.reduce((s, r) => s + (r.link_clicks || r.clicks || 0), 0);
        return clicks > 0 ? spend / clicks : null;
    }
    if (key === "cpa") {
        const spend = rows.reduce((s, r) => s + (r.ad_spend || 0), 0);
        const conv = rows.reduce((s, r) => s + (r.conversions || 0), 0);
        return conv > 0 ? spend / conv : null;
    }
    if (key === "conv_rate") {
        const conv = rows.reduce((s, r) => s + (r.conversions || 0), 0);
        const clicks = rows.reduce((s, r) => s + (r.link_clicks || r.clicks || 0), 0);
        return clicks > 0 ? (conv / clicks) * 100 : null;
    }
    if (key === "engagement_rate") {
        const eng = rows.reduce((s, r) => s + (r.engagement || 0), 0);
        const imp = rows.reduce((s, r) => s + (r.impressions || 0), 0);
        return imp > 0 ? (eng / imp) * 100 : null;
    }
    if (key === "frequency") {
        const reach = rows.reduce((s, r) => s + (r.reach || 0), 0);
        const imp = rows.reduce((s, r) => s + (r.impressions || 0), 0);
        return reach > 0 ? imp / reach : rows.reduce((s, r) => s + (r.frequency || 0), 0) / rows.length;
    }
    return null;
}

export function buildFunnelSpendByDate(campaignDailyRows) {
    const byDate = {};
    for (const row of campaignDailyRows || []) {
        const date = row.date_start || row.date;
        if (!date) continue;
        const spend = parseFloat(row.spend || row.ad_spend || 0);
        const bucket = classifyCampaignFunnel(row.campaign_name);
        if (!byDate[date]) {
            byDate[date] = { date, prospecting_spend: 0, retargeting_spend: 0, other_spend: 0 };
        }
        if (bucket === "prospecting") byDate[date].prospecting_spend += spend;
        else if (bucket === "retargeting") byDate[date].retargeting_spend += spend;
        else byDate[date].other_spend += spend;
    }
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

export function pickCreativeWinnersLosers(ads, { minSpend = 500, limit = 5 } = {}) {
    const rows = (ads || [])
        .map(mapCreativeAdRow)
        .filter((r) => r.spend >= minSpend && r.impressions > 0);
    const byRoas = [...rows].sort((a, b) => b.roas - a.roas);
    const winners = byRoas.slice(0, limit);
    const losers = [...byRoas].reverse().slice(0, limit);
    return { winners, losers };
}
