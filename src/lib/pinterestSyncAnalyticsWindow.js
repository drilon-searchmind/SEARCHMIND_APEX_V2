/**
 * Pinterest Marketing API sync analytics (`/ad_accounts/.../analytics`) only allows
 * data from the last 90 days (UTC). Older ranges must use the async Reports API.
 */

export function utcTodayYmd() {
    return new Date().toISOString().slice(0, 10);
}

/** Earliest start/end date (inclusive) allowed for sync analytics, YYYY-MM-DD UTC. */
export function earliestAllowedPinterestSyncAnalyticsDateYmd() {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - 90);
    return d.toISOString().slice(0, 10);
}

/**
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 */
export function isPinterestSyncAnalyticsRangeAllowed(startDate, endDate) {
    const sd = String(startDate).slice(0, 10);
    const ed = String(endDate).slice(0, 10);
    const earliest = earliestAllowedPinterestSyncAnalyticsDateYmd();
    return sd >= earliest && ed >= earliest;
}
