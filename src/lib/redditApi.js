import { isoCodeFromBillingCountryName } from "./shopifyMarketAdSpendCountries";
import { getCurrencyConversionTable, conversionRateToDkk } from "./currencyConversionTable";

/**
 * Reddit Ads API v3 — base URL matches https://ads-api.reddit.com/docs/v3/
 *
 * Reporting spend is in USD (microdollars). All spend returned from this module is converted to DKK
 * using the same FX table as Google Ads (`conversionRateToDkk`).
 *
 * Credentials: `CustomerSettings.reddit` (see `redditCustomerSettings.js`).
 * Server env overrides: REDDIT_APP_ID, REDDIT_APP_SECRET, optional REDDIT_ADS_ACCESS_TOKEN / REDDIT_USERNAME.
 */

const REDDIT_ADS_API = "https://ads-api.reddit.com/api/v3";
const REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
/** Reddit reports SPEND in USD microdollars; convert to DKK for dashboard parity with Google Ads. */
export const REDDIT_ADS_SPEND_CURRENCY = "USD";
const ACCESS_TOKEN_CACHE_TTL_MS = 50 * 60 * 1000;

/** @type {Map<string, { token: string, expires: number }>} */
const accessTokenCache = new Map();
/** @type {Map<string, Promise<string>>} */
const refreshInFlight = new Map();

function redditTokenCacheKey({ appId, refreshToken }) {
    return `${String(appId || "").trim()}:${String(refreshToken || "").trim()}`;
}

function readCachedRedditAccessToken(cacheKey) {
    if (!cacheKey) return null;
    const entry = accessTokenCache.get(cacheKey);
    if (!entry || entry.expires <= Date.now()) return null;
    return entry.token;
}

function writeCachedRedditAccessToken(cacheKey, token) {
    if (!cacheKey || !token) return;
    accessTokenCache.set(cacheKey, {
        token,
        expires: Date.now() + ACCESS_TOKEN_CACHE_TTL_MS,
    });
}

export function invalidateRedditAccessTokenCache(creds) {
    const key = redditTokenCacheKey(creds || {});
    if (key) accessTokenCache.delete(key);
}

async function refreshRedditAccessTokenCached(creds, { force = false } = {}) {
    const cacheKey = redditTokenCacheKey(creds);
    if (!cacheKey || cacheKey === ":") {
        return refreshRedditAccessToken(creds);
    }

    if (!force) {
        const cached = readCachedRedditAccessToken(cacheKey);
        if (cached) {
            dbg("Bearer source: in-memory cache");
            return cached;
        }
        const pending = refreshInFlight.get(cacheKey);
        if (pending) {
            dbg("Bearer source: awaiting in-flight refresh");
            return pending;
        }
    } else {
        accessTokenCache.delete(cacheKey);
    }

    const promise = refreshRedditAccessToken(creds)
        .then((token) => {
            writeCachedRedditAccessToken(cacheKey, token);
            return token;
        })
        .finally(() => {
            refreshInFlight.delete(cacheKey);
        });

    refreshInFlight.set(cacheKey, promise);
    return promise;
}

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

