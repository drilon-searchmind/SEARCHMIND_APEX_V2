/**
 * Klaviyo read-only helpers for APEX MCP (metrics catalog, lists/segments, account context).
 * Revision 2024-10-15.
 */

import { getPlacedOrderMetricId } from '@/lib/klaviyoDashboard';

const KLAVIYO_BASE = 'https://a.klaviyo.com/api';
const REVISION = '2024-10-15';
const RATE_LIMIT_DELAY_MS = 500;
const PROFILE_COUNT_DELAY_MS = 1100;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string} url
 * @param {string} apiKey
 */
async function klaviyoGetJson(url, apiKey) {
    const res = await fetch(url, {
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
        throw new Error(`Klaviyo API error ${res.status}: ${detail}`);
    }
    return res.json();
}

/**
 * @param {string} initialPath
 * @param {string} apiKey
 * @param {{ maxPages?: number }} [opts]
 */
async function klaviyoPaginate(initialPath, apiKey, opts = {}) {
    const maxPages = opts.maxPages ?? 50;
    /** @type {unknown[]} */
    const data = [];
    let url = initialPath.startsWith('http') ? initialPath : `${KLAVIYO_BASE}${initialPath}`;
    let pages = 0;

    while (url && pages < maxPages) {
        const json = await klaviyoGetJson(url, apiKey);
        data.push(...(json.data || []));
        url = json.links?.next || null;
        pages += 1;
        if (url) await sleep(RATE_LIMIT_DELAY_MS);
    }

    return { data, truncated: Boolean(url) };
}

/**
 * @param {unknown} metric
 */
function serializeMetric(metric) {
    const m = /** @type {Record<string, unknown>} */ (metric);
    const attrs = /** @type {Record<string, unknown>} */ (m.attributes || {});
    return {
        id: m.id,
        name: attrs.name || '',
        integration: /** @type {Record<string, unknown>} */ (attrs.integration || {}).name || null,
        created: attrs.created || null,
        updated: attrs.updated || null,
    };
}

/**
 * @param {string} apiKey
 * @param {{ sampleEventsPerMetric?: number, maxMetrics?: number }} [options]
 */
export async function fetchKlaviyoMetricsCatalog(apiKey, options = {}) {
    if (!apiKey?.trim()) throw new Error('Klaviyo Private API Key is required');
    const sampleEventsPerMetric = Math.min(Math.max(Number(options.sampleEventsPerMetric) || 1, 0), 3);
    const maxMetrics = Math.min(Math.max(Number(options.maxMetrics) || 120, 1), 200);

    const { data, truncated } = await klaviyoPaginate('/metrics/', apiKey.trim(), {
        maxPages: Math.ceil(maxMetrics / 50) + 1,
    });
    const metrics = data
        .slice(0, maxMetrics)
        .map(serializeMetric)
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    /** @type {Record<string, { metricId: string, metricName: string, events: Array<Record<string, unknown>> }>} */
    const eventSamples = {};

    if (sampleEventsPerMetric > 0) {
        const interesting = metrics.filter((m) =>
            /placed order|viewed product|added to cart|started checkout|subscribed|active on site/i.test(
                m.name
            )
        );
        const toSample = (interesting.length ? interesting : metrics).slice(0, 8);

        for (const metric of toSample) {
            await sleep(RATE_LIMIT_DELAY_MS);
            try {
                const filter = encodeURIComponent(`equals(metric_id,"${metric.id}")`);
                const json = await klaviyoGetJson(
                    `${KLAVIYO_BASE}/events/?filter=${filter}&page[size]=${sampleEventsPerMetric}`,
                    apiKey.trim()
                );
                const events = (json.data || []).map((ev) => {
                    const row = /** @type {Record<string, unknown>} */ (ev);
                    const attrs = /** @type {Record<string, unknown>} */ (row.attributes || {});
                    const props = /** @type {Record<string, unknown>} */ (attrs.event_properties || {});
                    const propKeys = Object.keys(props).slice(0, 40);
                    /** @type {Record<string, unknown>} */
                    const sampleProps = {};
                    for (const k of propKeys) sampleProps[k] = props[k];
                    return {
                        id: row.id,
                        datetime: attrs.datetime || null,
                        uuid: attrs.uuid || null,
                        propertyKeys: Object.keys(props),
                        sampleProperties: sampleProps,
                    };
                });
                eventSamples[metric.id] = {
                    metricId: metric.id,
                    metricName: metric.name,
                    events,
                };
            } catch (e) {
                eventSamples[metric.id] = {
                    metricId: metric.id,
                    metricName: metric.name,
                    events: [],
                    error: e.message,
                };
            }
        }
    }

    return {
        readOnly: true,
        generatedAt: new Date().toISOString(),
        truncated,
        metricCount: metrics.length,
        metrics,
        eventSamples: Object.values(eventSamples),
    };
}

/**
 * @param {string} apiKey
 */
export async function fetchKlaviyoAccountContext(apiKey) {
    if (!apiKey?.trim()) throw new Error('Klaviyo Private API Key is required');
    const key = apiKey.trim();

    const accountsJson = await klaviyoGetJson(`${KLAVIYO_BASE}/accounts/`, key);
    const accountRow = (accountsJson.data || [])[0];
    if (!accountRow) throw new Error('No Klaviyo account returned for this API key.');

    const accountId = String(/** @type {{ id: string }} */ (accountRow).id);
    await sleep(RATE_LIMIT_DELAY_MS);
    const accountDetail = await klaviyoGetJson(
        `${KLAVIYO_BASE}/accounts/${encodeURIComponent(accountId)}/`,
        key
    );
    const attrs = /** @type {Record<string, unknown>} */ (accountDetail.data?.attributes || {});
    const contact = /** @type {Record<string, unknown>} */ (attrs.contact_information || {});

    const placedOrderMetricId = await getPlacedOrderMetricId(key);

    return {
        readOnly: true,
        generatedAt: new Date().toISOString(),
        account: {
            id: accountId,
            organizationName: contact.organization_name || null,
            timezone: attrs.timezone || null,
            preferredCurrency: attrs.preferred_currency || null,
            publicApiKey: attrs.public_api_key || null,
            websiteUrl: contact.website_url || null,
        },
        conversion_metric: placedOrderMetricId
            ? {
                  id: placedOrderMetricId,
                  name: 'Placed Order',
                  note: 'Used by APEX Klaviyo reporting (campaign-values, flow-values, flow-series).',
              }
            : null,
        attribution: {
            availableViaApi: false,
            note:
                'Klaviyo does not expose email/SMS attribution window settings via public API (Account → Settings → Attribution). Flow/campaign reporting endpoints reflect the account’s current attribution window for conversions.',
        },
    };
}

/**
 * @param {string} apiKey
 * @param {string} resource lists|segments
 * @param {string} id
 */
async function fetchAudienceWithProfileCount(apiKey, resource, id) {
    const field = resource === 'lists' ? 'list' : 'segment';
    const path = `/${resource}/${encodeURIComponent(id)}/?additional-fields[${field}]=profile_count`;
    const json = await klaviyoGetJson(`${KLAVIYO_BASE}${path}`, apiKey);
    const row = /** @type {Record<string, unknown>} */ (json.data || {});
    const attrs = /** @type {Record<string, unknown>} */ (row.attributes || {});
    return {
        id: row.id,
        name: attrs.name || '',
        created: attrs.created || null,
        updated: attrs.updated || null,
        profile_count: attrs.profile_count ?? null,
    };
}

/**
 * @param {string} apiKey
 * @param {{ maxLists?: number, maxSegments?: number, includeProfileCounts?: boolean }} [options]
 */
export async function fetchKlaviyoListsAndSegments(apiKey, options = {}) {
    if (!apiKey?.trim()) throw new Error('Klaviyo Private API Key is required');
    const key = apiKey.trim();
    const maxLists = Math.min(Math.max(Number(options.maxLists) || 100, 1), 150);
    const maxSegments = Math.min(Math.max(Number(options.maxSegments) || 100, 1), 150);
    const includeProfileCounts = options.includeProfileCounts !== false;

    const [listsPage, segmentsPage] = await Promise.all([
        klaviyoPaginate('/lists/?sort=-updated', key, { maxPages: Math.ceil(maxLists / 50) + 1 }),
        klaviyoPaginate('/segments/?sort=-updated', key, { maxPages: Math.ceil(maxSegments / 50) + 1 }),
    ]);

    /** @type {Array<{ id: unknown, name: unknown, created: unknown, updated: unknown, profile_count: number|null }>} */
    let lists = listsPage.data.slice(0, maxLists).map((item) => {
        const row = /** @type {Record<string, unknown>} */ (item);
        const attrs = /** @type {Record<string, unknown>} */ (row.attributes || {});
        return {
            id: row.id,
            name: attrs.name || '',
            created: attrs.created || null,
            updated: attrs.updated || null,
            profile_count: null,
        };
    });

    /** @type {typeof lists} */
    let segments = segmentsPage.data.slice(0, maxSegments).map((item) => {
        const row = /** @type {Record<string, unknown>} */ (item);
        const attrs = /** @type {Record<string, unknown>} */ (row.attributes || {});
        return {
            id: row.id,
            name: attrs.name || '',
            created: attrs.created || null,
            updated: attrs.updated || null,
            profile_count: null,
        };
    });

    if (includeProfileCounts) {
        const enrichedLists = [];
        for (const list of lists) {
            await sleep(PROFILE_COUNT_DELAY_MS);
            try {
                enrichedLists.push(await fetchAudienceWithProfileCount(key, 'lists', String(list.id)));
            } catch (e) {
                enrichedLists.push({ ...list, profile_count_error: e.message });
            }
        }
        lists = enrichedLists.sort(
            (a, b) => Number(b.profile_count ?? -1) - Number(a.profile_count ?? -1)
        );

        const enrichedSegments = [];
        for (const seg of segments) {
            await sleep(PROFILE_COUNT_DELAY_MS);
            try {
                enrichedSegments.push(
                    await fetchAudienceWithProfileCount(key, 'segments', String(seg.id))
                );
            } catch (e) {
                enrichedSegments.push({ ...seg, profile_count_error: e.message });
            }
        }
        segments = enrichedSegments.sort(
            (a, b) => Number(b.profile_count ?? -1) - Number(a.profile_count ?? -1)
        );
    }

    const listsTruncated = listsPage.truncated || listsPage.data.length > maxLists;
    const segmentsTruncated = segmentsPage.truncated || segmentsPage.data.length > maxSegments;

    return {
        readOnly: true,
        generatedAt: new Date().toISOString(),
        includeProfileCounts,
        sortedByProfileCount: includeProfileCounts,
        lists: {
            truncated: listsTruncated,
            count: lists.length,
            items: lists,
        },
        segments: {
            truncated: segmentsTruncated,
            count: segments.length,
            items: segments,
        },
        note: includeProfileCounts
            ? 'Profile counts use additional-fields per list/segment (Klaviyo rate limit ~15/min). Results are sorted by profile_count descending within the fetched page — raise maxLists/maxSegments if you need more than the largest in this slice.'
            : 'Pass includeProfileCounts=true to fetch sizes (slower).',
        warning:
            listsTruncated || segmentsTruncated
                ? 'List or segment catalog was truncated before profile counts; increase maxLists/maxSegments to search for larger audiences.'
                : null,
    };
}
