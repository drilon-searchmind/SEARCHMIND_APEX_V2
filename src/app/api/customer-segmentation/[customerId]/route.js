// src/app/api/customer-segmentation/[customerId]/route.js
import fetchCustomerSegmentation, { computeSegmentationFromMerged } from '@/lib/customerSegmentationApi';
import { getDemoPayload, isDemoCustomerId } from '@/lib/demoCustomer';
import { getDemoMergedSourcesForRange } from '@/lib/demoMergedSources';
import { getCustomerById } from '../../../../../lib/customerOperations';

// In-memory cache for repeat requests (same customer + date range). TTL 5 min.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

export async function GET(request, { params }) {
    const { searchParams } = new URL(request.url);
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const fast = searchParams.get('fast') === 'true';
    const extendForLtv = searchParams.get('extendForLtv') !== 'false'; // default true for backward compat

    if (!customerId) return Response.json({ error: 'Missing customerId in path' }, { status: 400 });
    if (!startDate || !endDate) return Response.json({ error: 'Missing startDate or endDate' }, { status: 400 });

    if (isDemoCustomerId(customerId)) {
        let customer = null;
        try {
            const doc = await getCustomerById(customerId);
            customer = doc?.toObject ? doc.toObject() : doc;
        } catch {
            customer = getDemoPayload('customer');
        }
        const merged = getDemoMergedSourcesForRange(startDate, endDate, customer);
        return Response.json(computeSegmentationFromMerged(merged, startDate, endDate));
    }

    const cacheKey = `${customerId}:${startDate}:${endDate}:${fast}:${extendForLtv}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
        return Response.json(cached.data);
    }

    try {
        const data = await fetchCustomerSegmentation(customerId, startDate, endDate, { fast, extendForLtv });
        cache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL_MS });
        return Response.json(data);
    } catch (err) {
        if (!/Shopify access denied|access denied|required access/i.test(err?.message || '')) {
            console.error('Error computing customer segmentation:', err);
        }
        return Response.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}