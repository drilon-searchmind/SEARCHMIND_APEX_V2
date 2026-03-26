// src/app/api/merged-sources/[customerId]/route.js
import { fetchMergedSources } from '@/lib/mergedSourcesApi';
import { getDemoPayload, isDemoCustomerId } from '@/lib/demoCustomer';
import { getDemoMergedSourcesForRange } from '@/lib/demoMergedSources';
import { getCustomerById } from '../../../../../lib/customerOperations';

export async function GET(request, { params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const source = searchParams.get('source');

    if (!startDate || !endDate) {
        return Response.json({ error: 'Missing startDate or endDate' }, { status: 400 });
    }

    if (isDemoCustomerId(customerId)) {
        let customer = null;
        try {
            const doc = await getCustomerById(customerId);
            customer = doc?.toObject ? doc.toObject() : doc;
        } catch {
            customer = getDemoPayload('customer');
        }
        return Response.json(getDemoMergedSourcesForRange(startDate, endDate, customer));
    }

    // Rule: parent-property, daily-overview, and performance-dashboard need daily breakdown for Facebook (PS cost per day, Ad Spend Allocation chart)
    const dailyBreakdown = source === 'parent-property' || source === 'daily-overview' || source === 'performance-dashboard';

    try {
        // Fetch customer settings
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const res = await fetch(`${baseUrl}/api/customers/${customerId}`);
        if (!res.ok) throw new Error('Failed to fetch customer');
        const data = await res.json();
        const settings = {
            customerName: data.customerName,
            customerType: data.customerType || 'Shopify', // Include customer type
            ...(data.CustomerSettings || {}),
            CustomerStaticExpenses: data.CustomerStaticExpenses || {},
        };

        console.log(`[Merged Sources] Customer: ${data.customerName || 'Unknown'} (${customerId}), type: ${settings.customerType}, shop: ${settings.shopifyUrl || 'N/A'}`);

        // Fetch merged sources (now returns daily arrays)
        const merged = await fetchMergedSources(settings, startDate, endDate, {
            dailyBreakdown,
            source: source || undefined,
        });
        return Response.json(merged);
    } catch (error) {
        console.error('Error fetching merged sources:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}