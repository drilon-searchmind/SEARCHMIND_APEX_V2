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

async function linkedInGetRaw(url, accessToken, version, timeoutMs = 0) {
    return fetch(url, {
        ...(timeoutMs > 0 ? { signal: AbortSignal.timeout(timeoutMs) } : {}),
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
            "LinkedIn-Version": version,
        },
        cache: "no-store",
    });
}

async function linkedInGet(url, accessToken, version, allowRefresh = true, timeoutMs = 0) {
    let token = accessToken;
    let response = await linkedInGetRaw(url, token, version, timeoutMs);
    let payload = await readJson(response);

    if (response.status === 401 && allowRefresh) {
        const creds = readEnvCredentials();
        if (creds.refreshToken && creds.clientId && creds.clientSecret) {
            dbg("Access token rejected; refreshing…");
            token = await refreshAccessToken(creds);
            response = await linkedInGetRaw(url, token, version, timeoutMs);
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

/** Demographic pivots the analytics API supports for ad accounts (checked against a live account). */
const DEMOGRAPHIC_PIVOTS = [
    { key: "job_function", pivot: "MEMBER_JOB_FUNCTION", resource: "functions" },
    { key: "seniority", pivot: "MEMBER_SENIORITY", resource: "seniorities" },
    { key: "company_size", pivot: "MEMBER_COMPANY_SIZE", resource: null },
    { key: "industry", pivot: "MEMBER_INDUSTRY", resource: "industries", limit: 15 },
];

const DEMOGRAPHIC_FIELDS = [
    "impressions",
    "clicks",
    "landingPageClicks",
    "costInLocalCurrency",
    "oneClickLeads",
    "externalWebsiteConversions",
    "pivotValues",
].join(",");

const nameCache = new Map();
/** Some industry ids never answer; a lookup that takes longer than this just falls back to a generic label. */
const NAME_LOOKUP_TIMEOUT_MS = 4000;

/** Standardized names (function, seniority, industry) come from /rest/{resource}/{id}; they never change, so cache them. */
async function fetchStandardizedName(accessToken, version, resource, id) {
    const key = `${resource}:${id}`;
    if (nameCache.has(key)) return nameCache.get(key);
    let name = null;
    try {
        const { payload } = await linkedInGet(
            `${API_ROOT}/rest/${resource}/${encodeURIComponent(id)}?locale=(language:en,country:US)`,
            accessToken,
            version,
            true,
            NAME_LOOKUP_TIMEOUT_MS
        );
        name = payload?.name?.localized?.en_US || Object.values(payload?.name?.localized || {})[0] || null;
    } catch {
        name = null;
    }
    if (name) nameCache.set(key, name);
    return name;
}

/** "SIZE_11_TO_50" -> "11 to 50 employees", "SIZE_10001_OR_MORE" -> "10.001 or more employees" */
function companySizeLabel(value) {
    const v = String(value || "");
    let m = v.match(/^SIZE_(\d+)_TO_(\d+)$/);
    if (m) return `${m[1]} to ${m[2]} employees`;
    m = v.match(/^SIZE_(\d+)_OR_MORE$/);
    if (m) return `${Number(m[1]).toLocaleString("da-DK")} or more employees`;
    if (v === "SIZE_1") return "Self-employed";
    return v.replace(/^SIZE_/, "").replace(/_/g, " ").toLowerCase();
}

async function fetchDemographicPivot(accessToken, version, adAccountId, startDate, endDate, def) {
    const chunks = splitDateRangeIntoChunks(startDate, endDate);
    const agg = new Map();
    for (const chunk of chunks) {
        // Member demographic pivots ignore start/count and always return the whole set, so asking for
        // "the next page" would return the same rows again. One request per chunk is the complete answer.
        const payload = await fetchAnalyticsPage({
            accessToken,
            version,
            adAccountId,
            pivot: def.pivot,
            timeGranularity: "ALL",
            startDate: chunk.start,
            endDate: chunk.end,
            fields: DEMOGRAPHIC_FIELDS,
        });
        const elements = Array.isArray(payload.elements) ? payload.elements : [];
        for (const row of elements) {
            const raw = (row?.pivotValues || [])[0];
            if (!raw) continue;
            const cur = agg.get(raw) || { raw, impressions: 0, clicks: 0, ad_spend: 0, leads: 0, conversions: 0 };
            const counts = aggregateAnalyticsCounts(row);
            cur.impressions += counts.impressions;
            cur.clicks += counts.clicks;
            cur.ad_spend += counts.ad_spend;
            cur.leads += counts.leads;
            cur.conversions += counts.conversions;
            agg.set(raw, cur);
        }
    }

    let rows = [...agg.values()].sort((a, b) => b.impressions - a.impressions);
    if (def.limit) rows = rows.slice(0, def.limit);

    const named = await mapPool(rows, CREATIVE_FETCH_CONCURRENCY, async (r) => {
        const idMatch = String(r.raw).match(/:(\d+)$/);
        let name;
        if (def.resource && idMatch) name = await fetchStandardizedName(accessToken, version, def.resource, idMatch[1]);
        else if (!def.resource) name = companySizeLabel(r.raw);
        return {
            id: String(r.raw),
            name: name || `${def.key.replace("_", " ")} ${idMatch ? idMatch[1] : r.raw}`,
            impressions: r.impressions,
            clicks: r.clicks,
            ad_spend: r.ad_spend,
            leads: r.leads,
            conversions: r.conversions,
            ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
        };
    });
    return named;
}

/**
 * Reach and engagement for the whole period. Unique reach cannot be added up across windows, so it is
 * only returned for ranges inside one analytics window (92 days).
 */
async function fetchAccountReach(accessToken, version, adAccountId, startDate, endDate) {
    if (splitDateRangeIntoChunks(startDate, endDate).length !== 1) return null;
    const payload = await fetchAnalyticsPage({
        accessToken,
        version,
        adAccountId,
        pivot: "ACCOUNT",
        timeGranularity: "ALL",
        startDate,
        endDate,
        fields: "impressions,approximateMemberReach,totalEngagements",
    });
    const row = (Array.isArray(payload.elements) ? payload.elements : [])[0];
    if (!row) return null;
    const reach = num(row.approximateMemberReach);
    const impressions = num(row.impressions);
    return {
        reach,
        total_engagements: num(row.totalEngagements),
        frequency: reach > 0 ? impressions / reach : null,
    };
}

/**
 * @param {Object} config
 * @param {string} config.adAccountId — numeric sponsored account id
 * @param {string} config.startDate — YYYY-MM-DD
 * @param {string} config.endDate — YYYY-MM-DD
 * @param {string} [config.accessToken]
 * @param {boolean} [config.includeExtras] — demographics, reach and engagement (dashboard only); failures return as warnings
 */
export async function fetchLinkedInDashboardMetrics({ adAccountId, startDate, endDate, accessToken, includeExtras = false }) {
    if (!adAccountId) throw new Error("Missing LinkedIn ad account id");
    if (!startDate || !endDate) throw new Error("Missing date range");

    const token = accessToken || (await resolveLinkedInAccessToken());
    const version = await ensureApiVersion(token);

    dbg("fetchLinkedInDashboardMetrics", { adAccountId, startDate, endDate, version, includeExtras });

    const skipped = Promise.resolve(null);
    const [daily, campaigns, ads, reach, ...demos] = await Promise.allSettled([
        fetchAccountDailyMetrics(token, version, adAccountId, startDate, endDate),
        fetchTopCampaigns(token, version, adAccountId, startDate, endDate),
        fetchTopAds(token, version, adAccountId, startDate, endDate),
        includeExtras ? fetchAccountReach(token, version, adAccountId, startDate, endDate) : skipped,
        ...DEMOGRAPHIC_PIVOTS.map((def) =>
            includeExtras ? fetchDemographicPivot(token, version, adAccountId, startDate, endDate, def) : skipped
        ),
    ]);

    // The daily account series and the campaign table are required; creatives and the extras are not
    if (daily.status === "rejected") throw daily.reason;
    if (campaigns.status === "rejected") throw campaigns.reason;

    const result = {
        metrics_by_date: daily.value,
        top_campaigns: campaigns.value,
        top_ads: ads.status === "fulfilled" ? ads.value : [],
        campaigns_by_date: [],
        metrics_definitions: LINKEDIN_METRICS_DEFINITIONS,
    };
    if (!includeExtras) {
        if (ads.status === "rejected") throw ads.reason;
        return result;
    }

    const warnings = [];
    if (ads.status === "rejected") warnings.push({ part: "ads", message: ads.reason?.message || "Ad-level report failed" });
    result.reach = reach.status === "fulfilled" ? reach.value : null;
    if (reach.status === "rejected") warnings.push({ part: "reach", message: reach.reason?.message || "Reach report failed" });

    result.demographics = {};
    DEMOGRAPHIC_PIVOTS.forEach((def, i) => {
        const r = demos[i];
        if (r.status === "fulfilled") result.demographics[def.key] = r.value || [];
        else {
            result.demographics[def.key] = [];
            warnings.push({ part: def.key, message: r.reason?.message || `${def.pivot} report failed` });
        }
    });
    result.warnings = warnings;
    return result;
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
