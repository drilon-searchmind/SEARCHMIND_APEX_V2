import { isoCodeFromBillingCountryName } from "./shopifyMarketAdSpendCountries";

/**
 * Reddit Ads API v3 — base URL matches https://ads-api.reddit.com/docs/v3/
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

function dbgErr(...args) {
    if (redditDebugEnabled()) console.error("[RedditAds]", ...args);
}

/** Human-readable snippet for logs and thrown errors (avoids [object Object]). */
function stringifyRedditPayload(value, maxLen = 3500) {
    if (value == null) return "";
    if (typeof value === "string") return value.length > maxLen ? `${value.slice(0, maxLen)}…` : value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
        const s = JSON.stringify(value, null, 2);
        return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
    } catch {
        return String(value);
    }
}

/**
 * Reddit error bodies vary: `message` can be a string or structured object; see `field_errors`, `errors`.
 * @param {unknown} data - Parsed JSON (or { _raw })
 * @param {Response} res
 */
export function formatRedditAdsApiError(data, res) {
    const status = res?.status;
    if (!data || typeof data !== "object") {
        return res?.statusText || (status != null ? String(status) : "Error");
    }
    const root =
        data.error && typeof data.error === "object" && !Array.isArray(data.error) ? data.error : data;
    /** @type {string[]} */
    const bits = [];
    const msg = root.message ?? data.message;
    if (msg != null) bits.push(typeof msg === "string" ? msg : stringifyRedditPayload(msg, 2500));
    if (data.error != null && data.error !== msg && typeof data.error === "string") bits.push(data.error);
    if (root.reason) bits.push(String(root.reason));
    if (root.error_description) bits.push(String(root.error_description));
    if (root.field_errors) bits.push(`field_errors: ${stringifyRedditPayload(root.field_errors)}`);
    if (root.errors != null) bits.push(`errors: ${stringifyRedditPayload(root.errors)}`);
    if (root.detail) bits.push(stringifyRedditPayload(root.detail));
    const fieldList = Array.isArray(root.fields) ? root.fields : Array.isArray(data.fields) ? data.fields : [];
    if (fieldList.length) bits.push(`fields: ${stringifyRedditPayload(fieldList)}`);
    if (data._raw && typeof data._raw === "string") bits.push(data._raw.slice(0, 600));

    const joined = bits.filter(Boolean).join(" — ");
    return joined || res?.statusText || (status != null ? `HTTP ${status}` : "Reddit Ads API error");
}

/** Reddit requires a descriptive User-Agent for API calls. */
export function buildRedditUserAgent(redditUsername) {
    const u = String(redditUsername || process.env.REDDIT_USERNAME || "apex").trim() || "apex";
    return `web:SEARCHMIND_APEX:v1.0 (by /u/${u})`;
}

/**
 * Reddit Ads API v3 reporting (OpenAPI): POST body uses JSON:API-style `data` with:
 * `starts_at`, `ends_at` (ISO-8601 UTC), `fields` (uppercase metric enums), `breakdowns` (dimensions).
 * @see https://github.com/modelslab/reddit-ads-mcp (verified examples against live API)
 */
function redditReportPostBody(spec) {
    return { data: spec };
}

