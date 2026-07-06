import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { canAccessApexRadar } from "@/lib/apexRadarAccess";
import { sendApexRadarActiveWarningsToAssignedUsers } from "@/lib/apexRadarSlack";
import { enrichAlertsWithServerAssignees } from "@/lib/apexRadarSlackAssigneesServer";
import { resolveApexRadarSlackPlatformLabel } from "@/lib/apexRadarSlackConfig";
import { isValidApexRadarChannel } from "@/lib/apexRadarChannels";
import connectToDatabase from "../../../../../../../lib/mongodb";
import User from "../../../../../../../models/User";

/**
 * POST /api/apex-radar/slack/active-warnings/dm
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
            : null;

    if (!channel) {
        return NextResponse.json(
            { error: "channel is required (facebook or google-ads)" },
            { status: 400 }
        );
    }

    const platformLabel = resolveApexRadarSlackPlatformLabel(channel, body.platformLabel);

    const alertsWithAssignees = await enrichAlertsWithServerAssignees(alerts, channel);

    const assigneeIds = [
        ...new Set(
            alertsWithAssignees.flatMap((alert) =>
                (Array.isArray(alert.assigneeUserIds) ? alert.assigneeUserIds : []).map(String)
            )
        ),
    ];

    /** @type {Map<string, { name: string, slackId?: string, clickupId?: string }>} */
    const usersById = new Map();

    if (assigneeIds.length) {
        await connectToDatabase();
        const docs = await User.find({ _id: { $in: assigneeIds } })
            .select("name slackId clickupId")
            .lean();

        for (const doc of docs) {
            usersById.set(String(doc._id), {
                name: doc.name,
                slackId: doc.slackId || "",
                clickupId: doc.clickupId || "",
            });
        }
    }

    const result = await sendApexRadarActiveWarningsToAssignedUsers({
        alerts: alertsWithAssignees,
        platformLabel,
        channel,
        usersById,
    });

    if (!result.success) {
        return NextResponse.json(
            {
                error: result.error || "Failed to send Slack DMs",
                dmSentCount: result.dmSentCount ?? 0,
                skipped: result.skipped ?? [],
                unassignedAlertCount: result.unassignedAlertCount ?? 0,
            },
            { status: 500 }
        );
    }

    return NextResponse.json({
        success: true,
        channelName: result.channelName,
        channelId: result.channelId,
        summaryMessageTs: result.summaryMessageTs,
        dmSentCount: result.dmSentCount,
        deliveries: result.deliveries,
        skipped: result.skipped,
        unassignedAlertCount: result.unassignedAlertCount,
        platformLabel,
    });
}
