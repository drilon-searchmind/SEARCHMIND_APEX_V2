import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import connectToDatabase from '../../../../../../lib/mongodb';
import DataWrappedReport from '@/models/DataWrappedReport';
import { getCustomerById } from '../../../../../../lib/customerOperations';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getPeriodLabel(period) {
    if (!period || !/^\d{4}-\d{2}$/.test(period)) return period || '';
    const [y, m] = period.split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${y}`;
}

export async function GET(request, { params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;

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

        const reports = await DataWrappedReport.find({ customerId })
            .select('period createdAt')
            .sort({ period: -1 })
            .lean();

        const monthly = reports.map((r) => ({
            period: r.period,
            periodLabel: getPeriodLabel(r.period),
            createdAt: r.createdAt,
        }));

        return Response.json({
            monthly,
            quarterly: [],
            yearly: [],
        });
    } catch (error) {
        console.error('Error fetching data wrapped reports:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
