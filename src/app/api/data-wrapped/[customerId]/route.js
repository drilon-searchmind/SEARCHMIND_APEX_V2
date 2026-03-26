import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { fetchMergedSources } from '@/lib/mergedSourcesApi';
import connectToDatabase from '../../../../../lib/mongodb';
import DataWrappedReport from '@/models/DataWrappedReport';
import { getCustomerById } from '../../../../../lib/customerOperations';
import { getDemoPayload, isDemoCustomerId } from '@/lib/demoCustomer';
import { getDemoMergedSourcesForRange } from '@/lib/demoMergedSources';

function getMonthRange(period) {
    const [year, month] = period.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { startDate, endDate };
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

function buildWrappedData(merged, customer, period) {
    const [year, month] = period.split('-').map(Number);
    const { shopifyDaily, facebookDaily, googleDaily, grossProfitNetSales } = merged;

    const netRevenue = shopifyDaily.reduce((sum, d) => sum + (d.net_sales || 0), 0);
    const totalSales = shopifyDaily.reduce((sum, d) => sum + (d.total_sales || 0), 0);
    const orders = shopifyDaily.reduce((sum, d) => sum + (d.orders || 0), 0);
    const fbAdspend = facebookDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    const googleAdspend = googleDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    const totalAdspend = fbAdspend + googleAdspend;

    const roas = totalAdspend > 0 ? totalSales / totalAdspend : 0;
    const poas = totalAdspend > 0 ? grossProfitNetSales / totalAdspend : 0;
    const netAov = orders > 0 ? netRevenue / orders : 0;

    const topChannel = fbAdspend >= googleAdspend ? 'Facebook' : 'Google';
    const topChannelShare = totalAdspend > 0
        ? Math.round(((fbAdspend >= googleAdspend ? fbAdspend : googleAdspend) / totalAdspend) * 100)
        : 0;

    const settings = customer?.CustomerSettings || {};
    const services = [];
    if (settings.facebookAdAccountId) services.push('PS');
    if (settings.googleAdsCustomerId) services.push('PPC');
    if (settings.googleSearchConsoleProperty) services.push('SEO');
    if (settings.shopifyUrl || settings.wooCommerceApiUrl) services.push('EM');
    if (services.length === 0) services.push('Ecommerce');

    return {
        customerName: customer?.customerName || 'Your Store',
        period,
        year,
        month,
        netRevenue,
        orders,
        roas,
        poas,
        totalSpend: totalAdspend,
        netAov,
        topChannel,
        topChannelShare,
        services,
    };
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
        const wrappedData = buildWrappedData(merged, customer, period);
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
        const wrappedData = buildWrappedData(merged, customer, period);

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
