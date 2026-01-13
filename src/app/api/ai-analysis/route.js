import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from "../../../../lib/mongodb";
import AiAnalysisChat from '@/models/AiAnalysisChat';

// GET /api/ai-analysis - Get all chats for current customer and dashboard type
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const customerId = searchParams.get('customerId');
        const dashboardType = searchParams.get('dashboardType');

        if (!customerId) {
            return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
        }

        await dbConnect();

        const query = {
            customerId,
            status: 'active'
        };

        // Filter by dashboardType if provided
        if (dashboardType) {
            query.dashboardType = dashboardType;
        }

        const chats = await AiAnalysisChat.find(query)
            .sort({ updatedAt: -1 })
            .limit(50)
            .lean();

        return NextResponse.json(chats);
    } catch (error) {
        console.error('Error fetching AI chats:', error);
        return NextResponse.json(
            { error: 'Failed to fetch chats' },
            { status: 500 }
        );
    }
}

// POST /api/ai-analysis - Create a new chat
export async function POST(request) {
    try {
        const body = await request.json();
        const { customerId, title, dateRange, comparisonMethod, dataSnapshot, dashboardType } = body;

        if (!customerId || !dateRange) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        await dbConnect();

        // TODO: Get actual userId from session when auth is enabled
        // For now, use a placeholder userId - this will need to be updated
        const placeholderUserId = new mongoose.Types.ObjectId();

        const chat = await AiAnalysisChat.create({
            userId: placeholderUserId,
            customerId,
            title: title || 'New Analysis Chat',
            dateRange,
            comparisonMethod: comparisonMethod || 'Last Period',
            dataSnapshot: dataSnapshot || {},
            dashboardType: dashboardType || 'other',
            messages: [],
            status: 'active'
        });

        return NextResponse.json(chat, { status: 201 });
    } catch (error) {
        console.error('Error creating AI chat:', error);
        return NextResponse.json(
            { error: 'Failed to create chat' },
            { status: 500 }
        );
    }
}
