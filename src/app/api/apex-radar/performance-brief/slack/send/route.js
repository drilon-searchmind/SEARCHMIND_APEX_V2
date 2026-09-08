import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import { canAccessApexRadar } from "@/lib/apexRadarAccess";
import Customer from "@/models/Customer";
import { sendPerformanceBriefToSlack } from "@/lib/performanceBriefSlack";
import { getApexRadarCustomerSlackChannel } from "@/lib/apexRadarCustomerSlack";
import { isPerformanceBriefCustomerId } from "@/lib/performanceBriefConstants";

/**
 * POST /api/apex-radar/performance-brief/slack/send
 * Body: { customerId, slackPreview }
 */
export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessApexRadar(session.user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const customerId = String(body?.customerId || "").trim();
    if (!isPerformanceBriefCustomerId(customerId)) {
        return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    try {
        await connectToDatabase();
        const exists = await Customer.findById(customerId).select("_id customerName").lean();
        if (!exists) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        const slack = await getApexRadarCustomerSlackChannel(customerId);
        const slackChannelId =
            String(body?.slackChannelId || "").trim() || slack.slackChannelId;
        const slackChannelName =
            String(body?.slackChannelName || "").trim().replace(/^#/, "") ||
            slack.slackChannelName;

        if (!slackChannelId) {
            return NextResponse.json(
                { error: "Assign a Slack channel for this customer before sending." },
                { status: 400 }
            );
        }

        const result = await sendPerformanceBriefToSlack({
            payload: body?.slackPreview,
            channelId: slackChannelId,
            channelName: slackChannelName,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error || "Failed to send Slack message" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            channelId: result.channelId,
            channelName: result.channelName || slackChannelName,
            messageTs: result.messageTs,
        });
    } catch (e) {
        const msg = e.message || "Failed to send Performance Brief to Slack";
        console.error("[apex-radar/performance-brief/slack/send POST]", e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
