import {
    FiDollarSign,
    FiBarChart2,
    FiShoppingCart,
    FiEye,
    FiMousePointer,
    FiPercent,
    FiArrowDownRight,
    FiUsers,
    FiHeart,
    FiTarget,
} from "react-icons/fi";

/** KPI cards that toggle the spend-over-time chart */
export const CHART_TOGGLE_METRICS = [
    { key: "ad_spend", label: "Spend", icon: FiDollarSign, row: 1 },
    { key: "link_clicks", label: "Link clicks", icon: FiMousePointer, row: 1 },
    { key: "conversions", label: "Conversions", icon: FiShoppingCart, row: 1 },
    { key: "conversion_value", label: "Revenue", icon: FiDollarSign, row: 1 },
    { key: "impressions", label: "Impressions", icon: FiEye, row: 2 },
    { key: "roas", label: "ROAS", icon: FiBarChart2, row: 2 },
    { key: "cpm", label: "CPM", icon: FiEye, row: 2 },
    { key: "cpc", label: "CPC", icon: FiArrowDownRight, row: 2 },
    { key: "conv_rate", label: "Conv. Rate", icon: FiPercent, row: 2, isPercent: true },
    { key: "cpa", label: "CPA", icon: FiTarget, row: 2 },
];

export const DISPLAY_ONLY_METRICS = [
    { key: "new_customer_ratio", label: "New Customer Ratio", icon: FiUsers, isPercent: true, suffix: "% ads revenue" },
    { key: "recurring_customer_ratio", label: "Recurring Customer Ratio", icon: FiUsers, isPercent: true, suffix: "% ads revenue" },
    { key: "reach", label: "Reach", icon: FiUsers },
    { key: "frequency", label: "Frequency", icon: FiUsers, decimals: 2 },
    { key: "engagement_rate", label: "Engagement Rate", icon: FiHeart, isPercent: true },
];

export const CREATIVE_TABLE_COLUMNS = [
    { key: "creative", label: "Creative", align: "left", format: "text" },
    { key: "spend", label: "Spend", align: "right", format: "money", heatmap: true },
    { key: "clicks", label: "Clicks", align: "right", format: "number", heatmap: true },
    { key: "impressions", label: "Impressions", align: "right", format: "number", heatmap: true },
    { key: "cpm", label: "CPM", align: "right", format: "money", heatmap: true },
    { key: "ctr", label: "CTR", align: "right", format: "percent", heatmap: true },
    { key: "conversions", label: "Conversions", align: "right", format: "number", heatmap: true },
    { key: "revenue", label: "Revenue", align: "right", format: "money", heatmap: true },
    { key: "frequency", label: "Frequency", align: "right", format: "number" },
    { key: "roas", label: "ROAS", align: "right", format: "roas", heatmap: true },
];

export const PLACEMENT_TABLE_COLUMNS = [
    { key: "placement", label: "Placement", align: "left", format: "text" },
    { key: "ad_spend", label: "Spend", align: "right", format: "money", heatmap: true },
    { key: "impressions", label: "Impressions", align: "right", format: "number", heatmap: true },
    { key: "cpm", label: "CPM", align: "right", format: "money", heatmap: true },
    { key: "ctr", label: "CTR", align: "right", format: "percent", heatmap: true },
    { key: "conversions", label: "Conversions", align: "right", format: "number", heatmap: true },
    { key: "frequency", label: "Frequency", align: "right", format: "number" },
    { key: "cpa", label: "CPA", align: "right", format: "money", heatmap: true, heatmapInvert: true },
    { key: "roas", label: "ROAS", align: "right", format: "roas", heatmap: true },
];

export const CAMPAIGN_TABLE_COLUMNS = [
    { key: "campaign_name", label: "Kampagne", align: "left", format: "text" },
    { key: "ad_spend", label: "Spend", align: "right", format: "money", heatmap: true },
    { key: "conversions", label: "Conversions", align: "right", format: "number", heatmap: true },
    { key: "frequency", label: "Frequency", align: "right", format: "number" },
    { key: "cpm", label: "CPM", align: "right", format: "money", heatmap: true },
    { key: "cpa", label: "CPA", align: "right", format: "money", heatmap: true, heatmapInvert: true },
    { key: "roas", label: "ROAS", align: "right", format: "roas", heatmap: true },
];
