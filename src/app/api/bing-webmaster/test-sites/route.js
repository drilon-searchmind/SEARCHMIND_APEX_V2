import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { resolveBingWebmasterAccessToken } from "@/lib/bingWebmasterOAuth";
import {
    bingWebmasterJsonGet,
    getBingWebmasterApiConfig,
    parseBingJsonResponse,
} from "@/lib/bingWebmasterApi";

/**
 * GET — calls JSON API GetUserSites (see Bing Webmaster JSON API).
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { apiKey } = getBingWebmasterApiConfig();
    let authCtx = null;
    if (!apiKey) {
        authCtx = await resolveBingWebmasterAccessToken();
        if (!authCtx.accessToken) {
            return NextResponse.json(
                {
                    error:
                        "No Bing auth — set MICROSOFT_BING_WEBMASTER_API_KEY or connect OAuth / set MICROSOFT_BING_ACCESS_TOKEN.",
                },
                { status: 401 }
            );
        }
    }

    const result = await bingWebmasterJsonGet("GetUserSites", {}, authCtx);
    if (!result.res) {
        return NextResponse.json({ error: result.error || "Request failed" }, { status: result.status || 401 });
    }

    const data = await parseBingJsonResponse(result.res);

    if (!result.res.ok) {
        return NextResponse.json(
            {
                error: "Bing API error",
                status: result.status,
                body: data,
            },
            { status: 502 }
        );
    }

    const out = NextResponse.json({ ok: true, sites: data, tokenSource: result.tokenSource });
    if (authCtx?.refreshedFromApi?.access_token && authCtx.tokenSource === "cookie-refresh") {
        const secure = process.env.NODE_ENV === "production";
        const exp = Number(authCtx.refreshedFromApi.expires_in) || 3600;
        out.cookies.set("bing_wm_access_token", authCtx.refreshedFromApi.access_token, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            path: "/",
            maxAge: Math.max(60, exp - 120),
        });
    }
    return out;
}
