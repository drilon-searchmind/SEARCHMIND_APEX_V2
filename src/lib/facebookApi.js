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
