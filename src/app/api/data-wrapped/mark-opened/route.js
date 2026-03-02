import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { markOpenedWrappedPeriod } from '../../../../../lib/userService';

export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { customerId, period, periods } = body || {};

        const customerIdStr = String(customerId || "").trim();
        if (!customerIdStr) {
            return Response.json({ error: 'Missing customerId' }, { status: 400 });
        }

        const toMark = Array.isArray(periods)
            ? periods.filter((p) => typeof p === 'string' && /^\d{4}-\d{2}$/.test(p))
            : typeof period === 'string' && /^\d{4}-\d{2}$/.test(period)
                ? [period]
                : [];

        if (toMark.length === 0) {
            return Response.json({ error: 'Missing period or periods' }, { status: 400 });
        }

        for (const p of toMark) {
            await markOpenedWrappedPeriod(session.user.id, customerIdStr, p);
        }
        return Response.json({ ok: true });
    } catch (error) {
        console.error('Error marking wrapped opened:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
