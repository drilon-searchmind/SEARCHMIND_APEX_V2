import { formatCurrency } from "./utils";

export const B2B_METRIC_COLUMNS = [
    { key: "sessions", label: "Sessions", group: "traffic" },
    { key: "totalUsers", label: "Users", group: "traffic" },
    { key: "newUsers", label: "New Users", group: "traffic" },
    { key: "engagedSessions", label: "Engaged Sessions", group: "engagement" },
    { key: "engagementRate", label: "Engagement Rate", group: "engagement", format: "percent" },
    { key: "averageSessionDuration", label: "Avg. Duration", group: "engagement", format: "duration" },
    { key: "conversions", label: "Conversions", group: "engagement" },
    { key: "eventCount", label: "Events", group: "engagement" },
    { key: "bounceRate", label: "Bounce Rate", group: "engagement", format: "percent" },
    { key: "ppcCost", label: "Google Ads", group: "marketing", format: "currency" },
    { key: "psCost", label: "Meta Ads", group: "marketing", format: "currency" },
    { key: "pinterestCost", label: "Pinterest", group: "marketing", format: "currency" },
    { key: "snapchatCost", label: "Snapchat", group: "marketing", format: "currency" },
    { key: "bingCost", label: "Microsoft Ads", group: "marketing", format: "currency" },
    { key: "redditCost", label: "Reddit", group: "marketing", format: "currency" },
    { key: "totalMarketingSpend", label: "Total Ad Spend", group: "marketing", format: "currency" },
    { key: "costPerSession", label: "Cost / Session", group: "efficiency", format: "currency" },
    { key: "costPerConversion", label: "Cost / Conversion", group: "efficiency", format: "currency" },
];

export const DEFAULT_B2B_VISIBLE_METRICS = [
    "sessions",
    "totalUsers",
    "conversions",
    "engagementRate",
    "ppcCost",
    "psCost",
    "totalMarketingSpend",
    "costPerSession",
];

export function formatB2BCellValue(key, value, column) {
    const col = column || B2B_METRIC_COLUMNS.find((c) => c.key === key);
    const format = col?.format;
    const num = Number(value) || 0;

    if (format === "percent") {
        const pct = num <= 1 ? num * 100 : num;
        return `${pct.toFixed(1)}%`;
    }
    if (format === "duration") {
        const m = Math.floor(num / 60);
        const s = Math.floor(num % 60);
        return `${m}:${String(s).padStart(2, "0")}`;
    }
    if (format === "currency") {
        return formatCurrency(num, { maximumFractionDigits: 0 });
    }
    return num.toLocaleString("da-DK", { maximumFractionDigits: 0 });
}
