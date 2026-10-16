import { fetchStoreInventoryTotalsCached } from '@/lib/shopifyProductsInventoryCache.server';
import { getDemoPayload, isDemoCustomerId } from '@/lib/demoCustomer';

export const maxDuration = 300;

function demoInventoryTotals() {
    const payload = getDemoPayload('shopifyInventory');
    const inventory = payload?.inventory || {};
    const totals = {
        inventoryStock: 0,
        inventoryValue: 0,
        incomingQuantity: 0,
        productCount: 0,
    };
    for (const row of Object.values(inventory)) {
        totals.inventoryStock += Number(row.inventoryStock) || 0;
        totals.inventoryValue += Number(row.inventoryValue) || 0;
        totals.incomingQuantity += Number(row.incomingQuantity) || 0;
        totals.productCount += 1;
    }
    return totals;
}

export async function GET(request, { params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    if (!customerId) {
        return Response.json({ error: 'Missing customerId' }, { status: 400 });
    }

    if (isDemoCustomerId(customerId)) {
        return Response.json({ totals: demoInventoryTotals(), fromCache: false });
    }

    if (!startDate || !endDate) {
        return Response.json({ error: 'Missing startDate or endDate' }, { status: 400 });
    }

    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/customers/${customerId}`);
        if (!res.ok) throw new Error('Failed to fetch customer');
        const data = await res.json();
        const settings = data.CustomerSettings || {};
        const customerType = data.customerType || data.CustomerSettings?.customerType || 'Shopify';

        const result = await fetchStoreInventoryTotalsCached(settings, customerId, {
            startDate,
            endDate,
            customerType,
        });
        return Response.json({
            totals: result.totals,
            fromCache: result.fromCache,
            cacheLayer: result.cacheLayer ?? null,
            salesFingerprint: result.salesFingerprint ?? null,
        });
    } catch (error) {
        console.error('Error fetching store inventory totals:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
