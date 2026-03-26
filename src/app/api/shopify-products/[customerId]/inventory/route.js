import { fetchProductInventoryOnly } from '@/lib/shopifyProductsApi';
import { getDemoPayload, isDemoCustomerId } from '@/lib/demoCustomer';

export async function POST(request, { params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;

    if (!customerId) {
        return Response.json({ error: 'Missing customerId' }, { status: 400 });
    }

    if (isDemoCustomerId(customerId)) {
        return Response.json(getDemoPayload('shopifyInventory'));
    }

    try {
        const body = await request.json();
        const productIds = Array.isArray(body?.productIds) ? body.productIds : [];
        if (!productIds.length) {
            return Response.json({ inventory: {} });
        }

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/customers/${customerId}`);
        if (!res.ok) throw new Error('Failed to fetch customer');
        const data = await res.json();
        const settings = data.CustomerSettings || {};

        const inventory = await fetchProductInventoryOnly(settings, productIds);
        return Response.json({ inventory });
    } catch (error) {
        console.error('Error fetching product inventory:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
