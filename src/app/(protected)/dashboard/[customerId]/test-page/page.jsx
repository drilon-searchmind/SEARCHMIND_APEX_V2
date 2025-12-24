import { fetchMergedSources } from '@/lib/mergedSourcesApi';

async function getCustomerSettings(customerId, baseUrl) {
    // Fetch customer data from your API (absolute URL)
    const url = `${baseUrl}/api/customers/${customerId}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch customer');
    const data = await res.json();
    return data.CustomerSettings || {};
}

export default async function TestMergedSourcesPage({ params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    let mergedData = null;
    let error = null;

    // Build absolute URL for fetch
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    try {
        const settings = await getCustomerSettings(customerId, baseUrl);
        console.log('CustomerSettings:', JSON.stringify(settings));
        mergedData = await fetchMergedSources(settings, '2025-12-01', '2025-12-17');
    } catch (err) {
        error = err.message;
    }

    return (
        <pre style={{ fontSize: 14, color: 'black', background: '#eee', padding: 16 }}>
            {error ? `Error: ${error}` : JSON.stringify(mergedData, null, 2)}
        </pre>
    );
}