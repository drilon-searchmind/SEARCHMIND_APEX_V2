import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import {
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    permanentlyDeleteCustomer
} from '../../../../../lib/customerOperations';
import { getDemoPayload, isDemoCustomerId, mergeDemoCustomerDocument } from '@/lib/demoCustomer';

function externalUserHasCustomerAccess(session, customerId) {
    if (!session?.user?.isExternal) return true;
    const sharedIds = (session.user.sharedCustomers || []).map((id) => String(id));
    return sharedIds.includes(String(customerId));
}

function sanitizeCustomerUpdateForExternalUser(updateData, existingCustomer) {
    const sanitized = { ...updateData };
    delete sanitized.parentCustomer;
    delete sanitized.customerType;
    delete sanitized.isArchived;
    if (existingCustomer) {
        sanitized.parentCustomer = existingCustomer.parentCustomer ?? null;
        sanitized.customerType = existingCustomer.customerType;
        sanitized.isArchived = existingCustomer.isArchived;
    }
    return sanitized;
}

// GET /api/customers/[customerId] - Get a specific customer
export async function GET(request, { params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;

    try {
        const session = await getServerSession(authOptions);
        if (session?.user?.isExternal && !externalUserHasCustomerAccess(session, customerId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        if (isDemoCustomerId(customerId)) {
            const demo = getDemoPayload('customer');
            let dbCustomer = null;
            try {
                dbCustomer = await getCustomerById(customerId);
            } catch {
                dbCustomer = null;
            }
            if (!dbCustomer) {
                return NextResponse.json({ ...demo, _id: customerId });
            }
            const plain =
                typeof dbCustomer.toObject === 'function'
                    ? dbCustomer.toObject()
                    : dbCustomer;
            const merged = mergeDemoCustomerDocument(plain);
            merged._id = customerId;
            return NextResponse.json(merged);
        }
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
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!externalUserHasCustomerAccess(session, customerId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let updateData = await request.json();

        if (session.user.isExternal) {
            const existingCustomer = await getCustomerById(customerId);
            updateData = sanitizeCustomerUpdateForExternalUser(updateData, existingCustomer);
        }

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
export async function DELETE(request, contextPromise) {
    const { params } = await contextPromise;
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