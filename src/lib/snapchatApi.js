import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Snapchat Marketing API (https://adsapi.snapchat.com/v1).
 *
 * Per-customer OAuth / tokens live in `CustomerSettings.snapchat` (see `snapchatCustomerSettings.js`).
 * Optional server env fallbacks for local dev: SNAPCHAT_ACCESS_TOKEN or client/refresh env pair.
 *
 * OAuth (Marketing API): https://developers.snap.com/api/marketing-api/Ads-API/authentication
 */

const SNAPCHAT_ADS_API = "https://adsapi.snapchat.com/v1";
const SNAPCHAT_TOKEN_URL = "https://accounts.snapchat.com/login/oauth2/access_token";
const ACCESS_TOKEN_CACHE_TTL_MS = 50 * 60 * 1000;

/** @type {Map<string, { token: string, expires: number }>} */
const accessTokenCache = new Map();
/** @type {Map<string, Promise<string>>} */
const refreshInFlight = new Map();

function snapTokenCacheKey({ clientId, refreshToken }) {
    return `${String(clientId || "").trim()}:${String(refreshToken || "").trim()}`;
}

function readCachedSnapchatAccessToken(cacheKey) {
    if (!cacheKey) return null;
    const entry = accessTokenCache.get(cacheKey);
    if (!entry || entry.expires <= Date.now()) return null;
    return entry.token;
}

function writeCachedSnapchatAccessToken(cacheKey, token) {
    if (!cacheKey || !token) return;
    accessTokenCache.set(cacheKey, {
        token,
        expires: Date.now() + ACCESS_TOKEN_CACHE_TTL_MS,
    });
}

export function invalidateSnapchatAccessTokenCache(creds) {
    const key = snapTokenCacheKey(creds || {});
    if (key) accessTokenCache.delete(key);
}

async function refreshSnapchatAccessTokenCached(creds, { force = false } = {}) {
    const cacheKey = snapTokenCacheKey(creds);
    if (!cacheKey || cacheKey === ":") {
        return refreshSnapchatAccessToken(creds);
    }

    if (!force) {
        const cached = readCachedSnapchatAccessToken(cacheKey);
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

    const promise = refreshSnapchatAccessToken(creds)
        .then((token) => {
            writeCachedSnapchatAccessToken(cacheKey, token);
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

function snapDebugEnabled() {
    return process.env.DEBUG_SNAPCHAT === "1" || process.env.NODE_ENV === "development";
}

function dbg(...args) {
    if (snapDebugEnabled()) console.log("[Snapchat]", ...args);
}

/** dayjs timezone plugin has no `dayjs.tz.zone()` (that is moment-timezone). Use Intl for IANA validation. */
function isValidIanaTimeZone(tz) {
    if (!tz || typeof tz !== "string") return false;
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

/**
 * Snapchat returns spend in micro-currency (see Measurement API docs).
 * @returns {number} Spend in currency units (e.g. DKK major units).
 */
function spendMajor(spendMicro) {
    const m = num(spendMicro);
    return m > 0 ? m / 1_000_000 : 0;
}

export async function refreshSnapchatAccessToken({ clientId, clientSecret, refreshToken }) {
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
    });

    const res = await fetch(SNAPCHAT_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = data?.error_description || data?.error || res.statusText;
        throw new Error(`Snapchat token refresh failed: ${msg}`);
    }
    const access = typeof data.access_token === "string" ? data.access_token.trim() : "";
    if (!access) throw new Error("Snapchat token refresh returned no access_token");
    dbg("Resolved access token via refresh_token grant");
    return access;
}

/**
 * Resolve from server env only (dev / single-tenant fallback).
 */
export async function resolveSnapchatAccessTokenFromEnv() {
    const clientId = process.env.SNAPCHAT_CLIENT_ID?.trim();
    const clientSecret = process.env.SNAPCHAT_CLIENT_SECRET?.trim();
    const refreshToken = process.env.SNAPCHAT_REFRESH_TOKEN?.trim();
    if (clientId && clientSecret && refreshToken) {
        return refreshSnapchatAccessTokenCached({ clientId, clientSecret, refreshToken });
    }

    const direct = process.env.SNAPCHAT_ACCESS_TOKEN?.trim();
    if (direct) return direct;

    return null;
}

/**
 * Bearer for Marketing API. Refreshes via OAuth when needed, with in-memory cache and
 * single-flight deduplication so parallel dashboard fetches do not hit rate limits.
 * Falls back to stored access token when refresh is rate-limited or unavailable.
 * @param {Record<string, string | undefined>} snapNormalized — output of `normalizeSnapchatSettings()`
 * @param {{ preferStoredAccessToken?: boolean, forceRefresh?: boolean }} [opts]
 */
export async function resolveSnapchatAccessTokenForCustomer(snapNormalized, opts = {}) {
    const snap = snapNormalized || {};
    const clientId = typeof snap.clientId === "string" ? snap.clientId.trim() : "";
    const clientSecret = typeof snap.clientSecret === "string" ? snap.clientSecret.trim() : "";
    const refreshToken = typeof snap.refreshToken === "string" ? snap.refreshToken.trim() : "";
    const direct = typeof snap.accessToken === "string" ? snap.accessToken.trim() : "";
    const creds = { clientId, clientSecret, refreshToken };
    const cacheKey = snapTokenCacheKey(creds);

    if (!opts.forceRefresh && cacheKey && cacheKey !== ":") {
        const cached = readCachedSnapchatAccessToken(cacheKey);
        if (cached) {
            dbg("Bearer source: in-memory cache (per-customer)");
            return cached;
        }
    }

    if (direct && opts.preferStoredAccessToken !== false && !opts.forceRefresh) {
        if (snapDebugEnabled()) {
            dbg("Bearer source: CustomerSettings.snapchat.accessToken", { tokenLengthChars: direct.length });
        }
        return direct;
    }

    if (clientId && clientSecret && refreshToken) {
        try {
            if (snapDebugEnabled()) dbg("Bearer source: refresh_token grant (cached / deduped)");
            return await refreshSnapchatAccessTokenCached(creds, { force: opts.forceRefresh === true });
        } catch (err) {
            const msg = String(err?.message || err);
            if (direct && /too many requests/i.test(msg)) {
                dbg("Refresh rate-limited; falling back to stored accessToken");
                return direct;
            }
            throw err;
        }
    }

    if (direct) return direct;

    const envFallback = await resolveSnapchatAccessTokenFromEnv();
    if (envFallback && snapDebugEnabled()) dbg("Bearer source: server env SNAPCHAT_* fallback");
    return envFallback;
}

/**
 * @deprecated use resolveSnapchatAccessTokenFromEnv
 */
export async function resolveSnapchatAccessToken() {
    return resolveSnapchatAccessTokenFromEnv();
}

/**
 * Snapchat DAY stats require `start_time` / `end_time` on calendar-day boundaries in the **ad account timezone**
 * (see Measurement API). We send ISO timestamps in UTC that correspond to those local midnights.
 * @returns {{ start_time: string, end_time: string }} `end_time` exclusive (start of day after last date in account TZ).
 */
function statsWindowUtcIso(startDateYmd, endDateYmd, accountIanaTz) {
    let tz = typeof accountIanaTz === "string" && accountIanaTz.trim() ? accountIanaTz.trim() : "UTC";
    if (!isValidIanaTimeZone(tz)) {
        dbg("Unknown ad account timezone, using UTC:", tz);
        tz = "UTC";
    }

    const s = `${String(startDateYmd).trim()}T00:00:00`;
    const startLocal = dayjs.tz(s, tz).startOf("day");
    const endExclusiveLocal = dayjs.tz(`${String(endDateYmd).trim()}T00:00:00`, tz).startOf("day").add(1, "day");

    return {
        start_time: startLocal.toDate().toISOString(),
        end_time: endExclusiveLocal.toDate().toISOString(),
    };
}

async function snapFetchJson(path, accessToken, searchParams) {
    const u = new URL(`${SNAPCHAT_ADS_API}${path}`);
    if (searchParams && typeof searchParams === "object") {
        Object.entries(searchParams).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, String(v));
        });
    }
    dbg("GET", u.toString());
    const res = await fetch(u.toString(), {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
    });
    const text = await res.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { _nonJsonBody: text?.slice?.(0, 500) || "" };
    }
    if (!res.ok) {
        if (snapDebugEnabled()) {
            dbg(`HTTP ${res.status} body`, typeof data === "object" ? data : text?.slice?.(0, 300));
        }
        const msg =
            data?.debug_message ||
            data?.display_message ||
            data?.message ||
            data?.error_description ||
            data?.error ||
            data?.request_status_reason ||
            (typeof data?._nonJsonBody === "string" && data._nonJsonBody
                ? data._nonJsonBody.slice(0, 200)
                : "") ||
            res.statusText;
        throw new Error(`Snapchat API ${res.status}: ${msg || "Unauthorized"}`);
    }
    const status = String(data?.request_status || "").toLowerCase();
    if (status && status !== "success") {
        dbg("Non-success request_status", data?.request_status, data);
    }
    return data;
}

