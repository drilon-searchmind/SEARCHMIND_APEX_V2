/** B2B overview metrics available in custom KPI formulas. */
export const B2B_METRIC_DEFS = [
    { key: "sessions", label: "Sessions" },
    { key: "totalUsers", label: "Users" },
    { key: "newUsers", label: "New Users" },
    { key: "engagedSessions", label: "Engaged Sessions" },
    { key: "engagementRate", label: "Engagement Rate" },
    { key: "averageSessionDuration", label: "Avg. Session Duration" },
    { key: "bounceRate", label: "Bounce Rate" },
    { key: "screenPageViews", label: "Pageviews" },
    { key: "eventCount", label: "Events" },
    { key: "conversions", label: "Conversions / Leads" },
    { key: "conversion_rate", label: "Conversion Rate" },
    { key: "cost", label: "Marketing Spend" },
    { key: "marketing_spend", label: "Total Ad Spend" },
    { key: "meta_spend", label: "Meta spend" },
    { key: "google_spend", label: "Google Ads spend" },
    { key: "pinterest_spend", label: "Pinterest spend" },
    { key: "snapchat_spend", label: "Snapchat spend" },
    { key: "bing_spend", label: "Microsoft Ads spend" },
    { key: "reddit_spend", label: "Reddit spend" },
    { key: "cost_per_session", label: "Cost per Session" },
    { key: "cost_per_lead", label: "Cost per Lead (CPL)" },
    { key: "leads_per_1k_spend", label: "Leads per 1k Spend" },
    { key: "sessions_per_conversion", label: "Sessions per Lead" },
];

export const B2B_REPLACEABLE_STANDARD_METRICS = [
    { key: "sessions", label: "Sessions (traffic column)" },
    { key: "conversions", label: "Conversions (goals column)" },
    { key: "marketing_spend", label: "Total Ad Spend" },
    { key: "cost_per_lead", label: "Cost per Lead" },
    { key: "cost_per_session", label: "Cost per Session" },
    { key: "conversion_rate", label: "Conversion Rate" },
];

export const B2B_REPLACEABLE_STANDARD_METRIC_KEYS = new Set(
    B2B_REPLACEABLE_STANDARD_METRICS.map((m) => m.key)
);

/** KPI cards below the chart — excludes only the four column primary metrics. */
export const B2B_OVERVIEW_KPI_CARD_KEYS = [
    "totalUsers",
    "newUsers",
    "engagedSessions",
    "engagement_rate",
    "averageSessionDuration",
    "bounce_rate",
    "screenPageViews",
    "eventCount",
    "conversion_rate",
    "cost_per_lead",
    "cost_per_session",
    "sessions_per_conversion",
    "leads_per_1k_spend",
    "marketing_spend",
    "meta_spend",
    "google_spend",
    "pinterest_spend",
    "snapchat_spend",
    "bing_spend",
    "reddit_spend",
];

export const B2B_CHART_METRIC_OPTIONS = [
    { key: "sessions", label: "Sessions" },
    { key: "totalUsers", label: "Users" },
    { key: "newUsers", label: "New Users" },
    { key: "conversions", label: "Conversions" },
    { key: "engagedSessions", label: "Engaged Sessions" },
    { key: "engagement_rate", label: "Engagement Rate" },
    { key: "screenPageViews", label: "Pageviews" },
    { key: "eventCount", label: "Events" },
    { key: "cost", label: "Marketing Spend" },
    { key: "meta_spend", label: "Meta Spend" },
    { key: "google_spend", label: "Google Spend" },
    { key: "cost_per_lead", label: "Cost per Lead" },
    { key: "cost_per_session", label: "Cost per Session" },
    { key: "conversion_rate", label: "Conversion Rate" },
    { key: "leads_per_1k_spend", label: "Leads per 1k Spend" },
];

export const B2B_RATIO_KEYS = new Set([
    "engagementRate",
    "engagement_rate",
    "bounceRate",
    "bounce_rate",
    "conversion_rate",
    "leads_per_1k_spend",
    "sessions_per_conversion",
]);

export const B2B_CURRENCY_KEYS = new Set([
    "cost",
    "marketing_spend",
    "meta_spend",
    "google_spend",
    "pinterest_spend",
    "snapchat_spend",
    "bing_spend",
    "reddit_spend",
    "cost_per_session",
    "cost_per_lead",
]);

export const B2B_PCT_KEYS = new Set(["engagement_rate", "conversion_rate", "bounce_rate"]);
