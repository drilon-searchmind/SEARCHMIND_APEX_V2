
import { fetchGoogleAdsMetrics } from '@/lib/googleAdsApi';

async function getCustomerSettings(customerId, baseUrl) {
  // Fetch customer data from your API (absolute URL)
  const url = `${baseUrl}/api/customers/${customerId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch customer');
  const data = await res.json();
  return data.CustomerSettings || {};
}

export default async function GoogleAdsPage({ params }) {
  const resolvedParams = await params;
  const customerId = resolvedParams.customerId;
  let googleAdsData = null;
  let error = null;

  // Build absolute URL for fetch
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  try {
    const settings = await getCustomerSettings(customerId, baseUrl);
    const { googleAdsCustomerId } = settings;
    if (!googleAdsCustomerId) throw new Error('Missing Google Ads customer ID');

    // Fetch for 2025-12-01 to 2025-12-17
    googleAdsData = await fetchGoogleAdsMetrics(googleAdsCustomerId, '2025-12-01', '2025-12-17');
  } catch (err) {
    error = err.message;
  }

  return (
    <pre style={{ fontSize: 12, color: 'black', background: '#eee', padding: 16 }}>
      {error ? `Error: ${error}` : JSON.stringify(googleAdsData, null, 2)}
    </pre>
  );
}