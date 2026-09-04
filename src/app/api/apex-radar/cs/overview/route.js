import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import { canAccessApexRadar } from "@/lib/apexRadarAccess";
import ApexRadarCsCustomerSettings from "@/models/ApexRadarCsCustomerSettings";
import { fetchApexRadarCsOverviewMetrics } from "@/lib/apexRadarCsMetrics";
import { evaluateCsAlerts, mergeCsRules } from "@/lib/apexRadarCsRules";
import { formatApexRadarCsSlackPreview } from "@/lib/apexRadarCsSlack";
import { isApexRadarCsCustomerId } from "@/lib/apexRadarCsConstants";

export const maxDuration = 120;

/**
 * GET /api/apex-radar/cs/overview?customerId=
 */
export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessApexRadar(session.user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = String(searchParams.get("customerId") || "").trim();
    if (!isApexRadarCsCustomerId(customerId)) {
        return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    try {
        await connectToDatabase();
        const metrics = await fetchApexRadarCsOverviewMetrics(customerId);
        const settingsDoc = await ApexRadarCsCustomerSettings.findOne({
            customerId,
        }).lean();
        const rules = mergeCsRules(settingsDoc);
        const alerts = evaluateCsAlerts(metrics.platforms, rules, metrics.customer);
        const slackChannelName = String(settingsDoc?.slackChannelName || "").replace(/^#/, "");
        const slackChannelId = String(settingsDoc?.slackChannelId || "");
        const slackPreview = formatApexRadarCsSlackPreview({
            alerts,
            customerName: metrics.customer.customerName,
            channelName: slackChannelName,
        });

        let skipReason = null;
        if (!slackChannelId) skipReason = "no_slack_channel";

        return NextResponse.json({
            customer: metrics.customer,
            dateRange: metrics.dateRange,
            platforms: metrics.platforms,
            rules,
            alerts,
            slack: {
                channelId: slackChannelId,
                channelName: slackChannelName,
                wouldPost: Boolean(slackChannelId) && alerts.length > 0,
                skipReason,
            },
            slackPreview,
        });
    } catch (e) {
        const msg = e.message || "Failed to load CS overview";
        if (/not found/i.test(msg)) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }
        console.error("[apex-radar/cs/overview GET]", e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
