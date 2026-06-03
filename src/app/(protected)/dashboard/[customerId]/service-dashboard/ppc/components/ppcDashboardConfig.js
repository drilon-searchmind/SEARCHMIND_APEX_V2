import {
    FiDollarSign,
    FiBarChart2,
    FiShoppingCart,
    FiEye,
    FiMousePointer,
    FiPercent,
    FiArrowDownRight,
    FiUsers,
    FiTarget,
    FiAward,
} from "react-icons/fi";

export const CHART_TOGGLE_METRICS = [
    { key: "ad_spend", label: "Spend", icon: FiDollarSign, row: 1 },
    { key: "clicks", label: "Clicks", icon: FiMousePointer, row: 1 },
    { key: "conversions", label: "Conversions", icon: FiShoppingCart, row: 1 },
    { key: "conversions_value", label: "Revenue", icon: FiDollarSign, row: 1 },
    { key: "impressions", label: "Impressions", icon: FiEye, row: 2 },
    { key: "roas", label: "ROAS", icon: FiBarChart2, row: 2 },
    { key: "cpc", label: "CPC", icon: FiArrowDownRight, row: 2 },
    { key: "conv_rate", label: "Conv. Rate", icon: FiPercent, row: 2, isPercent: true },
    { key: "cpa", label: "CPA", icon: FiTarget, row: 2 },
];

export const DISPLAY_ONLY_METRICS = [
    { key: "new_customer_ratio", label: "New Customer Ratio", icon: FiUsers, isPercent: true },
    { key: "recurring_customer_ratio", label: "Recurring Customer Ratio", icon: FiUsers, isPercent: true },
];

export const IMPRESSION_SHARE_METRICS = [
    { key: "impression_share", label: "Impression Share", icon: FiAward, isPercent: true },
    { key: "is_lost_budget", label: "IS Lost (Budget)", icon: FiDollarSign, isPercent: true },
    { key: "is_lost_rank", label: "IS Lost (Rank)", icon: FiTarget, isPercent: true },
];

export const TERM_TABLE_COLUMNS = [
    { key: "search_term", label: "Søgeterm", align: "left", format: "text" },
    { key: "campaign_name", label: "Kampagne", align: "left", format: "text" },
    { key: "spend", label: "Spend", align: "right", format: "money", heatmap: true },
    { key: "clicks", label: "Clicks", align: "right", format: "number", heatmap: true },
    { key: "impressions", label: "Impressions", align: "right", format: "number", heatmap: true },
    { key: "revenue", label: "Revenue", align: "right", format: "money", heatmap: true },
    { key: "roas", label: "ROAS", align: "right", format: "roas", heatmap: true },
];

export const CAMPAIGN_TABLE_COLUMNS = [
    { key: "campaign_name", label: "Kampagne", align: "left", format: "text" },
    { key: "ad_spend", label: "Spend", align: "right", format: "money", heatmap: true },
    { key: "conversions", label: "Conv.", align: "right", format: "number", heatmap: true },
    { key: "conversions_value", label: "Revenue", align: "right", format: "money", heatmap: true },
    { key: "cpa", label: "CPA", align: "right", format: "money", heatmap: true, heatmapInvert: true },
    { key: "roas", label: "ROAS", align: "right", format: "roas", heatmap: true },
];
