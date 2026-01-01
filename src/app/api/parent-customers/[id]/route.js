import { NextResponse } from 'next/server';
import {
    getParentCustomerById,
    updateParentCustomer,
    deleteParentCustomer,
} from '../../../../../lib/parentCustomerOperations';

// GET /api/parent-customers/[id]
export async function GET(request, { params }) {
    try {
        const resolvedParams = await params;
        const id = resolvedParams.id;
        const parent = await getParentCustomerById(id);
        if (!parent) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        return NextResponse.json(parent);
    } catch (error) {
        console.error('Error fetching parent customer:', error);
        return NextResponse.json(
            { error: 'Failed to fetch parent customer' },
            { status: 500 }
        );
    }
}

// PUT /api/parent-customers/[id]
export async function PUT(request, { params }) {
    try {
        const { id } = params;
        const update = await request.json();
        const parent = await updateParentCustomer(id, update);
        if (!parent) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(parent);
    } catch (error) {
        console.error('Error updating parent customer:', error);
        return NextResponse.json(
            { error: 'Failed to update parent customer' },
            { status: 500 }
        );
    }
}

// DELETE /api/parent-customers/[id]
export async function DELETE(request, { params }) {
    try {
        const { id } = params;
        const parent = await deleteParentCustomer(id);
        if (!parent) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting parent customer:', error);
        return NextResponse.json(
            { error: 'Failed to delete parent customer' },
            { status: 500 }
        );
    }
}
