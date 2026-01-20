import { NextResponse } from "next/server";
import dbConnect from "../../../../../lib/mongodb";
import {
    getCampaignsByCustomer,
    createCampaigns,
    updateCampaign,
    deleteCampaign
} from "../../../../../lib/campaignOperations";
import { sendCampaignAssignmentNotification } from "../../../../../lib/slack";
import Customer from "@/models/Customer";
import User from "../../../../../models/User"


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

        // Send Slack DMs to assigned users (run asynchronously, don't block response)
        sendSlackNotifications(created, customerId).catch(error => {
            console.error("Error sending Slack notifications:", error);
            // Don't fail the campaign creation if Slack fails
        });

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

// Helper function to send Slack notifications to assigned users
async function sendSlackNotifications(createdCampaigns, customerId) {
    try {
        // Get customer data
        const customer = await Customer.findById(customerId).select('customerName');
        if (!customer) {
            console.error("Customer not found for Slack notifications:", customerId);
            return;
        }

        // Get all unique assigned user IDs from created campaigns
        const assignedUserIds = [...new Set(
            createdCampaigns
                .filter(campaign => campaign.assignedUsers && campaign.assignedUsers.length > 0)
                .flatMap(campaign => campaign.assignedUsers)
        )];

        if (assignedUserIds.length === 0) {
            console.log("No assigned users found, skipping Slack notifications");
            return;
        }

        // Get user data for assigned users (only those with slackId)
        const users = await User.find({
            _id: { $in: assignedUserIds },
            slackId: { $exists: true, $ne: '' }
        }).select('_id slackId name');

        if (users.length === 0) {
            console.log("No users with Slack IDs found, skipping notifications");
            return;
        }

        // Group campaigns by assigned user for batch processing
        const userCampaignMap = new Map();

        for (const campaign of createdCampaigns) {
            if (!campaign.assignedUsers || campaign.assignedUsers.length === 0) continue;

            for (const userId of campaign.assignedUsers) {
                const user = users.find(u => u._id.toString() === userId.toString());
                if (!user) continue;

                if (!userCampaignMap.has(userId)) {
                    userCampaignMap.set(userId, { user, campaigns: [] });
                }
                userCampaignMap.get(userId).campaigns.push(campaign);
            }
        }

        // Send notifications to each user
        const notificationPromises = Array.from(userCampaignMap.values()).map(async ({ user, campaigns }) => {
            for (const campaign of campaigns) {
                try {
                    const result = await sendCampaignAssignmentNotification(
                        user.slackId,
                        campaign,
                        customer,
                        customerId
                    );

                    if (result.success) {
                        console.log(`Slack DM sent successfully to ${user.name} (${user.slackId}) for campaign: ${campaign.campaignName}`);
                    } else {
                        console.error(`Failed to send Slack DM to ${user.name} (${user.slackId}):`, result.error);
                    }
                } catch (error) {
                    console.error(`Error sending Slack DM to ${user.name} (${user.slackId}):`, error);
                }
            }
        });

        await Promise.all(notificationPromises);
        console.log(`Slack notification process completed for ${createdCampaigns.length} campaigns`);

    } catch (error) {
        console.error("Error in sendSlackNotifications:", error);
        // Don't throw - we don't want Slack failures to affect campaign creation
    }
}
