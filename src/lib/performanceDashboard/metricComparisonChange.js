/**
 * Period-over-period % change display (green = positive, red = negative).
 */

/** Explicit keys where a higher value vs prior period is worse. */
export const LOWER_IS_BETTER_METRIC_KEYS = new Set([
    "cogs",
    "cogs_pct_total_sales",
    "pick_pack",
    "shipping_cost",
    "shipping_cost_pct_total_sales",
    "transaction_fee",
    "returns_cost",
    "total_order_costs",
    "cost",
    "marketing_spend",
    "meta_spend",
    "google_spend",
    "pinterest_spend",
    "snapchat_spend",
    "bing_spend",
    "reddit_spend",
    "ad_spend_pct_total_sales",
    "variable_costs",
    "total_expenses",
    "fixed_costs",
    "spendshare",
    "cac",
]);

/**
 * @param {string | undefined} metricKey
 */
export function isLowerIsBetterMetricKey(metricKey) {
    if (!metricKey) return false;
    if (LOWER_IS_BETTER_METRIC_KEYS.has(metricKey)) return true;
    if (metricKey.endsWith("_spend")) return true;
    if (/^fixed_(bureau|tooling|other)_\d+$/.test(metricKey)) return true;
    return false;
}

/**
 * @param {number | null | undefined} current
 * @param {number | null | undefined} prev
 */
export function percentChange(current, prev) {
    if (prev === 0 || prev === null || prev === undefined) return null;
    return ((current - prev) / Math.abs(prev)) * 100;
}

/**
 * Signed % string for MetricCard badges (e.g. "-17" or "12.5").
 * @param {number | null | undefined} pct — from percentChange()
 * @param {number} [decimals=0]
 */
export function formatPercentChangeDisplay(pct, decimals = 0) {
    if (pct === null || pct === undefined) return undefined;
    return pct.toFixed(decimals);
}

/**
 * UI change direction for MetricCard badges (`up` = green, `down` = red).
 * @param {string | undefined} _metricKey — kept for call-site compatibility
 * @param {number | null | undefined} pct — from percentChange()
 */
export function changeTypeForMetric(_metricKey, pct) {
    if (pct === null || pct === undefined || pct === 0) return undefined;
    return pct > 0 ? "up" : "down";
}
