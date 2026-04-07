import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { cookies } from "next/headers";
import { getBingWebmasterEnv } from "@/lib/bingWebmasterOAuth";
import { getBingWebmasterApiConfig } from "@/lib/bingWebmasterApi";

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
    const { apiKey: webmasterApiKey } = getBingWebmasterApiConfig();
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
            hasEnvAccessToken: !!env.accessTokenFromEnv,
            hasEnvRefreshToken: !!env.refreshTokenFromEnv,
            hasWebmasterApiKey: !!webmasterApiKey,
        },
        session: {
            hasAccessToken: !!access,
            hasRefreshToken: !!refresh,
            accessTokenPreview: maskToken(access),
        },
        nextTokenSource:
            env.accessTokenFromEnv ? "env" : access ? "cookie" : env.refreshTokenFromEnv ? "env-refresh" : refresh ? "cookie-refresh" : "none",
    });
}
