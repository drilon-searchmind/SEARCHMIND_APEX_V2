import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { fetchMergedSources } from '@/lib/mergedSourcesApi';
import connectToDatabase from '../../../../../lib/mongodb';
import DataWrappedReport from '@/models/DataWrappedReport';
import { getCustomerById } from '../../../../../lib/customerOperations';
import { getDemoPayload, isDemoCustomerId } from '@/lib/demoCustomer';
import { getDemoMergedSourcesForRange } from '@/lib/demoMergedSources';
import { buildWrappedData, getMonthRange, previousPeriod, summarizeMerged } from '@/lib/dataWrapped';

/**
 * Headline numbers of the previous month for the comparison slide. A saved report is reused when there
 * is one; otherwise the month is fetched once. Any failure just means the comparison slide is skipped.
 */
async function loadPreviousSummary(customerId, period, settings) {
    const prevPeriod = previousPeriod(period);
    try {
        const saved = await DataWrappedReport.findOne({ customerId, period: prevPeriod }).lean();
        const d = saved?.data;
        if (d && Number.isFinite(Number(d.netRevenue))) {
            return {
                period: prevPeriod,
                netRevenue: Number(d.netRevenue) || 0,
                orders: Number(d.orders) || 0,
                netAov: Number(d.netAov) || 0,
                totalSpend: Number(d.totalSpend) || 0,
                roas: Number(d.roas) || 0,
                poas: Number(d.poas) || 0,
            };
        }
        const { startDate, endDate } = getMonthRange(prevPeriod);
        const merged = await fetchMergedSources(settings, startDate, endDate, {});
        const summary = summarizeMerged(merged);
        return summary.netRevenue > 0 || summary.orders > 0 ? { period: prevPeriod, ...summary } : null;
    } catch (err) {
        console.error('Data wrapped previous month error:', err);
        return null;
    }
}

function isLastDayOfMonth() {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return d.getDate() === lastDay;
}

function isCurrentMonth(period) {
    const d = new Date();
    const current = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return period === current;
}

export async function GET(request, { params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
        return Response.json({ error: 'Missing or invalid period (expected YYYY-MM)' }, { status: 400 });
    }

    if (isDemoCustomerId(customerId)) {
        const { startDate, endDate } = getMonthRange(period);
        let customer = null;
        try {
            const doc = await getCustomerById(customerId);
            customer = doc?.toObject ? doc.toObject() : doc;
        } catch {
            customer = getDemoPayload('customer');
        }
        const merged = getDemoMergedSourcesForRange(startDate, endDate, customer);
        const prevPeriod = previousPeriod(period);
        const prevRange = getMonthRange(prevPeriod);
        const prevMerged = getDemoMergedSourcesForRange(prevRange.startDate, prevRange.endDate, customer);
        const prevSummary = summarizeMerged(prevMerged);
        const prev = prevSummary.netRevenue > 0 ? { period: prevPeriod, ...prevSummary } : null;
        const wrappedData = buildWrappedData(merged, customer, period, prev);
        return Response.json({ data: wrappedData, fromCache: true });
    }

    try {
        await connectToDatabase();

        const customer = await getCustomerById(customerId);
        if (!customer) {
            return Response.json({ error: 'Customer not found' }, { status: 404 });
        }

        if (session.user.isExternal) {
            const sharedIds = (session.user.sharedCustomers || []).map(id => String(id));
            if (!sharedIds.includes(String(customerId))) {
                return Response.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        const existing = await DataWrappedReport.findOne({ customerId, period }).lean();
        if (existing?.data) {
            return Response.json({ data: existing.data, fromCache: true });
        }

        if (isCurrentMonth(period) && !isLastDayOfMonth()) {
            return Response.json(
                { error: 'Wrapped for this month will be available on the last day of the month.' },
                { status: 403 }
            );
        }

        const { startDate, endDate } = getMonthRange(period);
        const settings = {
            customerType: customer.customerType || 'Shopify',
            ...(customer.CustomerSettings || {}),
            CustomerStaticExpenses: customer.CustomerStaticExpenses || {},
        };

        const merged = await fetchMergedSources(settings, startDate, endDate, {});
        const prev = await loadPreviousSummary(customerId, period, settings);
        const wrappedData = buildWrappedData(merged, customer, period, prev);

        const report = new DataWrappedReport({
            customerId,
            period,
            data: wrappedData,
        });
        report.save().catch(err => console.error('DataWrappedReport save error:', err));

        return Response.json({ data: wrappedData, fromCache: false });
    } catch (error) {
        console.error('Error fetching data wrapped:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
