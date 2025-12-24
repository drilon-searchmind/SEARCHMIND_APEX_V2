
import { fetchFacebookAdsInsights } from '@/lib/facebookApi';

async function getCustomerSettings(customerId, baseUrl) {
    // Fetch customer data from your API (absolute URL)
    const url = `${baseUrl}/api/customers/${customerId}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch customer');
    const data = await res.json();
    return data.CustomerSettings || {};
}

export default async function MetaPage({ params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    let fbData = null;
    let error = null;

    // Build absolute URL for fetch
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    try {
        const settings = await getCustomerSettings(customerId, baseUrl);
        const { facebookAdAccountId, customerMetaID } = settings;
        const accessToken = process.env.FACEBOOK_APP_TOKEN;
        if (!facebookAdAccountId || !customerMetaID || !accessToken) throw new Error('Missing Facebook credentials');

        // Facebook API expects ad account id with 'act_' prefix
        const adAccountId = facebookAdAccountId.startsWith('act_') ? facebookAdAccountId : `act_${facebookAdAccountId}`;

        // Fetch for 2025-12-01 to 2025-12-17
        fbData = await fetchFacebookAdsInsights(adAccountId, customerMetaID, accessToken, '2025-12-01', '2025-12-17');
    } catch (err) {
        error = err.message;
    }

    return (
        <pre style={{ fontSize: 12, color: 'black', background: '#eee', padding: 16 }}>
            {error ? `Error: ${error}` : JSON.stringify(fbData, null, 2)}
        </pre>
    );
}