async function redditAdsFetch(accessToken, path, { method = "GET", body: jsonBody, redditUsername, full = false } = {}) {
    const url = path.startsWith("http") ? path : `${REDDIT_ADS_API}${path.startsWith("/") ? path : `/${path}`}`;
    const ua = buildRedditUserAgent(redditUsername);
    dbg(method, url);
    let res;
    // Reddit rate-limits bursts of report calls with 429, so wait briefly and retry a couple of times.
    for (let attempt = 0; attempt < 3; attempt += 1) {
        res = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                "User-Agent": ua,
            },
            body: jsonBody ? JSON.stringify(jsonBody) : undefined,
            cache: "no-store",
        });
        if (res.status !== 429 || attempt === 2) break;
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1500 * (attempt + 1), 5000);
        dbg("429, retrying in", waitMs);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
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
    if (full) return data;
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

    if (direct && opts.preferStoredAccessToken) {
        if (redditDebugEnabled()) dbg("Bearer source: CustomerSettings.reddit.accessToken");
        return direct;
    }

    // User OAuth: prefer refresh_token grant so reporting does not use an expired pasted access token.
    if (appId && appSecret && refreshToken) {
        try {
            return await refreshRedditAccessTokenCached(
                { appId, appSecret, refreshToken },
                { force: opts.forceRefresh === true }
            );
        } catch (err) {
            if (direct && String(err?.message || "").includes("429")) {
                dbg("Refresh rate-limited — falling back to stored access token");
                return direct;
            }
            throw err;
        }
    }

    if (direct) {
        if (redditDebugEnabled()) dbg("Bearer source: CustomerSettings.reddit.accessToken");
        return direct;
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

async function redditSpendConversionRateToDkk() {
    const { data: currencyData } = await getCurrencyConversionTable();
    return conversionRateToDkk(REDDIT_ADS_SPEND_CURRENCY, currencyData);
}

/**
 * Convert Reddit USD spend fields to DKK (metrics_by_date, top_campaigns, spend_by_iso2).
 * @param {Awaited<ReturnType<typeof fetchRedditDashboardMetricsInner>>} payload
 * @param {number} rate
 */
function applyRedditSpendConversionToDkk(payload, rate) {
    if (!rate || rate === 1) return payload;

    const metrics_by_date = (payload.metrics_by_date || []).map((row) => {
        const ad_spend = Math.round(num(row.ad_spend) * rate * 100) / 100;
        const clicks = num(row.clicks);
        const impressions = num(row.impressions);
        const conversion_value = Math.round(num(row.conversion_value) * rate * 100) / 100;
        const purchases = num(row.purchases);
        return {
            ...row,
            ad_spend,
            conversion_value,
            purchase_value: conversion_value,
            cpc: clicks > 0 ? ad_spend / clicks : 0,
            cpm: impressions > 0 ? (ad_spend / impressions) * 1000 : 0,
            roas: ad_spend > 0 ? conversion_value / ad_spend : 0,
            aov: purchases > 0 ? conversion_value / purchases : 0,
        };
    });

    const top_campaigns = (payload.top_campaigns || []).map((row) => ({
        ...row,
        ad_spend: num(row.ad_spend) * rate,
        purchase_value: num(row.purchase_value) * rate,
    }));

    const spend_by_iso2 =
        payload.spend_by_iso2 instanceof Map ? payload.spend_by_iso2 : new Map();
    if (spend_by_iso2.size > 0) {
        for (const [iso, spend] of spend_by_iso2) {
            spend_by_iso2.set(iso, num(spend) * rate);
        }
    }

    return {
        ...payload,
        metrics_by_date,
        top_campaigns,
        spend_by_iso2,
        spend_currency: "DKK",
        source_spend_currency: REDDIT_ADS_SPEND_CURRENCY,
        spend_conversion_rate_to_dkk: rate,
    };
}

async function finalizeRedditDashboardPayload(payload) {
    const rate = await redditSpendConversionRateToDkk();
    return applyRedditSpendConversionToDkk(payload, rate);
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
    const purchases = num(agg.purchases ?? agg.conversions);
    const conversion_value = Math.round(num(agg.value) * 100) / 100;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpc = clicks > 0 ? ad_spend / clicks : 0;
    const cpm = impressions > 0 ? (ad_spend / impressions) * 1000 : 0;
    return {
        date: dateStr,
        ad_spend,
        impressions,
        clicks,
        saves: 0,
        conversions: purchases,
        purchases,
        adds_to_cart: num(agg.adds),
        conversion_value,
        purchase_value: conversion_value,
        ctr,
        cpc,
        cpm,
        roas: ad_spend > 0 ? conversion_value / ad_spend : 0,
        aov: purchases > 0 ? conversion_value / purchases : 0,
    };
}

/**
 * Reddit pages every response (50 rows by default), which silently cut daily series at 50 days and
 * campaign tables at 50 rows. Ask for the largest page (`page.size`) and follow `pagination.next_url`.
 */
async function redditReportAllRows(accessToken, accountId, spec, uaOpt) {
    const body = redditReportPostBody(spec);
    const rows = [];
    let url = `/ad_accounts/${encodeURIComponent(accountId)}/reports?page.size=1000`;
    for (let page = 0; page < 25 && url; page += 1) {
        const full = await redditAdsFetch(accessToken, url, { method: "POST", body, full: true, ...uaOpt });
        rows.push(...extractReportRows(full?.data !== undefined ? full.data : full));
        url = full?.pagination?.next_url || null;
    }
    return rows;
}

async function redditListAll(accessToken, accountId, path, uaOpt) {
    const out = [];
    let url = `/ad_accounts/${encodeURIComponent(accountId)}${path}?page.size=1000`;
    for (let page = 0; page < 25 && url; page += 1) {
        const full = await redditAdsFetch(accessToken, url, { full: true, ...uaOpt });
        if (Array.isArray(full?.data)) out.push(...full.data);
        url = full?.pagination?.next_url || null;
    }
    return out;
}

/** id -> entity (name and parents) for campaigns, ad groups or ads; empty on failure so names fall back to ids */
async function redditEntityMap(accessToken, accountId, path, uaOpt) {
    try {
        const list = await redditListAll(accessToken, accountId, path, uaOpt);
        return new Map(list.map((e) => [String(e.id), e]));
    } catch (e) {
        if (String(e?.message || "").includes("Reddit Ads API 401")) throw e;
        dbgErr(`entity list ${path} failed`, e?.message || e);
        return new Map();
    }
}

/** Purchase and add to cart fields. They are accepted by the reporting API but optional, so they fall back. */
const CONVERSION_FIELDS = ["CONVERSION_PURCHASE_TOTAL_ITEMS", "CONVERSION_PURCHASE_TOTAL_VALUE", "CONVERSION_ADD_TO_CART_TOTAL_ITEMS"];

/** Run a report with the conversion fields first and the plain fields as a fallback. */
async function redditReportWithConversions(accessToken, accountId, spec, uaOpt) {
    try {
        return await redditReportAllRows(accessToken, accountId, { ...spec, fields: [...spec.fields, ...CONVERSION_FIELDS] }, uaOpt);
    } catch (e) {
        if (String(e?.message || "").includes("Reddit Ads API 401")) throw e;
        dbgErr("report with conversion fields failed, retrying plain", e?.message || e);
        return redditReportAllRows(accessToken, accountId, spec, uaOpt);
    }
}

/** Purchase value is reported in micro-currency like spend. */
function valueToMajor(row) {
    return num(row.conversion_purchase_total_value ?? row.CONVERSION_PURCHASE_TOTAL_VALUE) / 1_000_000;
}

function rowPurchases(row) {
    return num(row.conversion_purchase_total_items ?? row.CONVERSION_PURCHASE_TOTAL_ITEMS);
}

function rowAddsToCart(row) {
    return num(row.conversion_add_to_cart_total_items ?? row.CONVERSION_ADD_TO_CART_TOTAL_ITEMS);
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
 *   spendByDateOnly?: boolean — when true, skip campaign breakdown fetches (merged-sources spend rollup)
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
    spendByDateOnly = false,
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
            spendByDateOnly,
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
        invalidateRedditAccessTokenCache(creds);
        const fresh = await refreshRedditAccessTokenCached(
            {
                appId: creds.appId,
                appSecret: creds.appSecret,
                refreshToken: creds.refreshToken,
            },
            { force: true }
        );
        return runWithToken(fresh);
    }
}

