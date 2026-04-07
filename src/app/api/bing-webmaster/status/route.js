import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { cookies } from "next/headers";
import { getBingWebmasterEnv } from "@/lib/bingWebmasterOAuth";

function maskToken(t) {
    if (!t || typeof t !== "string") return null;
    if (t.length <= 12) return "****";
    return `${t.slice(0, 6)}…${t.slice(-4)}`;
}

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const env = getBingWebmasterEnv();
    const jar = await cookies();
    const access = jar.get("bing_wm_access_token")?.value;
    const refresh = jar.get("bing_wm_refresh_token")?.value;

    return NextResponse.json({
        env: {
            hasClientId: !!env.clientId,
            hasClientSecret: !!env.clientSecret,
            hasRedirectUri: !!env.redirectUri,
            redirectUriPreview: env.redirectUri ? env.redirectUri.replace(/\/\/.*@/, "//***@") : "",
            apiJsonBase: env.apiJsonBase,
        },
        session: {
            hasAccessToken: !!access,
            hasRefreshToken: !!refresh,
            accessTokenPreview: maskToken(access),
        },
    });
}
