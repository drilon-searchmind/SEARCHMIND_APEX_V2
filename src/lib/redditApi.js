/**
 * Reddit Ads API v3 (https://ads-api.reddit.com/api/v3).
 *
 * Credentials: `CustomerSettings.reddit` (see `redditCustomerSettings.js`).
 * Server env overrides: REDDIT_APP_ID, REDDIT_APP_SECRET, optional REDDIT_ADS_ACCESS_TOKEN / REDDIT_USERNAME.
 */

const REDDIT_ADS_API = "https://ads-api.reddit.com/api/v3";
const REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";

function num(v) {
    if (v === undefined || v === null || v === "") return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function redditDebugEnabled() {
    return process.env.DEBUG_REDDIT === "1" || process.env.NODE_ENV === "development";
}

function dbg(...args) {
    if (redditDebugEnabled()) console.log("[RedditAds]", ...args);
}

/** Reddit requires a descriptive User-Agent for API calls. */
export function buildRedditUserAgent(redditUsername) {
    const u = String(redditUsername || process.env.REDDIT_USERNAME || "apex").trim() || "apex";
    return `web:SEARCHMIND_APEX:v1.0 (by /u/${u})`;
}

async function redditAdsFetch(accessToken, path, { method = "GET", body: jsonBody, redditUsername } = {}) {
    const url = `${REDDIT_ADS_API}${path.startsWith("/") ? path : `/${path}`}`;
    const ua = buildRedditUserAgent(redditUsername);
    dbg(method, url);
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "User-Agent": ua,
        },
        body: jsonBody ? JSON.stringify(jsonBody) : undefined,
        cache: "no-store",
    });
    const text = await res.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { _raw: text?.slice?.(0, 500) || "" };
    }
    if (!res.ok) {
        const msg =
            data?.message ||
            data?.error ||
            data?.reason ||
            (typeof data?._raw === "string" && data._raw.slice(0, 200)) ||
            res.statusText;
        throw new Error(`Reddit Ads API ${res.status}: ${msg || "Error"}`);
    }
    return data.data !== undefined ? data.data : data;
}

/**
 * App-only token (scope `adsread`). Listing `/me/ad_accounts` may require a user OAuth token instead.
 */
export async function fetchRedditClientCredentialsToken({ appId, appSecret }) {
    const id = String(appId || "").trim();
    const secret = String(appSecret || "").trim();
    if (!id || !secret) throw new Error("Reddit app id and app secret are required for token exchange");

    const basic = Buffer.from(`${id}:${secret}`).toString("base64");
    const body = new URLSearchParams({ grant_type: "client_credentials", scope: "adsread" });

    const res = await fetch(REDDIT_TOKEN_URL, {
        method: "POST",
        headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": buildRedditUserAgent(process.env.REDDIT_USERNAME),
        },
        body: body.toString(),
    });

    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = raw?.message || raw?.error_description || raw?.error || res.statusText;
        throw new Error(`Reddit token failed: ${msg || res.status}`);
    }
    const access = typeof raw.access_token === "string" ? raw.access_token.trim() : "";
    if (!access) throw new Error("Reddit token response missing access_token");
    dbg("Resolved Reddit access_token via client_credentials");
    return access;
}

export async function refreshRedditAccessToken({ appId, appSecret, refreshToken }) {
    const id = String(appId || "").trim();
    const secret = String(appSecret || "").trim();
    const rt = String(refreshToken || "").trim();
    if (!id || !secret || !rt) throw new Error("Missing Reddit app id, secret, or refresh token");

    const basic = Buffer.from(`${id}:${secret}`).toString("base64");
    const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: rt });

    const res = await fetch(REDDIT_TOKEN_URL, {
        method: "POST",
        headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": buildRedditUserAgent(process.env.REDDIT_USERNAME),
        },
        body: body.toString(),
    });

    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = raw?.message || raw?.error_description || raw?.error || res.statusText;
        throw new Error(`Reddit refresh failed: ${msg || res.status}`);
    }
    const access = typeof raw.access_token === "string" ? raw.access_token.trim() : "";
    if (!access) throw new Error("Reddit refresh returned no access_token");
    dbg("Resolved Reddit access_token via refresh_token");
    return access;
}

/**
 * @param {ReturnType<import("./redditCustomerSettings").normalizeRedditSettings>} redditNormalized
 */
