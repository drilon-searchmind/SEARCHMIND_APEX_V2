import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { canAccessApexRadarDevTools } from "@/lib/apexRadarDevToolsAccess";

/**
 * GET /api/apex-radar/dev-tools/access
 * Returns whether the current session may open Apex Radar Dev Tools (localhost + allowlisted email).
 */
export async function GET(request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ allowed: false }, { status: 401 });
    }

    const allowed = canAccessApexRadarDevTools(session.user, request);
    return NextResponse.json({
        allowed,
        emailConfigured: Boolean(process.env.APEX_RADAR_DEV_TOOLS_EMAIL?.trim()),
    });
}
