/**
 * Fetches Facebook Ads Insights at the campaign level for a given ad account and country (Meta ID).
 * @param {string} adAccountId - Facebook Ad Account ID (with 'act_' prefix)
 * @param {string} metaCountryCode - Country code to filter (e.g., 'DK')
 * @param {string} accessToken - Facebook App Token
 * @param {string} since - Start date (YYYY-MM-DD)
 * @param {string} until - End date (YYYY-MM-DD)
 * @returns {Promise<object>} - The raw response from Facebook Graph API (campaign level)
 */
export async function fetchFacebookCampaignInsights(adAccountId, metaCountryCode, accessToken, since, until) {
    // Metrics to fetch at campaign level
    const fields = [
        'campaign_name',
        'spend',
        'impressions',
        'clicks',
        'ctr',
        'cpc',
        'cpm',
    ];

    // Facebook API endpoint (always use act_ prefix)
    const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const apiUrl = `https://graph.facebook.com/v21.0/${accountId}/insights`;

    // Query parameters
    const params = new URLSearchParams({
        access_token: accessToken,
        time_range: JSON.stringify({ since, until }),
        time_increment: '1', // Aggregate for the period
        fields: fields.join(','),
        level: 'campaign',
        limit: '1000',
    });

    // Add country filtering if metaCountryCode is provided
    if (metaCountryCode) {
        params.append('filtering', JSON.stringify([
            {
                field: 'country',
                operator: 'IN',
                value: [metaCountryCode]
            }
        ]));
    }

    const url = `${apiUrl}?${params.toString()}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Facebook API error: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    if (data.error) {
        throw new Error(`Facebook API error: ${JSON.stringify(data.error)}`);
    }

    // Optionally, filter by country code (metaCountryCode) if not already filtered
    let filtered = data.data || [];
    if (metaCountryCode) {
        filtered = filtered.filter(row => {
            if (!row.country) return false;
            return row.country.toUpperCase() === metaCountryCode.toUpperCase();
        });
    }
    return { ...data, data: filtered };
}
// src/lib/facebookApi.js

/**
 * Fetches Facebook Ads Insights for a given ad account and country (Meta ID).
 * @param {string} adAccountId - Facebook Ad Account ID (with 'act_' prefix)
 * @param {string} metaCountryCode - Country code to filter (e.g., 'DK')
 * @param {string} accessToken - Facebook App Token
 * @param {string} since - Start date (YYYY-MM-DD)
 * @param {string} until - End date (YYYY-MM-DD)
 * @returns {Promise<object>} - The raw response from Facebook Graph API
 */
export async function fetchFacebookAdsInsights(adAccountId, metaCountryCode, accessToken, since, until) {
    // Metrics to fetch
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

    // Facebook API endpoint (always use act_ prefix)
    const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const apiUrl = `https://graph.facebook.com/v21.0/${accountId}/insights`;

    // Query parameters
    const params = new URLSearchParams({
        access_token: accessToken,
        time_range: JSON.stringify({ since, until }),
        time_increment: '1', // Daily breakdown
        fields: fields.join(','),
        level: 'account',
        limit: '1000',
    });

    // Add country filtering if metaCountryCode is provided
    if (metaCountryCode) {
        params.append('filtering', JSON.stringify([
            {
                field: 'country',
                operator: 'IN',
                value: [metaCountryCode]
            }
        ]));
    }

    const url = `${apiUrl}?${params.toString()}`;

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Facebook API error: ${res.status} - ${errorText}`);
    }

    const data = await res.json();
    if (data.error) {
        throw new Error(`Facebook API error: ${JSON.stringify(data.error)}`);
    }

    // Optionally, filter by country code (metaCountryCode) if not already filtered
    let filtered = data.data || [];
    if (metaCountryCode) {
        // Log row structure for debugging
        filtered.forEach((row, idx) => {
            // console.log(`Row ${idx}:`, row);
        });
        
        filtered = filtered.filter(row => {
            if (!row.country) return false;
            return row.country.toUpperCase() === metaCountryCode.toUpperCase();
        });
    }
    return { ...data, data: filtered };
}

/**
 * Fetch comprehensive Facebook Ads PS dashboard metrics
 * @param {Object} config - Configuration object
 * @param {string} config.accessToken - Facebook API access token
 * @param {string} config.adAccountId - Facebook Ad Account ID
 * @param {string} config.startDate - Start date in YYYY-MM-DD format
 * @param {string} config.endDate - End date in YYYY-MM-DD format
 * @param {string} [config.countryCode] - Optional country code to filter by (e.g., 'DK', 'DE')
 * @returns {Promise<Object>} Object containing metrics_by_date, top_campaigns, and campaigns_by_date
 */
export async function fetchFacebookAdsPSDashboardMetrics({ accessToken, adAccountId, startDate, endDate, countryCode }) {
    const formattedAccountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const apiUrl = `https://graph.facebook.com/v21.0/${formattedAccountId}/insights`;

    console.log(`[Facebook API PS] Fetching data for account: ${formattedAccountId}, date range: ${startDate} to ${endDate}`);
    if (countryCode) {
        console.log(`[Facebook API PS] Filtering by country: ${countryCode}`);
    }

    // Helper function to extract action values
    const getActionValue = (actions, actionType) => {
        if (!actions) return 0;
        const action = actions.find(a => a.action_type === actionType);
        return parseFloat(action?.value || 0);
    };

    try {
        // Step 1: Fetch account-level daily metrics
        console.log('[Facebook API PS] Fetching account-level daily metrics');
        const accountParams = new URLSearchParams({
            access_token: accessToken,
            time_range: JSON.stringify({
                since: startDate,
                until: endDate
            }),
            time_increment: '1',
            fields: 'spend,clicks,impressions,actions,action_values,date_start',
            level: 'account',
            limit: '1000'
        });

        if (countryCode) {
            accountParams.append('filtering', JSON.stringify([
                {
                    field: 'country',
                    operator: 'IN',
                    value: [countryCode]
                }
            ]));
        }

        const accountResponse = await fetch(`${apiUrl}?${accountParams.toString()}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!accountResponse.ok) {
            const errorText = await accountResponse.text();
            console.error(`[Facebook API PS] Account metrics error: ${accountResponse.status}`, errorText);
            throw new Error(`Facebook API error: ${accountResponse.status} - ${errorText}`);
        }

        const accountData = await accountResponse.json();
        if (accountData.error) {
            throw new Error(`Facebook API error: ${JSON.stringify(accountData.error)}`);
        }

        const metrics_by_date = (accountData.data || []).map(row => {
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

        // Step 2: Fetch top campaigns
        console.log('[Facebook API PS] Fetching top campaigns');
        const campaignsParams = new URLSearchParams({
            access_token: accessToken,
            time_range: JSON.stringify({
                since: startDate,
                until: endDate
            }),
            fields: 'campaign_name,spend,clicks,impressions,actions',
            level: 'campaign',
            limit: '100'
        });
        if (countryCode) {
            campaignsParams.append('filtering', JSON.stringify([
                {
                    field: 'country',
                    operator: 'IN',
                    value: [countryCode]
                }
            ]));
        }
        const campaignsResponse = await fetch(`${apiUrl}?${campaignsParams.toString()}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!campaignsResponse.ok) {
            const errorText = await campaignsResponse.text();
            console.error(`[Facebook API PS] Campaigns error: ${campaignsResponse.status}`, errorText);
            throw new Error(`Facebook API error: ${campaignsResponse.status} - ${errorText}`);
        }
        const campaignsData = await campaignsResponse.json();
        if (campaignsData.error) {
            throw new Error(`Facebook API error: ${JSON.stringify(campaignsData.error)}`);
        }
        const top_campaigns = (campaignsData.data || [])
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

        // Step 3: For top campaigns, fetch daily breakdown
        console.log('[Facebook API PS] Fetching daily breakdown for top campaigns');
        const topCampaignNames = top_campaigns.map(c => c.campaign_name);
        const campaigns_by_date = [];
        for (const campaignName of topCampaignNames) {
            try {
                const campaignDailyParams = new URLSearchParams({
                    access_token: accessToken,
                    time_range: JSON.stringify({
                        since: startDate,
                        until: endDate
                    }),
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
                if (countryCode) {
                    filters.push({
                        field: 'country',
                        operator: 'IN',
                        value: [countryCode]
                    });
                }
                campaignDailyParams.append('filtering', JSON.stringify(filters));
                const dailyResponse = await fetch(`${apiUrl}?${campaignDailyParams.toString()}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                if (dailyResponse.ok) {
                    const dailyData = await dailyResponse.json();
                    if (!dailyData.error && dailyData.data) {
                        dailyData.data.forEach(row => {
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
        console.log(`[Facebook API PS] Successfully fetched: ${metrics_by_date.length} days, ${top_campaigns.length} campaigns, ${campaigns_by_date.length} campaign-date records`);
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