/**
 * Extras for the dashboard (best-effort, each part may fail on its own and returns a warning):
 *  - audience breakdowns: communities (subreddits), interests, keywords, gender, country, region, placement
 *  - ad groups and ads with names
 *  - account totals: unique reach, frequency and the video funnel
 * Spend and purchase value are converted to DKK like the rest of the module.
 */
const BREAKDOWN_FIELDS = ["IMPRESSIONS", "CLICKS", "SPEND"];

const AUDIENCE_BREAKDOWNS = [
    { key: "community", breakdown: "COMMUNITY", rowKey: "community", limit: 40 },
    { key: "interest", breakdown: "INTEREST", rowKey: "interest", limit: 30 },
    { key: "keyword", breakdown: "KEYWORD", rowKey: "keyword", limit: 30 },
    { key: "gender", breakdown: "GENDER", rowKey: "gender", limit: 10 },
    { key: "country", breakdown: "COUNTRY", rowKey: "country", limit: 30 },
    { key: "region", breakdown: "REGION", rowKey: "region", limit: 30 },
    { key: "placement", breakdown: "PLACEMENT", rowKey: "placement", limit: 10 },
];

function titleCase(v) {
    return String(v)
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function breakdownLabel(key, raw) {
    const v = String(raw ?? "").trim();
    if (!v) return "Unknown";
    if (key === "country" && v.length === 2) {
        try {
            return new Intl.DisplayNames(["en"], { type: "region" }).of(v.toUpperCase()) || v.toUpperCase();
        } catch {
            return v.toUpperCase();
        }
    }
    if (key === "placement") return titleCase(v);
    if (key === "community") return `r/${v.replace(/^r\//i, "")}`;
    return v;
}

function withMetrics(base, agg, rate) {
    const ad_spend = agg.spend * rate;
    const purchase_value = agg.value * rate;
    return {
        ...base,
        impressions: agg.impressions,
        clicks: agg.clicks,
        ad_spend,
        purchases: agg.purchases,
        adds_to_cart: agg.adds,
        purchase_value,
        ctr: agg.impressions > 0 ? agg.clicks / agg.impressions : 0,
        roas: ad_spend > 0 && purchase_value > 0 ? purchase_value / ad_spend : 0,
    };
}

function emptyAgg() {
    return { impressions: 0, clicks: 0, spend: 0, purchases: 0, adds: 0, value: 0 };
}

function addRow(agg, row) {
    agg.impressions += rowImpressions(row);
    agg.clicks += rowClicks(row);
    agg.spend += spendToMajor(row);
    agg.purchases += rowPurchases(row);
    agg.adds += rowAddsToCart(row);
    agg.value += valueToMajor(row);
}

async function redditBreakdownRows(accessToken, acc, startDate, endDate, breakdown, uaOpt) {
    return redditReportWithConversions(
        accessToken,
        acc,
        { ...redditReportTimeRange(startDate, endDate), fields: BREAKDOWN_FIELDS, breakdowns: [breakdown] },
        uaOpt
    );
}

async function redditAudienceBreakdown({ accessToken, acc, startDate, endDate, uaOpt, rate, def }) {
    const rows = await redditBreakdownRows(accessToken, acc, startDate, endDate, def.breakdown, uaOpt);
    const map = new Map();
    for (const r of rows) {
        const raw = String(r[def.rowKey] ?? r[def.rowKey.toUpperCase()] ?? "");
        if (!raw) continue;
        const cur = map.get(raw) || emptyAgg();
        addRow(cur, r);
        map.set(raw, cur);
    }
    return [...map.entries()]
        .map(([raw, agg]) => withMetrics({ id: raw, name: breakdownLabel(def.key, raw) }, agg, rate))
        .sort((a, b) => b.ad_spend - a.ad_spend)
        .slice(0, def.limit);
}

async function redditEntityBreakdown({ accessToken, acc, startDate, endDate, uaOpt, rate, kind }) {
    const isAd = kind === "ad";
    const [rows, entities, campaigns, adGroups] = await Promise.all([
        redditBreakdownRows(accessToken, acc, startDate, endDate, isAd ? "AD_ID" : "AD_GROUP_ID", uaOpt),
        redditEntityMap(accessToken, acc, isAd ? "/ads" : "/ad_groups", uaOpt),
        redditEntityMap(accessToken, acc, "/campaigns", uaOpt),
        isAd ? redditEntityMap(accessToken, acc, "/ad_groups", uaOpt) : Promise.resolve(new Map()),
    ]);
    const idKey = isAd ? "ad_id" : "ad_group_id";
    const map = new Map();
    for (const r of rows) {
        const id = String(r[idKey] ?? "");
        if (!id) continue;
        const cur = map.get(id) || emptyAgg();
        addRow(cur, r);
        map.set(id, cur);
    }
    return [...map.entries()]
        .map(([id, agg]) => {
            const e = entities.get(id) || {};
            const camp = campaigns.get(String(e.campaign_id)) || {};
            return withMetrics(
                {
                    id,
                    name: e.name || `${isAd ? "Ad" : "Ad group"} ${id}`,
                    campaign_id: e.campaign_id || null,
                    campaign_name: camp.name || null,
                    ad_group_name: isAd ? adGroups.get(String(e.ad_group_id))?.name || null : null,
                    status: e.effective_status || null,
                    objective: camp.objective || null,
                },
                agg,
                rate
            );
        })
        .sort((a, b) => b.ad_spend - a.ad_spend)
        .slice(0, 50);
}

const ACCOUNT_TOTAL_FIELDS = [
    "IMPRESSIONS",
    "REACH",
    "FREQUENCY",
    "VIDEO_STARTED",
    "VIDEO_WATCHED_25_PERCENT",
    "VIDEO_WATCHED_50_PERCENT",
    "VIDEO_WATCHED_75_PERCENT",
    "VIDEO_WATCHED_100_PERCENT",
    "VIDEO_PLAYS_WITH_SOUND",
];

async function redditAccountTotals({ accessToken, acc, startDate, endDate, uaOpt }) {
    const rows = await redditReportAllRows(
        accessToken,
        acc,
        { ...redditReportTimeRange(startDate, endDate), fields: ACCOUNT_TOTAL_FIELDS, breakdowns: [] },
        uaOpt
    );
    const r = rows[0] || {};
    const started = num(r.video_started);
    return {
        reach: num(r.reach),
        frequency: num(r.frequency),
        video_started: started,
        video_25: num(r.video_watched_25_percent),
        video_50: num(r.video_watched_50_percent),
        video_75: num(r.video_watched_75_percent),
        video_100: num(r.video_watched_100_percent),
        video_with_sound: num(r.video_plays_with_sound),
    };
}

export async function fetchRedditDashboardExtras({ accessToken, accountId, startDate, endDate, redditUsername }) {
    const acc = String(accountId || "").trim();
    const uaOpt = { redditUsername };
    const rate = await redditSpendConversionRateToDkk();
    const ctx = { accessToken, acc, startDate, endDate, uaOpt, rate };

    const settled = await Promise.allSettled([
        redditAccountTotals(ctx),
        redditEntityBreakdown({ ...ctx, kind: "ad_group" }),
        redditEntityBreakdown({ ...ctx, kind: "ad" }),
        ...AUDIENCE_BREAKDOWNS.map((def) => redditAudienceBreakdown({ ...ctx, def })),
    ]);
    const [totals, adGroups, ads, ...audiences] = settled;

    const warnings = [];
    const fail = (part, r) => warnings.push({ part, message: r.reason?.message || `${part} failed` });
    if (totals.status === "rejected") fail("account", totals);
    if (adGroups.status === "rejected") fail("ad_groups", adGroups);
    if (ads.status === "rejected") fail("ads", ads);

    const audience = {};
    AUDIENCE_BREAKDOWNS.forEach((def, i) => {
        const r = audiences[i];
        if (r.status === "fulfilled") audience[def.key] = r.value;
        else {
            audience[def.key] = [];
            fail(def.key, r);
        }
    });

    return {
        account: totals.status === "fulfilled" ? totals.value : null,
        ad_groups: adGroups.status === "fulfilled" ? adGroups.value : [],
        ads: ads.status === "fulfilled" ? ads.value : [],
        audience,
        warnings,
    };
}

async function fetchRedditDashboardMetricsInner({
    accessToken,
    accountId,
    startDate,
    endDate,
    uaOpt,
    countryIsoCodes,
    aggregateSpendByCountry = false,
    spendByDateOnly = false,
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
            const rowsAll = await redditReportAllRows(
                accessToken,
                acc,
                { ...redditReportTimeRange(startDate, endDate), fields: ["SPEND"], breakdowns: ["DATE", "COUNTRY"] },
                uaOpt
            );
            for (const row of rowsAll) {
                const cc = rowCountryCode(row);
                if (!cc) continue;
                spendByIso2.set(cc, (spendByIso2.get(cc) || 0) + spendToMajor(row));
            }
        } catch (e) {
            if (String(e?.message || "").includes("Reddit Ads API 401")) throw e;
            dbgErr("aggregateSpendByCountry failed", e?.message || e);
        }
        return finalizeRedditDashboardPayload({
            metrics_by_date: [],
            top_campaigns: [],
            campaigns_by_date: [],
            spend_by_iso2: spendByIso2,
        });
    }

    let dailyRows = [];
    if (marketCountryFilter) {
        try {
            const spec = { ...redditReportTimeRange(startDate, endDate), fields: ["SPEND"], breakdowns: ["DATE", "COUNTRY"] };
            dbg("reports try (DATE+COUNTRY)", spec);
            dailyRows = await redditReportAllRows(accessToken, acc, spec, uaOpt);
            if (dailyRows.length === 0) dbg("DATE+COUNTRY reports empty rows");
        } catch (e) {
            if (String(e?.message || "").includes("Reddit Ads API 401")) throw e;
            dbgErr("DATE+COUNTRY reports failed", e?.message || e);
        }
    } else {
        try {
            const spec = { ...redditReportTimeRange(startDate, endDate), fields: reportFields, breakdowns: ["DATE"] };
            dbg("reports try", spec);
            dailyRows = spendByDateOnly
                ? await redditReportAllRows(accessToken, acc, spec, uaOpt)
                : await redditReportWithConversions(accessToken, acc, spec, uaOpt);
            if (dailyRows.length === 0) dbg("reports empty rows");
        } catch (e) {
            if (String(e?.message || "").includes("Reddit Ads API 401")) throw e;
            // A persistent rate limit on the dashboard path is an error, not an account with no spend.
            if (!spendByDateOnly && String(e?.message || "").includes("Reddit Ads API 429")) throw e;
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
            if (!byDate[dk]) byDate[dk] = { impressions: 0, clicks: 0, spend: 0, conversions: 0, purchases: 0, value: 0, adds: 0 };
            const m = byDate[dk];
            m.impressions += rowImpressions(row);
            m.clicks += rowClicks(row);
            m.spend += spendToMajor(row);
            m.conversions += rowConversions(row);
            m.purchases += rowPurchases(row);
            m.value += valueToMajor(row);
            m.adds += rowAddsToCart(row);
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
        normalizeDayRow(d, byDate[d] || { impressions: 0, clicks: 0, spend: 0, conversions: 0, purchases: 0, value: 0, adds: 0 })
    );
    metrics_by_date = metrics_by_date.filter((r) => r.date);

    let top_campaigns = [];
    if (!spendByDateOnly) {
    try {
        const [campRows, campaignMap] = await Promise.all([
            redditReportWithConversions(
                accessToken,
                acc,
                { ...redditReportTimeRange(startDate, endDate), fields: reportFields, breakdowns: ["CAMPAIGN_ID"] },
                uaOpt
            ),
            redditEntityMap(accessToken, acc, "/campaigns", uaOpt),
        ]);
        const merged = new Map();
        for (const row of campRows) {
            const cid = campaignKey(row) || "__";
            const prev = merged.get(cid) || { impressions: 0, clicks: 0, spend: 0, purchases: 0, adds: 0, value: 0, name: campaignMap.get(cid)?.name || campaignLabel(row) };
            prev.impressions += rowImpressions(row);
            prev.clicks += rowClicks(row);
            prev.spend += spendToMajor(row);
            prev.purchases += rowPurchases(row);
            prev.adds += rowAddsToCart(row);
            prev.value += valueToMajor(row);
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
                purchases: v.purchases,
                adds_to_cart: v.adds,
                purchase_value: v.value,
                objective: campaignMap.get(id)?.objective || null,
                status: campaignMap.get(id)?.effective_status || null,
            };
        });
        top_campaigns.sort((a, b) => (b.ad_spend || 0) - (a.ad_spend || 0));
        top_campaigns = top_campaigns.slice(0, 50);
    } catch (e2) {
        if (String(e2?.message || "").includes("Reddit Ads API 401")) throw e2;
        dbgErr("top campaigns failed", e2?.message || e2);
        if (e2 && typeof e2 === "object" && e2.stack && redditDebugEnabled()) {
            dbgErr(e2.stack);
        }
    }
    }

    return finalizeRedditDashboardPayload({
        metrics_by_date,
        top_campaigns,
        campaigns_by_date: [],
        spend_by_iso2: spendByIso2,
    });
}

