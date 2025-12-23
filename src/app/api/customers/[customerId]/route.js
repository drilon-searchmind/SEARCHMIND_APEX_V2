import { NextResponse } from 'next/server';
import {
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    permanentlyDeleteCustomer
} from '@/lib/customerOperations.js';

// GET /api/customers/[customerId] - Get a specific customer
export async function GET(request, { params }) {
    try {
        const { customerId } = params;
        const customer = await getCustomerById(customerId);
        return NextResponse.json(customer);
    } catch (error) {
        console.error('Error fetching customer:', error);
        if (error.message === 'Customer not found') {
            return NextResponse.json(
                { error: 'Customer not found' },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to fetch customer' },
            { status: 500 }
        );
    }
}

// PUT /api/customers/[customerId] - Update a customer
export async function PUT(request, { params }) {
    try {
        const { customerId } = params;
        const updateData = await request.json();
        const customer = await updateCustomer(customerId, updateData);
        return NextResponse.json(customer);
    } catch (error) {
        console.error('Error updating customer:', error);
        if (error.message === 'Customer not found') {
            return NextResponse.json(
                { error: 'Customer not found' },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to update customer' },
            { status: 500 }
        );
    }
}

// DELETE /api/customers/[customerId] - Archive a customer (soft delete)
export async function DELETE(request, { params }) {
    try {
        const { customerId } = params;
        const customer = await deleteCustomer(customerId);
        return NextResponse.json({
            message: 'Customer archived successfully',
            customer
        });
    } catch (error) {
        console.error('Error deleting customer:', error);
        if (error.message === 'Customer not found') {
            return NextResponse.json(
                { error: 'Customer not found' },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to delete customer' },
            { status: 500 }
        );
    }
}