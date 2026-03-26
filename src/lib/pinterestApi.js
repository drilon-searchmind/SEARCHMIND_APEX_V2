/**
 * Pinterest Marketing API v5 (https://api.pinterest.com/v5)
 *
 * Server env (add to `.env.local` / deployment secrets):
 * - PINTEREST_ACCESS_TOKEN — required; OAuth token with `ads:read` (or client-credentials token with ads scope).
 * - PINTEREST_APP_ID — optional; reserved for future OAuth / token refresh (not used by these helpers yet).
 * - PINTEREST_APP_SECRET — optional; same as above.
 */
import dayjs from "dayjs";
import {
    isPinterestSyncAnalyticsRangeAllowed,
    earliestAllowedPinterestSyncAnalyticsDateYmd,
} from "@/lib/pinterestSyncAnalyticsWindow";

const PINTEREST_API_BASE = "https://api.pinterest.com/v5";

/** Pinterest allows up to 90 days per analytics request for non-hourly granularity. */
const MAX_ANALYTICS_RANGE_DAYS = 90;

const ACCOUNT_ANALYTICS_COLUMNS = [
    "SPEND_IN_DOLLAR",
    "SPEND_IN_MICRO_DOLLAR",
    "IMPRESSION_1",
    "OUTBOUND_CLICK_1",
    "TOTAL_CLICKTHROUGH",
    "CLICKTHROUGH_1",
    "REPIN_1",
    "TOTAL_CHECKOUT",
    "TOTAL_CONVERSIONS",
    "TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR",
].join(",");

const CAMPAIGN_ANALYTICS_COLUMNS = [
    "CAMPAIGN_NAME",
    "CAMPAIGN_ID",
    "OUTBOUND_CLICK_1",
    "TOTAL_CLICKTHROUGH",
    "CLICKTHROUGH_1",
    "IMPRESSION_1",
    "REPIN_1",
].join(",");

function num(v) {
    if (v === undefined || v === null || v === "") return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

/** Enable verbose `[Pinterest]` logs: DEBUG_PINTEREST=1 or NODE_ENV=development */
function pinterestDebugEnabled() {
    return process.env.DEBUG_PINTEREST === "1" || process.env.NODE_ENV === "development";
}

function dbg(...args) {
    if (pinterestDebugEnabled()) console.log("[Pinterest]", ...args);
}

/**
 * Pinterest sometimes returns UPPER_SNAKE, sometimes camelCase; account-level example uses TOTAL_CLICKTHROUGH.
 */
function pick(row, ...keys) {
    if (!row || typeof row !== "object") return undefined;
    for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null) return row[k];
    }
    return undefined;
}

function normalizeDateKey(v) {
    if (v === undefined || v === null) return "";
    const s = String(v).trim();
    return s.length >= 10 ? s.slice(0, 10) : s;
}

/** Normalize a raw analytics row to our canonical UPPER keys + DATE (YYYY-MM-DD). */
function normalizeAccountAnalyticsRow(row) {
    if (!row || typeof row !== "object") return null;
    const dateRaw = pick(row, "DATE", "date", "Date");
    const d = normalizeDateKey(dateRaw);
    if (!d) return null;

    const spendDollar = pick(row, "SPEND_IN_DOLLAR", "spend_in_dollar", "spendInDollar");
    const spendMicro = pick(row, "SPEND_IN_MICRO_DOLLAR", "spend_in_micro_dollar", "spendInMicroDollar");
    const spend =
        num(spendDollar) ||
        (spendMicro !== undefined ? num(spendMicro) / 1_000_000 : 0);

    const impressions = num(
        pick(row, "IMPRESSION_1", "impression_1", "impression1", "PAID_IMPRESSION", "paid_impression", "TOTAL_IMPRESSION", "total_impression")
    );

    const outboundClicks = num(pick(row, "OUTBOUND_CLICK_1", "outbound_click_1", "outboundClick1"));
    const totalClickthrough = num(pick(row, "TOTAL_CLICKTHROUGH", "total_clickthrough", "totalClickthrough"));
    const clickthrough1 = num(pick(row, "CLICKTHROUGH_1", "clickthrough_1", "clickthrough1"));
    const clicks = outboundClicks || totalClickthrough || clickthrough1;

    const saves = num(pick(row, "REPIN_1", "repin_1", "repin1"));

    const checkout = num(pick(row, "TOTAL_CHECKOUT", "total_checkout", "totalCheckout"));
    const totalConv = num(pick(row, "TOTAL_CONVERSIONS", "total_conversions", "totalConversions"));
    const checkoutMicro = num(
        pick(
            row,
            "TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR",
            "total_checkout_value_in_micro_dollar",
            "totalCheckoutValueInMicroDollar"
        )
    );

    return {
        DATE: d,
        SPEND_IN_DOLLAR: spend,
        IMPRESSION_1: impressions,
        OUTBOUND_CLICK_1: clicks,
        REPIN_1: saves,
        TOTAL_CHECKOUT: checkout,
        TOTAL_CONVERSIONS: totalConv,
        TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR: checkoutMicro,
    };
}

