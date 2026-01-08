import { NextResponse } from "next/server";
import dbConnect from "../../../../../lib/mongodb";
import {
    getCampaignsByCustomer,
    createCampaigns,
    updateCampaign,
    deleteCampaign
} from "../../../../../lib/campaignOperations";

// GET /api/campaigns/[customerId] - Get all campaigns for a customer
export async function GET(request, { params }) {
    await dbConnect();
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    try {
        const campaigns = await getCampaignsByCustomer(customerId);
        return NextResponse.json(campaigns);
    } catch (error) {
        console.error("Error fetching campaigns:", error);
        return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
    }
}

// POST /api/campaigns/[customerId] - Create new campaign(s) for a customer
export async function POST(request, { params }) {
    await dbConnect();
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    try {
        const data = await request.json();
        const created = await createCampaigns(customerId, data);
        return NextResponse.json(created);
    } catch (error) {
        console.error("Error creating campaign(s):", error);
        return NextResponse.json({ error: "Failed to create campaign(s)" }, { status: 500 });
    }
}

// PUT /api/campaigns/[customerId] - Update campaign status or details
export async function PUT(request, { params }) {
    await dbConnect();
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    try {
        const { id, ...updateData } = await request.json();
        const updated = await updateCampaign(customerId, id, updateData);
        if (!updated) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }
        return NextResponse.json(updated);
    } catch (error) {
        console.error("Error updating campaign:", error);
        return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
    }
}

// DELETE /api/campaigns/[customerId] - Delete a campaign
export async function DELETE(request, { params }) {
    await dbConnect();
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    try {
        const { id } = await request.json();
        const deleted = await deleteCampaign(customerId, id);
        if (!deleted) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }
        return NextResponse.json({ message: "Campaign deleted", campaign: deleted });
    } catch (error) {
        console.error("Error deleting campaign:", error);
        return NextResponse.json({ error: "Failed to delete campaign" }, { status: 500 });
    }
}
