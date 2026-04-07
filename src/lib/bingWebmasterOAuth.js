/**
 * Bing Webmaster Tools OAuth 2.0 (authorization code flow).
 * @see https://learn.microsoft.com/en-us/bingwebmaster/oauth2
 */

export const BING_WM_AUTHORIZE_URL = "https://www.bing.com/webmasters/oauth/authorize";
export const BING_WM_TOKEN_URL = "https://www.bing.com/webmasters/oauth/token";

export const DEFAULT_SCOPE = "webmaster.manage";

export function buildAuthorizeUrl({ clientId, redirectUri, scope = DEFAULT_SCOPE, state }) {
    const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
    });
    if (state) params.set("state", state);
    return `${BING_WM_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access + refresh tokens (code valid ~5 minutes).
 */
export async function exchangeAuthorizationCode({ clientId, clientSecret, code, redirectUri }) {
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
    });
    const res = await fetch(BING_WM_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        json = { raw: text };
    }
    if (!res.ok) {
        const err = json.error_description || json.error || text || res.statusText;
        throw new Error(typeof err === "string" ? err : JSON.stringify(err));
    }
    return json;
}

/**
 * Refresh access token (POST body per Microsoft docs — token endpoint may be /webmasters/token for refresh only).
 */
export async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
    const tryUrls = [
        BING_WM_TOKEN_URL,
        "https://www.bing.com/webmasters/token",
    ];
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    });
    let lastErr;
    for (const url of tryUrls) {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });
        const text = await res.text();
        let json;
        try {
            json = JSON.parse(text);
        } catch {
            json = { raw: text };
        }
        if (res.ok) return { ...json, _tokenUrlUsed: url };
        lastErr = json.error_description || json.error || text;
    }
    throw new Error(typeof lastErr === "string" ? lastErr : JSON.stringify(lastErr));
}

export function getBingWebmasterEnv() {
    const clientId = process.env.MICROSOFT_BING_CLIENT_ID || "";
    const clientSecret = process.env.MICROSOFT_BING_CLIENT_SECRET || "";
    const redirectUri = process.env.MICROSOFT_BING_REDIRECT_URI || "";
    const apiJsonBase =
        process.env.MICROSOFT_BING_API?.replace(/\/$/, "") ||
        "https://www.bing.com/webmaster/api.svc/json";
    return { clientId, clientSecret, redirectUri, apiJsonBase };
}
