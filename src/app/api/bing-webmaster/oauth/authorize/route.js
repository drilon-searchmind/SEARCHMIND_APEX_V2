import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { buildAuthorizeUrl, getBingWebmasterEnv } from "@/lib/bingWebmasterOAuth";

/** Only allow same-origin relative return paths (open-redirect safe). */
function safeReturnPath(raw) {
    if (!raw || typeof raw !== "string") return "/dashboard";
    const t = decodeURIComponent(raw).trim();
    if (!t.startsWith("/") || t.startsWith("//")) return "/dashboard";
    return t.length > 2048 ? "/dashboard" : t;
}

/**
 * Start OAuth: redirects browser to Bing Webmaster authorize URL.
 * Query: returnTo — path to send user after callback (e.g. /dashboard/CID/service-dashboard/bing-webmaster)
 */
export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { clientId, redirectUri } = getBingWebmasterEnv();
    if (!clientId || !redirectUri) {
        return NextResponse.json(
            {
                error: "Missing MICROSOFT_BING_CLIENT_ID or MICROSOFT_BING_REDIRECT_URI",
            },
            { status: 500 }
        );
    }

    const { searchParams } = new URL(req.url);
    const returnTo = safeReturnPath(searchParams.get("returnTo") || "/dashboard");
    const state = Buffer.from(JSON.stringify({ returnTo }), "utf8").toString("base64url");

    const url = buildAuthorizeUrl({ clientId, redirectUri, state });
    return NextResponse.redirect(url);
}
