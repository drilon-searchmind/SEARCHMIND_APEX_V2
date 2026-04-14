import { getServerSession } from 'next-auth';
import mongoose from 'mongoose';
import { authOptions } from '../../auth/[...nextauth]/route';
import connectToDatabase from '@root/lib/mongodb';
import { getCustomerById } from '@root/lib/customerOperations';
import ShareOfSearchSnapshot from '@/models/ShareOfSearchSnapshot';
import { fetchBrandSearchMetrics } from '@/lib/googleAdsKeywordIdeas';
import {
    getShareOfSearchPreviousPeriodRange,
    getShareOfSearchLastYearRange,
    mergeShareComparisonIntoRows,
} from '@/lib/shareOfSearchComparisonRanges';
import { isDemoCustomerId } from '@/lib/demoCustomer';

function isValidIntegrationId(value) {
    const s = String(value ?? '').trim();
    if (!s) return false;
    if (s === '0' || s === '1') return false;
    return true;
}

async function assertCustomerAccess(session, customerId) {
    const customer = await getCustomerById(customerId);
    if (session.user.isExternal) {
        const sharedIds = (session.user.sharedCustomers || []).map((id) => String(id));
        if (!sharedIds.includes(String(customerId))) {
            const err = new Error('Forbidden');
            err.statusCode = 403;
            throw err;
        }
    }
    return customer;
}

function demoHistory() {
    const now = new Date().toISOString();
    const brands = ['Acme', 'Contoso'];
    const rows = brands.map((brand, i) => ({
        brand,
        apiKeywordText: brand,
        volumeInRange: 120000 * (i + 1),
        avgMonthlySearches: 10000 * (i + 1),
        monthlySearchVolumes: [],
        sharePct: 0,
    }));
    const total = rows.reduce((s, r) => s + r.volumeInRange, 0);
    for (const r of rows) {
        r.sharePct = total > 0 ? Math.round((r.volumeInRange / total) * 10000) / 100 : 0;
        r.sharePctPreviousPeriod = Math.max(0, Math.round((r.sharePct - 2.5) * 100) / 100);
        r.sharePctLastYear = Math.max(0, Math.round((r.sharePct - 5) * 100) / 100);
    }
    return [
        {
            _id: 'demo-snapshot-1',
            view: 'share',
            brands,
            geoLabel: 'Denmark',
            languageCode: 'en',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            summary: { totalVolume: total, brandCount: rows.length },
            rows,
            createdAt: now,
        },
    ];
}

function demoMetricsFromBrands(brands, startDate, endDate) {
    const clean = [...new Set((brands || []).map((b) => String(b).trim()).filter(Boolean))];
    const list = clean.length
        ? clean
        : ['Demo Brand A', 'Demo Brand B'];
    const rows = list.map((brand, i) => ({
        brand,
        apiKeywordText: brand,
        volumeInRange: 50000 * (i + 1),
        avgMonthlySearches: 4200 * (i + 1),
        monthlySearchVolumes: [],
        sharePct: 0,
    }));
    const total = rows.reduce((s, r) => s + r.volumeInRange, 0);
    for (const r of rows) {
        r.sharePct = total > 0 ? Math.round((r.volumeInRange / total) * 10000) / 100 : 0;
        r.sharePctPreviousPeriod = Math.max(0, Math.round((r.sharePct - 1.2) * 100) / 100);
        r.sharePctLastYear = Math.max(0, Math.round((r.sharePct - 3) * 100) / 100);
    }
    return {
        geoCriterionId: 2208,
        language: 'languageConstants/1009',
        rows,
        rawResultCount: rows.length,
        normalizedStartDate: startDate,
        normalizedEndDate: endDate,
    };
}

export async function GET(request, { params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
        return Response.json({ error: 'Invalid customer id' }, { status: 400 });
    }

    if (isDemoCustomerId(customerId)) {
        return Response.json({ items: demoHistory() });
    }

    try {
        await connectToDatabase();
        try {
            await assertCustomerAccess(session, customerId);
        } catch (accessErr) {
            if (accessErr.statusCode === 403) {
                return Response.json({ error: 'Forbidden' }, { status: 403 });
            }
            if (String(accessErr.message || '').toLowerCase().includes('not found')) {
                return Response.json({ error: 'Customer not found' }, { status: 404 });
            }
            throw accessErr;
        }
        const items = await ShareOfSearchSnapshot.find({ customerId })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        return Response.json({ items });
    } catch (error) {
        if (error.statusCode === 403) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (String(error.message || '').toLowerCase().includes('not found')) {
            return Response.json({ error: 'Customer not found' }, { status: 404 });
        }
        console.error('share-of-search GET:', error);
        return Response.json({ error: error.message || 'Failed to load history' }, { status: 500 });
    }
}

