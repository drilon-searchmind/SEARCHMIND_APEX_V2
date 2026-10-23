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
 * Commerce dashboard categorical sequence (DESIGN.md · Chart palette).
 * Ink first, then greens from dark to mint, then sage neutrals.
 */
export const COMMERCE_CHART_PALETTE = [
    "#111A12",
    "#2F8434",
    "#5DBB58",
    "#A9EDA2",
    "#7D877D",
    "#C5CFC4",
    "#3F4C40",
    "#DDF2D8",
];

/**
 * Metric comparison lines (overview chart): high-contrast hues kept away from the brand
 * greens so several selected metrics stay easy to tell apart. Comparison series reuse
 * the same hue at 45% opacity, dashed.
 */
export const METRIC_CHART_PALETTE = [
    "#2563EB", // blue
    "#EA580C", // orange
    "#7C3AED", // violet
    "#DB2777", // pink
    "#0891B2", // cyan
    "#CA8A04", // amber
    "#475569", // slate
    "#DC2626", // red
];

/** Axis, grid and label colours for ApexCharts on commerce pages. */
export const COMMERCE_CHART_CHROME = {
    axisLabel: "#859085",
    grid: "#E0E7DE",
    legend: "#4C564D",
    fontFamily: "'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif",
};

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
 * @param {{ isCurrentSeries?: (s: { name?: string }) => boolean, palette?: string[] }} [opts]
 */
export function colorsForCurrentComparisonSeries(
    series,
    {
        isCurrentSeries = (s) => String(s?.name || "").includes("(Current)"),
        palette = CHART_SERIES_PALETTE,
    } = {}
) {
    const colorAt = (i) => palette[i % palette.length];
    /** @type {string[]} */
    const colors = [];
    let metricIndex = 0;
    for (const s of series || []) {
        if (isCurrentSeries(s)) {
            colors.push(colorAt(metricIndex));
            metricIndex += 1;
        } else {
            colors.push(hexWithAlpha(colorAt(Math.max(0, metricIndex - 1)), 0.45));
        }
    }
    return colors;
}
