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
    const direct = process.env.SNAPCHAT_ACCESS_TOKEN?.trim();
    if (direct) return direct;

    const clientId = process.env.SNAPCHAT_CLIENT_ID?.trim();
    const clientSecret = process.env.SNAPCHAT_CLIENT_SECRET?.trim();
    const refreshToken = process.env.SNAPCHAT_REFRESH_TOKEN?.trim();
    if (!clientId || !clientSecret || !refreshToken) {
        return null;
    }
    return refreshSnapchatAccessToken({ clientId, clientSecret, refreshToken });
}

/**
 * Bearer for Marketing API: customer access token → customer refresh credentials → env fallbacks.
 * @param {Record<string, string | undefined>} snapNormalized — output of `normalizeSnapchatSettings()`
 */
export async function resolveSnapchatAccessTokenForCustomer(snapNormalized) {
    const snap = snapNormalized || {};
    const direct = typeof snap.accessToken === "string" ? snap.accessToken.trim() : "";
    if (direct) return direct;

    const clientId = typeof snap.clientId === "string" ? snap.clientId.trim() : "";
    const clientSecret = typeof snap.clientSecret === "string" ? snap.clientSecret.trim() : "";
    const refreshToken = typeof snap.refreshToken === "string" ? snap.refreshToken.trim() : "";
    if (clientId && clientSecret && refreshToken) {
        return refreshSnapchatAccessToken({ clientId, clientSecret, refreshToken });
    }

    return resolveSnapchatAccessTokenFromEnv();
}

/**
 * @deprecated use resolveSnapchatAccessTokenFromEnv
 */
export async function resolveSnapchatAccessToken() {
    return resolveSnapchatAccessTokenFromEnv();
}

function utcExclusiveEndDate(endDateYmd) {
    const [y, m, d] = endDateYmd.split("-").map((x) => parseInt(x, 10));
    if (!Number.isFinite(y)) return `${endDateYmd}T00:00:00.000Z`;
    const end = Date.UTC(y, (m || 1) - 1, d || 1, 0, 0, 0);
    const next = new Date(end + 86400000);
    return next.toISOString().replace(/\.\d{3}Z$/, ".000Z");
}

function utcStartDate(startDateYmd) {
    return `${startDateYmd.trim()}T00:00:00.000Z`;
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg =
            data?.debug_message ||
            data?.display_message ||
            data?.request_status_reason ||
            (typeof data === "string" ? data : "") ||
            res.statusText;
        throw new Error(`Snapchat API ${res.status}: ${msg}`);
    }
    const status = String(data?.request_status || "").toLowerCase();
    if (status && status !== "success") {
        dbg("Non-success request_status", data?.request_status, data);
    }
    return data;
}

function extractDayTimeseries(statsJson) {
    const chunks = statsJson?.timeseries_stats;
    if (!Array.isArray(chunks) || !chunks.length) return [];
    const first = chunks[0];
    const ts =
        first?.timeseries_stat?.timeseries ||
        first?.timeseriesStat?.timeseries ||
        [];
    return Array.isArray(ts) ? ts : [];
}

/**
 * Normalize one daily row to Pinterest-shaped keys for dashboard UI reuse.
 */
function normalizeDayRow(startTimeIso, stats) {
    const st = stats && typeof stats === "object" ? stats : {};
    const impressions = num(st.impressions);
    const swipes = num(st.swipes);
    const ad_spend = Math.round(spendMajor(st.spend) * 100) / 100;
    const clicks = swipes;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpc = clicks > 0 ? ad_spend / clicks : 0;
    const cpm = impressions > 0 ? (ad_spend / impressions) * 1000 : 0;
    const dateStr =
        typeof startTimeIso === "string" && startTimeIso.length >= 10 ? startTimeIso.slice(0, 10) : "";

    return {
        date: dateStr,
        ad_spend,
        impressions,
        clicks,
        saves: swipes,
        conversions: 0,
        conversion_value: 0,
        ctr,
        cpc,
        cpm,
        roas: 0,
        aov: 0,
    };
}

/** Best-effort: campaign-level TOTAL stats for range — response shape varies; may return []. */
function extractCampaignTotals(statsJson) {
    const totals = statsJson?.total_stats;
    if (!Array.isArray(totals)) return [];
    const rows = [];
    for (const item of totals) {
        const ts = item?.total_stat;
        if (!ts || typeof ts !== "object") continue;
        const id = ts.id || ts.entity_id;
        const name =
            ts.name ||
            ts.campaign_name ||
            ts.campaign?.name ||
            (id ? String(id).slice(0, 8) + "…" : "Campaign");
        const st = ts.stats;
        if (!st || typeof st !== "object") continue;
        const impressions = num(st.impressions);
        const swipes = num(st.swipes);
        const ad_spend = spendMajor(st.spend);
        const ctr = impressions > 0 ? swipes / impressions : 0;
        rows.push({
            campaign_id: id,
            campaign_name: name || (id ? `Campaign ${id}` : "Campaign"),
            clicks: swipes,
            impressions,
            saves: swipes,
            ctr,
            ad_spend,
        });
    }
    rows.sort((a, b) => (b.ad_spend || 0) - (a.ad_spend || 0));
    return rows.slice(0, 20);
}

export async function fetchSnapchatDashboardMetrics({
    accessToken,
    adAccountId,
    startDate,
    endDate,
}) {
    const trimmed = String(adAccountId || "").trim();
    if (!trimmed) throw new Error("Missing adAccountId");

    const start_time = utcStartDate(startDate);
    const end_time = utcExclusiveEndDate(endDate);
    const fields = "impressions,swipes,spend";

    const dayParams = {
        granularity: "DAY",
        start_time,
        end_time,
        fields,
    };

    const dayJson = await snapFetchJson(`/adaccounts/${encodeURIComponent(trimmed)}/stats`, accessToken, dayParams);

    const series = extractDayTimeseries(dayJson);
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
    const byDate = Object.fromEntries(
        series.map((pt) => {
            const iso = pt.start_time || pt.startTime;
            const row = normalizeDayRow(iso, pt.stats);
            return [row.date, row];
        })
    );

    let metrics_by_date = eachDayInclusive(startDate, endDate).map((d) =>
        byDate[d] ||
        normalizeDayRow(`${d}T00:00:00.000Z`, {
            impressions: 0,
            swipes: 0,
            spend: 0,
        })
    );

    metrics_by_date = metrics_by_date.filter((r) => r.date);

    let top_campaigns = [];
    try {
        const campJson = await snapFetchJson(`/adaccounts/${encodeURIComponent(trimmed)}/stats`, accessToken, {
            granularity: "TOTAL",
            start_time,
            end_time,
            fields,
            breakdown: "campaign",
            limit: 50,
        });
        top_campaigns = extractCampaignTotals(campJson);
    } catch (e) {
        dbg("Campaign breakdown stats skipped", e?.message || e);
    }

    return {
        metrics_by_date,
        top_campaigns,
        campaigns_by_date: [],
    };
}
