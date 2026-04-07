/**
 * Bing Webmaster JSON/HTTP API helpers.
 * @see https://learn.microsoft.com/en-us/bingwebmaster/api-protocols
 * @see https://learn.microsoft.com/en-us/bingwebmaster/getting-access (API key)
 */

import { getBingWebmasterEnv, resolveBingWebmasterAccessToken } from "@/lib/bingWebmasterOAuth";

function isHttpUrl(s) {
    return typeof s === "string" && /^https?:\/\//i.test(s.trim());
}

/**
 * JSON base URL: API key → ssl.bing.com (docs); Bearer → www or env override.
 */
export function getBingWebmasterApiConfig() {
    const env = getBingWebmasterEnv();
    const apiKey = (process.env.MICROSOFT_BING_WEBMASTER_API_KEY || "").trim();
    const baseFromEnv = (process.env.MICROSOFT_BING_API || "").replace(/\/$/, "");

    let jsonBase;
    if (apiKey) {
        jsonBase = baseFromEnv && isHttpUrl(baseFromEnv)
            ? baseFromEnv
            : "https://ssl.bing.com/webmaster/api.svc/json";
    } else {
        jsonBase = baseFromEnv || "https://www.bing.com/webmaster/api.svc/json";
    }

    return { apiKey, jsonBase, env };
}

/**
 * Normalize site URL for Bing (e.g. https://example.com/).
 */
export function normalizeBingSiteUrl(raw) {
    if (!raw || typeof raw !== "string") return "";
    let u = raw.trim();
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    try {
        const p = new URL(u);
        if (p.pathname === "/" || p.pathname === "") return `${p.origin}/`;
        return p.pathname.endsWith("/") ? `${p.origin}${p.pathname}` : `${p.origin}${p.pathname}/`;
    } catch {
        return u.endsWith("/") ? u : `${u}/`;
    }
}

/** Parse Microsoft JSON date: /Date(1316156400000-0700)/ */
export function parseBingDotNetDate(s) {
    if (!s || typeof s !== "string") return null;
    const m = s.match(/\/Date\((\d+)([+-]\d+)?\)\//);
    if (m) return new Date(parseInt(m[1], 10));
    return null;
}

/**
 * @param {Record<string, string>} queryParams
 * @param {null | { accessToken: string | null, refreshedFromApi: object | null, tokenSource: string }} [authContext] — pass the same object from one `resolveBingWebmasterAccessToken()` for multiple calls in one request (Bearer only).
 */
export async function bingWebmasterJsonGet(methodName, queryParams = {}, authContext = null) {
    const { apiKey, jsonBase } = getBingWebmasterApiConfig();
    const u = new URL(`${jsonBase.replace(/\/$/, "")}/${methodName}`);
    if (apiKey) {
        u.searchParams.set("apikey", apiKey);
    }
    for (const [k, v] of Object.entries(queryParams)) {
        if (v != null && v !== "") u.searchParams.set(k, String(v));
    }

    if (!apiKey) {
        const resolved = authContext ?? (await resolveBingWebmasterAccessToken());
        const accessToken = resolved.accessToken;
        if (!accessToken) {
            return {
                ok: false,
                error: "No Bing auth — set MICROSOFT_BING_WEBMASTER_API_KEY or connect OAuth / set MICROSOFT_BING_ACCESS_TOKEN.",
                status: 401,
                res: null,
                refreshedFromApi: resolved.refreshedFromApi,
                tokenSource: resolved.tokenSource,
            };
        }
        const res = await fetch(u.toString(), {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${accessToken}`,
            },
        });
        return {
            ok: res.ok,
            status: res.status,
            res,
            refreshedFromApi: resolved.refreshedFromApi,
            tokenSource: resolved.tokenSource,
        };
    }

    const res = await fetch(u.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
    });
    return {
        ok: res.ok,
        status: res.status,
        res,
        refreshedFromApi: null,
        tokenSource: "apikey",
    };
}

export async function parseBingJsonResponse(res) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        return { raw: text };
    }
}
