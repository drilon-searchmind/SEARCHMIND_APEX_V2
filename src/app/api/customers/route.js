import { NextResponse } from 'next/server';
import { getAllCustomers, createCustomer } from '../../../../lib/customerOperations';
import connectToDatabase from '@root/lib/mongodb';
import { isDemoCustomerId, mergeDemoCustomerDocument } from '@/lib/demoCustomer';
import { APEX_RADAR_CHANNEL_FACEBOOK } from '@/lib/apexRadarChannels';
import ApexRadarChannelSettings from '@/models/ApexRadarChannelSettings';
import { mergeFacebookChannelSettingsIntoCustomers } from '@/lib/apexRadarChannelSettingsMerge';

function toPlainCustomer(doc) {
    if (doc && typeof doc.toObject === 'function') return doc.toObject();
    return { ...doc };
}

// GET /api/customers - Get all customers
export async function GET() {
    try {
        const customers = await getAllCustomers();
        let merged = customers.map((c) => {
            const plain = toPlainCustomer(c);
            const id = String(plain._id);
            if (!isDemoCustomerId(id)) return plain;
            return mergeDemoCustomerDocument(plain);
        });

        await connectToDatabase();
        const fbSettings = await ApexRadarChannelSettings.find({
            channel: APEX_RADAR_CHANNEL_FACEBOOK,
            customerId: { $in: merged.map((c) => c._id) },
        }).lean();
        merged = mergeFacebookChannelSettingsIntoCustomers(merged, fbSettings);

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