/**
 * IANA timezone from GET /v1/adaccounts/{id} (e.g. America/Los_Angeles), required for DAY stats windows.
 */
async function fetchAdAccountTimezone(accessToken, adAccountId) {
    const trimmed = String(adAccountId || "").trim();
    if (!trimmed) return "UTC";
    const data = await snapFetchJson(`/adaccounts/${encodeURIComponent(trimmed)}`, accessToken, {});
    const list = data?.adaccounts;
    const first = Array.isArray(list) && list[0] ? list[0] : null;
    const acc = first?.adaccount ?? first?.ad_account;
    const tz = acc?.timezone;
    if (typeof tz === "string" && tz.trim()) return tz.trim();
    return "UTC";
}

/**
 * All DAY (or HOUR) stat points. When `breakdown=campaign` (or adsquad on campaign entity), points live under
 * `timeseries_stat.breakdown_stats.campaign[].timeseries`, not on `timeseries_stat.timeseries` alone.
 */
function extractAllTimeseriesPoints(statsJson) {
    const chunks = statsJson?.timeseries_stats;
    if (!Array.isArray(chunks)) return [];
    const out = [];

    function pushSeries(series) {
        if (!Array.isArray(series)) return;
        for (const pt of series) out.push(pt);
    }

    for (const item of chunks) {
        const root = item?.timeseries_stat || item?.timeseriesStat;
        if (!root) continue;
        pushSeries(root.timeseries);

        const breakdown = root.breakdown_stats || root.breakdownStats;
        if (breakdown && typeof breakdown === "object") {
            for (const key of Object.keys(breakdown)) {
                const entities = breakdown[key];
                if (!Array.isArray(entities)) continue;
                for (const ent of entities) {
                    pushSeries(ent.timeseries);
                }
            }
        }
    }
    return out;
}

function dateKeyInAccountTz(isoTime, accountIanaTz) {
    if (!isoTime || typeof isoTime !== "string") return "";
    let tz = typeof accountIanaTz === "string" && accountIanaTz.trim() ? accountIanaTz.trim() : "UTC";
    if (!isValidIanaTimeZone(tz)) tz = "UTC";
    return dayjs(isoTime).tz(tz).format("YYYY-MM-DD");
}

