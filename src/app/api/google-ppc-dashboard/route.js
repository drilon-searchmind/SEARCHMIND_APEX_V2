import { fetchGoogleAdsPPCDashboardMetrics } from '@/lib/googleAdsPpcDashboard';
import { isDemoCustomerId } from '@/lib/demoCustomer';
import { getDemoGooglePpcDashboardForRange } from '@/lib/demoAdMetrics';
import {
    getGoogleAdsDeveloperToken,
    getGoogleAdsManagerCustomerId,
    getGoogleAdsOAuthClientId,
    getGoogleAdsOAuthClientSecret,
    getGoogleAdsRefreshToken,
} from '@/lib/googleAdsOAuthEnv';

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const countryFilter = searchParams.get('countryFilter') || undefined;
    const countryExclude = searchParams.get('countryExclude') || undefined;
    const campaignInclude = searchParams.get('campaignInclude') || undefined;
    const campaignExclude = searchParams.get('campaignExclude') || undefined;
    const dashboardCustomerId = searchParams.get('dashboardCustomerId');

    if (!customerId || !startDate || !endDate) {
        return new Response(JSON.stringify({ error: 'Missing required query parameters' }), { status: 400 });
    }

    if (dashboardCustomerId && isDemoCustomerId(dashboardCustomerId)) {
        return new Response(JSON.stringify(getDemoGooglePpcDashboardForRange(startDate, endDate)), { status: 200 });
    }

    try {
        const metrics = await fetchGoogleAdsPPCDashboardMetrics({
            developerToken: getGoogleAdsDeveloperToken(),
            clientId: getGoogleAdsOAuthClientId(),
            clientSecret: getGoogleAdsOAuthClientSecret(),
            refreshToken: getGoogleAdsRefreshToken(),
            customerId,
            managerCustomerId: getGoogleAdsManagerCustomerId(),
            startDate,
            endDate,
            countryFilter,
            countryExclude,
            campaignInclude,
            campaignExclude,
        });
        return new Response(JSON.stringify(metrics), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
