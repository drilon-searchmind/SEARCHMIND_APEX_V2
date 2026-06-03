/**
 * SEO dashboard aggregation and chart helpers.
 */

export const SEO_CHART_METRIC_LABELS = {
    clicks: "Clicks",
    impressions: "Impressions",
    organic_revenue: "Organic Revenue",
    spend_saved: "Spend Saved",
    ctr: "CTR",
    position: "Avg. Position",
    organic_conversions: "Organic Conv.",
    non_brand_traffic_share: "NB Traffic",
    brand_traffic_share: "B Traffic",
    backlinks: "Backlinks",
    revenue_per_click: "Revenue / Click",
    organic_conv_rate: "Organic Conv. Rate",
};

export function normalizeSeriesValues(values) {
    const nums = values.map((v) => (typeof v === "number" && !Number.isNaN(v) ? v : null));
    const finite = nums.filter((v) => v !== null);
    const max = finite.length ? Math.max(...finite) : 0;
    if (max <= 0) return nums.map(() => 0);
    return nums.map((v) => (v === null ? null : Math.round((v / max) * 100)));
}

function calcCtr(clicks, impressions) {
    if (!impressions) return null;
    return (clicks / impressions) * 100;
}

function weightedPosition(rows) {
    if (!rows?.length) return null;
    let impSum = 0;
    let posSum = 0;
    for (const r of rows) {
        const imp = r.impressions || 0;
        impSum += imp;
        posSum += (r.position || 0) * imp;
    }
    return impSum > 0 ? posSum / impSum : null;
}

function organicByDate(organicDaily) {
    return Object.fromEntries((organicDaily || []).map((r) => [r.date, r]));
}

export function computeBrandKeywordMetrics(keywordRows, brandTerms) {
    const terms = (brandTerms || []).map((t) => String(t).toLowerCase()).filter(Boolean);
    if (!terms.length || !keywordRows?.length) {
        return { brand_traffic_share: null, non_brand_traffic_share: null };
    }

    let brand_clicks = 0;
    let total_clicks = 0;
    for (const row of keywordRows) {
        const kw = (row.keys?.[0] || "").toLowerCase();
        const clicks = row.clicks || 0;
        total_clicks += clicks;
        if (terms.some((t) => kw.includes(t))) brand_clicks += clicks;
    }
    const brand_traffic_share = total_clicks > 0 ? (brand_clicks / total_clicks) * 100 : null;
    const non_brand_traffic_share =
        brand_traffic_share != null ? 100 - brand_traffic_share : null;
    return { brand_traffic_share, non_brand_traffic_share };
}

export function buildSeoSummary(gscRows, supplemental, keywordRows, brandTerms) {
    const brand = computeBrandKeywordMetrics(keywordRows, brandTerms);
    const clicks = (gscRows || []).reduce((s, r) => s + (r.clicks || 0), 0);
    const impressions = (gscRows || []).reduce((s, r) => s + (r.impressions || 0), 0);
    const organic_revenue = supplemental?.organic_revenue ?? null;
    const organic_conversions = supplemental?.organic_conversions ?? null;
    const avg_cpc = supplemental?.avg_cpc ?? null;
    const spend_saved =
        supplemental?.spend_saved ?? (avg_cpc != null && clicks > 0 ? clicks * avg_cpc : null);

    return {
        clicks,
        impressions,
        ctr: calcCtr(clicks, impressions),
        position: weightedPosition(gscRows),
        organic_revenue,
        organic_conversions,
        spend_saved,
        avg_cpc,
        backlinks: supplemental?.backlinks ?? null,
        domain_rating: supplemental?.domain_rating ?? null,
        revenue_per_click: clicks > 0 && organic_revenue != null ? organic_revenue / clicks : null,
        organic_conv_rate: clicks > 0 && organic_conversions != null ? (organic_conversions / clicks) * 100 : null,
        ...brand,
    };
}

export function getDailyMetricValue(gscRow, key, supplemental, date) {
    const organic = organicByDate(supplemental?.organic_daily)[date];
    if (key === "clicks") return gscRow?.clicks ?? null;
    if (key === "impressions") return gscRow?.impressions ?? null;
    if (key === "ctr") return calcCtr(gscRow?.clicks, gscRow?.impressions);
    if (key === "position") return gscRow?.position != null ? Number(gscRow.position) : null;
    if (key === "organic_revenue") return organic?.revenue ?? null;
    if (key === "organic_conversions") return organic?.conversions ?? null;
    if (key === "spend_saved") {
        const c = gscRow?.clicks;
        const cpc = supplemental?.avg_cpc;
        return c != null && cpc != null ? c * cpc : null;
    }
    return null;
}

export function getSeoKpiValue(key, summary) {
    return summary?.[key] ?? null;
}