function aggregateEngagementAndConversionsByDate(statsJson, accountIanaTz) {
    const points = extractAllTimeseriesPoints(statsJson);
    const map = {};
    for (const pt of points) {
        const iso = pt.start_time || pt.startTime;
        const d = dateKeyInAccountTz(iso, accountIanaTz);
        if (!d) continue;
        const st = pt.stats || {};
        if (!map[d]) {
            map[d] = {
                impressions: 0,
                swipes: 0,
                spend_micro: 0,
                conversion_purchases: 0,
                conversion_purchases_value_micro: 0,
                conversion_add_cart: 0,
            };
        }
        map[d].impressions += num(st.impressions);
        map[d].swipes += num(st.swipes);
        map[d].spend_micro += num(st.spend);
        map[d].conversion_purchases += num(st.conversion_purchases);
        map[d].conversion_purchases_value_micro += num(st.conversion_purchases_value);
        map[d].conversion_add_cart += num(st.conversion_add_cart);
    }
    return map;
}

/** Map YYYY-MM-DD → spend microcurrency from Ad Account DAY stats (`fields` must be `spend` only). */
function spendMicroByDateFromAccountDayStats(statsJson, accountIanaTz) {
    const points = extractAllTimeseriesPoints(statsJson);
    const map = {};
    for (const pt of points) {
        const iso = pt.start_time || pt.startTime;
        const d = dateKeyInAccountTz(iso, accountIanaTz);
        if (!d) continue;
        const m = num(pt.stats?.spend);
        map[d] = (map[d] || 0) + m;
    }
    return map;
}

function iso2AllowSet(countryIsoCodes) {
    return new Set(
        (countryIsoCodes || [])
            .map((c) => String(c).trim().toLowerCase())
            .filter((c) => c.length === 2)
    );
}

/**
 * DAY stats with `report_dimension=country` expose `dimension_stats[].country` (lowercase ISO-2) + spend micros.
 * @param {unknown} statsJson
 * @param {string} accountIanaTz
 * @param {string[]} countryIsoCodes — ISO 3166-1 alpha-2 (same allowlist as Meta country filter)
 * @returns {Record<string, number>} YYYY-MM-DD → spend microcurrency
 */
function spendMicroByDateFromCountryDimensionStats(statsJson, accountIanaTz, countryIsoCodes) {
    const allow = iso2AllowSet(countryIsoCodes);
    if (allow.size === 0) return {};

    const byDate = {};

    function addSpend(startTimeIso, countryCode, spendMicro) {
        const cc = String(countryCode || "").trim().toLowerCase();
        if (!cc || !allow.has(cc)) return;
        const d = dateKeyInAccountTz(startTimeIso, accountIanaTz);
        if (!d) return;
        byDate[d] = (byDate[d] || 0) + num(spendMicro);
    }

    function ingestDimensionStats(list, startTimeIso) {
        if (!Array.isArray(list)) return;
        for (const ds of list) {
            if (!ds || typeof ds !== "object") continue;
            addSpend(startTimeIso, ds.country ?? ds.Country, ds.spend);
        }
    }

    function walk(obj, depth, parentStartTime) {
        if (!obj || typeof obj !== "object" || depth > 14) return;
        const startIso =
            obj.start_time ||
            obj.startTime ||
            parentStartTime ||
            "";

        ingestDimensionStats(obj.dimension_stats, startIso);
        ingestDimensionStats(obj.dimensionStats, startIso);

        if (Array.isArray(obj.timeseries)) {
            for (const pt of obj.timeseries) {
                if (!pt || typeof pt !== "object") continue;
                const ptStart = pt.start_time || pt.startTime || startIso;
                ingestDimensionStats(pt.dimension_stats, ptStart);
                ingestDimensionStats(pt.dimensionStats, ptStart);
                const st = pt.stats;
                if (st && typeof st === "object") {
                    ingestDimensionStats(st.dimension_stats, ptStart);
                    ingestDimensionStats(st.dimensionStats, ptStart);
                    if (st.country != null) addSpend(ptStart, st.country, st.spend);
                }
            }
        }

        if (Array.isArray(obj)) {
            for (const x of obj) walk(x, depth + 1, parentStartTime);
            return;
        }

        for (const k of Object.keys(obj)) {
            if (k === "dimension_stats" || k === "dimensionStats" || k === "timeseries") continue;
            walk(obj[k], depth + 1, startIso || parentStartTime);
        }
    }

    walk(statsJson, 0, "");
    return byDate;
}

/**
 * Sum spend (major currency) by ISO-2 from DAY stats with `report_dimension=country` (all countries).
 * @returns {Map<string, number>}
 */
