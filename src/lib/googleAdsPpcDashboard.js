// src/lib/googleAdsPpcDashboard.js
import { GoogleAdsApi } from 'google-ads-api';
import { resolveCountryToCriterionId } from './googleAdsApi';
import { getCurrencyConversionTable, conversionRateToDkk } from './currencyConversionTable';

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
export async function fetchGoogleAdsPPCDashboardMetrics({
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
        return {
            metrics_by_date,
            top_campaigns,
            campaigns_by_date,
        };
    } catch (error) {
        console.error('Error fetching Google Ads PPC dashboard data:', error);
        throw new Error(`Failed to fetch Google Ads PPC dashboard data: ${error.message}`);
    }
}
