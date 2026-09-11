import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import { canAccessApexRadar } from "@/lib/apexRadarAccess";
import { generatePerformanceBrief } from "@/lib/performanceBriefMetrics";
import { formatPerformanceBriefSlack } from "@/lib/performanceBriefSlackPreview";
import { getApexRadarCustomerSlackChannel } from "@/lib/apexRadarCustomerSlack";
import { isPerformanceBriefCustomerId } from "@/lib/performanceBriefConstants";

export const maxDuration = 120;

/**
 * POST /api/apex-radar/performance-brief/generate
 * Body: { customerId }
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
        body = {};
    }

    const { searchParams } = new URL(request.url);
    const customerId = String(
        body?.customerId || searchParams.get("customerId") || ""
    ).trim();
    if (!isPerformanceBriefCustomerId(customerId)) {
        return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    try {
        await connectToDatabase();
        const brief = await generatePerformanceBrief(customerId);
        const slack = await getApexRadarCustomerSlackChannel(customerId);
        const slackChannelName = slack.slackChannelName;
        const slackChannelId = slack.slackChannelId;
        const slackPreview = formatPerformanceBriefSlack({
            compact: {
                customer: brief.customer,
                windows: brief.windows,
                meta: brief.meta,
                google: brief.google,
                accountIntent: brief.accountIntent,
            },
            narrative: brief.narrative,
            channelName: slackChannelName,
        });

        return NextResponse.json({
            customer: brief.customer,
            windows: brief.windows,
            meta: brief.meta,
            google: brief.google,
            accountIntent: brief.accountIntent,
            narrative: brief.narrative,
            claude: brief.claude,
            slack: {
                channelId: slackChannelId,
                channelName: slackChannelName,
                wouldPost: Boolean(slackChannelId),
                skipReason: slackChannelId ? null : "no_slack_channel",
            },
            slackPreview,
        });
    } catch (e) {
        const msg = e.message || "Failed to generate Performance Brief";
        if (/not found/i.test(msg)) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }
        console.error("[apex-radar/performance-brief/generate POST]", e);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