function spendMajorTotalsByIso2FromCountryDimensionStats(statsJson, accountIanaTz) {
    /** @type {Map<string, number>} */
    const byIso = new Map();

    function addSpend(startTimeIso, countryCode, spendMicro) {
        const cc = String(countryCode || "").trim().toUpperCase();
        if (cc.length !== 2) return;
        const major = spendMajor(num(spendMicro));
        byIso.set(cc, (byIso.get(cc) || 0) + major);
    }

    function ingestDimensionStats(list, startTimeIso) {
        if (!Array.isArray(list)) return;
        for (const ds of list) {
            if (!ds || typeof ds !== "object") continue;
            addSpend(startTimeIso, ds.country ?? ds.Country, ds.spend);
        }
    }

    function walk(obj, depth, parentStartTime) {
        if (!obj || typeof obj !== "object" || depth > 14) return;
        const startIso =
            obj.start_time || obj.startTime || parentStartTime || "";
        ingestDimensionStats(obj.dimension_stats, startIso);
        ingestDimensionStats(obj.dimensionStats, startIso);
        if (Array.isArray(obj.timeseries)) {
            for (const pt of obj.timeseries) {
                if (!pt || typeof pt !== "object") continue;
                const ptStart = pt.start_time || pt.startTime || startIso;
                ingestDimensionStats(pt.dimension_stats, ptStart);
                ingestDimensionStats(pt.dimensionStats, ptStart);
            }
        }
        if (Array.isArray(obj)) {
            for (const x of obj) walk(x, depth + 1, parentStartTime);
            return;
        }
        for (const k of Object.keys(obj)) {
            if (k === "dimension_stats" || k === "dimensionStats" || k === "timeseries") continue;
            walk(obj[k], depth + 1, startIso || parentStartTime);
        }
    }

    walk(statsJson, 0, "");
    return byIso;
}

/**
 * One country-dimension stats fetch; totals spend by ISO-2 (markets overview).
 */
export async function fetchSnapchatSpendByIso2Map({
    accessToken,
    adAccountId,
    startDate,
    endDate,
    snapCredentials,
}) {
    const dash = await fetchSnapchatDashboardMetrics({
        accessToken,
        adAccountId,
        startDate,
        endDate,
        snapCredentials,
        spendByCountryOnly: true,
    });
    return dash.spend_by_iso2 instanceof Map ? dash.spend_by_iso2 : new Map();
}

/**
 * @param {string} accessToken
 * @param {string} adAccountId
 * @param {string} start_time
 * @param {string} end_time
 * @param {object} dayStatsBase
 * @param {string} accountTz
 * @param {string[]} countryIsoCodes
 */
async function fetchSnapchatCountryFilteredSpendByDate(
    accessToken,
    adAccountId,
    start_time,
    end_time,
    dayStatsBase,
    accountTz,
    countryIsoCodes
) {
    const trimmed = String(adAccountId || "").trim();
    const base = {
        ...dayStatsBase,
        report_dimension: "country",
        fields: "spend",
    };

    try {
        const json = await snapFetchJson(`/adaccounts/${encodeURIComponent(trimmed)}/stats`, accessToken, {
            ...base,
            breakdown: "campaign",
        });
        const map = spendMicroByDateFromCountryDimensionStats(json, accountTz, countryIsoCodes);
        if (Object.keys(map).length > 0) return map;
    } catch (e1) {
        dbg("Country DAY stats (breakdown=campaign) failed", e1?.message || e1);
    }

    try {
        const json2 = await snapFetchJson(`/adaccounts/${encodeURIComponent(trimmed)}/stats`, accessToken, base);
        return spendMicroByDateFromCountryDimensionStats(json2, accountTz, countryIsoCodes);
    } catch (e2) {
        dbg("Country DAY stats failed", e2?.message || e2);
        return {};
    }
}

/**
 * Normalize one daily row to Pinterest-shaped keys for dashboard UI reuse.
 */
function normalizeDayRow(startTimeIso, stats) {
    const st = stats && typeof stats === "object" ? stats : {};
    const impressions = num(st.impressions);
    const swipes = num(st.swipes);
    const spendMicroRaw = num(st.spend);
    const ad_spend = Math.round(spendMajor(spendMicroRaw) * 100) / 100;
    const clicks = swipes;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpc = clicks > 0 ? ad_spend / clicks : 0;
    const cpm = impressions > 0 ? (ad_spend / impressions) * 1000 : 0;
    const purchases = num(st.conversion_purchases);
    const purchase_value_major = spendMajor(num(st.conversion_purchases_value));
    const purchase_value = Math.round(purchase_value_major * 100) / 100;
    const adds_to_cart = num(st.conversion_add_cart);
    const roas = ad_spend > 0 ? purchase_value_major / ad_spend : 0;
    const dateStr =
        typeof startTimeIso === "string" && startTimeIso.length >= 10 ? startTimeIso.slice(0, 10) : "";

    return {
        date: dateStr,
        ad_spend,
        impressions,
        clicks,
        saves: swipes,
        /** @deprecated use `purchases` — kept for older UI / exports */
        conversions: purchases,
        purchases,
        purchase_value,
        conversion_value: purchase_value,
        adds_to_cart,
        ctr,
        cpc,
        cpm,
        roas,
        purchase_roas: roas,
        aov: purchases > 0 ? purchase_value / purchases : 0,
    };
}

/** Campaign rows from TOTAL stats (`breakdown_stats.campaign[]` when requesting ad account + breakdown=campaign). */
function extractCampaignTotals(statsJson) {
    const totals = statsJson?.total_stats;
    if (!Array.isArray(totals)) return [];
    const rows = [];

    function pushFromEntity(ts) {
        if (!ts || typeof ts !== "object") return;
        const id = ts.id || ts.entity_id;
        const name =
            ts.name ||
            ts.campaign_name ||
            ts.campaign?.name ||
            (id ? String(id).slice(0, 8) + "…" : "Campaign");
        const st = ts.stats;
        if (!st || typeof st !== "object") return;
        const impressions = num(st.impressions);
        const swipes = num(st.swipes);
        const ad_spend = spendMajor(st.spend);
        const purchases = num(st.conversion_purchases);
        const adds_to_cart = num(st.conversion_add_cart);
        const purchase_value = spendMajor(st.conversion_purchases_value);
        const ctr = impressions > 0 ? swipes / impressions : 0;
        rows.push({
            campaign_id: id,
            campaign_name: name || (id ? `Campaign ${id}` : "Campaign"),
            clicks: swipes,
            impressions,
            saves: swipes,
            ctr,
            ad_spend,
            purchases,
            adds_to_cart,
            purchase_value,
        });
    }

    for (const item of totals) {
        const aggregate = item?.total_stat;
        if (!aggregate) continue;
        const campaigns = aggregate.breakdown_stats?.campaign || aggregate.breakdownStats?.campaign;
        if (Array.isArray(campaigns) && campaigns.length > 0) {
            for (const c of campaigns) pushFromEntity(c);
            continue;
        }
        pushFromEntity(aggregate);
    }
    rows.sort((a, b) => (b.ad_spend || 0) - (a.ad_spend || 0));
    return rows.slice(0, 20);
}

