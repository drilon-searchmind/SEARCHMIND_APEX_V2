import { getCustomerById } from '../../../../../lib/customerOperations';
import { fetchKlaviyoDashboardMetricsBothPeriods } from '@/lib/klaviyoDashboard';

// In-memory cache for repeat requests. TTL 5 min. Avoids 50–60s waits when Klaviyo is rate-limited.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

/**
 * GET /api/klaviyo-dashboard/[customerId]
 * Query params: startDate, endDate, prevStartDate, prevEndDate (YYYY-MM-DD)
 * Fetches both periods in one call to respect Klaviyo rate limits (2 campaign-values-reports/min).
 */
export async function GET(req, { params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const prevStartDate = searchParams.get('prevStartDate');
    const prevEndDate = searchParams.get('prevEndDate');

    if (!customerId || !startDate || !endDate) {
        return new Response(
            JSON.stringify({ error: 'Missing required parameters: customerId, startDate, endDate' }),
            { status: 400 }
        );
    }

    try {
        const customer = await getCustomerById(customerId);
        const apiKey = customer?.CustomerSettings?.klaviyoPrivateApiKey;
        if (!apiKey || !apiKey.trim()) {
            return new Response(
                JSON.stringify({ error: 'Klaviyo Private API Key not configured. Add it in Property Settings → Email (Klaviyo).' }),
                { status: 400 }
            );
        }

        const cacheKey = `${customerId}:${startDate}:${endDate}:${prevStartDate || ''}:${prevEndDate || ''}`;
        const cached = cache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
            return new Response(JSON.stringify(cached.data), { status: 200 });
        }

        const result = await fetchKlaviyoDashboardMetricsBothPeriods({
            apiKey: apiKey.trim(),
            startDate,
            endDate,
            prevStartDate: prevStartDate || null,
            prevEndDate: prevEndDate || null,
        });
        cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS });
        return new Response(JSON.stringify(result), { status: 200 });
    } catch (err) {
        console.error('Klaviyo dashboard API error:', err);
        return new Response(
            JSON.stringify({ error: err.message || 'Failed to fetch Klaviyo dashboard metrics' }),
            { status: 500 }
        );
    }
}
