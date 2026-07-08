/**
 * Meta Ads Pixel — stats via Graph API ({pixel-id}/stats).
 * Used by Apex Radar conversion event picker and pixel-based conversion tracking.
 */

const GRAPH_VERSION = "v21.0";

/** @param {string} raw */
export function normalizeFacebookPixelId(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    const digits = s.replace(/\D/g, "");
    return digits || s;
}

function isoToUnixSeconds(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 1000);
}

/** End of UTC day (inclusive) for YYYY-MM-DD. */
function isoEndOfDayUnixSeconds(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d, 23, 59, 59) / 1000);
}

/**
 * @param {string} accessToken
 * @param {string} pixelId
 * @param {object} opts
 * @param {string} opts.aggregation — event_total_counts | event
 * @param {string} [opts.startIso] — YYYY-MM-DD
 * @param {string} [opts.endIso] — YYYY-MM-DD
 * @param {"WEB_ONLY"|"SERVER_ONLY"} [opts.eventSource]
 */
export async function fetchFacebookPixelStats(accessToken, pixelId, opts = {}) {
    const id = normalizeFacebookPixelId(pixelId);
    if (!id) throw new Error("Missing Facebook pixel id");
    if (!accessToken) throw new Error("Missing Facebook access token");

    const params = new URLSearchParams({
        access_token: accessToken,
        aggregation: opts.aggregation || "event_total_counts",
    });
    if (opts.startIso) params.set("start_time", String(isoToUnixSeconds(opts.startIso)));
    if (opts.endIso) params.set("end_time", String(isoEndOfDayUnixSeconds(opts.endIso)));
    if (opts.eventSource) params.set("event_source", opts.eventSource);

    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${id}/stats?${params.toString()}`;
    const res = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`Facebook pixel stats: bad JSON ${text.slice(0, 200)}`);
    }
    if (data.error) {
        throw new Error(`Facebook pixel stats: ${JSON.stringify(data.error)}`);
    }
    return data;
}

/**
 * Flatten nested pixel stats buckets into event → count.
 * @param {object} statsResponse — Graph API response
 * @returns {Map<string, number>}
 */
export function aggregatePixelEventCounts(statsResponse) {
    const counts = new Map();
    const buckets = statsResponse?.data || [];
    for (const bucket of buckets) {
        const rows = bucket?.data || [];
        for (const row of rows) {
            const name = row?.value ?? row?.event ?? row?.event_name;
            const count = parseFloat(row?.count ?? row?.value_count ?? 0);
            if (!name || !Number.isFinite(count) || count <= 0) continue;
            const key = String(name);
            counts.set(key, (counts.get(key) || 0) + count);
        }
    }
    return counts;
}

/**
 * Hourly `aggregation=event` buckets → daily rows { date_start, events: Record<string, number> }.
 * @param {object} statsResponse
 * @returns {Array<{ date_start: string, events: Record<string, number> }>}
 */
export function pixelStatsToDailyEventRows(statsResponse) {
    const byDate = new Map();
    const buckets = statsResponse?.data || [];
    for (const bucket of buckets) {
        const ts = bucket?.start_time || bucket?.timestamp;
        const dateStart =
            typeof ts === "string" && ts.length >= 10
                ? ts.slice(0, 10)
                : ts
                  ? new Date(Number(ts) * 1000).toISOString().slice(0, 10)
                  : null;
        if (!dateStart) continue;

        let day = byDate.get(dateStart);
        if (!day) {
            day = {};
            byDate.set(dateStart, day);
        }
        for (const row of bucket?.data || []) {
            const name = row?.value ?? row?.event ?? row?.event_name;
            const count = parseFloat(row?.count ?? row?.value_count ?? 0);
            if (!name || !Number.isFinite(count) || count <= 0) continue;
            const key = String(name);
            day[key] = (day[key] || 0) + count;
        }
    }
    return [...byDate.entries()]
        .map(([date_start, events]) => ({ date_start, events }))
        .sort((a, b) => a.date_start.localeCompare(b.date_start));
}

/**
 * @param {Map<string, number>} counts
 * @param {(name: string) => string} [formatLabel]
 */
export function pixelCountsToEventOptions(counts, formatLabel = (n) => n) {
    return [...counts.entries()]
        .map(([actionType, count]) => ({
            actionType,
            count: Math.round(count * 1000) / 1000,
            label: formatLabel(actionType),
            source: "pixel",
        }))
        .sort((a, b) => b.count - a.count || a.actionType.localeCompare(b.actionType));
}

/**
 * Sum selected pixel event names for one daily row.
 * @param {{ events?: Record<string, number> }|null|undefined} dayRow
 * @param {string[]} eventNames
 */
export function conversionsFromPixelDay(dayRow, eventNames) {
    if (!dayRow?.events || !eventNames?.length) return 0;
    let sum = 0;
    for (const name of eventNames) {
        const v = dayRow.events[name];
        if (Number.isFinite(v) && v > 0) sum += v;
    }
    return sum;
}

/** Config anchor for Meta section in customer config. */
export function customerMetaConfigUrl(customerId) {
    return `/dashboard/${encodeURIComponent(String(customerId))}/config#meta`;
}

export function isFacebookPermissionDeniedError(err) {
    const msg = String(err?.message || err || "");
    return msg.includes("Permission Denied") || msg.includes('"code":100') || msg.includes('"code":200');
}

/**
 * @param {string} accessToken
 * @param {string} adAccountId
 * @returns {Promise<Array<{ id: string, name: string, last_fired_time?: string }>>}
 */
export async function fetchAdAccountPixels(accessToken, adAccountId) {
    const raw = String(adAccountId || "").trim().replace(/^act_/, "");
    if (!raw) return [];
    const params = new URLSearchParams({
        access_token: accessToken,
        fields: "id,name,last_fired_time",
        limit: "50",
    });
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/act_${raw}/adspixels?${params.toString()}`;
    const res = await fetch(url, { method: "GET" });
    const data = await res.json();
    if (data.error) {
        throw new Error(`Facebook adspixels: ${JSON.stringify(data.error)}`);
    }
    return Array.isArray(data.data) ? data.data : [];
}

/**
 * @param {string} configuredPixelId
 * @param {Array<{ id: string, name?: string, last_fired_time?: string }>} pixels
 */
export function resolveFacebookPixelId(configuredPixelId, pixels = []) {
    const configured = normalizeFacebookPixelId(configuredPixelId);
    if (configured) return configured;
    if (!pixels.length) return "";
    const sorted = [...pixels].sort((a, b) => {
        const ta = a.last_fired_time ? Date.parse(a.last_fired_time) : 0;
        const tb = b.last_fired_time ? Date.parse(b.last_fired_time) : 0;
        return tb - ta;
    });
    return normalizeFacebookPixelId(sorted[0]?.id);
}

/**
 * Pixel-based conversion config is active when custom events are selected.
 * Counts use ad-account insights with pixel-name → action_type mapping.
 */
export function usesPixelConversionTracking(_pixelId, trackingConversionActionTypes) {
    return (
        Array.isArray(trackingConversionActionTypes) && trackingConversionActionTypes.length > 0
    );
}
