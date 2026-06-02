import {
    adCampaignFilterActive,
    normalizeCampaignNameKeywords,
    shouldExcludeAdCampaign,
} from './adCampaignFilterUtils';
import { normalizeMetaAdsCampaignId } from './metaAdsCampaignIdUtils';

/**
 * Parse meta ID include/exclude from comma-separated strings.
 * @param {string} [includeStr] - Comma-separated country codes to include (e.g. 'DK,SE,NO')
 * @param {string} [excludeStr] - Comma-separated country codes to exclude (e.g. 'FR,ES')
 * @returns {{ include: string[], exclude: string[], effectiveInclude: string[] }}
 */
function parseMetaIdFilter(includeStr, excludeStr) {
    const parse = (s) => (typeof s === 'string' ? s.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean) : []);
    const include = parse(includeStr);
    const exclude = parse(excludeStr);
    const effectiveInclude = include.length > 0 ? include.filter((c) => !exclude.includes(c)) : [];
    return { include, exclude, effectiveInclude };
}

/**
 * Fetches Facebook Ads Insights at the campaign level for a given ad account and country (Meta ID).
 * @param {string} adAccountId - Facebook Ad Account ID (with 'act_' prefix)
 * @param {string} [metaIdInclude] - Comma-separated country codes to include (e.g., 'DK,SE,NO'). Empty = all countries.
 * @param {string} [metaIdExclude] - Comma-separated country codes to exclude (e.g., 'FR,ES')
 * @param {string} accessToken - Facebook App Token
 * @param {string} since - Start date (YYYY-MM-DD)
 * @param {string} until - End date (YYYY-MM-DD)
 * @returns {Promise<object>} - The raw response from Facebook Graph API (campaign level)
 */
