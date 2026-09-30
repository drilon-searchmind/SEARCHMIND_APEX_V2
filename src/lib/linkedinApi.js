/**
 * LinkedIn Marketing API (REST)
 *
 * Server env:
 * - LI_ACCESS_TOKEN — required for API calls
 * - LI_REFRESH_TOKEN, LI_CLIENT_ID, LI_CLIENT_SECRET — optional; used to refresh on 401
 * - LINKEDIN_API_VERSION — optional; defaults to 202609
 */
import dayjs from "dayjs";

const API_ROOT = "https://api.linkedin.com";
const DEFAULT_VERSION = "202609";
const VERSION_CANDIDATES = ["202609", "202608", "202607", "202606", "202605"];
const PAGE_SIZE = 100;
/** LinkedIn recommends ≤92-day analytics windows. */
const MAX_ANALYTICS_RANGE_DAYS = 92;

const ACCOUNT_DAILY_FIELDS = [
    "impressions",
    "clicks",
    "landingPageClicks",
    "costInLocalCurrency",
    "externalWebsiteConversions",
    "oneClickLeads",
    "oneClickLeadFormOpens",
    "dateRange",
].join(",");

const CAMPAIGN_TOTAL_FIELDS = [
    "impressions",
    "clicks",
    "landingPageClicks",
    "costInLocalCurrency",
    "externalWebsiteConversions",
    "oneClickLeads",
    "oneClickLeadFormOpens",
    "pivotValues",
].join(",");

const CREATIVE_TOTAL_FIELDS = [
    "impressions",
    "clicks",
    "landingPageClicks",
    "costInLocalCurrency",
    "externalWebsiteConversions",
    "oneClickLeads",
    "oneClickLeadFormOpens",
    "pivotValues",
].join(",");

/** Explains LinkedIn metric semantics for dashboard + MCP consumers. */
export const LINKEDIN_METRICS_DEFINITIONS = {
    clicks:
        "Landing page clicks when available (landingPageClicks), otherwise all ad clicks.",
    leads:
        "oneClickLeads — Lead Gen Form submissions (One Click Lead Gen). Not the same as website conversions.",
    lead_form_opens:
        "oneClickLeadFormOpens — users who opened a Lead Gen Form without necessarily submitting.",
    conversions:
        "externalWebsiteConversions — Insight Tag / Conversions API website events attributed to the ad. Not Lead Gen Form submits.",
};

const CREATIVE_FETCH_CONCURRENCY = 8;

let cachedAccessToken = null;
let resolvedApiVersion = null;

function num(v) {
    if (v === undefined || v === null || v === "") return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function linkedInDebugEnabled() {
    return process.env.DEBUG_LINKEDIN === "1" || process.env.NODE_ENV === "development";
}

function dbg(...args) {
    if (linkedInDebugEnabled()) console.log("[LinkedIn]", ...args);
}

export function getLinkedInApiVersion() {
    const fromEnv = String(process.env.LINKEDIN_API_VERSION || "").trim();
    return fromEnv || DEFAULT_VERSION;
}

function readEnvCredentials() {
    return {
        accessToken: String(process.env.LI_ACCESS_TOKEN || "").trim(),
        refreshToken: String(process.env.LI_REFRESH_TOKEN || "").trim(),
        clientId: String(process.env.LI_CLIENT_ID || "").trim(),
        clientSecret: String(process.env.LI_CLIENT_SECRET || "").trim(),
    };
}

async function readJson(response) {
    const text = await response.text();
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch {
        return { message: text.slice(0, 500) };
    }
}

async function refreshAccessToken(creds) {
    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: creds.refreshToken,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
    });
    const response = await fetch(`${API_ROOT}/oauth/v2/accessToken`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    });
    const payload = await readJson(response);
    if (!response.ok || !payload.access_token) {
        const message = payload.error_description || payload.message || payload.error || response.statusText;
        throw new Error(`LinkedIn token refresh failed (${response.status}): ${message}`);
    }
    cachedAccessToken = payload.access_token;
    if (payload.refresh_token) {
        process.env.LI_REFRESH_TOKEN = payload.refresh_token;
    }
    return cachedAccessToken;
}

/**
 * @returns {Promise<string>}
 */
