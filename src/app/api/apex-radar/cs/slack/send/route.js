import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import { canAccessApexRadar } from "@/lib/apexRadarAccess";
import Customer from "@/models/Customer";
import ApexRadarCsCustomerSettings from "@/models/ApexRadarCsCustomerSettings";
import { sendApexRadarCsAlertsToSlack } from "@/lib/apexRadarCsSlack";
import { isApexRadarCsCustomerId } from "@/lib/apexRadarCsConstants";

/**
 * POST /api/apex-radar/cs/slack/send
 * Body: { customerId, alerts?, customerName? }
 *
 * Uses alerts from the client preview (no metrics refetch) for fast manual sends.
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
    if (!isApexRadarCsCustomerId(customerId)) {
        return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    const alerts = Array.isArray(body?.alerts) ? body.alerts : null;
    if (!alerts) {
        return NextResponse.json({ error: "alerts array is required" }, { status: 400 });
    }

    try {
        await connectToDatabase();
        const exists = await Customer.findById(customerId).select("_id customerName").lean();
        if (!exists) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        const settingsDoc = await ApexRadarCsCustomerSettings.findOne({ customerId }).lean();
        const slackChannelId = String(settingsDoc?.slackChannelId || "").trim();
        const slackChannelName = String(settingsDoc?.slackChannelName || "").replace(/^#/, "");

        if (!slackChannelId) {
            return NextResponse.json(
                { error: "Assign a Slack channel for this customer before sending." },
                { status: 400 }
            );
        }

        const customerName =
            String(body?.customerName || exists.customerName || "").trim() || "Customer";

        const result = await sendApexRadarCsAlertsToSlack({
            alerts,
            customerName,
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
            alertCount: result.alertCount,
        });
    } catch (e) {
        const msg = e.message || "Failed to send CS alerts to Slack";
        console.error("[apex-radar/cs/slack/send POST]", e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
