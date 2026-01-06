import { fetchShopifyProductMetrics } from '@/lib/shopifyProductsApi';

export async function GET(request, { params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
        return Response.json({ error: 'Missing startDate or endDate' }, { status: 400 });
    }

    try {
        // Fetch customer settings
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/customers/${customerId}`);
        if (!res.ok) throw new Error('Failed to fetch customer');
        const data = await res.json();
        const settings = {
            ...(data.CustomerSettings || {}),
            CustomerStaticExpenses: data.CustomerStaticExpenses || {},
        };

        const products = await fetchShopifyProductMetrics(settings, startDate, endDate);
        return Response.json({ products });
    } catch (error) {
        console.error('Error fetching shopify product metrics:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