export async function resolveLinkedInAccessToken() {
    const creds = readEnvCredentials();
    if (cachedAccessToken) return cachedAccessToken;
    if (!creds.accessToken) {
        throw new Error("Missing LI_ACCESS_TOKEN on server");
    }
    cachedAccessToken = creds.accessToken;
    return cachedAccessToken;
}

export function sponsoredAccountUrn(adAccountId) {
    const id = String(adAccountId || "").trim().replace(/^urn:li:sponsoredAccount:/, "");
    if (!id) return "";
    return `urn:li:sponsoredAccount:${id}`;
}

function encodeAccountListParam(adAccountId) {
    const urn = sponsoredAccountUrn(adAccountId);
    return `List(${encodeURIComponent(urn)})`;
}

function formatLinkedInDate(isoYmd) {
    const d = dayjs(isoYmd);
    return `(year:${d.year()},month:${d.month() + 1},day:${d.date()})`;
}

function formatLinkedInDateRange(startDate, endDate) {
    return `(start:${formatLinkedInDate(startDate)},end:${formatLinkedInDate(endDate)})`;
}

function parseLinkedInDateFromElement(elem) {
    const dr = elem?.dateRange?.start;
    if (!dr || dr.year == null || dr.month == null || dr.day == null) return "";
    const m = String(dr.month).padStart(2, "0");
    const d = String(dr.day).padStart(2, "0");
    return `${dr.year}-${m}-${d}`;
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

function isVersionError(status, body) {
    const message = String(body?.message || "");
    return status === 426 || /nonexistent version|unsupported version|Invalid version/i.test(message);
}

async function linkedInGetRaw(url, accessToken, version) {
    return fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
            "LinkedIn-Version": version,
        },
        cache: "no-store",
    });
}

async function linkedInGet(url, accessToken, version, allowRefresh = true) {
    let token = accessToken;
    let response = await linkedInGetRaw(url, token, version);
    let payload = await readJson(response);

    if (response.status === 401 && allowRefresh) {
        const creds = readEnvCredentials();
        if (creds.refreshToken && creds.clientId && creds.clientSecret) {
            dbg("Access token rejected; refreshing…");
            token = await refreshAccessToken(creds);
            response = await linkedInGetRaw(url, token, version);
            payload = await readJson(response);
        }
    }

    if (!response.ok) {
        const message = payload.message || payload.error_description || JSON.stringify(payload);
        const err = new Error(`LinkedIn API ${response.status}: ${message}`);
        err.status = response.status;
        err.payload = payload;
        throw err;
    }

    return { payload, accessToken: token };
}

async function ensureApiVersion(accessToken) {
    if (resolvedApiVersion) return resolvedApiVersion;
    const preferred = getLinkedInApiVersion();
    const candidates = [preferred, ...VERSION_CANDIDATES.filter((v) => v !== preferred)];
    let lastError = null;

    for (const version of candidates) {
        const url = `${API_ROOT}/rest/adAccountUsers?q=authenticatedUser&start=0&count=1`;
        const response = await linkedInGetRaw(url, accessToken, version);
        const payload = await readJson(response);
        if (response.ok) {
            resolvedApiVersion = version;
            return version;
        }
        if (isVersionError(response.status, payload)) {
            lastError = payload.message || version;
            continue;
        }
        const message = payload.message || JSON.stringify(payload);
        throw new Error(`LinkedIn version probe failed (${response.status}): ${message}`);
    }

    throw new Error(`No supported LinkedIn-Version worked. Last: ${lastError}`);
}

async function fetchAnalyticsPage({
    accessToken,
    version,
    adAccountId,
    pivot,
    timeGranularity,
    startDate,
    endDate,
    fields,
    start = 0,
    count = PAGE_SIZE,
}) {
    // RestLi query params (dateRange, accounts, fields) must not be over-encoded by URLSearchParams.
    const query = [
        "q=analytics",
        `pivot=${encodeURIComponent(pivot)}`,
        `timeGranularity=${encodeURIComponent(timeGranularity)}`,
        `dateRange=${formatLinkedInDateRange(startDate, endDate)}`,
        `accounts=${encodeAccountListParam(adAccountId)}`,
        `fields=${fields}`,
        `start=${start}`,
        `count=${count}`,
    ].join("&");

    const url = `${API_ROOT}/rest/adAnalytics?${query}`;
    const { payload } = await linkedInGet(url, accessToken, version);
    return payload;
}

