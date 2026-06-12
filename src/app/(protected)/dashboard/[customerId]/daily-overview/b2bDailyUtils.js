import { formatCurrency, getCellStyles } from "./utils";
import { B2B_METRIC_COLUMNS, formatB2BCellValue } from "./b2bMetricConfig";

export const B2B_GROUP_LABELS = {
    traffic: "Traffic",
    engagement: "Engagement",
    marketing: "Marketing",
    efficiency: "Efficiency",
};

export const B2B_HEATMAP_KEYS = new Set([
    "sessions",
    "totalUsers",
    "newUsers",
    "engagedSessions",
    "conversions",
    "eventCount",
    "ppcCost",
    "psCost",
    "pinterestCost",
    "snapchatCost",
    "bingCost",
    "redditCost",
    "totalMarketingSpend",
]);

const B2B_HIGHER_IS_BETTER = new Set([
    "sessions",
    "totalUsers",
    "newUsers",
    "engagedSessions",
    "conversions",
    "eventCount",
    "engagementRate",
]);

export function getB2BVisibleColumns(metricColumns, visibleMetrics) {
    return metricColumns.filter((m) => visibleMetrics[m.key]);
}

export function getB2BBorderLClass(visibleCols, key) {
    const idx = visibleCols.findIndex((m) => m.key === key);
    const col = visibleCols[idx];
    if (!col || idx < 0) return "";
    const prevInGroup = visibleCols.slice(0, idx).filter((p) => p.group === col.group);
    const isFirst = idx === 0;
    const isFirstInGroup = prevInGroup.length === 0;
    if (isFirst || (isFirstInGroup && col.group !== "traffic")) {
        return " border-l border-gray-200";
    }
    return "";
}

export function computeB2BRowMax(rows) {
    if (!rows?.length) return {};
    const max = {};
    for (const key of B2B_HEATMAP_KEYS) {
        max[key] = Math.max(...rows.map((r) => Number(r[key]) || 0));
    }
    return max;
}

export function computeB2BRawTotals(rows) {
    if (!rows?.length) {
        return Object.fromEntries(
            B2B_METRIC_COLUMNS.map((c) => [c.key, 0])
        );
    }

    const sum = (key) => rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
    const totalSessions = sum("sessions");
    const totalConversions = sum("conversions");
    const totalSpend = sum("totalMarketingSpend");

    const totals = {};
    for (const col of B2B_METRIC_COLUMNS) {
        if (col.key === "engagementRate") {
            const weighted = rows.reduce(
                (acc, r) => acc + (Number(r.engagementRate) || 0) * (Number(r.sessions) || 0),
                0
            );
            totals.engagementRate =
                totalSessions > 0 ? weighted / totalSessions : 0;
        } else if (col.key === "bounceRate") {
            const weighted = rows.reduce(
                (acc, r) => acc + (Number(r.bounceRate) || 0) * (Number(r.sessions) || 0),
                0
            );
            totals.bounceRate = totalSessions > 0 ? weighted / totalSessions : 0;
        } else if (col.key === "averageSessionDuration") {
            const weighted = rows.reduce(
                (acc, r) =>
                    acc + (Number(r.averageSessionDuration) || 0) * (Number(r.sessions) || 0),
                0
            );
            totals.averageSessionDuration =
                totalSessions > 0 ? weighted / totalSessions : 0;
        } else if (col.key === "costPerSession") {
            totals.costPerSession = totalSessions > 0 ? totalSpend / totalSessions : 0;
        } else if (col.key === "costPerConversion") {
            totals.costPerConversion =
                totalConversions > 0 ? totalSpend / totalConversions : 0;
        } else {
            totals[col.key] = sum(col.key);
        }
    }
    return totals;
}

export function formatB2BTotalValue(key, value, column) {
    const col = column || B2B_METRIC_COLUMNS.find((c) => c.key === key);
    if (col?.format === "currency" || key === "totalMarketingSpend" || key.endsWith("Cost")) {
        return formatCurrency(value, { maximumFractionDigits: 0 });
    }
    return formatB2BCellValue(key, value, col);
}

export function computeB2BTotals(rows) {
    const raw = computeB2BRawTotals(rows);
    const formatted = {};
    for (const col of B2B_METRIC_COLUMNS) {
        formatted[col.key] = formatB2BTotalValue(col.key, raw[col.key], col);
    }
    return formatted;
}

export function computeB2BDifference(rows, rowsPrev) {
    const curr = computeB2BRawTotals(rows);
    const prev = computeB2BRawTotals(rowsPrev || []);
    const result = {};

    for (const col of B2B_METRIC_COLUMNS) {
        const key = col.key;
        const diff = (curr[key] ?? 0) - (prev[key] ?? 0);
        const higherIsBetter = B2B_HIGHER_IS_BETTER.has(key);
        const isGood = diff === 0 ? null : higherIsBetter ? diff > 0 : diff < 0;

        let formatted;
        if (col.format === "percent" || key === "engagementRate" || key === "bounceRate") {
            const displayDiff = diff <= 1 && Math.abs(diff) < 1 ? diff * 100 : diff;
            formatted =
                displayDiff >= 0
                    ? `+${displayDiff.toFixed(1)}%`
                    : `${displayDiff.toFixed(1)}%`;
        } else if (col.format === "duration" || key === "averageSessionDuration") {
            formatted = diff >= 0 ? `+${Math.round(diff)}s` : `${Math.round(diff)}s`;
        } else if (col.format === "currency" || key.endsWith("Cost") || key === "totalMarketingSpend") {
            formatted =
                diff >= 0
                    ? `+${formatCurrency(diff, { maximumFractionDigits: 0 })}`
                    : formatCurrency(diff, { maximumFractionDigits: 0 });
        } else if (key === "costPerSession" || key === "costPerConversion") {
            formatted =
                diff >= 0
                    ? `+${formatCurrency(diff, { maximumFractionDigits: 0 })}`
                    : formatCurrency(diff, { maximumFractionDigits: 0 });
        } else {
            formatted = diff >= 0 ? `+${Math.round(diff)}` : `${Math.round(diff)}`;
        }

        result[key] = { diff, formatted, isGood };
    }
    return result;
}

export function computeB2BIndex(rows, rowsPrev) {
    const curr = computeB2BRawTotals(rows);
    const prev = computeB2BRawTotals(rowsPrev || []);
    const result = {};

    for (const col of B2B_METRIC_COLUMNS) {
        const key = col.key;
        const p = prev[key];
        if (p === 0 || p == null) {
            result[key] = { index: null, formatted: "-", isGood: null };
            continue;
        }
        const index = (curr[key] / p) * 100;
        const higherIsBetter = B2B_HIGHER_IS_BETTER.has(key);
        const isGood = index === 100 ? null : higherIsBetter ? index > 100 : index < 100;
        result[key] = {
            index,
            formatted: Math.round(index).toString(),
            isGood,
        };
    }
    return result;
}

export function getB2BCellStyle(key, value, max) {
    if (!B2B_HEATMAP_KEYS.has(key)) return {};
    const num = Number(value) || 0;
    const maxVal = max[key] ?? 0;
    return getCellStyles(num, maxVal, num === maxVal);
}
