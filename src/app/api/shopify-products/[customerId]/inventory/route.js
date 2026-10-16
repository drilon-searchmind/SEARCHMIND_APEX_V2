import { fetchProductInventoryOnlyCached } from '@/lib/shopifyProductsInventoryCache.server';
import { getDemoPayload, isDemoCustomerId } from '@/lib/demoCustomer';

export const maxDuration = 300;

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

        const arrivalsOnly = body?.arrivalsOnly === true;
        const includeArrivals = body?.includeArrivals === true;
        const startDate = body?.startDate || '';
        const endDate = body?.endDate || '';
        const salesFingerprint = body?.salesFingerprint || null;
        const customerType = data.customerType || data.CustomerSettings?.customerType || 'Shopify';

        const { inventory, fromCache, fetchedCount, salesFingerprint: resolvedFingerprint } =
            await fetchProductInventoryOnlyCached(
            settings,
            customerId,
            productIds,
            {
                arrivalsOnly,
                includeArrivals,
                includeVariantDetails: false,
                startDate,
                endDate,
                customerType,
                salesFingerprint,
            }
            );
        return Response.json({
            inventory,
            fromCache,
            fetchedCount,
            salesFingerprint: resolvedFingerprint,
        });
    } catch (error) {
        console.error('Error fetching product inventory:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