async function fetchAllAnalyticsElements(options) {
    const elements = [];
    let start = 0;
    let total = null;

    for (let page = 0; page < 200; page += 1) {
        const payload = await fetchAnalyticsPage({ ...options, start, count: PAGE_SIZE });
        const batch = Array.isArray(payload.elements) ? payload.elements : [];
        elements.push(...batch);
        if (Number.isFinite(payload.paging?.total)) total = payload.paging.total;
        if (!batch.length) break;
        start += batch.length;
        if (total != null && start >= total) break;
        if (batch.length < PAGE_SIZE) break;
    }

    return elements;
}

function aggregateAnalyticsCounts(row) {
    const ad_spend = num(row.costInLocalCurrency);
    const impressions = num(row.impressions);
    const clicks = num(row.landingPageClicks) || num(row.clicks);
    const leads = num(row.oneClickLeads);
    const lead_form_opens = num(row.oneClickLeadFormOpens);
    const conversions = num(row.externalWebsiteConversions);
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cpc = clicks > 0 ? ad_spend / clicks : 0;
    const cpm = impressions > 0 ? (ad_spend / impressions) * 1000 : 0;
    return {
        ad_spend,
        impressions,
        clicks,
        leads,
        lead_form_opens,
        conversions,
        ctr,
        cpc,
        cpm,
    };
}

function analyticsRowToMetric(row) {
    const date = parseLinkedInDateFromElement(row);
    const counts = aggregateAnalyticsCounts(row);
    return {
        date,
        conversion_value: 0,
        ...counts,
        roas: 0,
        aov: 0,
    };
}

function emptyMetricForDate(date) {
    return {
        date,
        conversion_value: 0,
        ad_spend: 0,
        conversions: 0,
        leads: 0,
        lead_form_opens: 0,
        impressions: 0,
        clicks: 0,
        roas: 0,
        aov: 0,
        ctr: 0,
        cpc: 0,
        cpm: 0,
    };
}

function fillDateRangeMetrics(startDate, endDate, byDateMap) {
    const out = [];
    let d = dayjs(startDate);
    const end = dayjs(endDate);
    while (!d.isAfter(end)) {
        const key = d.format("YYYY-MM-DD");
        out.push(byDateMap.get(key) || emptyMetricForDate(key));
        d = d.add(1, "day");
    }
    return out;
}

async function fetchAccountDailyMetrics(accessToken, version, adAccountId, startDate, endDate) {
    const chunks = splitDateRangeIntoChunks(startDate, endDate);
    const byDate = new Map();

    for (const chunk of chunks) {
        const elements = await fetchAllAnalyticsElements({
            accessToken,
            version,
            adAccountId,
            pivot: "ACCOUNT",
            timeGranularity: "DAILY",
            startDate: chunk.start,
            endDate: chunk.end,
            fields: ACCOUNT_DAILY_FIELDS,
        });
        for (const row of elements) {
            const metric = analyticsRowToMetric(row);
            if (!metric.date) continue;
            byDate.set(metric.date, metric);
        }
    }

    return fillDateRangeMetrics(startDate, endDate, byDate);
}

function idFromPivotUrn(row, entity) {
    const urn = (row?.pivotValues || [])[0];
    if (!urn) return "";
    const match = String(urn).match(new RegExp(`${entity}:(\\d+)`));
    return match ? match[1] : String(urn).split(":").pop() || "";
}

function campaignIdFromPivot(row) {
    return idFromPivotUrn(row, "sponsoredCampaign");
}

function creativeUrnFromPivot(row) {
    const urn = (row?.pivotValues || [])[0];
    return urn ? String(urn) : "";
}

function creativeIdFromPivot(row) {
    return idFromPivotUrn(row, "sponsoredCreative");
}

function campaignIdFromUrn(urn) {
    const match = String(urn || "").match(/sponsoredCampaign:(\d+)/);
    return match ? match[1] : "";
}

async function fetchCampaignName(accessToken, version, adAccountId, campaignId) {
    if (!campaignId) return "Unknown campaign";
    try {
        const { payload } = await linkedInGet(
            `${API_ROOT}/rest/adAccounts/${encodeURIComponent(adAccountId)}/adCampaigns/${encodeURIComponent(campaignId)}`,
            accessToken,
            version
        );
        return payload.name || `Campaign ${campaignId}`;
    } catch {
        return `Campaign ${campaignId}`;
    }
}

