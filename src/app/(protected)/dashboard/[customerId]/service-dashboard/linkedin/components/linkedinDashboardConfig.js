import {
    FiTrendingUp,
    FiShoppingCart,
    FiEye,
    FiMousePointer,
    FiPercent,
    FiArrowDownRight,
    FiArrowUpRight,
    FiUserPlus,
} from "react-icons/fi";

export const CHART_TOGGLE_ROW1 = [
    { key: "ad_spend", label: "Ad spend", icon: FiTrendingUp },
    { key: "conversions", label: "Conversions", icon: FiShoppingCart },
    { key: "clicks", label: "Clicks", icon: FiMousePointer },
];

export const CHART_TOGGLE_ROW2 = [
    { key: "impressions", label: "Impressions", icon: FiEye },
    { key: "leads", label: "Leads", icon: FiUserPlus },
];

export const CHART_TOGGLE_ROW3 = [
    { key: "ctr", label: "CTR", icon: FiPercent, isPercent: true },
    { key: "cpc", label: "CPC", icon: FiArrowDownRight, isCurrency: true, decimals: 2 },
    { key: "cpm", label: "CPM", icon: FiArrowUpRight, isCurrency: true, decimals: 2 },
];

export const METRIC_OPTIONS = [...CHART_TOGGLE_ROW1, ...CHART_TOGGLE_ROW2, ...CHART_TOGGLE_ROW3];

export const CAMPAIGN_TABLE_COLUMNS = [
    { key: "campaign_name", label: "Campaign", align: "left", format: "text" },
    { key: "clicks", label: "Clicks", align: "right", format: "number", heatmap: true },
    { key: "impressions", label: "Impressions", align: "right", format: "number", heatmap: true },
    { key: "leads", label: "Leads", align: "right", format: "number", heatmap: true },
    { key: "ctr", label: "CTR", align: "right", format: "percent", heatmap: true },
];
