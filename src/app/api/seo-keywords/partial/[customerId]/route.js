import { NextResponse } from 'next/server';
import connectToDatabase from '../../../../../../lib/mongodb';
import SEOPartialKeywordGroup from '@/models/SEOPartialKeywordGroup';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getDemoPayload, isDemoCustomerId } from '@/lib/demoCustomer';

// GET - Fetch all partial keyword groups for a customer
export async function GET(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const resolvedParams = await params;
        const { customerId } = resolvedParams;

        if (isDemoCustomerId(customerId)) {
            return NextResponse.json(getDemoPayload('seoKeywordsPartial'));
        }

        await connectToDatabase();

        const groups = await SEOPartialKeywordGroup.find({ customer: customerId }).sort({ createdAt: -1 });

        return NextResponse.json({ success: true, data: groups });
    } catch (error) {
        console.error('Error fetching partial keyword groups:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Create a new partial keyword group
export async function POST(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const resolvedParams = await params;
        const { customerId } = resolvedParams;
        const body = await request.json();
        const { name, keywords } = body;

        if (!name || !Array.isArray(keywords)) {
            return NextResponse.json({ error: 'Name and keywords array are required' }, { status: 400 });
        }

        const group = await SEOPartialKeywordGroup.create({
            name,
            keywords: keywords.map(k => k.toLowerCase().trim()).filter(k => k),
            customer: customerId,
            isActive: false,
        });

        return NextResponse.json({ success: true, data: group });
    } catch (error) {
        console.error('Error creating partial keyword group:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT - Update a partial keyword group
export async function PUT(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const resolvedParams = await params;
        const { customerId } = resolvedParams;
        const body = await request.json();
        const { groupId, name, keywords, isActive } = body;

        if (!groupId) {
            return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
        }

        const updateData = { updatedAt: Date.now() };
        if (name !== undefined) updateData.name = name;
        if (keywords !== undefined) updateData.keywords = keywords.map(k => k.toLowerCase().trim()).filter(k => k);
        if (isActive !== undefined) updateData.isActive = isActive;

        const group = await SEOPartialKeywordGroup.findOneAndUpdate(
            { _id: groupId, customer: customerId },
            updateData,
            { new: true, runValidators: true }
        );

        if (!group) {
            return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: group });
    } catch (error) {
        console.error('Error updating partial keyword group:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE - Remove a partial keyword group
export async function DELETE(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const resolvedParams = await params;
        const { customerId } = resolvedParams;
        const { searchParams } = new URL(request.url);
        const groupId = searchParams.get('groupId');

        if (!groupId) {
            return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
        }

        const group = await SEOPartialKeywordGroup.findOneAndDelete({ 
            _id: groupId, 
            customer: customerId 
        });

        if (!group) {
            return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'Group deleted' });
    } catch (error) {
        console.error('Error deleting partial keyword group:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}