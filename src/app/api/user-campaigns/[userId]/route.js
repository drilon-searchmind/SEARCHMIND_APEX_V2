import { NextResponse } from "next/server";
import dbConnect from "../../../../../lib/mongodb";
import { getCampaignsByAssignedUser } from "../../../../../lib/campaignOperations";

// GET /api/user-campaigns/[userId] - Get all campaigns assigned to a user
export async function GET(request, { params }) {
    await dbConnect();
    const resolvedParams = await params;
    const userId = resolvedParams.userId;

    try {
        const campaigns = await getCampaignsByAssignedUser(userId);
        return NextResponse.json(campaigns);
    } catch (error) {
        console.error("Error fetching user campaigns:", error);
        return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
    }
}