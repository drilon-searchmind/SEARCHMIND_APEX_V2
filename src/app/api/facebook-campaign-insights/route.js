// src/app/api/facebook-campaign-insights/route.js

import { fetchFacebookAdsPSDashboardMetrics } from '@/lib/facebookApi';
import { isDemoCustomerId } from '@/lib/demoCustomer';
import { getDemoFacebookCampaignInsightsForRange } from '@/lib/demoAdMetrics';

export async function GET(req) {
    const FACEBOOK_APP_TOKEN = process.env.FACEBOOK_APP_TOKEN;
    const { searchParams } = new URL(req.url);
    const dashboardCustomerId = searchParams.get('dashboardCustomerId');
    const adAccountId = searchParams.get('adAccountId');
    const metaIdInclude = searchParams.get('customerMetaID') || searchParams.get('metaIdInclude') || '';
    const metaIdExclude = searchParams.get('customerMetaIDExclude') || searchParams.get('metaIdExclude') || '';
    const since = searchParams.get('since');
    const until = searchParams.get('until');

    if (!adAccountId || !since || !until) {
        return new Response(JSON.stringify({ error: 'Missing required query parameters: adAccountId, since, until' }), { status: 400 });
    }

    if (dashboardCustomerId && isDemoCustomerId(dashboardCustomerId)) {
        return new Response(JSON.stringify(getDemoFacebookCampaignInsightsForRange(since, until)), { status: 200 });
    }

    try {
        const metrics = await fetchFacebookAdsPSDashboardMetrics({
            accessToken: FACEBOOK_APP_TOKEN,
            adAccountId,
            startDate: since,
            endDate: until,
            metaIdInclude: metaIdInclude || undefined,
            metaIdExclude: metaIdExclude || undefined,
        });
        return new Response(JSON.stringify(metrics), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}