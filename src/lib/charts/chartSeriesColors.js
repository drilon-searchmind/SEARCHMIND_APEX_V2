/**
 * Distinct series colors for dashboard charts (lines, bars, areas, donuts).
 * Shared with Share of Search — avoids brand teal/lime pairs that are hard to tell apart.
 */

export const CHART_SERIES_PALETTE = [
    "#2563eb",
    "#dc2626",
    "#16a34a",
    "#9333ea",
    "#ea580c",
    "#0891b2",
    "#ca8a04",
    "#db2777",
    "#4f46e5",
    "#0d9488",
    "#b45309",
    "#7c3aed",
    "#059669",
    "#e11d48",
    "#0284c7",
    "#65a30d",
    "#c026d3",
    "#d97706",
    "#6366f1",
    "#14b8a6",
];

/**
 * @param {number} index
 */
export function chartSeriesColor(index) {
    const i = Number(index);
    if (!Number.isFinite(i) || i < 0) return CHART_SERIES_PALETTE[0];
    return CHART_SERIES_PALETTE[i % CHART_SERIES_PALETTE.length];
}

/**
 * @param {string} hex #RRGGBB
 * @param {number} alpha 0–1
 */
export function hexWithAlpha(hex, alpha) {
    const raw = String(hex || "").replace("#", "");
    if (raw.length !== 6) return hex;
    const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${raw}${a}`;
}

/**
 * Muted variant for comparison / prior-period series (same hue, lower opacity).
 * @param {number} index
 */
export function chartComparisonColor(index) {
    return hexWithAlpha(chartSeriesColor(index), 0.45);
}

/**
 * @param {number} [count] defaults to full palette length
 */
export function getChartSeriesPalette(count = CHART_SERIES_PALETTE.length) {
    const n = Math.max(1, Number(count) || CHART_SERIES_PALETTE.length);
    return Array.from({ length: n }, (_, i) => chartSeriesColor(i));
}

/**
 * Colors for series named "Metric (Current)" + "Metric (LY)" pairs.
 * @param {{ name?: string }[]} series
 * @param {{ isCurrentSeries?: (s: { name?: string }) => boolean }} [opts]
 */
export function colorsForCurrentComparisonSeries(
    series,
    { isCurrentSeries = (s) => String(s?.name || "").includes("(Current)") } = {}
) {
    /** @type {string[]} */
    const colors = [];
    let metricIndex = 0;
    for (const s of series || []) {
        if (isCurrentSeries(s)) {
            colors.push(chartSeriesColor(metricIndex));
            metricIndex += 1;
        } else {
            colors.push(chartComparisonColor(Math.max(0, metricIndex - 1)));
        }
    }
    return colors;
}
