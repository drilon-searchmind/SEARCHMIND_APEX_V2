import { NextResponse } from 'next/server';
import connectToDatabase from '../../../../lib/mongodb.js';
import ParentCustomer from '@/models/ParentCustomer';
import {
    createParentCustomer,
    getParentCustomers,
    getParentCustomerById,
    updateParentCustomer,
    deleteParentCustomer,
} from '../../../../lib/parentCustomerOperations';

// GET /api/parent-customers or /api/parent-customers?id=xxx
export async function GET(request) {
    try {
        const url = new URL(request.url);
        if (url.searchParams.get('minimal') === '1') {
            await connectToDatabase();
            const rows = await ParentCustomer.find({})
                .select('_id name')
                .lean();
            const list = rows.map((p) => ({
                _id: String(p._id),
                name: p.name || String(p._id),
            }));
            return NextResponse.json(list);
        }
        const id = url.searchParams.get('id');
        if (id) {
            const parent = await getParentCustomerById(id);
            if (!parent) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }
            return NextResponse.json(parent);
        }
        const parents = await getParentCustomers();
        return NextResponse.json(parents);
    } catch (error) {
        console.error('Error fetching parent customers:', error);
        return NextResponse.json(
            { error: 'Failed to fetch parent customers' },
            { status: 500 }
        );
    }
}

// POST /api/parent-customers - Create a new parent customer
export async function POST(request) {
    try {
        const data = await request.json();
        const parent = await createParentCustomer(data);
        return NextResponse.json(parent, { status: 201 });
    } catch (error) {
        console.error('Error creating parent customer:', error);
        return NextResponse.json(
            { error: 'Failed to create parent customer' },
            { status: 500 }
        );
    }
}

// PUT /api/parent-customers - Update a parent customer
export async function PUT(request) {
    try {
        const data = await request.json();
        const { id, ...update } = data;
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
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

// DELETE /api/parent-customers?id=xxx - Delete a parent customer
export async function DELETE(request) {
    try {
        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
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
