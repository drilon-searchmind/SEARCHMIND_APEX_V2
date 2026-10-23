/**
 * Pure helpers behind the SEO dashboard's derived views. Everything here is computed from the
 * Search Console rows the dashboard already loads (no extra API calls, no assumed benchmarks).
 */

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const norm = (kw) => String(kw || "").trim().toLowerCase();

/** Rank bands used for the position distribution. */
export const POSITION_BANDS = [
    { id: "top3", label: "Top 3", min: 0, max: 3.5 },
    { id: "page1", label: "4 to 10", min: 3.5, max: 10.5 },
    { id: "page2", label: "11 to 20", min: 10.5, max: 20.5 },
    { id: "tail", label: "21 and below", min: 20.5, max: Infinity },
];

/** Search Console averages positions, so bands use rounded positions (3.5 rounds into 4). */
export function bandForPosition(position) {
    const p = num(position);
    return POSITION_BANDS.find((b) => p >= b.min && p < b.max) || POSITION_BANDS[POSITION_BANDS.length - 1];
}

/**
 * How many keywords sit in each rank band, and how many clicks and impressions each band earns.
 * @param {Array<{ keys?: string[], clicks?: number, impressions?: number, position?: number }>} keywordRows
 */
export function positionDistribution(keywordRows) {
    const bands = POSITION_BANDS.map((b) => ({ ...b, keywords: 0, clicks: 0, impressions: 0 }));
    for (const row of keywordRows || []) {
        if (!row?.keys?.[0] || row.position == null) continue;
        const band = bands.find((b) => num(row.position) >= b.min && num(row.position) < b.max) || bands[bands.length - 1];
        band.keywords += 1;
        band.clicks += num(row.clicks);
        band.impressions += num(row.impressions);
    }
    const totalKeywords = bands.reduce((s, b) => s + b.keywords, 0);
    const totalClicks = bands.reduce((s, b) => s + b.clicks, 0);
    return {
        bands: bands.map((b) => ({
            ...b,
            keywordShare: totalKeywords ? b.keywords / totalKeywords : 0,
            clickShare: totalClicks ? b.clicks / totalClicks : 0,
        })),
        totalKeywords,
        totalClicks,
    };
}

/**
 * Keywords that gained or lost the most clicks against a comparison period.
 * Keywords with no clicks in either period are skipped; new keywords count as pure gains.
 */
export function winnersAndLosers(currentRows, prevRows, limit = 5) {
    const prev = new Map((prevRows || []).map((r) => [norm(r.keys?.[0]), r]));
    const seen = new Set();
    const items = [];
    for (const row of currentRows || []) {
        const keyword = row.keys?.[0];
        if (!keyword) continue;
        const k = norm(keyword);
        seen.add(k);
        const before = prev.get(k);
        const clicks = num(row.clicks);
        const prevClicks = before ? num(before.clicks) : 0;
        if (clicks === 0 && prevClicks === 0) continue;
        items.push({
            keyword,
            clicks,
            prevClicks,
            delta: clicks - prevClicks,
            isNew: !before,
            position: row.position != null ? num(row.position) : null,
            prevPosition: before?.position != null ? num(before.position) : null,
        });
    }
    for (const [k, before] of prev) {
        if (seen.has(k) || num(before.clicks) === 0) continue;
        items.push({
            keyword: before.keys?.[0],
            clicks: 0,
            prevClicks: num(before.clicks),
            delta: -num(before.clicks),
            isNew: false,
            isLost: true,
            position: null,
            prevPosition: before.position != null ? num(before.position) : null,
        });
    }
    const winners = items.filter((i) => i.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, limit);
    const losers = items.filter((i) => i.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, limit);
    return { winners, losers };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Average clicks per weekday (Mon first), plus each day's index against the best day. */
export function weekdayPattern(dailyRows) {
    const sums = Array(7).fill(0);
    const counts = Array(7).fill(0);
    for (const row of dailyRows || []) {
        const date = row.keys?.[0];
        if (!date) continue;
        const dow = new Date(`${date}T12:00:00.000Z`).getUTCDay();
        sums[dow] += num(row.clicks);
        counts[dow] += 1;
    }
    const order = [1, 2, 3, 4, 5, 6, 0];
    const days = order.map((dow) => ({
        label: WEEKDAYS[dow],
        avg: counts[dow] ? sums[dow] / counts[dow] : 0,
        samples: counts[dow],
    }));
    const max = Math.max(...days.map((d) => d.avg), 0);
    return {
        days: days.map((d) => ({ ...d, index: max > 0 ? d.avg / max : 0, isBest: max > 0 && d.avg === max })),
        enough: counts.filter((c) => c >= 2).length >= 5,
    };
}

/** Days whose clicks sit far from the period average (needs two weeks of data to mean anything). */
export function notableDays(dailyRows, { threshold = 1.8, limit = 2, minDays = 14 } = {}) {
    const rows = (dailyRows || []).filter((r) => r.keys?.[0]);
    if (rows.length < minDays) return { spikes: [], dips: [], enough: false };
    const values = rows.map((r) => num(r.clicks));
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    if (sd === 0) return { spikes: [], dips: [], enough: true };
    const scored = rows.map((r, i) => ({ date: r.keys[0], clicks: values[i], z: (values[i] - mean) / sd, mean }));
    return {
        spikes: scored.filter((d) => d.z >= threshold).sort((a, b) => b.z - a.z).slice(0, limit),
        dips: scored.filter((d) => d.z <= -threshold).sort((a, b) => a.z - b.z).slice(0, limit),
        enough: true,
    };
}

export function median(values) {
    const v = (values || []).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/**
 * Keywords on page two (positions 11 to 20), biggest search volume first: the nearest wins.
 * @param {Array<{ keyword: string, position: number, volume?: number, clicks?: number }>} keywordOverview
 */
export function strikingDistance(keywordOverview, limit = 10) {
    return (keywordOverview || [])
        .filter((r) => r.position != null && r.position > 10 && r.position <= 20)
        .sort((a, b) => num(b.volume) - num(a.volume))
        .slice(0, limit);
}

/**
 * "Snippet gaps": top-10 keywords whose click-through rate trails the site's own median for the
 * same rank band. Compares a keyword with its peers on this site, not with an outside benchmark.
 * The extra-click figure is an estimate (search volume times the CTR gap).
 */
export function snippetGaps(keywordOverview, { limit = 8, minPeers = 3, tolerance = 0.75 } = {}) {
    const rows = (keywordOverview || []).filter(
        (r) => r.position != null && r.position <= 10.5 && Number.isFinite(r.ctr) && num(r.volume) > 0
    );
    const bandMedian = {};
    for (const band of POSITION_BANDS.slice(0, 2)) {
        const inBand = rows.filter((r) => bandForPosition(r.position).id === band.id);
        bandMedian[band.id] = inBand.length >= minPeers ? median(inBand.map((r) => r.ctr)) : null;
    }
    return rows
        .map((r) => {
            const bandId = bandForPosition(r.position).id;
            const peer = bandMedian[bandId];
            if (peer == null || r.ctr >= peer * tolerance) return null;
            return {
                keyword: r.keyword,
                position: r.position,
                volume: r.volume,
                clicks: r.clicks,
                ctr: r.ctr,
                peerCtr: peer,
                bandLabel: bandForPosition(r.position).label,
                extraClicks: Math.round((num(r.volume) * (peer - r.ctr)) / 100),
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.extraClicks - a.extraClicks)
        .slice(0, limit);
}
