/**
 * Klaviyo Reporting API client for Email Dashboard metrics.
 * Uses campaign-values-reports to fetch email campaign performance.
 * @see https://developers.klaviyo.com/en/reference/reporting_api_overview
 */

const KLAVIYO_BASE = 'https://a.klaviyo.com/api';
const REVISION = '2024-10-15';

/** Delay between Klaviyo API calls. Metrics: 10/s, 150/m. campaign-values-reports: 2/min. */
const RATE_LIMIT_DELAY_MS = 500;
/** Delay between two campaign-values-reports calls (2/min limit). Use 65s to be safe. */
const CAMPAIGN_REPORT_DELAY_MS = 65000;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with retry on 429 (rate limit). Parses "Expected available in X second" from Klaviyo errors.
 */
async function klaviyoFetch(url, options, maxRetries = 5) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const res = await fetch(url, options);
        if (res.status !== 429) return res;
        const errText = await res.text();
        let waitMs = RATE_LIMIT_DELAY_MS;
        try {
            const errJson = JSON.parse(errText);
            const detail = errJson.errors?.[0]?.detail || '';
            const match = detail.match(/Expected available in (\d+) second/);
            if (match) waitMs = (parseInt(match[1], 10) + 1) * 1000;
        } catch {}
        if (attempt < maxRetries - 1) await sleep(waitMs);
        else throw new Error(`Klaviyo rate limit (429): ${errText}`);
    }
    return null;
}

/** In-memory cache for Placed Order metric ID. TTL 1 hour. */
const metricIdCache = new Map();
const METRIC_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Fetch Placed Order metric ID from Klaviyo (required for conversion stats).
 * Cached per apiKey. Stops paginating as soon as found.
 * @param {string} apiKey - Klaviyo Private API Key
 * @returns {Promise<string|null>} Metric ID or null if not found
 */
export async function getPlacedOrderMetricId(apiKey) {
    const cached = metricIdCache.get(apiKey);
    if (cached && cached.expires > Date.now()) return cached.metricId;

    const url = `${KLAVIYO_BASE}/metrics`;
    const res = await klaviyoFetch(url, {
        headers: {
            'Authorization': `Klaviyo-API-Key ${apiKey}`,
            'Accept': 'application/json',
            'revision': REVISION,
        },
    });
    if (!res.ok) {
        let detail = '';
        try {
            const errJson = await res.json();
            detail = errJson.errors?.[0]?.detail || errJson.detail || JSON.stringify(errJson);
        } catch {
            detail = await res.text();
        }
        const msg = detail
            ? `Klaviyo metrics API error: ${res.status} - ${detail}`
            : `Klaviyo metrics API error: ${res.status} ${res.statusText}. Ensure your Private API Key has the "metrics:read" scope.`;
        throw new Error(msg);
    }
    const json = await res.json();
    let metrics = json.data || [];
    let placedOrder = metrics.find((m) => (m.attributes?.name || '').toLowerCase() === 'placed order');
    let nextUrl = json.links?.next;

    while (!placedOrder && nextUrl) {
        await sleep(RATE_LIMIT_DELAY_MS);
        const nextRes = await klaviyoFetch(nextUrl, {
            headers: {
                'Authorization': `Klaviyo-API-Key ${apiKey}`,
                'Accept': 'application/json',
                'revision': REVISION,
            },
        });
        if (!nextRes.ok) break;
        const nextJson = await nextRes.json();
        metrics = nextJson.data || [];
        placedOrder = metrics.find((m) => (m.attributes?.name || '').toLowerCase() === 'placed order');
        nextUrl = nextJson.links?.next;
    }

    const metricId = placedOrder?.id ?? null;
    if (metricId) metricIdCache.set(apiKey, { metricId, expires: Date.now() + METRIC_CACHE_TTL_MS });
    return metricId;
}

/**
 * Display label for a campaign (avoids N extra API calls for names).
 * Uses short ID for readability.
 */
