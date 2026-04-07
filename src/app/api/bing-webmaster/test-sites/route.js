import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { cookies } from "next/headers";
import { getBingWebmasterEnv, refreshAccessToken } from "@/lib/bingWebmasterOAuth";

/**
 * GET — calls JSON API GetUserSites to verify Bearer token (see Bing Webmaster JSON API).
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const jar = await cookies();
    let accessToken = jar.get("bing_wm_access_token")?.value;
    const refreshToken = jar.get("bing_wm_refresh_token")?.value;
    const { clientId, clientSecret, apiJsonBase } = getBingWebmasterEnv();

    let refreshedFromApi = null;
    if (!accessToken && refreshToken && clientId && clientSecret) {
        try {
            refreshedFromApi = await refreshAccessToken({
                clientId,
                clientSecret,
                refreshToken,
            });
            accessToken = refreshedFromApi.access_token;
        } catch (e) {
            console.error("[bing-webmaster test-sites] refresh", e);
            return NextResponse.json(
                { error: "Could not refresh token; connect again.", detail: String(e?.message || e) },
                { status: 401 }
            );
        }
    }

    if (!accessToken) {
        return NextResponse.json({ error: "Not connected — use Connect Bing Webmaster first." }, { status: 401 });
    }

    const url = `${apiJsonBase}/GetUserSites`;
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: "{}",
    });
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }

    if (!res.ok) {
        return NextResponse.json(
            {
                error: "Bing API error",
                status: res.status,
                body: data,
            },
            { status: 502 }
        );
    }

    const out = NextResponse.json({ ok: true, sites: data });
    if (refreshedFromApi?.access_token) {
        const secure = process.env.NODE_ENV === "production";
        const exp = Number(refreshedFromApi.expires_in) || 3600;
        out.cookies.set("bing_wm_access_token", refreshedFromApi.access_token, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            path: "/",
            maxAge: Math.max(60, exp - 120),
        });
    }
    return out;
}