/**
 * @param {{
 *   accessToken: string,
 *   adAccountId: string,
 *   startDate: string,
 *   endDate: string,
 *   snapCredentials?: ReturnType<import("./snapchatCustomerSettings").normalizeSnapchatSettings>,
 *   countryIsoCodes?: string[] — when set, daily spend is limited to these ISO-2 countries (Shopify Markets ad spend filter)
 *   spendByCountryOnly?: boolean — when true, return `spend_by_iso2` only (single country-dimension fetch)
 *   spendByDateOnly?: boolean — when true, skip campaign TOTAL breakdown (merged-sources spend rollup)
 * }} args — when snapCredentials is set, 401 responses retry once via refresh_token
 */
async function fetchSnapchatDashboardMetricsWindow({
    accessToken,
    adAccountId,
    startDate,
    endDate,
    snapCredentials,
    countryIsoCodes,
    spendByCountryOnly = false,
    spendByDateOnly = false,
}) {
    const trimmed = String(adAccountId || "").trim();
    if (!trimmed) throw new Error("Missing adAccountId");

    try {
        return await fetchSnapchatDashboardMetricsInner({
            accessToken,
            adAccountId: trimmed,
            startDate,
            endDate,
            countryIsoCodes,
            spendByCountryOnly,
            spendByDateOnly,
        });
    } catch (e) {
        const msg = String(e?.message || "");
        const creds = snapCredentials || {};
        const canRefresh =
            msg.includes("Snapchat API 401") &&
            creds.clientId &&
            creds.clientSecret &&
            creds.refreshToken;
        if (!canRefresh) throw e;
        dbg("401 — retrying after refresh_token");
        invalidateSnapchatAccessTokenCache(creds);
        const fresh = await refreshSnapchatAccessTokenCached(
            {
                clientId: creds.clientId,
                clientSecret: creds.clientSecret,
                refreshToken: creds.refreshToken,
            },
            { force: true }
        );
        return fetchSnapchatDashboardMetricsInner({
            accessToken: fresh,
            adAccountId: trimmed,
            startDate,
            endDate,
            countryIsoCodes,
            spendByCountryOnly,
            spendByDateOnly,
        });
    }
}

/** Snapchat rejects DAY-granularity stats over more than 32 days, so longer ranges run in 31-day windows. */
const SNAP_MAX_WINDOW_DAYS = 31;

function snapWindows(startDate, endDate, maxDays = SNAP_MAX_WINDOW_DAYS) {
    const out = [];
    let cur = dayjs(startDate);
    const end = dayjs(endDate);
    if (cur.isAfter(end)) return [{ startDate, endDate }];
    while (!cur.isAfter(end)) {
        const winEnd = cur.add(maxDays - 1, "day");
        const stop = winEnd.isAfter(end) ? end : winEnd;
        out.push({ startDate: cur.format("YYYY-MM-DD"), endDate: stop.format("YYYY-MM-DD") });
        cur = stop.add(1, "day");
    }
    return out;
}

function mergeCampaignTotals(lists) {
    const map = new Map();
    for (const list of lists) {
        for (const c of list || []) {
            const key = c.campaign_id || c.campaign_name;
            const cur = map.get(key) || { ...c, clicks: 0, impressions: 0, saves: 0, ad_spend: 0, purchases: 0, adds_to_cart: 0, purchase_value: 0 };
            cur.clicks += num(c.clicks);
            cur.impressions += num(c.impressions);
            cur.saves += num(c.saves);
            cur.ad_spend += num(c.ad_spend);
            cur.purchases += num(c.purchases);
            cur.adds_to_cart += num(c.adds_to_cart);
            cur.purchase_value += num(c.purchase_value);
            map.set(key, cur);
        }
    }
    return [...map.values()]
        .map((c) => ({ ...c, ctr: c.impressions > 0 ? c.clicks / c.impressions : 0 }))
        .sort((a, b) => (b.ad_spend || 0) - (a.ad_spend || 0))
        .slice(0, 20);
}

/**
 * Public entry. One window when the range fits, otherwise 31-day windows that are fetched in order
 * and merged (daily rows are concatenated, campaign totals and country spend are summed).
 */
export async function fetchSnapchatDashboardMetrics(args) {
    const windows = snapWindows(args.startDate, args.endDate);
    if (windows.length === 1) return fetchSnapchatDashboardMetricsWindow(args);

    const parts = [];
    for (const w of windows) {
        parts.push(await fetchSnapchatDashboardMetricsWindow({ ...args, startDate: w.startDate, endDate: w.endDate }));
    }
    const merged = {
        metrics_by_date: parts.flatMap((x) => x.metrics_by_date || []),
        top_campaigns: mergeCampaignTotals(parts.map((x) => x.top_campaigns)),
        campaigns_by_date: [],
    };
    if (parts.some((x) => x.spend_by_iso2 instanceof Map)) {
        const iso = new Map();
        for (const x of parts) {
            if (!(x.spend_by_iso2 instanceof Map)) continue;
            for (const [k, v] of x.spend_by_iso2) iso.set(k, (iso.get(k) || 0) + v);
        }
        merged.spend_by_iso2 = iso;
    }
    return merged;
}