export async function POST(request, { params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
        return Response.json({ error: 'Invalid customer id' }, { status: 400 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
        brands,
        geoLabel = 'Denmark',
        languageCode = 'en',
        startDate,
        endDate,
    } = body || {};

    if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
        return Response.json({ error: 'startDate and endDate (YYYY-MM-DD) are required' }, { status: 400 });
    }

    if (!Array.isArray(brands) || brands.length === 0) {
        return Response.json({ error: 'brands array is required' }, { status: 400 });
    }

    if (isDemoCustomerId(customerId)) {
        const metrics = demoMetricsFromBrands(brands, startDate, endDate);
        const prevRange = getShareOfSearchPreviousPeriodRange(
            metrics.normalizedStartDate,
            metrics.normalizedEndDate
        );
        const lyRange = getShareOfSearchLastYearRange(
            metrics.normalizedStartDate,
            metrics.normalizedEndDate
        );
        metrics.comparisonRanges = {
            previousPeriod: { ...prevRange, ok: true },
            lastYear: { ...lyRange, ok: true },
        };
        return Response.json({
            snapshot: null,
            metrics,
            demo: true,
        });
    }

    try {
        await connectToDatabase();
        let customer;
        try {
            customer = await assertCustomerAccess(session, customerId);
        } catch (accessErr) {
            if (accessErr.statusCode === 403) {
                return Response.json({ error: 'Forbidden' }, { status: 403 });
            }
            if (String(accessErr.message || '').toLowerCase().includes('not found')) {
                return Response.json({ error: 'Customer not found' }, { status: 404 });
            }
            throw accessErr;
        }
        const googleAdsCustomerId = customer.CustomerSettings?.googleAdsCustomerId;
        if (!isValidIntegrationId(googleAdsCustomerId)) {
            return Response.json(
                { error: 'Google Ads customer ID is not configured for this account' },
                { status: 400 }
            );
        }

        const metrics = await fetchBrandSearchMetrics({
            googleAdsCustomerId,
            brands,
            geoLabel,
            languageCode,
            startDate,
            endDate,
        });

        const prevRange = getShareOfSearchPreviousPeriodRange(
            metrics.normalizedStartDate,
            metrics.normalizedEndDate
        );
        const lyRange = getShareOfSearchLastYearRange(
            metrics.normalizedStartDate,
            metrics.normalizedEndDate
        );

        let previousPeriodRows = null;
        let lastYearRows = null;
        const fetchOpts = {
            googleAdsCustomerId,
            brands,
            geoLabel,
            languageCode,
        };
        try {
            const pm = await fetchBrandSearchMetrics({
                ...fetchOpts,
                startDate: prevRange.startDate,
                endDate: prevRange.endDate,
            });
            previousPeriodRows = pm.rows;
        } catch (e) {
            console.warn('share-of-search previous period fetch:', e.message);
        }
        try {
            const lm = await fetchBrandSearchMetrics({
                ...fetchOpts,
                startDate: lyRange.startDate,
                endDate: lyRange.endDate,
            });
            lastYearRows = lm.rows;
        } catch (e) {
            console.warn('share-of-search last year fetch:', e.message);
        }

        metrics.rows = mergeShareComparisonIntoRows(metrics.rows, previousPeriodRows, lastYearRows);
        metrics.comparisonRanges = {
            previousPeriod: { ...prevRange, ok: previousPeriodRows != null },
            lastYear: { ...lyRange, ok: lastYearRows != null },
        };

        const snapshot = await ShareOfSearchSnapshot.create({
            customerId,
            view: 'share',
            brands: metrics.rows.map((r) => r.brand),
            geoLabel: String(geoLabel || 'Denmark'),
            geoCriterionId: metrics.geoCriterionId,
            languageCode: String(languageCode || 'en'),
            startDate: metrics.normalizedStartDate,
            endDate: metrics.normalizedEndDate,
            rows: metrics.rows,
            summary: {
                totalVolume: metrics.rows.reduce((s, r) => s + (r.volumeInRange || 0), 0),
                brandCount: metrics.rows.length,
            },
        });

        return Response.json({
            snapshot,
            metrics,
        });
    } catch (error) {
        if (error.statusCode === 403) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (String(error.message || '').toLowerCase().includes('not found')) {
            return Response.json({ error: 'Customer not found' }, { status: 404 });
        }
        console.error('share-of-search POST:', error);
        return Response.json({ error: error.message || 'Failed to fetch keyword data' }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
        return Response.json({ error: 'Invalid customer id' }, { status: 400 });
    }

    const snapshotId = new URL(request.url).searchParams.get('snapshotId');
    if (!snapshotId) {
        return Response.json({ error: 'Missing snapshotId' }, { status: 400 });
    }

    if (isDemoCustomerId(customerId)) {
        return Response.json({ ok: true });
    }

    if (!mongoose.Types.ObjectId.isValid(snapshotId)) {
        return Response.json({ error: 'Invalid snapshotId' }, { status: 400 });
    }

    try {
        await connectToDatabase();
        try {
            await assertCustomerAccess(session, customerId);
        } catch (accessErr) {
            if (accessErr.statusCode === 403) {
                return Response.json({ error: 'Forbidden' }, { status: 403 });
            }
            if (String(accessErr.message || '').toLowerCase().includes('not found')) {
                return Response.json({ error: 'Customer not found' }, { status: 404 });
            }
            throw accessErr;
        }

        const deleted = await ShareOfSearchSnapshot.findOneAndDelete({
            _id: snapshotId,
            customerId,
        });
        if (!deleted) {
            return Response.json({ error: 'Snapshot not found' }, { status: 404 });
        }
        return Response.json({ ok: true });
    } catch (error) {
        if (error.statusCode === 403) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        console.error('share-of-search DELETE:', error);
        return Response.json({ error: error.message || 'Failed to delete snapshot' }, { status: 500 });
    }
}
