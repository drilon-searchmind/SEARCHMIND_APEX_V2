import { fetchGoogleAdsPPCDashboardMetrics } from '@/lib/googleAdsPpcDashboard';

export async function GET(req) {
    const GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const GOOGLE_ADS_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
    const GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const GOOGLE_ADS_REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;
    const GOOGLE_ADS_MANAGER_CUSTOMER_ID = process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID;
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!customerId || !startDate || !endDate) {
        return new Response(JSON.stringify({ error: 'Missing required query parameters' }), { status: 400 });
    }

    try {
        const metrics = await fetchGoogleAdsPPCDashboardMetrics({
            developerToken: GOOGLE_ADS_DEVELOPER_TOKEN,
            clientId: GOOGLE_ADS_CLIENT_ID,
            clientSecret: GOOGLE_ADS_CLIENT_SECRET,
            refreshToken: GOOGLE_ADS_REFRESH_TOKEN,
            customerId,
            managerCustomerId: GOOGLE_ADS_MANAGER_CUSTOMER_ID,
            startDate,
            endDate,
        });
        return new Response(JSON.stringify(metrics), { status: 200 });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