/**
 * Extras for the dashboard (best-effort, each part may fail on its own and returns a warning):
 *  - campaign detail: reach and frequency, video views and completion, shares, saves, story opens
 *  - audience breakdowns through `report_dimension` (gender, age, country, region, OS, device make). At ad
 *    account level these only allow `fields=spend`, so they are requested with `breakdown=campaign` and summed
 * Windows are 31 days like the main fetch. Reach and frequency are not additive, so they are only
 * returned when the whole range fits in one window.
 */
const DETAIL_FIELDS_FULL =
    "impressions,swipes,spend,uniques,frequency,video_views,view_completion,quartile_1,quartile_2,quartile_3,shares,saves,story_opens,conversion_purchases,conversion_purchases_value";
const DETAIL_FIELDS_SAFE = "impressions,swipes,spend,video_views,view_completion,shares,saves,story_opens";

const SNAP_DIMENSIONS = [
    { key: "gender", dim: "gender" },
    { key: "age", dim: "age", rowKey: "age_bucket" },
    { key: "country", dim: "country" },
    { key: "region", dim: "region" },
    { key: "os", dim: "os", rowKey: "operating_system" },
    { key: "device_make", dim: "make", rowKey: "make" },
];

const DIMENSION_FIELDS = "impressions,swipes,spend,conversion_purchases,conversion_purchases_value";

function dimensionLabel(key, raw) {
    const v = String(raw ?? "").trim();
    if (!v) return "Unknown";
    if (key === "country" && v.length === 2) {
        try {
            return new Intl.DisplayNames(["en"], { type: "region" }).of(v.toUpperCase()) || v.toUpperCase();
        } catch {
            return v.toUpperCase();
        }
    }
    if (key === "region") {
        const [cc, ...rest] = v.split("/");
        const place = rest.join("/").replace(/\s+-\s+/g, "-");
        let country = cc.toUpperCase();
        try {
            country = new Intl.DisplayNames(["en"], { type: "region" }).of(cc.toUpperCase()) || country;
        } catch {
            /* keep the code */
        }
        return place ? `${place}, ${country}` : country;
    }
    if (key === "device_make") return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
    if (key === "gender") return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
    if (key === "os") return v.toUpperCase() === "IOS" ? "iOS" : v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
    return v.replace(/_/g, " ");
}

/** Walk the response and collect flat dimension rows: objects that carry the dimension key plus metrics. */
function collectDimensionRows(statsJson, rowKey) {
    const rows = [];
    function walk(obj, depth) {
        if (!obj || typeof obj !== "object" || depth > 14) return;
        if (Array.isArray(obj)) {
            for (const x of obj) walk(x, depth + 1);
            return;
        }
        if (obj[rowKey] !== undefined && (obj.impressions !== undefined || obj.spend !== undefined || obj.swipes !== undefined)) rows.push(obj);
        for (const k of Object.keys(obj)) walk(obj[k], depth + 1);
    }
    walk(statsJson, 0);
    return rows;
}

async function fetchSnapchatDimension({ accessToken, adAccountId, windows, accountTz, def }) {
    const map = new Map();
    for (const w of windows) {
        const { start_time, end_time } = statsWindowUtcIso(w.startDate, w.endDate, accountTz);
        const json = await snapFetchJson(`/adaccounts/${encodeURIComponent(adAccountId)}/stats`, accessToken, {
            granularity: "TOTAL",
            start_time,
            end_time,
            report_dimension: def.dim,
            breakdown: "campaign",
            limit: 50,
            fields: DIMENSION_FIELDS,
            swipe_up_attribution_window: "28_DAY",
            view_attribution_window: "1_DAY",
        });
        const rowKey = def.rowKey || def.dim;
        for (const r of collectDimensionRows(json, rowKey)) {
            const raw = String(r[rowKey]);
            const cur = map.get(raw) || { id: raw, name: dimensionLabel(def.key, raw), impressions: 0, clicks: 0, ad_spend: 0, purchases: 0, purchase_value: 0 };
            cur.impressions += num(r.impressions);
            cur.clicks += num(r.swipes);
            cur.ad_spend += spendMajor(r.spend);
            cur.purchases += num(r.conversion_purchases);
            cur.purchase_value += spendMajor(r.conversion_purchases_value);
            map.set(raw, cur);
        }
    }
    return [...map.values()]
        .map((r) => ({ ...r, ctr: r.impressions > 0 ? r.clicks / r.impressions : 0, roas: r.ad_spend > 0 ? r.purchase_value / r.ad_spend : 0 }))
        .sort((a, b) => b.ad_spend - a.ad_spend)
        .slice(0, 30);
}

