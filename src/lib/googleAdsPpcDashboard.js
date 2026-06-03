// src/lib/googleAdsPpcDashboard.js
import { GoogleAdsApi } from 'google-ads-api';
import { resolveCountryToCriterionId } from './googleAdsApi';
import { getCurrencyConversionTable, conversionRateToDkk } from './currencyConversionTable';
import { parseGoogleAdsCustomerIds } from './googleAdsCustomerIdUtils';
import {
    applyImpressionShareToMetricsByDate,
    fetchPpcDashboardExtendedSections,
} from './googlePpcDashboardExtended';
import { mapPpcCampaignRow } from './googlePpcDashboardUtils';

/**
 * Fetch comprehensive Google Ads PPC dashboard metrics
 * @param {Object} config - Configuration object
 * @param {string} config.developerToken
 * @param {string} config.clientId
 * @param {string} config.clientSecret
 * @param {string} config.refreshToken
 * @param {string} config.customerId
 * @param {string} [config.managerCustomerId]
 * @param {string} config.startDate
 * @param {string} config.endDate
 * @param {string} [config.countryFilter] - Optional comma-separated countries to INCLUDE
 * @param {string} [config.countryExclude] - Optional comma-separated countries to EXCLUDE
 * @returns {Promise<Object>} Object containing metrics_by_date, top_campaigns, and campaigns_by_date
 */
