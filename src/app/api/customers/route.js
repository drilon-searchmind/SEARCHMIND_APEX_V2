import { NextResponse } from 'next/server';
import { getAllCustomers, createCustomer } from '../../../../lib/customerOperations';

// GET /api/customers - Get all customers
export async function GET() {
    try {
        const customers = await getAllCustomers();
        return NextResponse.json(customers);
    } catch (error) {
        console.error('Error fetching customers:', error);
        return NextResponse.json(
            { error: 'Failed to fetch customers' },
            { status: 500 }
        );
    }
}

// POST /api/customers - Create a new customer
export async function POST(request) {
    try {
        const customerData = await request.json();
        const customer = await createCustomer(customerData);
        return NextResponse.json(customer, { status: 201 });
    } catch (error) {
        console.error('Error creating customer:', error);
        return NextResponse.json(
            { error: 'Failed to create customer' },
            { status: 500 }
        );
    }
}