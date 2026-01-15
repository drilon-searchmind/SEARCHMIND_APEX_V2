import { NextResponse } from 'next/server';
import SEOBrandKeyword from '@/models/SEOBrandKeyword';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import connectToDatabase from "../../../../../../lib/mongodb";

// GET - Fetch brand keywords for a customer
export async function GET(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const resolvedParams = await params;
        const { customerId } = resolvedParams;

        const brandKeywords = await SEOBrandKeyword.findOne({ customer: customerId });

        return NextResponse.json({ 
            success: true, 
            data: brandKeywords || { keywords: [] } 
        });
    } catch (error) {
        console.error('Error fetching brand keywords:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST - Create or update brand keywords
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
        const { keywords } = body;

        if (!Array.isArray(keywords)) {
            return NextResponse.json({ error: 'Keywords must be an array' }, { status: 400 });
        }

        // Upsert (update or create)
        const brandKeywords = await SEOBrandKeyword.findOneAndUpdate(
            { customer: customerId },
            { 
                keywords: keywords.map(k => k.toLowerCase().trim()).filter(k => k),
                updatedAt: Date.now() 
            },
            { upsert: true, new: true, runValidators: true }
        );

        return NextResponse.json({ success: true, data: brandKeywords });
    } catch (error) {
        console.error('Error saving brand keywords:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE - Remove brand keywords
export async function DELETE(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectToDatabase();
        const resolvedParams = await params;
        const { customerId } = resolvedParams;

        await SEOBrandKeyword.findOneAndDelete({ customer: customerId });

        return NextResponse.json({ success: true, message: 'Brand keywords deleted' });
    } catch (error) {
        console.error('Error deleting brand keywords:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}