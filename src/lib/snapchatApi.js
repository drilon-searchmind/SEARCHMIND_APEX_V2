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
        return refreshSnapchatAccessToken({ clientId, clientSecret, refreshToken });
    }

    const direct = process.env.SNAPCHAT_ACCESS_TOKEN?.trim();
    if (direct) return direct;

    return null;
}

/**
 * Bearer for Marketing API. When client id + secret + refresh token exist, refresh on each resolve
 * (stored access tokens expire in ~1h). Falls back to stored access token, then env.
 * @param {Record<string, string | undefined>} snapNormalized — output of `normalizeSnapchatSettings()`
 * @param {{ preferStoredAccessToken?: boolean }} [opts]
 */
export async function resolveSnapchatAccessTokenForCustomer(snapNormalized, opts = {}) {
    const snap = snapNormalized || {};
    const clientId = typeof snap.clientId === "string" ? snap.clientId.trim() : "";
    const clientSecret = typeof snap.clientSecret === "string" ? snap.clientSecret.trim() : "";
    const refreshToken = typeof snap.refreshToken === "string" ? snap.refreshToken.trim() : "";
    const direct = typeof snap.accessToken === "string" ? snap.accessToken.trim() : "";

    if (clientId && clientSecret && refreshToken && !opts.preferStoredAccessToken) {
        if (snapDebugEnabled()) dbg("Bearer source: refresh_token grant (per-customer client id)");
        return refreshSnapchatAccessToken({ clientId, clientSecret, refreshToken });
    }

    if (direct) {
        if (snapDebugEnabled()) {
            dbg("Bearer source: CustomerSettings.snapchat.accessToken", { tokenLengthChars: direct.length });
        }
        return direct;
    }

    if (clientId && clientSecret && refreshToken) {
        return refreshSnapchatAccessToken({ clientId, clientSecret, refreshToken });
    }

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
 * }} args — when snapCredentials is set, 401 responses retry once via refresh_token
 */
export async function fetchSnapchatDashboardMetrics({
    accessToken,
    adAccountId,
    startDate,
    endDate,
    snapCredentials,
    countryIsoCodes,
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
        const fresh = await refreshSnapchatAccessToken({
            clientId: creds.clientId,
            clientSecret: creds.clientSecret,
            refreshToken: creds.refreshToken,
        });
        return fetchSnapchatDashboardMetricsInner({
            accessToken: fresh,
            adAccountId: trimmed,
            startDate,
            endDate,
            countryIsoCodes,
        });
    }
}

async function fetchSnapchatDashboardMetricsInner({
    accessToken,
    adAccountId,
    startDate,
    endDate,
    countryIsoCodes,
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

    return {
        metrics_by_date,
        top_campaigns,
        campaigns_by_date: [],
    };
}