async function fetchSnapchatCampaignDetail({ accessToken, adAccountId, windows, accountTz }) {
    const single = windows.length === 1;
    const map = new Map();
    for (const w of windows) {
        const { start_time, end_time } = statsWindowUtcIso(w.startDate, w.endDate, accountTz);
        const base = {
            granularity: "TOTAL",
            start_time,
            end_time,
            breakdown: "campaign",
            limit: 50,
            swipe_up_attribution_window: "28_DAY",
            view_attribution_window: "1_DAY",
        };
        let json;
        try {
            json = await snapFetchJson(`/adaccounts/${encodeURIComponent(adAccountId)}/stats`, accessToken, { ...base, fields: DETAIL_FIELDS_FULL });
        } catch (e1) {
            dbg("Campaign detail full fields failed, retrying safe fields", e1?.message || e1);
            json = await snapFetchJson(`/adaccounts/${encodeURIComponent(adAccountId)}/stats`, accessToken, { ...base, fields: DETAIL_FIELDS_SAFE });
        }
        for (const item of json?.total_stats || []) {
            const campaigns = item?.total_stat?.breakdown_stats?.campaign || [];
            for (const c of campaigns) {
                const st = c?.stats || {};
                const id = c.id || c.entity_id;
                if (!id) continue;
                const cur = map.get(id) || { campaign_id: id, video_views: 0, video_completes: 0, quartile_1: 0, quartile_2: 0, quartile_3: 0, shares: 0, saves_total: 0, story_opens: 0, uniques: null, frequency: null };
                cur.video_views += num(st.video_views);
                cur.video_completes += num(st.view_completion);
                cur.quartile_1 += num(st.quartile_1);
                cur.quartile_2 += num(st.quartile_2);
                cur.quartile_3 += num(st.quartile_3);
                cur.shares += num(st.shares);
                cur.saves_total += num(st.saves);
                cur.story_opens += num(st.story_opens);
                if (single) {
                    cur.uniques = st.uniques != null ? num(st.uniques) : null;
                    cur.frequency = st.frequency != null ? num(st.frequency) : null;
                }
                map.set(id, cur);
            }
        }
    }
    return [...map.values()];
}

export async function fetchSnapchatDashboardExtras({ accessToken, adAccountId, startDate, endDate }) {
    const trimmed = String(adAccountId || "").trim();
    const accountTz = await fetchAdAccountTimezone(accessToken, trimmed);
    const windows = snapWindows(startDate, endDate);
    const warnings = [];

    const [detail, ...dims] = await Promise.allSettled([
        fetchSnapchatCampaignDetail({ accessToken, adAccountId: trimmed, windows, accountTz }),
        ...SNAP_DIMENSIONS.map((def) => fetchSnapchatDimension({ accessToken, adAccountId: trimmed, windows, accountTz, def })),
    ]);

    const result = { campaign_detail: [], audience: {}, warnings };
    if (detail.status === "fulfilled") result.campaign_detail = detail.value;
    else warnings.push({ part: "campaign_detail", message: detail.reason?.message || "Campaign detail failed" });
    SNAP_DIMENSIONS.forEach((def, i) => {
        const r = dims[i];
        if (r.status === "fulfilled") result.audience[def.key] = r.value;
        else {
            result.audience[def.key] = [];
            warnings.push({ part: def.key, message: r.reason?.message || `${def.dim} breakdown failed` });
        }
    });
    return result;
}