function unwrapAnalyticsArray(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.records)) return data.records;
    return [];
}

/**
 * Low-level GET to Pinterest v5.
 * @param {string} path - e.g. `/ad_accounts` (leading slash)
 * @param {string} accessToken
 * @param {Record<string, string | number | undefined>} searchParams
 */
export async function pinterestFetch(path, accessToken, searchParams = {}) {
    const url = new URL(`${PINTEREST_API_BASE}${path.startsWith("/") ? path : `/${path}`}`);
    Object.entries(searchParams).forEach(([k, v]) => {
        if (v === undefined || v === null || v === "") return;
        if (Array.isArray(v)) {
            v.forEach((item) => url.searchParams.append(k, String(item)));
        } else {
            url.searchParams.set(k, String(v));
        }
    });
    const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        cache: "no-store",
    });
    const text = await res.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`Pinterest API: invalid JSON (${res.status}): ${text.slice(0, 240)}`);
    }
    if (!res.ok) {
        const msg = data?.message || data?.error || text || res.statusText;
        throw new Error(`Pinterest API ${res.status}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
    }
    return data;
}

function splitDateRangeIntoChunks(startDate, endDate, maxDays = MAX_ANALYTICS_RANGE_DAYS) {
    const chunks = [];
    let start = dayjs(startDate);
    const end = dayjs(endDate);
    if (start.isAfter(end)) return chunks;
    while (!start.isAfter(end)) {
        const chunkEnd = start.add(maxDays - 1, "day");
        const endChunk = chunkEnd.isAfter(end) ? end : chunkEnd;
        chunks.push({
            start: start.format("YYYY-MM-DD"),
            end: endChunk.format("YYYY-MM-DD"),
        });
        start = endChunk.add(1, "day");
    }
    return chunks;
}

function mergeDailyRows(rows) {
    const byDate = new Map();
    for (const raw of rows) {
        const row = normalizeAccountAnalyticsRow(raw);
        if (!row) {
            dbg("mergeDailyRows: skipped row (no date)", raw && typeof raw === "object" ? Object.keys(raw) : raw);
            continue;
        }
        const d = row.DATE;
        if (!byDate.has(d)) {
            byDate.set(d, {
                DATE: d,
                SPEND_IN_DOLLAR: 0,
                IMPRESSION_1: 0,
                OUTBOUND_CLICK_1: 0,
                REPIN_1: 0,
                TOTAL_CHECKOUT: 0,
                TOTAL_CONVERSIONS: 0,
                TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR: 0,
            });
        }
        const agg = byDate.get(d);
        agg.SPEND_IN_DOLLAR += num(row.SPEND_IN_DOLLAR);
        agg.IMPRESSION_1 += num(row.IMPRESSION_1);
        agg.OUTBOUND_CLICK_1 += num(row.OUTBOUND_CLICK_1);
        agg.REPIN_1 += num(row.REPIN_1);
        agg.TOTAL_CHECKOUT += num(row.TOTAL_CHECKOUT);
        agg.TOTAL_CONVERSIONS += num(row.TOTAL_CONVERSIONS);
        agg.TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR += num(row.TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR);
    }
    return Array.from(byDate.values()).sort((a, b) => String(a.DATE).localeCompare(String(b.DATE)));
}

function adAccountRowToMetric(row) {
    const date = row.DATE;
    const ad_spend = num(row.SPEND_IN_DOLLAR);
    const impressions = num(row.IMPRESSION_1);
    const clicks = num(row.OUTBOUND_CLICK_1);
    const saves = num(row.REPIN_1);
    const conversions =
        num(row.TOTAL_CHECKOUT) > 0 ? num(row.TOTAL_CHECKOUT) : num(row.TOTAL_CONVERSIONS);
    const conversion_value = num(row.TOTAL_CHECKOUT_VALUE_IN_MICRO_DOLLAR) / 1_000_000;
    const roas = ad_spend > 0 ? conversion_value / ad_spend : 0;
    const aov = conversions > 0 ? conversion_value / conversions : 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpc = clicks > 0 ? ad_spend / clicks : 0;
    const cpm = impressions > 0 ? (ad_spend / impressions) * 1000 : 0;
    return {
        date,
        conversion_value,
        ad_spend,
        conversions,
        impressions,
        clicks,
        saves,
        roas,
        aov,
        ctr,
        cpc,
        cpm,
    };
}

function fillDateRangeMetrics(startDate, endDate, byDateMap) {
    const out = [];
    let d = dayjs(startDate);
    const end = dayjs(endDate);
    while (!d.isAfter(end)) {
        const key = d.format("YYYY-MM-DD");
        out.push(byDateMap.get(key) || adAccountRowToMetric({ DATE: key }));
        d = d.add(1, "day");
    }
    return out;
}

async function fetchAdAccountAnalyticsDaily(accessToken, adAccountId, startDate, endDate) {
    if (!isPinterestSyncAnalyticsRangeAllowed(startDate, endDate)) {
        dbg("skip ad_account/analytics (outside Pinterest sync 90-day window UTC)", {
            startDate,
            endDate,
            earliestAllowed: earliestAllowedPinterestSyncAnalyticsDateYmd(),
        });
        return fillDateRangeMetrics(startDate, endDate, new Map());
    }
    const chunks = splitDateRangeIntoChunks(startDate, endDate);
    const mergedRaw = [];
    for (const { start, end: chunkEnd } of chunks) {
        const data = await pinterestFetch(`/ad_accounts/${encodeURIComponent(adAccountId)}/analytics`, accessToken, {
            start_date: start,
            end_date: chunkEnd,
            columns: ACCOUNT_ANALYTICS_COLUMNS,
            granularity: "DAY",
        });
        const rows = unwrapAnalyticsArray(data);
        dbg("ad_account/analytics chunk", {
            adAccountId,
            start,
            end: chunkEnd,
            rowCount: rows.length,
            firstRowKeys: rows[0] && typeof rows[0] === "object" ? Object.keys(rows[0]) : [],
            firstRowSample: rows[0],
        });
        mergedRaw.push(...rows);
    }
    const merged = mergeDailyRows(mergedRaw);
    dbg("mergeDailyRows result", {
        uniqueDates: merged.length,
        spendSum: merged.reduce((s, r) => s + num(r.SPEND_IN_DOLLAR), 0),
    });
    const byDate = new Map(merged.map((r) => [r.DATE, adAccountRowToMetric(r)]));
    const filled = fillDateRangeMetrics(startDate, endDate, byDate);
    dbg("fillDateRangeMetrics", { startDate, endDate, days: filled.length, nonZeroSpendDays: filled.filter((r) => num(r.ad_spend) > 0).length });
    return filled;
}

async function listAllCampaignIds(accessToken, adAccountId) {
    const ids = [];
    let bookmark;
    do {
        const params = { page_size: 100 };
        if (bookmark) params.bookmark = bookmark;
        const data = await pinterestFetch(`/ad_accounts/${encodeURIComponent(adAccountId)}/campaigns`, accessToken, params);
        const items = data?.items || data?.data || [];
        for (const c of items) {
            const id = c?.id ?? c?.campaign_id;
            if (id != null && id !== "") ids.push(String(id));
        }
        bookmark = data?.bookmark;
    } while (bookmark);
    return ids;
}

/** Pinterest allows up to 250 campaign ids per analytics request; keep batches smaller for URL length. */
const CAMPAIGN_ID_BATCH = 100;

async function fetchTopCampaignsTotals(accessToken, adAccountId, startDate, endDate) {
    if (!isPinterestSyncAnalyticsRangeAllowed(startDate, endDate)) {
        dbg("skip campaigns/analytics (outside Pinterest sync 90-day window UTC)", { startDate, endDate });
        return [];
    }
    const campaignIds = await listAllCampaignIds(accessToken, adAccountId);
    if (!campaignIds.length) return [];

    const rows = [];
    for (let i = 0; i < campaignIds.length; i += CAMPAIGN_ID_BATCH) {
        const batch = campaignIds.slice(i, i + CAMPAIGN_ID_BATCH);
        const data = await pinterestFetch(
            `/ad_accounts/${encodeURIComponent(adAccountId)}/campaigns/analytics`,
            accessToken,
            {
                start_date: startDate,
                end_date: endDate,
                campaign_ids: batch,
                columns: CAMPAIGN_ANALYTICS_COLUMNS,
                granularity: "TOTAL",
            }
        );
        const part = unwrapAnalyticsArray(data);
        dbg("campaigns/analytics batch", { startDate, endDate, batchSize: batch.length, rowCount: part.length });
        rows.push(...part);
    }

    const normalized = rows.map((row) => {
        const impressions = num(pick(row, "IMPRESSION_1", "impression_1", "TOTAL_IMPRESSION", "total_impression"));
        const clicks =
            num(pick(row, "OUTBOUND_CLICK_1", "outbound_click_1")) ||
            num(pick(row, "TOTAL_CLICKTHROUGH", "total_clickthrough")) ||
            num(pick(row, "CLICKTHROUGH_1", "clickthrough_1"));
        const saves = num(pick(row, "REPIN_1", "repin_1"));
        const ctr = impressions > 0 ? clicks / impressions : 0;
        const name = pick(row, "CAMPAIGN_NAME", "campaign_name", "campaignName") || "Campaign";
        return {
            campaign_name: name,
            clicks,
            impressions,
            ctr,
            saves,
        };
    });

    normalized.sort((a, b) => b.clicks - a.clicks);
    return normalized.slice(0, 50);
}

/**
 * @param {Object} config
 * @param {string} config.accessToken
 * @param {string} config.adAccountId - Numeric Pinterest ad account id
 * @param {string} config.startDate - YYYY-MM-DD
 * @param {string} config.endDate - YYYY-MM-DD
 * @returns {Promise<{ metrics_by_date: object[], top_campaigns: object[], campaigns_by_date: [] }>}
 */
export async function fetchPinterestDashboardMetrics({ accessToken, adAccountId, startDate, endDate }) {
    if (!accessToken) throw new Error("Missing Pinterest access token");
    if (!adAccountId) throw new Error("Missing ad account id");
    if (!startDate || !endDate) throw new Error("Missing date range");

    dbg("fetchPinterestDashboardMetrics", { adAccountId, startDate, endDate });

    const [metrics_by_date, top_campaigns] = await Promise.all([
        fetchAdAccountAnalyticsDaily(accessToken, adAccountId, startDate, endDate),
        fetchTopCampaignsTotals(accessToken, adAccountId, startDate, endDate),
    ]);

    const totalSpend = metrics_by_date.reduce((s, r) => s + num(r.ad_spend), 0);
    dbg("dashboard summary", {
        days: metrics_by_date.length,
        totalSpend,
        topCampaigns: top_campaigns.length,
    });

    return {
        metrics_by_date,
        top_campaigns,
        campaigns_by_date: [],
    };
}

/**
 * List ad accounts the token can access (useful to copy the ad account id into customer settings).
 */
export async function listPinterestAdAccounts(accessToken) {
    const out = [];
    let bookmark;
    do {
        const params = { page_size: 100 };
        if (bookmark) params.bookmark = bookmark;
        const data = await pinterestFetch("/ad_accounts", accessToken, params);
        const items = data?.items || data?.data || [];
        for (const a of items) {
            out.push({
                id: a?.id != null ? String(a.id) : "",
                name: a?.name || a?.owner?.username || "",
                country: a?.country || "",
            });
        }
        bookmark = data?.bookmark;
    } while (bookmark);
    return out;
}