export async function resolveRedditAccessTokenForCustomer(redditNormalized) {
    const r = redditNormalized || {};

    const direct = typeof r.accessToken === "string" ? r.accessToken.trim() : "";
    if (direct) {
        if (redditDebugEnabled()) dbg("Bearer source: CustomerSettings.reddit.accessToken");
        return direct;
    }

    const appId = typeof r.appId === "string" ? r.appId.trim() : "";
    const appSecret = typeof r.appSecret === "string" ? r.appSecret.trim() : "";
    const refreshToken = typeof r.refreshToken === "string" ? r.refreshToken.trim() : "";

    if (appId && appSecret && refreshToken) {
        return refreshRedditAccessToken({ appId, appSecret, refreshToken });
    }

    if (appId && appSecret) {
        return fetchRedditClientCredentialsToken({ appId, appSecret });
    }

    const envTok = process.env.REDDIT_ADS_ACCESS_TOKEN?.trim();
    if (envTok) {
        if (redditDebugEnabled()) dbg("Bearer source: env REDDIT_ADS_ACCESS_TOKEN");
        return envTok;
    }

    return null;
}

function spendToMajor(row) {
    const micro = num(row.spend_micro ?? row.spendMicro);
    if (micro > 0) return micro / 1_000_000;
    const s = num(row.spend ?? row.spend_dollars);
    if (s <= 0) return 0;
    if (s >= 50_000) return s / 1_000_000;
    return s;
}

function rowDateKey(row) {
    const d = row.date ?? row.day ?? row.report_date ?? row.reportDate ?? row.time ?? row.event_date;
    if (typeof d === "string") return d.trim().slice(0, 10);
    return "";
}

/** Find arrays in payloads that resemble reporting rows */
function extractReportRows(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) {
        const ok = payload.some(
            (x) =>
                x &&
                typeof x === "object" &&
                (x.impressions != null || x.clicks != null || x.spend != null || rowDateKey(x))
        );
        return ok ? payload : [];
    }

    const stack = [payload];
    const seen = new Set();
    while (stack.length) {
        const cur = stack.pop();
        if (!cur || typeof cur !== "object") continue;
        if (seen.has(cur)) continue;
        seen.add(cur);

        if (Array.isArray(cur)) {
            if (
                cur.length &&
                typeof cur[0] === "object" &&
                (cur[0].impressions != null ||
                    cur[0].clicks != null ||
                    cur[0].spend != null ||
                    rowDateKey(cur[0]))
            ) {
                return cur;
            }
            for (const x of cur) stack.push(x);
            continue;
        }

        for (const k of Object.keys(cur)) {
            const v = cur[k];
            if (Array.isArray(v) && k === "metrics" && v.length && typeof v[0] === "object") {
                return v;
            }
            stack.push(v);
        }
    }
    return [];
}

