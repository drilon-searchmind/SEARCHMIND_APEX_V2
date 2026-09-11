export const PERFORMANCE_BRIEF_PLATFORMS = ["meta", "google-ads"];

export const PERFORMANCE_BRIEF_PLATFORM_LABELS = {
    meta: "Meta",
    "google-ads": "Google Ads",
};

export const PERFORMANCE_BRIEF_PLATFORM_WARNING_KEYS = {
    meta: "ps",
    "google-ads": "ppc",
};

export const PERFORMANCE_BRIEF_CONFIG_WARNING_TITLE =
    "Integration not configured for this customer (check Config or set a valid ID — not empty, 0, or 1)";

export function isPerformanceBriefCustomerId(value) {
    return /^[a-fA-F0-9]{24}$/.test(String(value || "").trim());
}

const PERFORMANCE_BRIEF_APP_BASE =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL) ||
    "https://apex.searchmind.tech";

export function performanceBriefCustomerSettingsUrl(customerId) {
    const id = String(customerId || "").trim();
    if (!isPerformanceBriefCustomerId(id)) return "";
    return `${String(PERFORMANCE_BRIEF_APP_BASE).replace(/\/$/, "")}/apex-radar/performance-brief/${id}`;
}

export const SLACK_LIGHT = {
    green: ":large_green_circle:",
    yellow: ":large_yellow_circle:",
    red: ":red_circle:",
};

export const SLACK_LIGHT_EMOJI = {
    green: "🟢",
    yellow: "🟡",
    red: "🔴",
};
