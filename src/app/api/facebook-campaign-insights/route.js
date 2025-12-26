// src/app/api/facebook-campaign-insights/route.js

import { fetchFacebookAdsPSDashboardMetrics } from '@/lib/facebookApi';

export async function GET(req) {
    const FACEBOOK_APP_TOKEN = process.env.FACEBOOK_APP_TOKEN;
    const { searchParams } = new URL(req.url);
    const adAccountId = searchParams.get('adAccountId');
    const metaCountryCode = searchParams.get('metaCountryCode');
    const since = searchParams.get('since');
    const until = searchParams.get('until');

    if (!adAccountId || !metaCountryCode || !since || !until) {
        return new Response(JSON.stringify({ error: 'Missing required query parameters' }), { status: 400 });
    }

    try {
        const metrics = await fetchFacebookAdsPSDashboardMetrics({
            accessToken: FACEBOOK_APP_TOKEN,
            adAccountId,
            startDate: since,
            endDate: until,
            countryCode: metaCountryCode,
        });
        return new Response(JSON.stringify(metrics), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}