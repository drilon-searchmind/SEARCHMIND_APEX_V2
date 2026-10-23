import { getCustomerById } from '../../../../../lib/customerOperations';
import { fetchKlaviyoDashboardMetricsBothPeriods } from '@/lib/klaviyoDashboard';
import { isDemoCustomerId } from '@/lib/demoCustomer';
import { getDemoEmPart } from '@/lib/demoEm';

export const maxDuration = 120;

// In-memory cache for repeat requests. Reports are rate limited (about 2 per minute, 225 per day),
// so finished periods are kept for 20 minutes and identical in-flight requests share one call.
const CACHE_TTL_MS = 20 * 60 * 1000;
const cache = new Map();
const inflight = new Map();

const PARTS = new Set(['summary', 'flows', 'daily']);

/**
 * GET /api/klaviyo-dashboard/[customerId]
 * Query params: part (summary | flows | daily), startDate, endDate (YYYY-MM-DD)
 * Each part is one Klaviyo report, so the page can ask for them one after another and render as they land.
 */
export async function GET(req, { params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const prevStartDate = searchParams.get('prevStartDate');
    const prevEndDate = searchParams.get('prevEndDate');
    const part = searchParams.get('part') || 'summary';

    if (!customerId || !startDate || !endDate) {
        return new Response(
            JSON.stringify({ error: 'Missing required parameters: customerId, startDate, endDate' }),
            { status: 400 }
        );
    }

    if (!PARTS.has(part)) {
        return new Response(JSON.stringify({ error: `Unknown part: ${part}` }), { status: 400 });
    }

    if (isDemoCustomerId(customerId)) {
        return new Response(JSON.stringify(getDemoEmPart(part, startDate, endDate)), { status: 200 });
    }

    try {
        const cacheKey = `${customerId}:${part}:${startDate}:${endDate}:${prevStartDate || ''}:${prevEndDate || ''}`;
        const cached = cache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
            return new Response(JSON.stringify(cached.data), { status: 200 });
        }

        let pending = inflight.get(cacheKey);
        if (!pending) {
            pending = (async () => {
                const customer = await getCustomerById(customerId);
                const apiKey = customer?.CustomerSettings?.klaviyoPrivateApiKey;
                if (!apiKey || !apiKey.trim()) {
                    const err = new Error('Klaviyo Private API Key not configured. Add it in Property Settings → Email (Klaviyo).');
                    err.status = 400;
                    throw err;
                }
                const result = await fetchKlaviyoDashboardMetricsBothPeriods({
                    apiKey: apiKey.trim(),
                    startDate,
                    endDate,
                    prevStartDate: prevStartDate || null,
                    prevEndDate: prevEndDate || null,
                    part,
                });
                cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS });
                return result;
            })().finally(() => inflight.delete(cacheKey));
            inflight.set(cacheKey, pending);
        }

        const result = await pending;
        return new Response(JSON.stringify(result), { status: 200 });
    } catch (err) {
        console.error('Klaviyo dashboard API error:', err);
        return new Response(
            JSON.stringify({ error: err.message || 'Failed to fetch Klaviyo dashboard metrics' }),
            { status: err.status || 500 }
        );
    }
}
