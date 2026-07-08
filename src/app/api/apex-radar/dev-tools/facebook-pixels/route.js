import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { canAccessApexRadarDevTools } from "@/lib/apexRadarDevToolsAccess";
import { fetchAllTokenAccessiblePixels } from "@/lib/apexRadarFacebookTokenPixels";

/**
 * GET /api/apex-radar/dev-tools/facebook-pixels
 * Lists all Meta pixels reachable by FACEBOOK_APP_TOKEN (localhost dev tools only).
 */
export async function GET(request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessApexRadarDevTools(session.user, request)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const token = process.env.FACEBOOK_APP_TOKEN;
    if (!token) {
        return NextResponse.json({ error: "FACEBOOK_APP_TOKEN not configured" }, { status: 503 });
    }

    try {
        const { adAccounts, pixels, errors } = await fetchAllTokenAccessiblePixels(token);
        return NextResponse.json({
            tokenConfigured: true,
            adAccountCount: adAccounts.length,
            uniquePixelCount: pixels.length,
            adAccounts,
            pixels,
            errors,
        });
    } catch (e) {
        console.error("[apex-radar/dev-tools/facebook-pixels]", e);
        return NextResponse.json({ error: e?.message || "Failed to list pixels" }, { status: 500 });
    }
}