function inferCreativeFormat(creative = {}) {
    if (creative.leadgenCallToAction) return "Lead Gen Form";
    const ref = String(creative.content?.reference || "");
    if (ref.includes("ugcPost")) return "Video / UGC";
    if (ref.includes("share")) return "Image / Document";
    return "Sponsored";
}

async function fetchCreativeMeta(accessToken, version, adAccountId, creativeUrn) {
    if (!creativeUrn) return null;
    try {
        const { payload } = await linkedInGet(
            `${API_ROOT}/rest/adAccounts/${encodeURIComponent(adAccountId)}/creatives/${encodeURIComponent(creativeUrn)}`,
            accessToken,
            version
        );
        return payload;
    } catch {
        return null;
    }
}

async function mapPool(items, concurrency, mapper) {
    const results = new Array(items.length);
    let index = 0;
    async function worker() {
        while (index < items.length) {
            const current = index;
            index += 1;
            results[current] = await mapper(items[current], current);
        }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
    return results;
}

async function fetchTopCampaigns(accessToken, version, adAccountId, startDate, endDate) {
    const chunks = splitDateRangeIntoChunks(startDate, endDate);
    const agg = new Map();

    for (const chunk of chunks) {
        const elements = await fetchAllAnalyticsElements({
            accessToken,
            version,
            adAccountId,
            pivot: "CAMPAIGN",
            timeGranularity: "ALL",
            startDate: chunk.start,
            endDate: chunk.end,
            fields: CAMPAIGN_TOTAL_FIELDS,
        });
        for (const row of elements) {
            const campaignId = campaignIdFromPivot(row);
            if (!campaignId) continue;
            const prev = agg.get(campaignId) || {
                campaign_id: campaignId,
                ad_spend: 0,
                impressions: 0,
                clicks: 0,
                leads: 0,
                lead_form_opens: 0,
                conversions: 0,
            };
            const counts = aggregateAnalyticsCounts(row);
            prev.ad_spend += counts.ad_spend;
            prev.impressions += counts.impressions;
            prev.clicks += counts.clicks;
            prev.leads += counts.leads;
            prev.lead_form_opens += counts.lead_form_opens;
            prev.conversions += counts.conversions;
            agg.set(campaignId, prev);
        }
    }

    const sorted = [...agg.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 50);
    const normalized = await mapPool(sorted, CREATIVE_FETCH_CONCURRENCY, async (row) => {
        const { impressions, clicks } = row;
        const campaign_name = await fetchCampaignName(
            accessToken,
            version,
            adAccountId,
            row.campaign_id
        );
        return {
            campaign_id: row.campaign_id,
            campaign_name,
            ad_spend: row.ad_spend,
            clicks,
            impressions,
            leads: row.leads,
            lead_form_opens: row.lead_form_opens,
            conversions: row.conversions,
            ctr: impressions > 0 ? clicks / impressions : 0,
        };
    });

    return normalized;
}

async function fetchTopAds(accessToken, version, adAccountId, startDate, endDate) {
    const chunks = splitDateRangeIntoChunks(startDate, endDate);
    const agg = new Map();

    for (const chunk of chunks) {
        const elements = await fetchAllAnalyticsElements({
            accessToken,
            version,
            adAccountId,
            pivot: "CREATIVE",
            timeGranularity: "ALL",
            startDate: chunk.start,
            endDate: chunk.end,
            fields: CREATIVE_TOTAL_FIELDS,
        });
        for (const row of elements) {
            const creativeUrn = creativeUrnFromPivot(row);
            const creativeId = creativeIdFromPivot(row);
            if (!creativeId) continue;
            const prev = agg.get(creativeId) || {
                creative_id: creativeId,
                creative_urn: creativeUrn,
                ad_spend: 0,
                impressions: 0,
                clicks: 0,
                leads: 0,
                lead_form_opens: 0,
                conversions: 0,
            };
            const counts = aggregateAnalyticsCounts(row);
            prev.ad_spend += counts.ad_spend;
            prev.impressions += counts.impressions;
            prev.clicks += counts.clicks;
            prev.leads += counts.leads;
            prev.lead_form_opens += counts.lead_form_opens;
            prev.conversions += counts.conversions;
            agg.set(creativeId, prev);
        }
    }

    const sorted = [...agg.values()].sort((a, b) => b.ad_spend - a.ad_spend).slice(0, 50);
    const campaignNameCache = new Map();

    return mapPool(sorted, CREATIVE_FETCH_CONCURRENCY, async (row) => {
        const creative = await fetchCreativeMeta(
            accessToken,
            version,
            adAccountId,
            row.creative_urn || `urn:li:sponsoredCreative:${row.creative_id}`
        );
        const campaignId = campaignIdFromUrn(creative?.campaign);
        let campaign_name = campaignNameCache.get(campaignId);
        if (campaignId && !campaign_name) {
            campaign_name = await fetchCampaignName(accessToken, version, adAccountId, campaignId);
            campaignNameCache.set(campaignId, campaign_name);
        }

        const impressions = row.impressions;
        const clicks = row.clicks;
        return {
            creative_id: row.creative_id,
            creative_name: creative?.name || `Ad ${row.creative_id}`,
            format: inferCreativeFormat(creative || {}),
            campaign_id: campaignId || null,
            campaign_name: campaign_name || null,
            ad_spend: row.ad_spend,
            clicks,
            impressions,
            leads: row.leads,
            lead_form_opens: row.lead_form_opens,
            conversions: row.conversions,
            ctr: impressions > 0 ? clicks / impressions : 0,
        };
    });
}

/**
 * @param {Object} config
 * @param {string} config.adAccountId — numeric sponsored account id
 * @param {string} config.startDate — YYYY-MM-DD
 * @param {string} config.endDate — YYYY-MM-DD
 * @param {string} [config.accessToken]
 */
export async function fetchLinkedInDashboardMetrics({ adAccountId, startDate, endDate, accessToken }) {
    if (!adAccountId) throw new Error("Missing LinkedIn ad account id");
    if (!startDate || !endDate) throw new Error("Missing date range");

    const token = accessToken || (await resolveLinkedInAccessToken());
    const version = await ensureApiVersion(token);

    dbg("fetchLinkedInDashboardMetrics", { adAccountId, startDate, endDate, version });

    const [metrics_by_date, top_campaigns, top_ads] = await Promise.all([
        fetchAccountDailyMetrics(token, version, adAccountId, startDate, endDate),
        fetchTopCampaigns(token, version, adAccountId, startDate, endDate),
        fetchTopAds(token, version, adAccountId, startDate, endDate),
    ]);

    return {
        metrics_by_date,
        top_campaigns,
        top_ads,
        campaigns_by_date: [],
        metrics_definitions: LINKEDIN_METRICS_DEFINITIONS,
    };
}

/**
 * Ad accounts the server token can access (for config / dev).
 */
export async function listLinkedInAdAccounts(accessToken) {
    const token = accessToken || (await resolveLinkedInAccessToken());
    const version = await ensureApiVersion(token);

    const accessRows = [];
    let start = 0;
    for (let page = 0; page < 50; page += 1) {
        const url = `${API_ROOT}/rest/adAccountUsers?q=authenticatedUser&start=${start}&count=${PAGE_SIZE}`;
        const { payload } = await linkedInGet(url, token, version);
        const batch = Array.isArray(payload.elements) ? payload.elements : [];
        accessRows.push(...batch);
        if (!batch.length) break;
        start += batch.length;
        if (batch.length < PAGE_SIZE) break;
    }

    const ids = new Set();
    for (const row of accessRows) {
        const match = String(row.account || "").match(/sponsoredAccount:(\d+)/);
        if (match) ids.add(match[1]);
    }

    const accounts = [];
    for (const id of ids) {
        const url = `${API_ROOT}/rest/adAccounts/${id}`;
        try {
            const { payload } = await linkedInGet(url, token, version);
            accounts.push({
                id: String(payload.id || id),
                name: payload.name || null,
                status: payload.status || null,
                currency: payload.currency || null,
                role: accessRows.find((r) => String(r.account || "").includes(id))?.role || null,
            });
        } catch {
            accounts.push({ id, name: null, status: null, currency: null, role: null });
        }
    }

    accounts.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    return accounts;
}