function campaignDisplayId(id) {
    if (!id) return '—';
    return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

/**
 * Internal: fetch campaign values report given conversion metric ID.
 */
async function fetchCampaignValuesReport({ apiKey, conversionMetricId, startDate, endDate }) {
    const startIso = `${startDate}T00:00:00+00:00`;
    const endIso = `${endDate}T23:59:59+00:00`;
    const body = {
        data: {
            type: 'campaign-values-report',
            attributes: {
                timeframe: { start: startIso, end: endIso },
                conversion_metric_id: conversionMetricId,
                filter: 'equals(send_channel,"email")',
                statistics: ['recipients', 'opens', 'clicks', 'open_rate', 'click_rate', 'conversions', 'conversion_value', 'unsubscribes'],
                group_by: ['campaign_message_id', 'campaign_id', 'send_channel'],
            },
        },
    };
    const res = await klaviyoFetch(`${KLAVIYO_BASE}/campaign-values-reports/`, {
        method: 'POST',
        headers: {
            'Authorization': `Klaviyo-API-Key ${apiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'revision': REVISION,
        },
        body: JSON.stringify(body),
    }, 10);
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Klaviyo campaign-values-reports error: ${res.status} - ${errText}`);
    }
    const json = await res.json();
    return json.data?.attributes?.results ?? [];
}

/**
 * Fetch both current and previous period in one call, with server-side delay to respect 2/min limit.
 * @returns {Promise<{ metrics_by_date, metrics_by_date_prev, top_campaigns }>}
 */
export async function fetchKlaviyoDashboardMetricsBothPeriods({ apiKey, startDate, endDate, prevStartDate, prevEndDate }) {
    if (!apiKey || !apiKey.trim()) throw new Error('Klaviyo Private API Key is required');

    const conversionMetricId = await getPlacedOrderMetricId(apiKey);
    if (!conversionMetricId) {
        throw new Error('Placed Order metric not found in Klaviyo account. Ensure your store integration is connected.');
    }

    await sleep(RATE_LIMIT_DELAY_MS);

    const currentResults = await fetchCampaignValuesReport({ apiKey, conversionMetricId, startDate, endDate });

    let prevResults = [];
    let prevFetchFailed = false;
    if (prevStartDate && prevEndDate) {
        await sleep(CAMPAIGN_REPORT_DELAY_MS);
        try {
            prevResults = await fetchCampaignValuesReport({ apiKey, conversionMetricId, startDate: prevStartDate, endDate: prevEndDate });
        } catch (err) {
            console.warn('Klaviyo previous period fetch failed (returning current only):', err.message);
            prevFetchFailed = true;
        }
    }

    const processResults = (results, date) => {
        const campaignMap = {};
        const campaignIds = new Set();
        for (const row of results) {
            const g = row.groupings || {};
            const s = row.statistics || {};
            const cid = g.campaign_id;
            if (!cid) continue;
            campaignIds.add(cid);
            if (!campaignMap[cid]) {
                campaignMap[cid] = { campaign_id: cid, recipients: 0, opens: 0, clicks: 0, conversions: 0, conversion_value: 0, unsubscribes: 0 };
            }
            const c = campaignMap[cid];
            c.recipients += s.recipients ?? 0;
            c.opens += s.opens ?? 0;
            c.clicks += s.clicks ?? 0;
            c.conversions += s.conversions ?? 0;
            c.conversion_value += s.conversion_value ?? 0;
            c.unsubscribes += s.unsubscribes ?? 0;
        }
        const allIds = [...new Set([...campaignIds])];
        return { campaignMap, campaignIds: allIds };
    };

    const { campaignMap: currentMap, campaignIds: currentIds } = processResults(currentResults, startDate);
    const { campaignMap: prevMap, campaignIds: prevIds } = processResults(prevResults, prevStartDate || startDate);

    const buildTopCampaigns = (campaignMap) =>
        Object.values(campaignMap)
            .map((c) => ({
                campaign_name: campaignDisplayId(c.campaign_id),
                campaign_id: c.campaign_id,
                recipients: c.recipients,
                opens: c.opens,
                clicks: c.clicks,
                open_rate: c.recipients > 0 ? c.opens / c.recipients : null,
                click_rate: c.recipients > 0 ? c.clicks / c.recipients : null,
                conversions: c.conversions,
                conversion_value: c.conversion_value,
                unsubscribes: c.unsubscribes,
            }))
            .sort((a, b) => (b.recipients ?? 0) - (a.recipients ?? 0))
            .slice(0, 100);

    const totalsFromMap = (m) =>
        Object.values(m).reduce(
            (acc, c) => ({
                recipients: acc.recipients + (c.recipients ?? 0),
                opens: acc.opens + (c.opens ?? 0),
                clicks: acc.clicks + (c.clicks ?? 0),
                conversions: acc.conversions + (c.conversions ?? 0),
                conversion_value: acc.conversion_value + (c.conversion_value ?? 0),
                unsubscribes: acc.unsubscribes + (c.unsubscribes ?? 0),
            }),
            { recipients: 0, opens: 0, clicks: 0, conversions: 0, conversion_value: 0, unsubscribes: 0 }
        );

    const currentTotals = totalsFromMap(currentMap);
    const prevTotals = totalsFromMap(prevMap);

    const metrics_by_date = [
        {
            date: startDate,
            ...currentTotals,
            open_rate: currentTotals.recipients > 0 ? currentTotals.opens / currentTotals.recipients : null,
            click_rate: currentTotals.recipients > 0 ? currentTotals.clicks / currentTotals.recipients : null,
        },
    ];

    const metrics_by_date_prev = prevStartDate && prevEndDate && !prevFetchFailed
        ? [
            {
                date: prevStartDate,
                ...prevTotals,
                open_rate: prevTotals.recipients > 0 ? prevTotals.opens / prevTotals.recipients : null,
                click_rate: prevTotals.recipients > 0 ? prevTotals.clicks / prevTotals.recipients : null,
            },
        ]
        : [];

    const top_campaigns = buildTopCampaigns(currentMap);

    return { metrics_by_date, metrics_by_date_prev, top_campaigns };
}

/**
 * Fetch Klaviyo campaign values report for email campaigns (single period).
 * @param {Object} params
 * @param {string} params.apiKey - Klaviyo Private API Key
 * @param {string} params.startDate - YYYY-MM-DD
 * @param {string} params.endDate - YYYY-MM-DD
 * @returns {Promise<{ metrics_by_date: Array, top_campaigns: Array, campaigns_by_date: Array }>}
 */
export async function fetchKlaviyoDashboardMetrics({ apiKey, startDate, endDate }) {
    const { metrics_by_date, top_campaigns } = await fetchKlaviyoDashboardMetricsBothPeriods({
        apiKey, startDate, endDate, prevStartDate: null, prevEndDate: null,
    });
    const campaigns_by_date = top_campaigns.map((c) => ({
        date: startDate,
        campaign_name: c.campaign_name,
        campaign_id: c.campaign_id,
        recipients: c.recipients,
        opens: c.opens,
        clicks: c.clicks,
        open_rate: c.open_rate,
        click_rate: c.click_rate,
    }));
    return { metrics_by_date, top_campaigns, campaigns_by_date };
}
