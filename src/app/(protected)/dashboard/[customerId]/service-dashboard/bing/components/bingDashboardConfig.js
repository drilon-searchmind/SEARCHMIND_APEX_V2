import {
    FiTrendingUp,
    FiShoppingCart,
    FiEye,
    FiMousePointer,
    FiPercent,
    FiArrowDownRight,
    FiArrowUpRight,
    FiDollarSign,
} from "react-icons/fi";

export const CHART_TOGGLE_ROW1 = [
    { key: "ad_spend", label: "Ad spend", icon: FiTrendingUp },
    { key: "conversions", label: "Conversions", icon: FiShoppingCart },
    { key: "clicks", label: "Clicks", icon: FiMousePointer },
    { key: "impressions", label: "Impressions", icon: FiEye },
];

export const CHART_TOGGLE_ROW2 = [
    { key: "conversion_value", label: "Conversion value", icon: FiDollarSign, isCurrency: true },
    { key: "ctr", label: "CTR", icon: FiPercent, isPercent: true },
    { key: "cpc", label: "CPC", icon: FiArrowDownRight, isCurrency: true, decimals: 2 },
    { key: "cpm", label: "CPM", icon: FiArrowUpRight, isCurrency: true, decimals: 2 },
];

export const METRIC_OPTIONS = [...CHART_TOGGLE_ROW1, ...CHART_TOGGLE_ROW2];

export const CAMPAIGN_TABLE_COLUMNS = [
    { key: "campaign_name", label: "Campaign", align: "left", format: "text" },
    { key: "clicks", label: "Clicks", align: "right", format: "number", heatmap: true },
    { key: "impressions", label: "Impressions", align: "right", format: "number", heatmap: true },
    { key: "conversions", label: "Conversions", align: "right", format: "number", heatmap: true },
    { key: "ctr", label: "CTR", align: "right", format: "percent", heatmap: true },
];
