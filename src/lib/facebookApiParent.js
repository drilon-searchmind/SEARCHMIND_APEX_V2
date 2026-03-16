/**
 * Parse meta ID include/exclude from comma-separated strings.
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
 * @param {string} [metaIdInclude] - Comma-separated country codes to include (e.g., 'DK,SE,NO'). Empty = all.
 * @param {string} [metaIdExclude] - Comma-separated country codes to exclude (e.g., 'FR,ES')
 * @param {string} accessToken - Facebook App Token
 * @param {string} since - Start date (YYYY-MM-DD)
 * @param {string} until - End date (YYYY-MM-DD)
 * @returns {Promise<object>} - The raw response from Facebook Graph API (campaign level)
 */
export async function fetchFacebookCampaignInsights(adAccountId, metaIdInclude, metaIdExclude, accessToken, since, until) {
    const fields = [
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
        time_increment: '1',
        fields: fields.join(','),
        level: 'campaign',
        limit: '1000',
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
 * Fetches Facebook Ads Insights for a given ad account and country (Meta ID).
 * @param {string} adAccountId - Facebook Ad Account ID (with 'act_' prefix)
 * @param {string} [metaIdInclude] - Comma-separated country codes to include (e.g., 'DK,SE,NO'). Empty = all.
 * @param {string} [metaIdExclude] - Comma-separated country codes to exclude (e.g., 'FR,ES')
 * @param {string} accessToken - Facebook App Token
 * @param {string} since - Start date (YYYY-MM-DD)
 * @param {string} until - End date (YYYY-MM-DD)
 * @returns {Promise<object>} - The raw response from Facebook Graph API
 */
export async function fetchFacebookAdsInsights(adAccountId, metaIdInclude, metaIdExclude, accessToken, since, until) {
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

    const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const apiUrl = `https://graph.facebook.com/v21.0/${accountId}/insights`;

    const params = new URLSearchParams({
        access_token: accessToken,
        time_range: JSON.stringify({ since, until }),
        time_increment: '1',
        fields: fields.join(','),
        level: 'account',
        limit: '1000',
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
        const byDate = {};
        for (const row of rows) {
            const key = row.date_start || '';
            if (!byDate[key]) byDate[key] = { date_start: key, spend: 0, impressions: 0, clicks: 0, actions: [], action_values: [] };
            byDate[key].spend += parseFloat(row.spend || 0);
            byDate[key].impressions += parseFloat(row.impressions || 0);
            byDate[key].clicks += parseFloat(row.clicks || 0);
            if (row.actions) byDate[key].actions.push(...row.actions);
            if (row.action_values) byDate[key].action_values.push(...(row.action_values || []));
        }
        rows = Object.values(byDate).map((r) => {
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
                impressions: r.impressions,
                clicks: r.clicks,
                ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
                cpc: r.clicks > 0 ? r.spend / r.clicks : 0,
                cpm: r.impressions > 0 ? (r.spend / r.impressions) * 1000 : 0,
                actions: Object.entries(actionsByType).map(([t, v]) => ({ action_type: t, value: String(v) })),
                action_values: Object.entries(actionValuesByType).map(([t, v]) => ({ action_type: t, value: String(v) })),
            };
        }).sort((a, b) => (a.date_start || '').localeCompare(b.date_start || ''));
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
            limit: '100'
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
                    time_increment: '1',
                    fields: 'campaign_name,spend,clicks,impressions,actions,date_start',
                    level: 'campaign',
                    limit: '1000'
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
