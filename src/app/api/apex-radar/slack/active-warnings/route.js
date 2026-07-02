import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { canAccessApexRadar } from "@/lib/apexRadarAccess";
import { sendApexRadarActiveWarningsToSlack } from "@/lib/apexRadarSlack";
import { resolveApexRadarSlackPlatformLabel } from "@/lib/apexRadarSlackConfig";
import { isValidApexRadarChannel } from "@/lib/apexRadarChannels";

/**
 * POST /api/apex-radar/slack/active-warnings
 * Body: { alerts: object[], platformLabel?: string, channel?: string }
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

    const alerts = Array.isArray(body?.alerts) ? body.alerts : null;
    if (!alerts) {
        return NextResponse.json({ error: "alerts array is required" }, { status: 400 });
    }

    const channel =
        typeof body.channel === "string" && isValidApexRadarChannel(body.channel)
            ? body.channel
            : undefined;

    const platformLabel = resolveApexRadarSlackPlatformLabel(channel, body.platformLabel);

    const result = await sendApexRadarActiveWarningsToSlack({
        alerts,
        platformLabel,
        channel,
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
        channelName: result.channelName,
        messageTs: result.messageTs,
        platformLabel,
    });
}
