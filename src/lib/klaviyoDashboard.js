/**
 * Klaviyo Reporting API for Email Dashboard.
 *
 * - campaign-values-reports → KPI totals + campaign table (campaigns only)
 * - flow-series-reports   → daily trend chart (Klaviyo has no working campaign-series endpoint)
 *
 * @see https://developers.klaviyo.com/en/reference/reporting_api_overview
 */

const KLAVIYO_BASE = 'https://a.klaviyo.com/api';
const REVISION = '2024-10-15';

const RATE_LIMIT_DELAY_MS = 500;
const REPORT_DELAY_MS = 65000;

const FLOW_SERIES_GROUP_BY = ['flow_id', 'flow_message_id', 'send_channel'];

const VALUES_STATISTICS = [
    'recipients',
    'opens',
    'clicks',
    'open_rate',
    'click_rate',
    'conversions',
    'conversion_value',
    'unsubscribes',
];

const FLOW_SERIES_STATISTICS = [
    'recipients',
    'opens',
    'clicks',
    'conversions',
    'conversion_value',
    'unsubscribes',
];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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

const metricIdCache = new Map();
const METRIC_CACHE_TTL_MS = 60 * 60 * 1000;

export async function getPlacedOrderMetricId(apiKey) {
    const cached = metricIdCache.get(apiKey);
    if (cached && cached.expires > Date.now()) return cached.metricId;

    const res = await klaviyoFetch(`${KLAVIYO_BASE}/metrics`, {
        headers: {
            Authorization: `Klaviyo-API-Key ${apiKey}`,
            Accept: 'application/json',
            revision: REVISION,
        },
    });
    if (!res.ok) {
        let detail = '';
        try {
            const errJson = await res.json();
            detail = errJson.errors?.[0]?.detail || JSON.stringify(errJson);
        } catch {
            detail = await res.text();
        }
        throw new Error(detail ? `Klaviyo metrics API error: ${res.status} - ${detail}` : `Klaviyo metrics API error: ${res.status}`);
    }
    const json = await res.json();
    let metrics = json.data || [];
    let placedOrder = metrics.find((m) => (m.attributes?.name || '').toLowerCase() === 'placed order');
    let nextUrl = json.links?.next;

    while (!placedOrder && nextUrl) {
        await sleep(RATE_LIMIT_DELAY_MS);
        const nextRes = await klaviyoFetch(nextUrl, {
            headers: {
                Authorization: `Klaviyo-API-Key ${apiKey}`,
                Accept: 'application/json',
                revision: REVISION,
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

function campaignDisplayId(id) {
    if (!id) return '—';
    return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function eachDayInclusive(startDate, endDate) {
    const days = [];
    let d = startDate;
    while (d <= endDate) {
        days.push(d);
        const [y, m, day] = d.split('-').map(Number);
        const next = new Date(Date.UTC(y, m - 1, day + 1));
        d = next.toISOString().slice(0, 10);
    }
    return days;
}

function emptyDailyRow(date) {
    return {
        date,
        recipients: 0,
        opens: 0,
        clicks: 0,
        conversions: 0,
        conversion_value: 0,
        unsubscribes: 0,
    };
}

function finalizeDailyRow(row) {
    return {
        ...row,
        open_rate: row.recipients > 0 ? row.opens / row.recipients : null,
        click_rate: row.recipients > 0 ? row.clicks / row.recipients : null,
    };
}

function addStatsToRow(row, stats) {
    row.recipients += Number(stats.recipients ?? 0);
    row.opens += Number(stats.opens ?? 0);
    row.clicks += Number(stats.clicks ?? 0);
    row.conversions += Number(stats.conversions ?? 0);
    row.conversion_value += Number(stats.conversion_value ?? 0);
    row.unsubscribes += Number(stats.unsubscribes ?? 0);
}

/** Klaviyo series stats are date-keyed objects, e.g. { "2024-03-01": 12, ... } */
function isDateKeyedSeries(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    return keys.length > 0 && keys.every((k) => /^\d{4}-\d{2}-\d{2}/.test(k));
}

function addSeriesStatToDaily(dailyByDate, statName, statValue, campaignAccumulator) {
    if (Array.isArray(statValue)) {
        const dates = [...dailyByDate.keys()].sort();
        for (let i = 0; i < statValue.length && i < dates.length; i++) {
            const day = dailyByDate.get(dates[i]);
            if (!day) continue;
            day[statName === 'conversion_value' ? 'conversion_value' : statName] += Number(statValue[i] || 0);
        }
        return;
    }
    if (isDateKeyedSeries(statValue)) {
        for (const [dateKey, val] of Object.entries(statValue)) {
            const date = dateKey.slice(0, 10);
            const day = dailyByDate.get(date);
            if (!day) continue;
            if (statName === 'conversion_value') day.conversion_value += Number(val || 0);
            else if (statName === 'recipients') day.recipients += Number(val || 0);
            else if (statName === 'opens') day.opens += Number(val || 0);
            else if (statName === 'clicks') day.clicks += Number(val || 0);
            else if (statName === 'conversions') day.conversions += Number(val || 0);
            else if (statName === 'unsubscribes') day.unsubscribes += Number(val || 0);
        }
        return;
    }
    if (campaignAccumulator && statName !== 'open_rate' && statName !== 'click_rate') {
        campaignAccumulator[statName] = (campaignAccumulator[statName] || 0) + Number(statValue || 0);
    }
}

function parseFlowSeriesToDaily(results, startDate, endDate) {
    const dates = eachDayInclusive(startDate, endDate);
    const dailyByDate = new Map(dates.map((date) => [date, emptyDailyRow(date)]));

    for (const row of results || []) {
        const stats = row.statistics || {};
        for (const [statName, statValue] of Object.entries(stats)) {
            if (statName === 'open_rate' || statName === 'click_rate') continue;
            addSeriesStatToDaily(dailyByDate, statName, statValue, null);
        }
    }

    return dates.map((date) => finalizeDailyRow(dailyByDate.get(date)));
}

function extractReportResults(json) {
    return json?.data?.attributes?.results ?? json?.data?.attributes?.result ?? [];
}

async function postReport(path, type, attributes, apiKey) {
    const res = await klaviyoFetch(`${KLAVIYO_BASE}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Klaviyo-API-Key ${apiKey}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            revision: REVISION,
        },
        body: JSON.stringify({ data: { type, attributes } }),
    }, 10);
    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Klaviyo ${type} error: ${res.status} - ${errText}`);
    }
    return res.json();
}

async function fetchCampaignValuesReport(apiKey, conversionMetricId, startDate, endDate) {
    const json = await postReport(
        '/campaign-values-reports/',
        'campaign-values-report',
        {
            timeframe: { start: `${startDate}T00:00:00+00:00`, end: `${endDate}T23:59:59+00:00` },
            conversion_metric_id: conversionMetricId,
            filter: 'equals(send_channel,"email")',
            statistics: VALUES_STATISTICS,
            group_by: ['campaign_message_id', 'campaign_id', 'send_channel'],
        },
        apiKey
    );
    return extractReportResults(json);
}

async function fetchFlowSeriesReport(apiKey, conversionMetricId, startDate, endDate) {
    const json = await postReport(
        '/flow-series-reports/',
        'flow-series-report',
        {
            timeframe: { start: `${startDate}T00:00:00+00:00`, end: `${endDate}T23:59:59+00:00` },
            interval: 'daily',
            conversion_metric_id: conversionMetricId,
            filter: 'equals(send_channel,"email")',
            statistics: FLOW_SERIES_STATISTICS,
            group_by: FLOW_SERIES_GROUP_BY,
        },
        apiKey
    );
    return extractReportResults(json);
}

function processCampaignValuesResults(results) {
    const campaignMap = {};
    for (const row of results || []) {
        const cid = row.groupings?.campaign_id;
        if (!cid) continue;
        if (!campaignMap[cid]) {
            campaignMap[cid] = {
                campaign_id: cid,
                recipients: 0,
                opens: 0,
                clicks: 0,
                conversions: 0,
                conversion_value: 0,
                unsubscribes: 0,
            };
        }
        addStatsToRow(campaignMap[cid], row.statistics || {});
    }
    return campaignMap;
}

function buildTopCampaigns(campaignMap) {
    return Object.values(campaignMap)
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
}

function totalsFromCampaignMap(campaignMap) {
    return Object.values(campaignMap).reduce(
        (acc, c) => {
            addStatsToRow(acc, c);
            return acc;
        },
        emptyDailyRow('totals')
    );
}

function sumDailyRows(rows) {
    return (rows || []).reduce(
        (acc, row) => {
            addStatsToRow(acc, row);
            return acc;
        },
        emptyDailyRow('sum')
    );
}

/** Campaign totals row (single period aggregate from values report). */
function campaignTotalsRow(startDate, campaignMap) {
    const totals = totalsFromCampaignMap(campaignMap);
    return finalizeDailyRow({ ...totals, date: startDate });
}

/**
 * Fast path: campaign values only (table + campaign KPI slice).
 */
export async function fetchKlaviyoDashboardSummary({ apiKey, startDate, endDate }) {
    if (!apiKey?.trim()) throw new Error('Klaviyo Private API Key is required');
    const conversionMetricId = await getPlacedOrderMetricId(apiKey);
    if (!conversionMetricId) throw new Error('Placed Order metric not found in Klaviyo account.');

    await sleep(RATE_LIMIT_DELAY_MS);
    const results = await fetchCampaignValuesReport(apiKey, conversionMetricId, startDate, endDate);
    const campaignMap = processCampaignValuesResults(results);

    return {
        campaign_totals: campaignTotalsRow(startDate, campaignMap),
        top_campaigns: buildTopCampaigns(campaignMap),
    };
}

/**
 * Daily trend from flow-series (automation). Klaviyo has no campaign-series API.
 */
export async function fetchKlaviyoDashboardDailySeries({ apiKey, startDate, endDate }) {
    if (!apiKey?.trim()) throw new Error('Klaviyo Private API Key is required');
    const conversionMetricId = await getPlacedOrderMetricId(apiKey);
    if (!conversionMetricId) throw new Error('Placed Order metric not found in Klaviyo account.');

    await sleep(RATE_LIMIT_DELAY_MS);
    const results = await fetchFlowSeriesReport(apiKey, conversionMetricId, startDate, endDate);
    const flowDaily = parseFlowSeriesToDaily(results, startDate, endDate);
    return { flow_daily: flowDaily };
}

/**
 * @param {'summary'|'daily'|'all'} part
 */
export async function fetchKlaviyoDashboardMetricsBothPeriods({
    apiKey,
    startDate,
    endDate,
    prevStartDate,
    prevEndDate,
    part = 'all',
}) {
    if (!apiKey?.trim()) throw new Error('Klaviyo Private API Key is required');

    if (part === 'summary') {
        const current = await fetchKlaviyoDashboardSummary({ apiKey, startDate, endDate });
        let metrics_by_date_prev = [];
        if (prevStartDate && prevEndDate) {
            await sleep(REPORT_DELAY_MS);
            try {
                const prev = await fetchKlaviyoDashboardSummary({
                    apiKey,
                    startDate: prevStartDate,
                    endDate: prevEndDate,
                });
                metrics_by_date_prev = [prev.campaign_totals];
            } catch (err) {
                console.warn('Klaviyo previous summary failed:', err.message);
            }
        }
        return {
            metrics_by_date: [current.campaign_totals],
            metrics_by_date_prev,
            top_campaigns: current.top_campaigns,
            flow_daily: [],
            hasDailySeries: false,
        };
    }

    if (part === 'daily') {
        const { flow_daily } = await fetchKlaviyoDashboardDailySeries({ apiKey, startDate, endDate });
        let flow_daily_prev = [];
        if (prevStartDate && prevEndDate) {
            await sleep(REPORT_DELAY_MS);
            try {
                const prev = await fetchKlaviyoDashboardDailySeries({
                    apiKey,
                    startDate: prevStartDate,
                    endDate: prevEndDate,
                });
                flow_daily_prev = prev.flow_daily;
            } catch (err) {
                console.warn('Klaviyo previous daily series failed:', err.message);
            }
        }
        return {
            flow_daily,
            flow_daily_prev,
            flow_totals: sumDailyRows(flow_daily),
            hasDailySeries: flow_daily.length > 1,
        };
    }

    throw new Error(`Unknown Klaviyo dashboard part: ${part}`);
}

export async function fetchKlaviyoDashboardMetrics({ apiKey, startDate, endDate }) {
    return fetchKlaviyoDashboardMetricsBothPeriods({
        apiKey,
        startDate,
        endDate,
        prevStartDate: null,
        prevEndDate: null,
        part: 'summary',
    });
}
