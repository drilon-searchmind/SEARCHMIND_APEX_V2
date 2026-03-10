// src/app/api/customer-segmentation-shopifyql/[customerId]/route.js
// Alternative API: fetches new vs returning customers via ShopifyQL's built-in
// new_or_returning_customer dimension (FROM sales). Much faster than order-level fetch.
// ?full=true returns full segmentation (ShopifyQL + merged-sources) for Customer Performance page.
import { fetchCustomerSegmentationShopifyql, fetchCustomerSegmentationShopifyqlFull } from '@/lib/customerSegmentationShopifyql';

export async function GET(request, { params }) {
    const { searchParams } = new URL(request.url);
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const full = searchParams.get('full') === 'true';

    if (!customerId) return Response.json({ error: 'Missing customerId in path' }, { status: 400 });
    if (!startDate || !endDate) return Response.json({ error: 'Missing startDate or endDate' }, { status: 400 });

    try {
        const data = full
            ? await fetchCustomerSegmentationShopifyqlFull(customerId, startDate, endDate)
            : await fetchCustomerSegmentationShopifyql(customerId, startDate, endDate);
        return Response.json(data);
    } catch (err) {
        console.error('ShopifyQL customer segmentation error:', err);
        return Response.json({ error: err.message || 'ShopifyQL query failed' }, { status: 500 });
    }
}
