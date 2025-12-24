
import { shopifyqlQuery } from '@/lib/shopifyApi';

async function getCustomerSettings(customerId, baseUrl) {
    // Fetch customer data from your API (absolute URL)
    const url = `${baseUrl}/api/customers/${customerId}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch customer');
    const data = await res.json();
    return data.CustomerSettings || {};
}

export default async function EcommercePage({ params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    let shopifyData = null;
    let error = null;

    // Build absolute URL for fetch
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    try {
        const settings = await getCustomerSettings(customerId, baseUrl);
        const { shopifyUrl, shopifyApiPassword } = settings;
        if (!shopifyUrl || !shopifyApiPassword) throw new Error('Missing Shopify credentials');

        // ShopifyQL query for the requested fields, 1st to 17th December (no quotes around dates)
        const query = `FROM sales SHOW gross_sales, discounts, net_sales, taxes, total_sales, average_order_value SINCE 2025-12-01 UNTIL 2025-12-17`;
        shopifyData = await shopifyqlQuery(shopifyUrl, shopifyApiPassword, query);
    } catch (err) {
        error = err.message;
    }

    return (
        <pre style={{ fontSize: 12, color: 'black', background: '#eee', padding: 16 }}>
            {error ? `Error: ${error}` : JSON.stringify(shopifyData, null, 2)}
        </pre>
    );
}