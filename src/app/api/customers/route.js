import { NextResponse } from 'next/server';
import { getAllCustomers, createCustomer } from '../../../../lib/customerOperations';
import { isDemoCustomerId, mergeDemoCustomerDocument } from '@/lib/demoCustomer';

function toPlainCustomer(doc) {
    if (doc && typeof doc.toObject === 'function') return doc.toObject();
    return { ...doc };
}

// GET /api/customers - Get all customers
export async function GET() {
    try {
        const customers = await getAllCustomers();
        const merged = customers.map((c) => {
            const plain = toPlainCustomer(c);
            const id = String(plain._id);
            if (!isDemoCustomerId(id)) return plain;
            return mergeDemoCustomerDocument(plain);
        });
        return NextResponse.json(merged);
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