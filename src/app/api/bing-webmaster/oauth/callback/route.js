import { NextResponse } from "next/server";
import { exchangeAuthorizationCode, getBingWebmasterEnv } from "@/lib/bingWebmasterOAuth";

const COOKIE_ACCESS = "bing_wm_access_token";
const COOKIE_REFRESH = "bing_wm_refresh_token";

function parseState(state) {
    if (!state) return { returnTo: "/dashboard" };
    try {
        const json = Buffer.from(state, "base64url").toString("utf8");
        const o = JSON.parse(json);
        const returnTo = typeof o.returnTo === "string" && o.returnTo.startsWith("/") && !o.returnTo.startsWith("//")
            ? o.returnTo
            : "/dashboard";
        return { returnTo };
    } catch {
        return { returnTo: "/dashboard" };
    }
}

/**
 * Bing redirects here with ?code=... or ?error=...
 */
export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const err = searchParams.get("error");
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const { returnTo } = parseState(state);

    const origin = new URL(req.url).origin;

    const redirectWithParam = (path, key, value) => {
        const u = path.startsWith("http") ? new URL(path) : new URL(path, origin);
        u.searchParams.set(key, value);
        return NextResponse.redirect(u);
    };

    const fail = (msg) => redirectWithParam(returnTo, "bing_wm_error", msg);

    if (err) {
        return fail(searchParams.get("error_description") || err);
    }
    if (!code) {
        return fail("Missing authorization code");
    }

    const { clientId, clientSecret, redirectUri } = getBingWebmasterEnv();
    if (!clientId || !clientSecret || !redirectUri) {
        return fail("Server missing Bing OAuth env vars");
    }

    let tokens;
    try {
        tokens = await exchangeAuthorizationCode({
            clientId,
            clientSecret,
            code,
            redirectUri,
        });
    } catch (e) {
        console.error("[bing-webmaster oauth callback] token exchange", e);
        return fail(e.message || "Token exchange failed");
    }

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;
    const expiresIn = Number(tokens.expires_in) || 3600;

    if (!accessToken) {
        return fail("No access_token in response");
    }

    const secure = process.env.NODE_ENV === "production";
    const ok = new URL(returnTo, origin);
    ok.searchParams.set("bing_wm", "connected");
    const redirect = NextResponse.redirect(ok);
    redirect.cookies.set(COOKIE_ACCESS, accessToken, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: Math.max(60, expiresIn - 120),
    });
    if (refreshToken) {
        redirect.cookies.set(COOKIE_REFRESH, refreshToken, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 90,
        });
    }
    return redirect;
}