export async function fetchFacebookCampaignInsights(adAccountId, metaIdInclude, metaIdExclude, accessToken, since, until) {
    const fields = [
        'campaign_id',
        'campaign_name',
        'spend',
        'impressions',
        'clicks',
        'ctr',
        'cpc',
        'cpm',
    ];

    const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const apiUrl = `https://graph.facebook.com/v21.0/${accountId}/insights`;

    const params = new URLSearchParams({
        access_token: accessToken,
        time_range: JSON.stringify({ since, until }),
        fields: fields.join(','),
        level: 'campaign',
    });

    const { effectiveInclude, exclude } = parseMetaIdFilter(metaIdInclude, metaIdExclude);

    if (effectiveInclude.length > 0) {
        params.append('filtering', JSON.stringify([
            { field: 'country', operator: 'IN', value: effectiveInclude }
        ]));
    }
    const useBreakdown = exclude.length > 0 && effectiveInclude.length === 0;
    if (useBreakdown) {
        params.append('breakdowns', JSON.stringify(['country']));
    }

    const url = `${apiUrl}?${params.toString()}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Facebook API error: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    if (data.error) {
        throw new Error(`Facebook API error: ${JSON.stringify(data.error)}`);
    }

    let rows = data.data || [];
    if (useBreakdown && rows.length > 0) {
        rows = rows.filter((row) => {
            const c = (row.country || '').toUpperCase();
            return c && !exclude.includes(c);
        });
        const byCampaign = {};
        for (const row of rows) {
            const key = row.campaign_name || 'Unknown';
            if (!byCampaign[key]) {
                byCampaign[key] = { campaign_name: key, spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0 };
            }
            byCampaign[key].spend += parseFloat(row.spend || 0);
            byCampaign[key].impressions += parseFloat(row.impressions || 0);
            byCampaign[key].clicks += parseFloat(row.clicks || 0);
        }
        rows = Object.values(byCampaign).map((r) => ({
            ...r,
            ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
            cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
            cpm: r.impressions > 0 ? (r.spend / r.impressions) * 1000 : 0,
        }));
    }
    return { ...data, data: rows };
}

/**
 * List distinct Meta campaigns for parent-property campaign picker.
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function fetchMetaAdsCampaignList(
    adAccountId,
    since,
    until,
    accessToken
) {
    const res = await fetchFacebookCampaignInsights(
        adAccountId,
        "",
        "",
        accessToken,
        since,
        until
    );
    const rows = res?.data || [];
    /** @type {Map<string, { id: string, name: string }>} */
    const byId = new Map();
    for (const row of rows) {
        const id =
            normalizeMetaAdsCampaignId(row.campaign_id) ||
            normalizeMetaAdsCampaignId(row.campaign_name);
        const name = String(row.campaign_name || id || "Unknown").trim();
        if (!id) continue;
        if (!byId.has(id)) byId.set(id, { id, name });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {unknown[]} rows
 * @param {string[]} excludedCampaignIds
 * @param {string[]} excludedCampaignNameKeywords
 */
function filterFacebookCampaignInsightRows(
    rows,
    excludedCampaignIds,
    excludedCampaignNameKeywords
) {
    const ids = (excludedCampaignIds || [])
        .map((id) => normalizeMetaAdsCampaignId(id))
        .filter(Boolean);
    const keywords = normalizeCampaignNameKeywords(excludedCampaignNameKeywords);
    if (!adCampaignFilterActive(ids.length > 0, keywords)) return rows;

    return (rows || []).filter((row) => {
        const id =
            normalizeMetaAdsCampaignId(row.campaign_id) ||
            normalizeMetaAdsCampaignId(row.campaign_name);
        const name = row.campaign_name;
        return !shouldExcludeAdCampaign(
            { id, name },
            { excludedIds: ids, excludedNameKeywords: keywords },
            normalizeMetaAdsCampaignId
        );
    });
}

/**
 * Aggregate campaign-level insight rows to daily account-style rows.
 * @param {unknown[]} rows
 */
function aggregateFacebookCampaignRowsToDaily(rows) {
    const byDate = {};
    for (const row of rows) {
        const key = row.date_start || "";
        if (!byDate[key]) {
            byDate[key] = { date_start: key, spend: 0 };
        }
        byDate[key].spend += parseFloat(row.spend || 0);
    }
    return Object.values(byDate).sort((a, b) =>
        (a.date_start || "").localeCompare(b.date_start || "")
    );
}

/**
 * Fetches Facebook Ads Insights for a given ad account and country (Meta ID).
 * @param {string} adAccountId - Facebook Ad Account ID (with 'act_' prefix)
 * @param {string} [metaIdInclude] - Comma-separated country codes to include (e.g., 'DK,SE,NO'). Empty = all countries.
 * @param {string} [metaIdExclude] - Comma-separated country codes to exclude (e.g., 'FR,ES')
 * @param {string} accessToken - Facebook App Token
 * @param {string} since - Start date (YYYY-MM-DD)
 * @param {string} until - End date (YYYY-MM-DD)
 * @param {object} [options] - Optional settings
 * @param {boolean} [options.dailyBreakdown] - If true, adds time_increment=1 for daily rows (used by parent-property)
 * @param {string[]} [options.excludedCampaignIds] - Campaign ids to omit from spend (parent group view)
 * @param {string[]} [options.excludedCampaignNameKeywords] - Name substrings to omit (case-insensitive)
 * @param {boolean} [options.forceCampaignQuery] - Fetch campaign-level insights and filter
 * @returns {Promise<object>} - The raw response from Facebook Graph API
 */
export async function fetchFacebookAdsInsights(adAccountId, metaIdInclude, metaIdExclude, accessToken, since, until, options = {}) {
    const excludedCampaignIds = Array.isArray(options.excludedCampaignIds)
        ? options.excludedCampaignIds
        : [];
    const excludedCampaignNameKeywords = normalizeCampaignNameKeywords(
        options.excludedCampaignNameKeywords
    );
    const forceCampaignQuery =
        options.forceCampaignQuery === true ||
        adCampaignFilterActive(excludedCampaignIds.length > 0, excludedCampaignNameKeywords);

    const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const apiUrl = `https://graph.facebook.com/v21.0/${accountId}/insights`;

    const params = new URLSearchParams({
        access_token: accessToken,
        time_range: JSON.stringify({ since, until }),
        limit: '500',
    });

    if (forceCampaignQuery) {
        params.set(
            'fields',
            ['campaign_id', 'campaign_name', 'spend', 'date_start'].join(',')
        );
        params.set('level', 'campaign');
        params.append('time_increment', '1');
    } else {
        const fields = [
            'spend',
            'purchase_roas',
            'actions',
            'impressions',
            'clicks',
            'ctr',
            'cpc',
            'cpm',
        ];
        params.set('fields', fields.join(','));
        params.set('level', 'account');
        if (options.dailyBreakdown) {
            params.append('time_increment', '1');
        }
    }

    const { effectiveInclude, exclude } = parseMetaIdFilter(metaIdInclude, metaIdExclude);

    if (effectiveInclude.length > 0) {
        params.append('filtering', JSON.stringify([
            { field: 'country', operator: 'IN', value: effectiveInclude }
        ]));
    }
    const forceCountryBreakdown = options.forceCountryBreakdown === true;
    const useBreakdown =
        forceCountryBreakdown || (exclude.length > 0 && effectiveInclude.length === 0);
    if (useBreakdown) {
        params.append('breakdowns', JSON.stringify(['country']));
        // With breakdowns, each row = (date, country). Need higher limit to avoid truncation.
        params.set('limit', '500');
    }

    const url = `${apiUrl}?${params.toString()}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Facebook API error: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    if (data.error) {
        throw new Error(`Facebook API error: ${JSON.stringify(data.error)}`);
    }

    let rows = data.data || [];

    if (forceCampaignQuery) {
        rows = filterFacebookCampaignInsightRows(
            rows,
            excludedCampaignIds,
            excludedCampaignNameKeywords
        );
        rows = aggregateFacebookCampaignRowsToDaily(rows);
        return { ...data, data: rows };
    }

    if (useBreakdown && !forceCountryBreakdown && rows.length > 0) {
        rows = rows.filter((row) => {
            const c = (row.country || '').toUpperCase();
            return c && !exclude.includes(c);
        });
        const keyField = options.dailyBreakdown ? 'date_start' : null;
        if (keyField) {
            const byDate = {};
            for (const row of rows) {
                const key = row[keyField] || '';
                if (!byDate[key]) {
                    byDate[key] = { date_start: key, spend: 0, impressions: 0, clicks: 0, actionsByType: {}, actionValuesByType: {} };
                }
                byDate[key].spend += parseFloat(row.spend || 0);
                byDate[key].impressions += parseFloat(row.impressions || 0);
                byDate[key].clicks += parseFloat(row.clicks || 0);
                if (row.actions) {
                    for (const a of row.actions) {
                        byDate[key].actionsByType[a.action_type] = (byDate[key].actionsByType[a.action_type] || 0) + parseFloat(a.value || 0);
                    }
                }
                if (row.action_values) {
                    for (const a of row.action_values) {
                        byDate[key].actionValuesByType[a.action_type] = (byDate[key].actionValuesByType[a.action_type] || 0) + parseFloat(a.value || 0);
                    }
                }
            }
            rows = Object.values(byDate).map((r) => {
                const actions = Object.entries(r.actionsByType || {}).map(([t, v]) => ({ action_type: t, value: String(v) }));
                const action_values = Object.entries(r.actionValuesByType || {}).map(([t, v]) => ({ action_type: t, value: String(v) }));
                const purchaseVal = action_values.find((a) => ['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase'].includes(a.action_type));
                return {
                    date_start: r.date_start,
                    spend: r.spend,
                    impressions: r.impressions,
                    clicks: r.clicks,
                    ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
                    cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
                    cpm: r.impressions > 0 ? (r.spend / r.impressions) * 1000 : 0,
                    actions,
                    action_values,
                    purchase_roas: r.spend > 0 && purchaseVal ? parseFloat(purchaseVal.value || 0) / r.spend : undefined,
                };
            }).sort((a, b) => (a.date_start || '').localeCompare(b.date_start || ''));
        } else {
            const agg = rows.reduce((acc, row) => {
                acc.spend += parseFloat(row.spend || 0);
                acc.impressions += parseFloat(row.impressions || 0);
                acc.clicks += parseFloat(row.clicks || 0);
                if (row.actions) acc.actions.push(...row.actions);
                if (row.action_values) acc.action_values.push(...(row.action_values || []));
                return acc;
            }, { spend: 0, impressions: 0, clicks: 0, actions: [], action_values: [] });
            rows = [{
                spend: agg.spend,
                impressions: agg.impressions,
                clicks: agg.clicks,
                ctr: agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
                cpc: agg.clicks > 0 ? agg.spend / agg.clicks : 0,
                cpm: agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : 0,
                actions: agg.actions,
                action_values: agg.action_values,
            }];
        }
    }
    return { ...data, data: rows };
}

/**
 * Fetch comprehensive Facebook Ads PS dashboard metrics
 * @param {Object} config - Configuration object
 * @param {string} config.accessToken - Facebook API access token
 * @param {string} config.adAccountId - Facebook Ad Account ID
 * @param {string} config.startDate - Start date in YYYY-MM-DD format
 * @param {string} config.endDate - End date in YYYY-MM-DD format
 * @param {string} [config.metaIdInclude] - Comma-separated country codes to include (e.g., 'DK,SE,NO'). Empty = all.
 * @param {string} [config.metaIdExclude] - Comma-separated country codes to exclude (e.g., 'FR,ES')
 * @returns {Promise<Object>} Object containing metrics_by_date, top_campaigns, and campaigns_by_date
 */
export async function fetchFacebookAdsPSDashboardMetrics({ accessToken, adAccountId, startDate, endDate, metaIdInclude, metaIdExclude }) {
    const formattedAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const apiUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}/insights`;

    const { effectiveInclude, exclude } = parseMetaIdFilter(metaIdInclude, metaIdExclude);
    const useBreakdown = exclude.length > 0 && effectiveInclude.length === 0;

    console.log(`[Facebook API PS] Fetching data for account: ${formattedAccountId}, date range: ${startDate} to ${endDate}`);
    if (effectiveInclude.length > 0) console.log(`[Facebook API PS] Include countries: ${effectiveInclude.join(',')}`);
    if (exclude.length > 0) console.log(`[Facebook API PS] Exclude countries: ${exclude.join(',')}`);

    const getActionValue = (actions, actionType) => {
        if (!actions) return 0;
        const action = actions.find(a => a.action_type === actionType);
        return parseFloat(action?.value || 0);
    };

    try {
        const accountParams = new URLSearchParams({
            access_token: accessToken,
            time_range: JSON.stringify({ since: startDate, until: endDate }),
            time_increment: '1',
            limit: '500',
            fields: 'spend,clicks,impressions,actions,action_values,date_start',
            level: 'account',
        });

        if (effectiveInclude.length > 0) {
            accountParams.append('filtering', JSON.stringify([
                { field: 'country', operator: 'IN', value: effectiveInclude }
            ]));
        }
        if (useBreakdown) {
            accountParams.append('breakdowns', JSON.stringify(['country']));
        }

        const accountResponse = await fetch(`${apiUrl}?${accountParams.toString()}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!accountResponse.ok) {
            const errorText = await accountResponse.text();
            throw new Error(`Facebook API error: ${accountResponse.status} - ${errorText}`);
        }

        const accountData = await accountResponse.json();
        if (accountData.error) {
            throw new Error(`Facebook API error: ${JSON.stringify(accountData.error)}`);
        }

        let accountRows = accountData.data || [];
        if (useBreakdown && accountRows.length > 0) {
            accountRows = accountRows.filter((row) => {
                const c = (row.country || '').toUpperCase();
                return c && !exclude.includes(c);
            });
            const byDate = {};
            for (const row of accountRows) {
                const key = row.date_start || '';
                if (!byDate[key]) byDate[key] = { date_start: key, spend: 0, clicks: 0, impressions: 0, actions: [], action_values: [] };
                byDate[key].spend += parseFloat(row.spend || 0);
                byDate[key].clicks += parseFloat(row.clicks || 0);
                byDate[key].impressions += parseFloat(row.impressions || 0);
                if (row.actions) byDate[key].actions.push(...row.actions);
                if (row.action_values) byDate[key].action_values.push(...(row.action_values || []));
            }
            accountRows = Object.values(byDate).map((r) => {
                const actionsByType = {};
                for (const a of (r.actions || [])) {
                    actionsByType[a.action_type] = (actionsByType[a.action_type] || 0) + parseFloat(a.value || 0);
                }
                const actionValuesByType = {};
                for (const a of (r.action_values || [])) {
                    actionValuesByType[a.action_type] = (actionValuesByType[a.action_type] || 0) + parseFloat(a.value || 0);
                }
                return {
                    date_start: r.date_start,
                    spend: r.spend,
                    clicks: r.clicks,
                    impressions: r.impressions,
                    actions: Object.entries(actionsByType).map(([t, v]) => ({ action_type: t, value: String(v) })),
                    action_values: Object.entries(actionValuesByType).map(([t, v]) => ({ action_type: t, value: String(v) })),
                };
            }).sort((a, b) => (a.date_start || '').localeCompare(b.date_start || ''));
        }

        const metrics_by_date = accountRows.map(row => {
            const conversions = getActionValue(row.actions, 'purchase') || 
                               getActionValue(row.actions, 'omni_purchase') ||
                               getActionValue(row.actions, 'offsite_conversion.fb_pixel_purchase');
            const conversion_value = getActionValue(row.action_values, 'purchase') || 
                                    getActionValue(row.action_values, 'omni_purchase') ||
                                    getActionValue(row.action_values, 'offsite_conversion.fb_pixel_purchase');
            const clicks = parseFloat(row.clicks || 0);
            const impressions = parseFloat(row.impressions || 0);
            const ad_spend = parseFloat(row.spend || 0);
            return {
                date: row.date_start,
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
            };
        }).sort((a, b) => new Date(a.date) - new Date(b.date));

        const campaignsParams = new URLSearchParams({
            access_token: accessToken,
            time_range: JSON.stringify({ since: startDate, until: endDate }),
            fields: 'campaign_name,spend,clicks,impressions,actions',
            level: 'campaign',
        });
        if (effectiveInclude.length > 0) {
            campaignsParams.append('filtering', JSON.stringify([
                { field: 'country', operator: 'IN', value: effectiveInclude }
            ]));
        }
        if (useBreakdown) {
            campaignsParams.append('breakdowns', JSON.stringify(['country']));
        }

        const campaignsResponse = await fetch(`${apiUrl}?${campaignsParams.toString()}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!campaignsResponse.ok) {
            const errorText = await campaignsResponse.text();
            throw new Error(`Facebook API error: ${campaignsResponse.status} - ${errorText}`);
        }
        const campaignsData = await campaignsResponse.json();
        if (campaignsData.error) {
            throw new Error(`Facebook API error: ${JSON.stringify(campaignsData.error)}`);
        }

        let campaignRows = campaignsData.data || [];
        if (useBreakdown && campaignRows.length > 0) {
            campaignRows = campaignRows.filter((row) => {
                const c = (row.country || '').toUpperCase();
                return c && !exclude.includes(c);
            });
            const byCampaign = {};
            for (const row of campaignRows) {
                const key = row.campaign_name || 'Unknown';
                if (!byCampaign[key]) byCampaign[key] = { campaign_name: key, spend: 0, clicks: 0, impressions: 0, actions: [] };
                byCampaign[key].spend += parseFloat(row.spend || 0);
                byCampaign[key].clicks += parseFloat(row.clicks || 0);
                byCampaign[key].impressions += parseFloat(row.impressions || 0);
                if (row.actions) byCampaign[key].actions.push(...row.actions);
            }
            campaignRows = Object.values(byCampaign).map((r) => {
                const actionsByType = {};
                for (const a of (r.actions || [])) {
                    actionsByType[a.action_type] = (actionsByType[a.action_type] || 0) + parseFloat(a.value || 0);
                }
                return {
                    campaign_name: r.campaign_name,
                    spend: r.spend,
                    clicks: r.clicks,
                    impressions: r.impressions,
                    actions: Object.entries(actionsByType).map(([t, v]) => ({ action_type: t, value: String(v) })),
                };
            });
        }
        const top_campaigns = campaignRows
            .map(row => {
                const clicks = parseFloat(row.clicks || 0);
                const impressions = parseFloat(row.impressions || 0);
                const conversions = getActionValue(row.actions, 'purchase') || 
                                   getActionValue(row.actions, 'omni_purchase') ||
                                   getActionValue(row.actions, 'offsite_conversion.fb_pixel_purchase');
                return {
                    campaign_name: row.campaign_name || 'Unknown',
                    clicks,
                    impressions,
                    conversions,
                    ctr: impressions > 0 ? clicks / impressions : 0,
                };
            })
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 5);

        const topCampaignNames = top_campaigns.map(c => c.campaign_name);
        const campaigns_by_date = [];
        for (const campaignName of topCampaignNames) {
            try {
                const campaignDailyParams = new URLSearchParams({
                    access_token: accessToken,
                    time_range: JSON.stringify({ since: startDate, until: endDate }),
                    fields: 'campaign_name,spend,clicks,impressions,actions,date_start',
                    level: 'campaign',
                });
                const filters = [{
                    field: 'campaign.name',
                    operator: 'EQUAL',
                    value: campaignName
                }];
                if (effectiveInclude.length > 0) {
                    filters.push({
                        field: 'country',
                        operator: 'IN',
                        value: effectiveInclude
                    });
                }
                if (useBreakdown) {
                    campaignDailyParams.append('breakdowns', JSON.stringify(['country']));
                }
                campaignDailyParams.append('filtering', JSON.stringify(filters));

                const dailyResponse = await fetch(`${apiUrl}?${campaignDailyParams.toString()}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (dailyResponse.ok) {
                    const dailyData = await dailyResponse.json();
                    if (!dailyData.error && dailyData.data) {
                        let dailyRows = dailyData.data;
                        if (useBreakdown) {
                            dailyRows = dailyRows.filter((row) => {
                                const c = (row.country || '').toUpperCase();
                                return c && !exclude.includes(c);
                            });
                            const byDateCampaign = {};
                            for (const row of dailyRows) {
                                const key = `${row.date_start || ''}::${row.campaign_name || 'Unknown'}`;
                                if (!byDateCampaign[key]) {
                                    byDateCampaign[key] = { date_start: row.date_start, campaign_name: row.campaign_name || 'Unknown', spend: 0, clicks: 0, impressions: 0, actions: [] };
                                }
                                byDateCampaign[key].spend += parseFloat(row.spend || 0);
                                byDateCampaign[key].clicks += parseFloat(row.clicks || 0);
                                byDateCampaign[key].impressions += parseFloat(row.impressions || 0);
                                if (row.actions) byDateCampaign[key].actions.push(...row.actions);
                            }
                            dailyRows = Object.values(byDateCampaign);
                        }
                        dailyRows.forEach(row => {
                            const clicks = parseFloat(row.clicks || 0);
                            const impressions = parseFloat(row.impressions || 0);
                            const ad_spend = parseFloat(row.spend || 0);
                            const conversions = getActionValue(row.actions, 'purchase') || 
                                               getActionValue(row.actions, 'omni_purchase') ||
                                               getActionValue(row.actions, 'offsite_conversion.fb_pixel_purchase');
                            campaigns_by_date.push({
                                date: row.date_start,
                                campaign_name: row.campaign_name || 'Unknown',
                                clicks,
                                impressions,
                                conversions,
                                ad_spend,
                                ctr: impressions > 0 ? clicks / impressions : 0,
                                conv_rate: clicks > 0 ? conversions / clicks : 0,
                                cpc: clicks > 0 ? ad_spend / clicks : 0,
                                cpm: impressions > 0 ? (ad_spend / impressions) * 1000 : 0,
                            });
                        });
                    }
                }
            } catch (error) {
                console.error(`[Facebook API PS] Error fetching daily data for campaign ${campaignName}:`, error);
            }
        }
        campaigns_by_date.sort((a, b) => {
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
        console.error('[Facebook API PS] Error fetching PS dashboard data:', error);
        throw new Error(`Failed to fetch Facebook Ads PS dashboard data: ${error.message}`);
    }
}