function eachDayInclusive(startDateYmd, endDateYmd) {
    const out = [];
    const d = new Date(`${startDateYmd}T12:00:00.000Z`);
    const end = new Date(`${endDateYmd}T12:00:00.000Z`);
    while (d <= end) {
        out.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return out;
}

function normalizeDayRow(dateStr, agg) {
    const impressions = num(agg.impressions);
    const clicks = num(agg.clicks);
    const ad_spend = Math.round(num(agg.spend) * 100) / 100;
    const conversions = num(agg.conversions);
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpc = clicks > 0 ? ad_spend / clicks : 0;
    const cpm = impressions > 0 ? (ad_spend / impressions) * 1000 : 0;
    return {
        date: dateStr,
        ad_spend,
        impressions,
        clicks,
        saves: 0,
        conversions,
        conversion_value: 0,
        ctr,
        cpc,
        cpm,
        roas: 0,
        aov: 0,
    };
}

function campaignLabel(row) {
    const name =
        row.campaign_name || row.name || row.campaignName || (row.metadata && row.metadata.name) || "";
    const id =
        row.campaign_id ?? row.campaignId ?? row.id ?? row.entity_id ?? row.campaign?.id ?? "";
    const n = String(name || "").trim();
    if (n) return n;
    if (id) return typeof id === "string" ? id : `Campaign ${String(id)}`;
    return "Campaign";
}

function campaignKey(row) {
    const id =
        row.campaign_id ?? row.campaignId ?? row.campaign?.id ?? row.id ?? campaignLabel(row) ?? "";
    return String(id);
}

/**
 * @param {{
 *   accessToken: string,
 *   accountId: string,
 *   startDate: string,
 *   endDate: string,
 *   redditUsername?: string,
 * }} args
 */
export async function fetchRedditDashboardMetrics({ accessToken, accountId, startDate, endDate, redditUsername }) {
    const acc = String(accountId || "").trim();
    if (!acc) throw new Error("Missing Reddit ad account id");

    const uaOpt = { redditUsername };

    const baseMetrics = ["impressions", "clicks", "spend", "conversions"];
    const safeMetrics = ["impressions", "clicks", "spend"];

    const dailyBodies = [
        { level: "ACCOUNT", group_by: ["DATE"], metrics: baseMetrics },
        { level: "CAMPAIGN", group_by: ["DATE"], metrics: safeMetrics },
        { level: "ACCOUNT", group_by: ["DATE"], metrics: safeMetrics },
        { level: "CAMPAIGN", metrics: safeMetrics },
    ];

    let dailyRows = [];
    for (const extra of dailyBodies) {
        const body = { start_date: startDate, end_date: endDate, ...extra };
        try {
            dbg("reports try", body);
            const payload = await redditAdsFetch(
                accessToken,
                `/ad_accounts/${encodeURIComponent(acc)}/reports`,
                { method: "POST", body, ...uaOpt }
            );
            dailyRows = extractReportRows(payload);
            if (dailyRows.length > 0) break;
            dbg("reports empty rows");
        } catch (e) {
            dbg("reports failed", e?.message || e);
        }
    }

    const byDate = {};
    const hasDates = dailyRows.some((r) => rowDateKey(r));

    if (hasDates) {
        for (const row of dailyRows) {
            const dk = rowDateKey(row);
            if (!dk) continue;
            if (!byDate[dk]) byDate[dk] = { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
            const m = byDate[dk];
            m.impressions += num(row.impressions);
            m.clicks += num(row.clicks);
            m.spend += spendToMajor(row);
            m.conversions += num(row.conversions);
        }
    } else if (dailyRows.length) {
        const total = dailyRows.reduce(
            (a, row) => {
                a.impressions += num(row.impressions);
                a.clicks += num(row.clicks);
                a.spend += spendToMajor(row);
                a.conversions += num(row.conversions);
                return a;
            },
            { impressions: 0, clicks: 0, spend: 0, conversions: 0 }
        );
        const days = eachDayInclusive(startDate, endDate);
        const n = Math.max(days.length, 1);
        for (const d of days) {
            byDate[d] = {
                impressions: total.impressions / n,
                clicks: total.clicks / n,
                spend: total.spend / n,
                conversions: total.conversions / n,
            };
        }
    }

    let metrics_by_date = eachDayInclusive(startDate, endDate).map((d) =>
        normalizeDayRow(d, byDate[d] || { impressions: 0, clicks: 0, spend: 0, conversions: 0 })
    );
    metrics_by_date = metrics_by_date.filter((r) => r.date);

    let top_campaigns = [];
    try {
        let campPayload;
        try {
            campPayload = await redditAdsFetch(
                accessToken,
                `/ad_accounts/${encodeURIComponent(acc)}/reports`,
                {
                    method: "POST",
                    body: {
                        start_date: startDate,
                        end_date: endDate,
                        level: "CAMPAIGN",
                        group_by: ["CAMPAIGN"],
                        metrics: baseMetrics,
                    },
                    ...uaOpt,
                }
            );
        } catch {
            campPayload = await redditAdsFetch(
                accessToken,
                `/ad_accounts/${encodeURIComponent(acc)}/reports`,
                {
                    method: "POST",
                    body: {
                        start_date: startDate,
                        end_date: endDate,
                        level: "CAMPAIGN",
                        metrics: safeMetrics,
                    },
                    ...uaOpt,
                }
            );
        }

        const campRows = extractReportRows(campPayload);
        const merged = new Map();
        for (const row of campRows) {
            const cid = campaignKey(row) || "__";
            const prev = merged.get(cid) || {
                impressions: 0,
                clicks: 0,
                spend: 0,
                name: campaignLabel(row),
            };
            prev.impressions += num(row.impressions);
            prev.clicks += num(row.clicks);
            prev.spend += spendToMajor(row);
            merged.set(cid, prev);
        }
        top_campaigns = [...merged.entries()].map(([id, v]) => {
            const impressions = v.impressions;
            const clicks = v.clicks;
            const ctr = impressions > 0 ? clicks / impressions : 0;
            return {
                campaign_id: id,
                campaign_name: v.name || id,
                clicks,
                impressions,
                ctr,
                saves: clicks,
                ad_spend: v.spend,
            };
        });
        top_campaigns.sort((a, b) => (b.ad_spend || 0) - (a.ad_spend || 0));
        top_campaigns = top_campaigns.slice(0, 20);
    } catch (e2) {
        dbg("top campaigns failed", e2?.message || e2);
    }

    return { metrics_by_date, top_campaigns, campaigns_by_date: [] };
}

