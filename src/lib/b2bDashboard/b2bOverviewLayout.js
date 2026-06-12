import { B2B_OVERVIEW_KPI_CARD_KEYS } from "./b2bKpiConstants";

/**
 * Four-column B2B overview (mirrors ecommerce standard layout).
 * @param {{ visibleAdSpendChannels: { metricsDataKey: string, label: string }[] }} opts
 */
export function buildB2BStandardOverviewSections({ visibleAdSpendChannels = [] } = {}) {
    const channelRows = visibleAdSpendChannels.map((c) => ({
        key: c.metricsDataKey,
        metricKey: c.metricsDataKey,
        label: `${c.label} spend`,
    }));

    return [
        {
            key: "traffic_engagement",
            title: "Traffic & Engagement",
            primaryKey: "sessions",
            headerSubtitle: "users",
            breakdown: [
                { key: "totalUsers", label: "Users" },
                { key: "newUsers", label: "New Users" },
                { key: "engagedSessions", label: "Engaged Sessions" },
                {
                    key: "engagement_rate_group",
                    metricKey: "engagement_rate",
                    label: "Engagement Rate",
                    collapsible: true,
                    children: [
                        {
                            key: "averageSessionDuration",
                            metricKey: "averageSessionDuration",
                            label: "Avg. Session Duration",
                            nested: true,
                        },
                        {
                            key: "bounce_rate",
                            metricKey: "bounce_rate",
                            label: "Bounce Rate",
                            nested: true,
                            valueType: "pct",
                        },
                    ],
                },
                { key: "screenPageViews", label: "Pageviews" },
                { key: "eventCount", label: "Events" },
            ],
        },
        {
            key: "conversions_goals",
            title: "Conversions & Goals",
            primaryKey: "conversions",
            headerSubtitle: "conversion_rate",
            ga4ConversionSettings: true,
            breakdown: [
                {
                    key: "conversion_rate",
                    metricKey: "conversion_rate",
                    label: "Conversion Rate",
                    valueType: "pct",
                },
                {
                    key: "sessions_per_conversion",
                    metricKey: "sessions_per_conversion",
                    label: "Sessions per Lead",
                },
                {
                    key: "cost_per_lead",
                    metricKey: "cost_per_lead",
                    label: "Cost per Lead (CPL)",
                },
                {
                    key: "leads_per_1k_spend",
                    metricKey: "leads_per_1k_spend",
                    label: "Leads per 1k Spend",
                },
            ],
        },
        {
            key: "marketing_spend",
            title: "Marketing Spend",
            primaryKey: "marketing_spend",
            headerSubtitle: "cost_per_session",
            breakdown: [
                ...channelRows,
                { key: "marketing_spend", label: "Total Ad Spend" },
                {
                    key: "cost_per_session",
                    metricKey: "cost_per_session",
                    label: "Cost per Session",
                },
            ],
        },
        {
            key: "efficiency",
            title: "Efficiency",
            primaryKey: "cost_per_lead",
            breakdown: [
                {
                    key: "cost_per_session",
                    metricKey: "cost_per_session",
                    label: "Cost per Session",
                },
                {
                    key: "conversion_rate",
                    metricKey: "conversion_rate",
                    label: "Conversion Rate",
                    valueType: "pct",
                },
                {
                    key: "leads_per_1k_spend",
                    metricKey: "leads_per_1k_spend",
                    label: "Leads per 1k Spend",
                },
                {
                    key: "sessions_per_conversion",
                    metricKey: "sessions_per_conversion",
                    label: "Sessions per Lead",
                },
            ],
        },
    ];
}

export function getB2BOverviewKpiCardKeys(sections) {
    const primaryKeys = new Set(
        (sections || []).map((s) => s.primaryKey).filter(Boolean)
    );
    return B2B_OVERVIEW_KPI_CARD_KEYS.filter((k) => !primaryKeys.has(k));
}
