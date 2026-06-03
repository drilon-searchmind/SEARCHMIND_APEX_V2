/**
 * Shared helpers for Google Ads PPC service dashboard.
 */

export function classifyBrandGeneric(campaignName) {
    const n = String(campaignName || "").toLowerCase();
    if (/\bbrand\b|branded|varemærke|mærkevare/.test(n)) return "brand";
    if (/generic|non-?brand|nonbrand|dki\b|broad match/.test(n)) return "generic";
    return "other";
}

export function mapPpcDailyRow(row) {
    const clicks = row.clicks || 0;
    const impressions = row.impressions || 0;
    const conversions = row.conversions || 0;
    const conversions_value = row.conversions_value || 0;
    const ad_spend = row.ad_spend || 0;
    return {
        date: row.date,
        clicks,
        impressions,
        conversions,
        conversions_value,
        ad_spend,
        roas: ad_spend > 0 ? conversions_value / ad_spend : 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? ad_spend / clicks : 0,
        conv_rate: clicks > 0 ? conversions / clicks : 0,
        cpa: conversions > 0 ? ad_spend / conversions : 0,
        impression_share: row.impression_share ?? null,
        is_lost_budget: row.is_lost_budget ?? null,
        is_lost_rank: row.is_lost_rank ?? null,
    };
}

export function mapPpcCampaignRow(row) {
    const clicks = row.clicks || 0;
    const impressions = row.impressions || 0;
    const conversions = row.conversions || 0;
    const conversions_value = row.conversions_value || 0;
    const ad_spend = row.ad_spend || 0;
    return {
        campaign_name: row.campaign_name || "Unknown",
        clicks,
        impressions,
        conversions,
        conversions_value,
        ad_spend,
        roas: ad_spend > 0 ? conversions_value / ad_spend : 0,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? ad_spend / clicks : 0,
        conv_rate: clicks > 0 ? conversions / clicks : 0,
        cpa: conversions > 0 ? ad_spend / conversions : 0,
        impression_share: row.impression_share ?? null,
    };
}

export function mapSearchTermRow(row) {
    const spend = row.ad_spend || 0;
    const clicks = row.clicks || 0;
    const impressions = row.impressions || 0;
    const conversions = row.conversions || 0;
    const revenue = row.conversions_value || 0;
    return {
        search_term: row.search_term || "—",
        campaign_name: row.campaign_name || "—",
        spend,
        clicks,
        impressions,
        conversions,
        revenue,
        roas: spend > 0 ? revenue / spend : 0,
    };
}

export function normalizeSeriesValues(values) {
    const nums = values.map((v) => (typeof v === "number" && !Number.isNaN(v) ? v : null));
    const finite = nums.filter((v) => v !== null);
    const max = finite.length ? Math.max(...finite) : 0;
    if (max <= 0) return nums.map(() => 0);
    return nums.map((v) => (v === null ? null : Math.round((v / max) * 100)));
}

export const PPC_CHART_METRIC_LABELS = {
    ad_spend: "Spend",
    clicks: "Clicks",
    conversions: "Conversions",
    conversions_value: "Revenue",
    impressions: "Impressions",
    roas: "ROAS",
    cpc: "CPC",
    conv_rate: "Conv. Rate",
    cpa: "CPA",
    impression_share: "Impression Share",
};

export function getPpcDailyMetricValue(row, key) {
    if (!row) return null;
    if (key === "conv_rate") return (row.conv_rate ?? 0) * 100;
    if (key === "ctr") return (row.ctr ?? 0) * 100;
    if (key === "impression_share" || key === "is_lost_budget" || key === "is_lost_rank") {
        const v = row[key];
        return typeof v === "number" ? v * 100 : null;
    }
    if (key === "roas") return row.roas ?? 0;
    const v = row[key];
    return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

export function aggregatePpcPeriodFromDaily(rows, key) {
    if (!rows?.length) return null;
    if (key === "conversions_value") {
        return rows.reduce((s, r) => s + (r.conversions_value || 0), 0);
    }
    if (key === "conversions" || key === "ad_spend" || key === "clicks" || key === "impressions") {
        return rows.reduce((s, r) => s + (r[key] || 0), 0);
    }
    if (key === "roas") {
        const spend = rows.reduce((s, r) => s + (r.ad_spend || 0), 0);
        const rev = rows.reduce((s, r) => s + (r.conversions_value || 0), 0);
        return spend > 0 ? rev / spend : null;
    }
    if (key === "cpc") {
        const spend = rows.reduce((s, r) => s + (r.ad_spend || 0), 0);
        const clicks = rows.reduce((s, r) => s + (r.clicks || 0), 0);
        return clicks > 0 ? spend / clicks : null;
    }
    if (key === "cpa") {
        const spend = rows.reduce((s, r) => s + (r.ad_spend || 0), 0);
        const conv = rows.reduce((s, r) => s + (r.conversions || 0), 0);
        return conv > 0 ? spend / conv : null;
    }
    if (key === "conv_rate") {
        const conv = rows.reduce((s, r) => s + (r.conversions || 0), 0);
        const clicks = rows.reduce((s, r) => s + (r.clicks || 0), 0);
        return clicks > 0 ? (conv / clicks) * 100 : null;
    }
    if (key === "impression_share" || key === "is_lost_budget" || key === "is_lost_rank") {
        let weighted = 0;
        let weight = 0;
        for (const r of rows) {
            const v = r[key];
            const imp = r.impressions || 0;
            if (typeof v === "number" && imp > 0) {
                weighted += v * imp;
                weight += imp;
            }
        }
        return weight > 0 ? (weighted / weight) * 100 : null;
    }
    return null;
}

export function pickTermWinnersLosers(terms, { minSpend = 100, limit = 5 } = {}) {
    const rows = (terms || []).filter((r) => r.spend >= minSpend && r.impressions > 0);
    const byRoas = [...rows].sort((a, b) => b.roas - a.roas);
    return {
        winners: byRoas.slice(0, limit),
        losers: [...byRoas].reverse().slice(0, limit),
    };
}

export function buildBrandGenericSpendByDate(rawRows) {
    const byDate = {};
    for (const row of rawRows || []) {
        const date = row.date;
        if (!date) continue;
        const spend = row.ad_spend || 0;
        const bucket = classifyBrandGeneric(row.campaign_name);
        if (!byDate[date]) {
            byDate[date] = { date, brand_spend: 0, generic_spend: 0, other_spend: 0 };
        }
        if (bucket === "brand") byDate[date].brand_spend += spend;
        else if (bucket === "generic") byDate[date].generic_spend += spend;
        else byDate[date].other_spend += spend;
    }
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}
