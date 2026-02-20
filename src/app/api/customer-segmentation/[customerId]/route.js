// src/app/api/customer-segmentation/[customerId]/route.js
import fetchCustomerSegmentation from '@/lib/customerSegmentationApi';

export async function GET(request, { params }) {
    const { searchParams } = new URL(request.url);
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const fast = searchParams.get('fast') === 'true';

    if (!customerId) return Response.json({ error: 'Missing customerId in path' }, { status: 400 });
    if (!startDate || !endDate) return Response.json({ error: 'Missing startDate or endDate' }, { status: 400 });

    try {
        const data = await fetchCustomerSegmentation(customerId, startDate, endDate, { fast });
        return Response.json(data);
    } catch (err) {
        console.error('Error computing customer segmentation:', err);
        return Response.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}