/** @param {string} ymd - YYYY-MM-DD */
function addOneCalendarDayYmd(ymd) {
    const d = new Date(`${ymd}T12:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}

/** @param {string} startDateYmd @param {string} endDateYmd */
function redditReportTimeRange(startDateYmd, endDateYmd) {
    // Both bounds must be hourly-only: YYYY-MM-DDTHH:00:00Z (see Reddit validation errors).
    // Use [starts_at, ends_at) with ends_at = midnight after the last reporting day so the range is inclusive of endDateYmd.
    return {
        starts_at: `${startDateYmd}T00:00:00Z`,
        ends_at: `${addOneCalendarDayYmd(endDateYmd)}T00:00:00Z`,
    };
}

/** Appended to 401 responses from ads-api.reddit.com (reports require a user-context token). */
function redditAdsUnauthorizedHint() {
    return " Use a user OAuth access token for the Reddit account that has access to this ad account (authorization-code flow; include scope adsread; store access + refresh token on the customer). App-only client_credentials tokens often return 401 on reporting. Docs: https://ads-api.reddit.com/docs/v3/";
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
        let msg = formatRedditAdsApiError(data, res);
        if (res.status === 401) {
            msg = `${msg}${redditAdsUnauthorizedHint()}`;
        }
        dbgErr("API error response", {
            status: res.status,
            url,
            message: msg,
            body: redditDebugEnabled() ? data : "(set DEBUG_REDDIT=1 for full body)",
        });
        if (redditDebugEnabled()) {
            dbgErr("Full error JSON", stringifyRedditPayload(data));
        }
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
 * @param {{ preferStoredAccessToken?: boolean }} [opts] — default: refresh when app id + secret + refresh token exist (access tokens expire ~1h)
 */
export async function resolveRedditAccessTokenForCustomer(redditNormalized, opts = {}) {
    const r = redditNormalized || {};
    const appId = typeof r.appId === "string" ? r.appId.trim() : "";
    const appSecret = typeof r.appSecret === "string" ? r.appSecret.trim() : "";
    const refreshToken = typeof r.refreshToken === "string" ? r.refreshToken.trim() : "";
    const direct = typeof r.accessToken === "string" ? r.accessToken.trim() : "";

    // User OAuth: prefer refresh_token grant so reporting does not use an expired pasted access token.
    if (appId && appSecret && refreshToken && !opts.preferStoredAccessToken) {
        return refreshRedditAccessToken({ appId, appSecret, refreshToken });
    }

    if (direct) {
        if (redditDebugEnabled()) dbg("Bearer source: CustomerSettings.reddit.accessToken");
        return direct;
    }

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
    const micro = num(row.spend_micro ?? row.spendMicro ?? row.SPEND_MICRO);
    if (micro > 0) return micro / 1_000_000;
    const s = num(row.spend ?? row.spend_dollars ?? row.SPEND);
    if (s <= 0) return 0;
    if (s >= 50_000) return s / 1_000_000;
    return s;
}

function rowImpressions(r) {
    return num(r.impressions ?? r.IMPRESSIONS);
}

function rowClicks(r) {
    return num(r.clicks ?? r.CLICKS);
}

function rowConversions(r) {
    return num(r.conversions ?? r.CONVERSIONS);
}

function rowDateKey(row) {
    const d =
        row.date ??
        row.day ??
        row.DATE ??
        row.report_date ??
        row.reportDate ??
        row.time ??
        row.event_date;
    if (typeof d === "string") {
        const t = d.trim();
        if (t.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
        if (t.includes("T")) return t.slice(0, 10);
    }
    return "";
}

/** ISO 3166-1 alpha-2 from Reddit report rows with COUNTRY breakdown (same allowlist as Meta / Snapchat). */
function rowCountryCode(row) {
    const raw =
        row.country ??
        row.COUNTRY ??
        row.country_code ??
        row.COUNTRY_CODE ??
        row.geo_country ??
        row.GEO_COUNTRY ??
        "";
    const s = String(raw).trim();
    if (s.length === 2) return s.toUpperCase();
    return isoCodeFromBillingCountryName(s) || "";
}

/**
 * Total spend by ISO-2 from a single DATE+COUNTRY report (no market filter).
 * @returns {Promise<Map<string, number>>}
 */
export async function fetchRedditSpendByIso2Map(args) {
    const dash = await fetchRedditDashboardMetrics({
        ...args,
        aggregateSpendByCountry: true,
    });
    return dash.spend_by_iso2 instanceof Map ? dash.spend_by_iso2 : new Map();
}

function rowLooksLikeReportRecord(x) {
    return (
        x &&
        typeof x === "object" &&
        (x.impressions != null ||
            x.IMPRESSIONS != null ||
            x.clicks != null ||
            x.CLICKS != null ||
            x.spend != null ||
            x.SPEND != null ||
            rowDateKey(x))
    );
}

/** Find arrays in payloads that resemble reporting rows */
function extractReportRows(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) {
        const ok = payload.some((x) => rowLooksLikeReportRecord(x));
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
            if (cur.length && typeof cur[0] === "object" && rowLooksLikeReportRecord(cur[0])) {
                return cur;
            }
            for (const x of cur) stack.push(x);
            continue;
        }

        for (const k of Object.keys(cur)) {
            const v = cur[k];
            if (Array.isArray(v) && (k === "metrics" || k === "rows" || k === "data") && v.length && typeof v[0] === "object") {
                if (rowLooksLikeReportRecord(v[0])) return v;
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
        row.campaign_name ||
        row.name ||
        row.campaignName ||
        row.CAMPAIGN_NAME ||
        (row.metadata && row.metadata.name) ||
        "";
    const id =
        row.campaign_id ??
        row.campaignId ??
        row.CAMPAIGN_ID ??
        row.id ??
        row.entity_id ??
        row.campaign?.id ??
        "";
    const n = String(name || "").trim();
    if (n) return n;
    if (id) return typeof id === "string" ? id : `Campaign ${String(id)}`;
    return "Campaign";
}

function campaignKey(row) {
    const id =
        row.campaign_id ??
        row.campaignId ??
        row.CAMPAIGN_ID ??
        row.campaign?.id ??
        row.id ??
        campaignLabel(row) ??
        "";
    return String(id);
}

/**
 * @param {{
 *   accessToken: string,
 *   accountId: string,
 *   startDate: string,
 *   endDate: string,
 *   redditUsername?: string,
 *   redditCredentials?: ReturnType<import("./redditCustomerSettings").normalizeRedditSettings>,
 *   countryIsoCodes?: string[] — when set, daily spend is limited to these ISO-2 countries (Shopify Markets ad spend filter)
 *   aggregateSpendByCountry?: boolean — when true, return `spend_by_iso2` Map (single DATE+COUNTRY fetch, all countries)
 * }} args — when redditCredentials is set, 401 responses retry once via refresh_token
 */
export async function fetchRedditDashboardMetrics({
    accessToken,
    accountId,
    startDate,
    endDate,
    redditUsername,
    redditCredentials,
    countryIsoCodes,
    aggregateSpendByCountry = false,
}) {
    const acc = String(accountId || "").trim();
    if (!acc) throw new Error("Missing Reddit ad account id");

    const uaOpt = { redditUsername };

    async function runWithToken(token) {
        return fetchRedditDashboardMetricsInner({
            accessToken: token,
            accountId: acc,
            startDate,
            endDate,
            uaOpt,
            countryIsoCodes,
            aggregateSpendByCountry,
        });
    }

    try {
        return await runWithToken(accessToken);
    } catch (e) {
        const msg = String(e?.message || "");
        const creds = redditCredentials || {};
        const canRefresh =
            msg.includes("Reddit Ads API 401") &&
            creds.appId &&
            creds.appSecret &&
            creds.refreshToken;
        if (!canRefresh) throw e;
        dbg("401 — retrying after refresh_token");
        const fresh = await refreshRedditAccessToken({
            appId: creds.appId,
            appSecret: creds.appSecret,
            refreshToken: creds.refreshToken,
        });
        return runWithToken(fresh);
    }
}

async function fetchRedditDashboardMetricsInner({
    accessToken,
    accountId,
    startDate,
    endDate,
    uaOpt,
    countryIsoCodes,
    aggregateSpendByCountry = false,
}) {
    const acc = String(accountId || "").trim();

    /**
     * `fields` must be enums from Reddit’s reporting schema — not `CONVERSIONS`.
     * Conversion counts use specific names (e.g. APP_INSTALL_*_COUNT). See docs.
     */
    const reportFields = ["IMPRESSIONS", "CLICKS", "SPEND"];

    const marketCountryFilter =
        !aggregateSpendByCountry &&
        Array.isArray(countryIsoCodes) &&
        countryIsoCodes.filter((c) => String(c).trim()).length > 0;
    const countryAllow = marketCountryFilter
        ? new Set(
              countryIsoCodes
                  .map((c) => String(c).trim().toUpperCase())
                  .filter((c) => c.length === 2)
          )
        : null;

    /** @type {Map<string, number>} */
    const spendByIso2 = new Map();

    if (aggregateSpendByCountry) {
        try {
            const body = redditReportPostBody({
                ...redditReportTimeRange(startDate, endDate),
                fields: ["SPEND"],
                breakdowns: ["DATE", "COUNTRY"],
            });
            const payload = await redditAdsFetch(
                accessToken,
                `/ad_accounts/${encodeURIComponent(acc)}/reports`,
                { method: "POST", body, ...uaOpt }
            );
            for (const row of extractReportRows(payload)) {
                const cc = rowCountryCode(row);
                if (!cc) continue;
                spendByIso2.set(cc, (spendByIso2.get(cc) || 0) + spendToMajor(row));
            }
        } catch (e) {
            if (String(e?.message || "").includes("Reddit Ads API 401")) throw e;
            dbgErr("aggregateSpendByCountry failed", e?.message || e);
        }
        return {
            metrics_by_date: [],
            top_campaigns: [],
            campaigns_by_date: [],
            spend_by_iso2: spendByIso2,
        };
    }

    let dailyRows = [];
    if (marketCountryFilter) {
        try {
            const body = redditReportPostBody({
                ...redditReportTimeRange(startDate, endDate),
                fields: ["SPEND"],
                breakdowns: ["DATE", "COUNTRY"],
            });
            dbg("reports try (DATE+COUNTRY)", body);
            const payload = await redditAdsFetch(
                accessToken,
                `/ad_accounts/${encodeURIComponent(acc)}/reports`,
                { method: "POST", body, ...uaOpt }
            );
            dailyRows = extractReportRows(payload);
            if (dailyRows.length === 0) dbg("DATE+COUNTRY reports empty rows");
        } catch (e) {
            if (String(e?.message || "").includes("Reddit Ads API 401")) throw e;
            dbgErr("DATE+COUNTRY reports failed", e?.message || e);
        }
    } else {
        try {
            const body = redditReportPostBody({
                ...redditReportTimeRange(startDate, endDate),
                fields: reportFields,
                breakdowns: ["DATE"],
            });
            dbg("reports try", body);
            const payload = await redditAdsFetch(
                accessToken,
                `/ad_accounts/${encodeURIComponent(acc)}/reports`,
                { method: "POST", body, ...uaOpt }
            );
            dailyRows = extractReportRows(payload);
            if (dailyRows.length === 0) dbg("reports empty rows");
        } catch (e) {
            if (String(e?.message || "").includes("Reddit Ads API 401")) throw e;
            dbgErr("reports failed", e?.message || e);
        }
    }

    const byDate = {};
    const hasDates = dailyRows.some((r) => rowDateKey(r));

    if (hasDates) {
        for (const row of dailyRows) {
            const dk = rowDateKey(row);
            if (!dk) continue;
            if (countryAllow) {
                const cc = rowCountryCode(row);
                if (!cc || !countryAllow.has(cc)) continue;
            }
            if (!byDate[dk]) byDate[dk] = { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
            const m = byDate[dk];
            m.impressions += rowImpressions(row);
            m.clicks += rowClicks(row);
            m.spend += spendToMajor(row);
            m.conversions += rowConversions(row);
        }
    } else if (dailyRows.length && !countryAllow) {
        const total = dailyRows.reduce(
            (a, row) => {
                a.impressions += rowImpressions(row);
                a.clicks += rowClicks(row);
                a.spend += spendToMajor(row);
                a.conversions += rowConversions(row);
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
        const campPayload = await redditAdsFetch(
            accessToken,
            `/ad_accounts/${encodeURIComponent(acc)}/reports`,
            {
                method: "POST",
                body: redditReportPostBody({
                    ...redditReportTimeRange(startDate, endDate),
                    fields: reportFields,
                    breakdowns: ["CAMPAIGN_ID"],
                }),
                ...uaOpt,
            }
        );

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
            prev.impressions += rowImpressions(row);
            prev.clicks += rowClicks(row);
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
        if (String(e2?.message || "").includes("Reddit Ads API 401")) throw e2;
        dbgErr("top campaigns failed", e2?.message || e2);
        if (e2 && typeof e2 === "object" && e2.stack && redditDebugEnabled()) {
            dbgErr(e2.stack);
        }
    }

    return { metrics_by_date, top_campaigns, campaigns_by_date: [], spend_by_iso2: spendByIso2 };
}

