import { NextResponse } from 'next/server';
import connectToDatabase from '../../../../../lib/mongodb';
import CustomerTrackingScanScores from '@/models/CustomerTrackingScanScores';
import { getDemoPayload, isDemoCustomerId } from '@/lib/demoCustomer';

// GET /api/customer-tracking-scores/[customerId] - Get the newest scan for the customer
export async function GET(request, { params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;

    if (!customerId) {
        return NextResponse.json(
            { error: 'Customer ID required' },
            { status: 400 }
        );
    }

    if (isDemoCustomerId(customerId)) {
        return NextResponse.json(getDemoPayload('customerTrackingScores'));
    }

    try {
        await connectToDatabase();

        const latestScan = await CustomerTrackingScanScores.findOne({ customer: customerId })
            .sort({ createdAt: -1 })
            .lean();

        if (!latestScan) {
            return NextResponse.json({
                totalScore: 0,
                performanceScore: 0,
                trackingScore: 0,
                complianceScore: 0,
                createdAt: null,
            });
        }

        return NextResponse.json({
            totalScore: latestScan.totalScore ?? 0,
            performanceScore: latestScan.performanceScore ?? 0,
            trackingScore: latestScan.trackingScore ?? 0,
            complianceScore: latestScan.complianceScore ?? 0,
            createdAt: latestScan.createdAt,
        });
    } catch (error) {
        console.error('Error fetching customer tracking scores:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tracking scores' },
            { status: 500 }
        );
    }
}