async function fetchSnapchatDashboardMetricsInner({
    accessToken,
    adAccountId,
    startDate,
    endDate,
    countryIsoCodes,
    spendByCountryOnly = false,
    spendByDateOnly = false,
}) {
    const trimmed = String(adAccountId || "").trim();

    const accountTz = await fetchAdAccountTimezone(accessToken, trimmed);
    const { start_time, end_time } = statsWindowUtcIso(startDate, endDate, accountTz);
    if (snapDebugEnabled()) dbg("DAY stats window (account TZ)", { accountTz, start_time, end_time });

    /**
     * Ad Account stats **without** breakdown only allow fields=spend. With breakdown=campaign, DAY rows live under
     * `breakdown_stats.campaign[].timeseries` — we aggregate by account-local calendar date.
     * Prefer one request including spend + engagement + Pixel-style conversions when the API accepts it.
     */
    const dayStatsBase = {
        granularity: "DAY",
        start_time,
        end_time,
        swipe_up_attribution_window: "28_DAY",
        view_attribution_window: "1_DAY",
    };

    const fieldsDayFull =
        "spend,impressions,swipes,conversion_purchases,conversion_purchases_value,conversion_add_cart";

    let rollupByDate = {};

    if (spendByCountryOnly) {
        const base = {
            ...dayStatsBase,
            report_dimension: "country",
            fields: "spend",
        };
        let spendByIso2 = new Map();
        try {
            const json = await snapFetchJson(
                `/adaccounts/${encodeURIComponent(trimmed)}/stats`,
                accessToken,
                base
            );
            spendByIso2 = spendMajorTotalsByIso2FromCountryDimensionStats(json, accountTz);
        } catch (e1) {
            dbg("spendByCountryOnly failed", e1?.message || e1);
        }
        return {
            metrics_by_date: [],
            top_campaigns: [],
            campaigns_by_date: [],
            spend_by_iso2: spendByIso2,
        };
    }

    const marketCountryFilter =
        Array.isArray(countryIsoCodes) && countryIsoCodes.filter((c) => String(c).trim()).length > 0;

    if (marketCountryFilter) {
        const spendByDateMicro = await fetchSnapchatCountryFilteredSpendByDate(
            accessToken,
            trimmed,
            start_time,
            end_time,
            dayStatsBase,
            accountTz,
            countryIsoCodes
        );
        for (const d of Object.keys(spendByDateMicro)) {
            rollupByDate[d] = {
                impressions: 0,
                swipes: 0,
                spend_micro: spendByDateMicro[d],
                conversion_purchases: 0,
                conversion_purchases_value_micro: 0,
                conversion_add_cart: 0,
            };
        }
    } else if (spendByDateOnly) {
        try {
            const spendDayJson = await snapFetchJson(`/adaccounts/${encodeURIComponent(trimmed)}/stats`, accessToken, {
                ...dayStatsBase,
                fields: "spend",
            });
            const spendByDateMicro = spendMicroByDateFromAccountDayStats(spendDayJson, accountTz);
            for (const d of Object.keys(spendByDateMicro)) {
                rollupByDate[d] = {
                    impressions: 0,
                    swipes: 0,
                    spend_micro: spendByDateMicro[d],
                    conversion_purchases: 0,
                    conversion_purchases_value_micro: 0,
                    conversion_add_cart: 0,
                };
            }
        } catch (eSpendOnly) {
            dbg("spendByDateOnly DAY spend request failed", eSpendOnly?.message || eSpendOnly);
        }
    } else try {
        const combinedDay = await snapFetchJson(`/adaccounts/${encodeURIComponent(trimmed)}/stats`, accessToken, {
            ...dayStatsBase,
            breakdown: "campaign",
            fields: fieldsDayFull,
        });
        rollupByDate = aggregateEngagementAndConversionsByDate(combinedDay, accountTz);
    } catch (eCombo) {
        dbg("Combined DAY breakdown=campaign request failed — falling back split calls", eCombo?.message || eCombo);
        const spendDayJson = await snapFetchJson(`/adaccounts/${encodeURIComponent(trimmed)}/stats`, accessToken, {
            ...dayStatsBase,
            fields: "spend",
        });
        const spendByDateMicro = spendMicroByDateFromAccountDayStats(spendDayJson, accountTz);

        try {
            const convDayJson = await snapFetchJson(`/adaccounts/${encodeURIComponent(trimmed)}/stats`, accessToken, {
                ...dayStatsBase,
                breakdown: "campaign",
                fields:
                    "impressions,swipes,conversion_purchases,conversion_purchases_value,conversion_add_cart",
            });
            rollupByDate = aggregateEngagementAndConversionsByDate(convDayJson, accountTz);
        } catch (eConv) {
            dbg("Campaign DAY impressions + conversions aggregation skipped", eConv?.message || eConv);
            try {
                const engDayJson = await snapFetchJson(`/adaccounts/${encodeURIComponent(trimmed)}/stats`, accessToken, {
                    ...dayStatsBase,
                    breakdown: "campaign",
                    fields: "impressions,swipes",
                });
                rollupByDate = aggregateEngagementAndConversionsByDate(engDayJson, accountTz);
            } catch (eEng) {
                dbg("Campaign DAY impressions/swipes aggregation skipped", eEng?.message || eEng);
            }
        }

        for (const d of Object.keys(spendByDateMicro)) {
            if (!rollupByDate[d])
                rollupByDate[d] = {
                    impressions: 0,
                    swipes: 0,
                    spend_micro: 0,
                    conversion_purchases: 0,
                    conversion_purchases_value_micro: 0,
                    conversion_add_cart: 0,
                };
            rollupByDate[d].spend_micro = spendByDateMicro[d];
        }
    }

    /** Fill gaps so charts align with calendar range (snap may omit zero days when omit_empty). */
    function eachDayInclusive(s, e) {
        const out = [];
        const d = new Date(`${s}T12:00:00.000Z`);
        const end = new Date(`${e}T12:00:00.000Z`);
        while (d <= end) {
            out.push(d.toISOString().slice(0, 10));
            d.setUTCDate(d.getUTCDate() + 1);
        }
        return out;
    }

    const emptyAgg = () => ({
        impressions: 0,
        swipes: 0,
        spend_micro: 0,
        conversion_purchases: 0,
        conversion_purchases_value_micro: 0,
        conversion_add_cart: 0,
    });

    let metrics_by_date = eachDayInclusive(startDate, endDate).map((d) => {
        const agg = rollupByDate[d] || emptyAgg();
        return normalizeDayRow(`${d}T12:00:00.000Z`, {
            spend: agg.spend_micro,
            impressions: agg.impressions,
            swipes: agg.swipes,
            conversion_purchases: agg.conversion_purchases,
            conversion_purchases_value: agg.conversion_purchases_value_micro,
            conversion_add_cart: agg.conversion_add_cart,
        });
    });

    metrics_by_date = metrics_by_date.filter((r) => r.date);

    let top_campaigns = [];
    if (!spendByDateOnly) {
    const totalStatsBase = {
        granularity: "TOTAL",
        start_time,
        end_time,
        breakdown: "campaign",
        limit: 50,
        swipe_up_attribution_window: "28_DAY",
        view_attribution_window: "1_DAY",
    };
    try {
        const campJson = await snapFetchJson(`/adaccounts/${encodeURIComponent(trimmed)}/stats`, accessToken, {
            ...totalStatsBase,
            fields: "impressions,swipes,spend,conversion_purchases,conversion_purchases_value,conversion_add_cart",
        });
        top_campaigns = extractCampaignTotals(campJson);
    } catch (e) {
        dbg("Campaign TOTAL with conversions failed, trying impressions+swipes+spend", e?.message || e);
        try {
            const campJson2 = await snapFetchJson(`/adaccounts/${encodeURIComponent(trimmed)}/stats`, accessToken, {
                ...totalStatsBase,
                fields: "impressions,swipes,spend",
            });
            top_campaigns = extractCampaignTotals(campJson2);
        } catch (e2) {
            dbg("Campaign TOTAL stats failed, trying spend-only for top campaigns", e2?.message || e2);
            try {
                const campSpendJson = await snapFetchJson(`/adaccounts/${encodeURIComponent(trimmed)}/stats`, accessToken, {
                    ...totalStatsBase,
                    fields: "spend",
                });
                top_campaigns = extractCampaignTotals(campSpendJson);
            } catch (e3) {
                dbg("Campaign breakdown stats skipped", e3?.message || e3);
            }
        }
    }
    }

    return {
        metrics_by_date,
        top_campaigns,
        campaigns_by_date: [],
    };
}
