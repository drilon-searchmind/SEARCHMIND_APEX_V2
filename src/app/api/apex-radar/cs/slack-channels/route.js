import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { canAccessApexRadar } from "@/lib/apexRadarAccess";
import { listApexRadarCsSlackChannels } from "@/lib/apexRadarCsSlack";

/**
 * GET /api/apex-radar/cs/slack-channels
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessApexRadar(session.user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const channels = await listApexRadarCsSlackChannels();
        return NextResponse.json({ channels });
    } catch (e) {
        console.error("[apex-radar/cs/slack-channels GET]", e);
        return NextResponse.json({ error: e.message || "Failed to list Slack channels" }, { status: 500 });
    }
}
