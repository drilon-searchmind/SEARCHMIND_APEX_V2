/**
 * Extra Google Ads queries for PPC service dashboard sections.
 */

import {
    buildBrandGenericSpendByDate,
    mapPpcCampaignRow,
    mapSearchTermRow,
} from "./googlePpcDashboardUtils";

function microsToSpend(micros, conversionRate) {
    return ((micros || 0) / 1_000_000) * conversionRate;
}

function parseQueryRows(response) {
    return (Array.isArray(response) ? response : response?.results || []).filter(Boolean);
}

/**
 * @param {import('google-ads-api').Customer} customer
 * @param {{ startDate: string, endDate: string, conversionRate: number, rawData: Array }} opts
 */
export async function fetchPpcDashboardExtendedSections(customer, { startDate, endDate, conversionRate, rawData }) {
    const dateWhere = `segments.date BETWEEN '${startDate}' AND '${endDate}'`;

    const campaigns_performance = buildCampaignsPerformanceFromRaw(rawData);

    let search_terms = [];
    let impressionShareDaily = [];

    try {
        const termQuery = `
            SELECT
                search_term_view.search_term,
                campaign.name,
                metrics.clicks,
                metrics.impressions,
                metrics.conversions,
                metrics.conversions_value,
                metrics.cost_micros
            FROM search_term_view
            WHERE ${dateWhere}
                AND metrics.impressions > 0
            ORDER BY metrics.conversions_value DESC
            LIMIT 500
        `;
        const termRows = parseQueryRows(await customer.query(termQuery));
        const termMap = {};
        for (const row of termRows) {
            const term = row.search_term_view?.search_term || row.search_term || "";
            const campaign = row.campaign?.name || "—";
            const key = `${term}::${campaign}`;
            if (!termMap[key]) {
                termMap[key] = {
                    search_term: term,
                    campaign_name: campaign,
                    clicks: 0,
                    impressions: 0,
                    conversions: 0,
                    conversions_value: 0,
                    ad_spend: 0,
                };
            }
            const t = termMap[key];
            t.clicks += row.metrics?.clicks || 0;
            t.impressions += row.metrics?.impressions || 0;
            t.conversions += row.metrics?.conversions || 0;
            t.conversions_value += row.metrics?.conversions_value || 0;
            t.ad_spend += microsToSpend(row.metrics?.cost_micros, conversionRate);
        }
        search_terms = Object.values(termMap)
            .map(mapSearchTermRow)
            .filter((r) => r.impressions > 0 || r.clicks > 0)
            .sort((a, b) => b.revenue - a.revenue);
    } catch (e) {
        console.warn("[Google PPC] search_term_view:", e?.message || e);
    }

    try {
        const isQuery = `
            SELECT
                campaign.name,
                segments.date,
                metrics.impressions,
                metrics.search_impression_share,
                metrics.search_budget_lost_impression_share,
                metrics.search_rank_lost_impression_share
            FROM campaign
            WHERE ${dateWhere}
        `;
        const isRows = parseQueryRows(await customer.query(isQuery));
        const byDate = {};
        for (const row of isRows) {
            const date = row.segments?.date;
            if (!date) continue;
            const imp = row.metrics?.impressions || 0;
            if (!byDate[date]) {
                byDate[date] = { impressions: 0, is: 0, lostBudget: 0, lostRank: 0 };
            }
            byDate[date].impressions += imp;
            byDate[date].is += (row.metrics?.search_impression_share || 0) * imp;
            byDate[date].lostBudget += (row.metrics?.search_budget_lost_impression_share || 0) * imp;
            byDate[date].lostRank += (row.metrics?.search_rank_lost_impression_share || 0) * imp;
        }
        impressionShareDaily = Object.entries(byDate).map(([date, v]) => ({
            date,
            impression_share: v.impressions > 0 ? v.is / v.impressions : null,
            is_lost_budget: v.impressions > 0 ? v.lostBudget / v.impressions : null,
            is_lost_rank: v.impressions > 0 ? v.lostRank / v.impressions : null,
        }));
    } catch (e) {
        console.warn("[Google PPC] impression share:", e?.message || e);
    }

    const brand_generic_spend_by_date = buildBrandGenericSpendByDate(rawData);

    return {
        campaigns_performance,
        search_terms,
        impression_share_daily: impressionShareDaily,
        brand_generic_spend_by_date,
        account_summary: {
            new_customer_ratio: null,
            recurring_customer_ratio: null,
        },
    };
}

function buildCampaignsPerformanceFromRaw(rawData) {
    const map = {};
    for (const row of rawData || []) {
        const name = row.campaign_name || "Unknown";
        if (!map[name]) {
            map[name] = {
                campaign_name: name,
                clicks: 0,
                impressions: 0,
                conversions: 0,
                conversions_value: 0,
                ad_spend: 0,
            };
        }
        map[name].clicks += row.clicks || 0;
        map[name].impressions += row.impressions || 0;
        map[name].conversions += row.conversions || 0;
        map[name].conversions_value += row.conversions_value || 0;
        map[name].ad_spend += row.ad_spend || 0;
    }
    return Object.values(map)
        .map(mapPpcCampaignRow)
        .filter((r) => r.ad_spend > 0 || r.impressions > 0)
        .sort((a, b) => b.ad_spend - a.ad_spend);
}

/** Merge impression share fields into metrics_by_date rows by date. */
export function applyImpressionShareToMetricsByDate(metrics_by_date, impression_share_daily) {
    const byDate = Object.fromEntries((impression_share_daily || []).map((r) => [r.date, r]));
    return (metrics_by_date || []).map((m) => ({
        ...m,
        impression_share: byDate[m.date]?.impression_share ?? m.impression_share ?? null,
        is_lost_budget: byDate[m.date]?.is_lost_budget ?? m.is_lost_budget ?? null,
        is_lost_rank: byDate[m.date]?.is_lost_rank ?? m.is_lost_rank ?? null,
    }));
}
