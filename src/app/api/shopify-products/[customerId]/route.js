import { fetchShopifyProductPerformancePage } from '@/lib/shopifyProductsApi';
import { getDemoPayload, isDemoCustomerId } from '@/lib/demoCustomer';

export const maxDuration = 300;

export async function GET(request, { params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const catalogCursor = searchParams.get('catalogCursor') || null;
    const salesOffset = parseInt(searchParams.get('salesOffset') || '0', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '100', 10);

    if (!startDate || !endDate) {
        return Response.json({ error: 'Missing startDate or endDate' }, { status: 400 });
    }

    if (isDemoCustomerId(customerId)) {
        return Response.json(getDemoPayload('shopifyProducts'));
    }

    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/customers/${customerId}`);
        if (!res.ok) throw new Error('Failed to fetch customer');
        const data = await res.json();
        const settings = {
            ...(data.CustomerSettings || {}),
            CustomerStaticExpenses: data.CustomerStaticExpenses || {},
        };
        const customerType = data.customerType || data.CustomerSettings?.customerType || 'Shopify';

        const result = await fetchShopifyProductPerformancePage(settings, startDate, endDate, {
            catalogCursor,
            salesOffset: Number.isFinite(salesOffset) ? salesOffset : 0,
            pageSize: Number.isFinite(pageSize) ? pageSize : 100,
            customerType,
        });
        return Response.json(result);
    } catch (error) {
        console.error('Error fetching shopify product metrics:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