function mergePpcMetricsByDate(arrays) {
    /** @type {Record<string, object>} */
    const map = {};
    for (const arr of arrays) {
        for (const m of arr || []) {
            if (!m?.date) continue;
            if (!map[m.date]) {
                map[m.date] = {
                    date: m.date,
                    clicks: 0,
                    impressions: 0,
                    conversions: 0,
                    conversions_value: 0,
                    ad_spend: 0,
                };
            }
            const row = map[m.date];
            row.clicks += m.clicks || 0;
            row.impressions += m.impressions || 0;
            row.conversions += m.conversions || 0;
            row.conversions_value += m.conversions_value || 0;
            row.ad_spend += m.ad_spend || 0;
        }
    }
    return Object.values(map)
        .map((m) => ({
            ...m,
            roas: m.ad_spend > 0 ? m.conversions_value / m.ad_spend : 0,
            aov: m.conversions > 0 ? m.conversions_value / m.conversions : 0,
            ctr: m.impressions > 0 ? m.clicks / m.impressions : 0,
            cpc: m.clicks > 0 ? m.ad_spend / m.clicks : 0,
            conv_rate: m.clicks > 0 ? m.conversions / m.clicks : 0,
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
}

function mergePpcTopCampaigns(arrays) {
    /** @type {Record<string, object>} */
    const map = {};
    for (const arr of arrays) {
        for (const c of arr || []) {
            const key = c.campaign_name || "(no campaign)";
            if (!map[key]) {
                map[key] = { campaign_name: key, clicks: 0, impressions: 0 };
            }
            map[key].clicks += c.clicks || 0;
            map[key].impressions += c.impressions || 0;
        }
    }
    return Object.values(map)
        .map((c) => ({
            ...c,
            ctr: c.impressions > 0 ? c.clicks / c.impressions : 0,
        }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 1000);
}

function mergePpcCampaignsByDate(arrays, topCampaignNames) {
    /** @type {Record<string, object>} */
    const map = {};
    for (const arr of arrays) {
        for (const row of arr || []) {
            if (!topCampaignNames.has(row.campaign_name)) continue;
            const key = `${row.date}_${row.campaign_name}`;
            if (!map[key]) {
                map[key] = {
                    date: row.date,
                    campaign_name: row.campaign_name,
                    clicks: 0,
                    impressions: 0,
                    conversions: 0,
                    ad_spend: 0,
                };
            }
            const agg = map[key];
            agg.clicks += row.clicks || 0;
            agg.impressions += row.impressions || 0;
            agg.conversions += row.conversions || 0;
            agg.ad_spend += row.ad_spend || 0;
        }
    }
    return Object.values(map)
        .map((c) => ({
            ...c,
            ctr: c.impressions > 0 ? c.clicks / c.impressions : 0,
            conv_rate: c.clicks > 0 ? c.conversions / c.clicks : 0,
            cpc: c.clicks > 0 ? c.ad_spend / c.clicks : 0,
        }))
        .sort((a, b) => {
            const dateCompare = new Date(a.date) - new Date(b.date);
            if (dateCompare !== 0) return dateCompare;
            return b.clicks - a.clicks;
        });
}

function mergePpcCampaignsPerformance(arrays) {
    const map = {};
    for (const arr of arrays) {
        for (const c of arr || []) {
            const key = c.campaign_name || "(no campaign)";
            if (!map[key]) {
                map[key] = {
                    campaign_name: key,
                    clicks: 0,
                    impressions: 0,
                    conversions: 0,
                    conversions_value: 0,
                    ad_spend: 0,
                };
            }
            map[key].clicks += c.clicks || 0;
            map[key].impressions += c.impressions || 0;
            map[key].conversions += c.conversions || 0;
            map[key].conversions_value += c.conversions_value || 0;
            map[key].ad_spend += c.ad_spend || 0;
        }
    }
    return Object.values(map)
        .map(mapPpcCampaignRow)
        .sort((a, b) => b.ad_spend - a.ad_spend);
}

function mergePpcSearchTerms(arrays) {
    const map = {};
    for (const arr of arrays) {
        for (const t of arr || []) {
            const key = `${t.search_term}::${t.campaign_name}`;
            if (!map[key]) {
                map[key] = { ...t, spend: 0, clicks: 0, impressions: 0, conversions: 0, revenue: 0 };
            }
            const m = map[key];
            m.spend += t.spend || 0;
            m.clicks += t.clicks || 0;
            m.impressions += t.impressions || 0;
            m.conversions += t.conversions || 0;
            m.revenue += t.revenue || 0;
            m.roas = m.spend > 0 ? m.revenue / m.spend : 0;
        }
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
}

function mergeBrandGenericByDate(arrays) {
    const map = {};
    for (const arr of arrays) {
        for (const row of arr || []) {
            if (!map[row.date]) {
                map[row.date] = { date: row.date, brand_spend: 0, generic_spend: 0, other_spend: 0 };
            }
            map[row.date].brand_spend += row.brand_spend || 0;
            map[row.date].generic_spend += row.generic_spend || 0;
            map[row.date].other_spend += row.other_spend || 0;
        }
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

function mergeImpressionShareDaily(arrays) {
    const map = {};
    for (const arr of arrays) {
        for (const row of arr || []) {
            if (!map[row.date]) {
                map[row.date] = { date: row.date, n: 0, is: 0, lb: 0, lr: 0 };
            }
            map[row.date].is += row.impression_share || 0;
            map[row.date].lb += row.is_lost_budget || 0;
            map[row.date].lr += row.is_lost_rank || 0;
            map[row.date].n += 1;
        }
    }
    return Object.values(map).map((r) => ({
        date: r.date,
        impression_share: r.n > 0 ? r.is / r.n : null,
        is_lost_budget: r.n > 0 ? r.lb / r.n : null,
        is_lost_rank: r.n > 0 ? r.lr / r.n : null,
    }));
}

/**
 * Fetch comprehensive Google Ads PPC dashboard metrics (supports comma-separated customer IDs).
 */
export async function fetchGoogleAdsPPCDashboardMetrics(config) {
    const ids = parseGoogleAdsCustomerIds(config.customerId);
    if (ids.length <= 1) {
        const single = ids[0] ?? String(config.customerId ?? "").trim();
        return fetchGoogleAdsPPCDashboardMetricsForOne({ ...config, customerId: single });
    }
    const parts = await Promise.all(
        ids.map((id) =>
            fetchGoogleAdsPPCDashboardMetricsForOne({ ...config, customerId: id })
        )
    );
    const metrics_by_date = mergePpcMetricsByDate(parts.map((p) => p.metrics_by_date));
    const top_campaigns = mergePpcTopCampaigns(parts.map((p) => p.top_campaigns));
    const topCampaignNames = new Set(top_campaigns.map((c) => c.campaign_name));
    const campaigns_by_date = mergePpcCampaignsByDate(
        parts.map((p) => p.campaigns_by_date),
        topCampaignNames
    );
    const impression_share_daily = mergeImpressionShareDaily(
        parts.map((p) => p.impression_share_daily)
    );
    return {
        metrics_by_date: applyImpressionShareToMetricsByDate(metrics_by_date, impression_share_daily),
        top_campaigns,
        campaigns_by_date,
        campaigns_performance: mergePpcCampaignsPerformance(parts.map((p) => p.campaigns_performance)),
        search_terms: mergePpcSearchTerms(parts.map((p) => p.search_terms)),
        brand_generic_spend_by_date: mergeBrandGenericByDate(
            parts.map((p) => p.brand_generic_spend_by_date)
        ),
        impression_share_daily,
        account_summary: parts[0]?.account_summary || {
            new_customer_ratio: null,
            recurring_customer_ratio: null,
        },
    };
}

async function fetchGoogleAdsPPCDashboardMetricsForOne({
    developerToken,
    clientId,
    clientSecret,
    refreshToken,
    customerId,
    managerCustomerId,
    startDate,
    endDate,
    countryFilter,
    countryExclude,
}) {
    try {
        const client = new GoogleAdsApi({
            client_id: clientId,
            client_secret: clientSecret,
            developer_token: developerToken,
        });
        const customer = client.Customer({
            customer_id: customerId,
            refresh_token: refreshToken,
            login_customer_id: managerCustomerId || undefined,
        });
        let accountCurrency = 'DKK';
        try {
            const currencyQuery = `SELECT customer.currency_code FROM customer`;
            const currencyResponse = await customer.query(currencyQuery);
            accountCurrency = currencyResponse[0]?.customer?.currency_code || 'DKK';
        } catch (err) {
            console.warn('Google Ads: could not fetch currency, using DKK:', err?.message);
        }
        
        const currencyData = (await getCurrencyConversionTable()).data;
        const conversionRate = conversionRateToDkk(accountCurrency, currencyData);
        
        const hasInclude = typeof countryFilter === 'string' && countryFilter.trim().length > 0;
        const hasExclude = typeof countryExclude === 'string' && countryExclude.trim().length > 0;
        const hasAnyFilter = hasInclude || hasExclude;
        let response;
        if (hasAnyFilter) {
            const resolveIds = async (inputStr) => {
                const inputs = inputStr.split(',').map((c) => c.trim()).filter(Boolean);
                const ids = [];
                for (const inp of inputs) {
                    const id = await resolveCountryToCriterionId(customer, inp);
                    if (id != null) ids.push(id);
                    else console.warn('Google Ads PPC country filter: unknown country skipped:', inp);
                }
                return [...new Set(ids)];
            };
            let includeIds = [];
            let excludeIds = [];
            if (hasInclude) includeIds = await resolveIds(countryFilter);
            if (hasExclude) excludeIds = await resolveIds(countryExclude);
            const effectiveIncludeIds = hasInclude
                ? includeIds.filter((id) => !excludeIds.includes(id))
                : null;
            if (hasInclude && effectiveIncludeIds.length === 0) {
                console.warn('Google Ads PPC country filter: all included countries were excluded, falling back to unfiltered');
            }
            const useLocationView = (hasInclude && effectiveIncludeIds.length > 0) || (hasExclude && !hasInclude);
            if (useLocationView) {
                const idsList = effectiveIncludeIds?.length ? effectiveIncludeIds.join(', ') : null;
                const whereCountry = idsList
                    ? `AND user_location_view.country_criterion_id IN (${idsList})`
                    : '';
                const countryQuery = `
                    SELECT 
                        user_location_view.country_criterion_id,
                        campaign.id,
                        campaign.name,
                        segments.date,
                        metrics.clicks,
                        metrics.impressions,
                        metrics.conversions,
                        metrics.conversions_value,
                        metrics.cost_micros
                    FROM user_location_view
                    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                    ${whereCountry}
                    ORDER BY segments.date ASC
                `;
                response = await customer.query(countryQuery);
                if (hasExclude && excludeIds.length > 0) {
                    const rows = Array.isArray(response) ? response : (response?.results || []);
                    response = rows.filter(
                        (r) => !excludeIds.includes(Number(r.user_location_view?.country_criterion_id ?? r.country_criterion_id))
                    );
                }
            }
        }
        if (!response) {
            const query = `
                SELECT 
                    campaign.id,
                    campaign.name,
                    segments.date,
                    metrics.clicks,
                    metrics.impressions,
                    metrics.conversions,
                    metrics.conversions_value,
                    metrics.cost_micros
                FROM campaign
                WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
                ORDER BY segments.date ASC
            `;
            response = await customer.query(query);
        }
        const rawData = (Array.isArray(response) ? response : (response?.results || [])).map(row => ({
            date: row.segments?.date,
            campaign_name: row.campaign?.name ?? '(no campaign)',
            campaign_id: row.campaign?.id,
            clicks: row.metrics?.clicks || 0,
            impressions: row.metrics?.impressions || 0,
            conversions: row.metrics?.conversions || 0,
            conversions_value: row.metrics?.conversions_value || 0,
            ad_spend: ((row.metrics?.cost_micros || 0) / 1_000_000) * conversionRate,
        })).filter(row => row.date);
        const metricsByDateMap = {};
        rawData.forEach(row => {
            if (!metricsByDateMap[row.date]) {
                metricsByDateMap[row.date] = {
                    date: row.date,
                    clicks: 0,
                    impressions: 0,
                    conversions: 0,
                    conversions_value: 0,
                    ad_spend: 0,
                };
            }
            metricsByDateMap[row.date].clicks += row.clicks;
            metricsByDateMap[row.date].impressions += row.impressions;
            metricsByDateMap[row.date].conversions += row.conversions;
            metricsByDateMap[row.date].conversions_value += row.conversions_value;
            metricsByDateMap[row.date].ad_spend += row.ad_spend;
        });
        const metrics_by_date = Object.values(metricsByDateMap).map(m => ({
            ...m,
            roas: m.ad_spend > 0 ? m.conversions_value / m.ad_spend : 0,
            aov: m.conversions > 0 ? m.conversions_value / m.conversions : 0,
            ctr: m.impressions > 0 ? m.clicks / m.impressions : 0,
            cpc: m.clicks > 0 ? m.ad_spend / m.clicks : 0,
            conv_rate: m.clicks > 0 ? m.conversions / m.clicks : 0,
        })).sort((a, b) => new Date(a.date) - new Date(b.date));
        const campaignMap = {};
        rawData.forEach(row => {
            if (!campaignMap[row.campaign_name]) {
                campaignMap[row.campaign_name] = {
                    campaign_name: row.campaign_name,
                    clicks: 0,
                    impressions: 0,
                };
            }
            campaignMap[row.campaign_name].clicks += row.clicks;
            campaignMap[row.campaign_name].impressions += row.impressions;
        });
        const top_campaigns = Object.values(campaignMap)
            .map(c => ({
                ...c,
                ctr: c.impressions > 0 ? c.clicks / c.impressions : 0,
            }))
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 1000);
        const topCampaignNames = new Set(top_campaigns.map(c => c.campaign_name));
        const campaignsByDateMap = {};
        rawData
            .filter(row => topCampaignNames.has(row.campaign_name))
            .forEach(row => {
                const key = `${row.date}_${row.campaign_name}`;
                if (!campaignsByDateMap[key]) {
                    campaignsByDateMap[key] = {
                        date: row.date,
                        campaign_name: row.campaign_name,
                        clicks: 0,
                        impressions: 0,
                        conversions: 0,
                        ad_spend: 0,
                    };
                }
                campaignsByDateMap[key].clicks += row.clicks;
                campaignsByDateMap[key].impressions += row.impressions;
                campaignsByDateMap[key].conversions += row.conversions;
                campaignsByDateMap[key].ad_spend += row.ad_spend;
            });
        const campaigns_by_date = Object.values(campaignsByDateMap)
            .map(c => ({
                ...c,
                ctr: c.impressions > 0 ? c.clicks / c.impressions : 0,
                conv_rate: c.clicks > 0 ? c.conversions / c.clicks : 0,
                cpc: c.clicks > 0 ? c.ad_spend / c.clicks : 0,
            }))
            .sort((a, b) => {
                const dateCompare = new Date(a.date) - new Date(b.date);
                if (dateCompare !== 0) return dateCompare;
                return b.clicks - a.clicks;
            });

        const extended = await fetchPpcDashboardExtendedSections(customer, {
            startDate,
            endDate,
            conversionRate,
            rawData,
        });

        return {
            metrics_by_date: applyImpressionShareToMetricsByDate(
                metrics_by_date,
                extended.impression_share_daily
            ),
            top_campaigns,
            campaigns_by_date,
            campaigns_performance: extended.campaigns_performance,
            search_terms: extended.search_terms,
            brand_generic_spend_by_date: extended.brand_generic_spend_by_date,
            impression_share_daily: extended.impression_share_daily,
            account_summary: extended.account_summary,
        };
    } catch (error) {
        console.error('Error fetching Google Ads PPC dashboard data:', error);
        throw new Error(`Failed to fetch Google Ads PPC dashboard data: ${error.message}`);
    }
}
