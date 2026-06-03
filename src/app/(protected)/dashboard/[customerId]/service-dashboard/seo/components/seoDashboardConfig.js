import {
    FiMousePointer,
    FiEye,
    FiDollarSign,
    FiCalendar,
    FiPercent,
    FiTrendingUp,
    FiShoppingCart,
    FiTag,
    FiLink2,
    FiLink,
} from "react-icons/fi";

/** Row 1 — chart toggles (4) */
export const CHART_TOGGLE_ROW1 = [
    { key: "clicks", label: "Clicks", icon: FiMousePointer, row: 1 },
    { key: "impressions", label: "Impressions", icon: FiEye, row: 1 },
    { key: "organic_revenue", label: "Organic Revenue", icon: FiDollarSign, row: 1 },
    { key: "spend_saved", label: "Spend Saved", icon: FiCalendar, row: 1 },
];

/** Row 2 — chart toggles (6) */
export const CHART_TOGGLE_ROW2 = [
    { key: "ctr", label: "CTR", icon: FiPercent, row: 2, isPercent: true },
    { key: "position", label: "Avg. Position", icon: FiTrendingUp, row: 2, decimals: 2 },
    { key: "organic_conversions", label: "Organic Conv.", icon: FiShoppingCart, row: 2 },
    { key: "non_brand_traffic_share", label: "NB Traffic", icon: FiTag, row: 2, isPercent: true },
    { key: "brand_traffic_share", label: "B Traffic", icon: FiTag, row: 2, isPercent: true },
    { key: "backlinks", label: "Backlinks", icon: FiLink2, row: 2 },
];

export const CHART_TOGGLE_METRICS = [...CHART_TOGGLE_ROW1, ...CHART_TOGGLE_ROW2];

/** Row 3 — display only (2 wide cards) */
export const DISPLAY_ONLY_METRICS = [
    { key: "revenue_per_click", label: "Revenue / Click", icon: FiLink },
    { key: "organic_conv_rate", label: "Organic Conv. Rate", icon: FiPercent, row: 3, isPercent: true },
];

/** Metrics that support daily chart series */
export const CHART_SERIES_KEYS = new Set([
    "clicks",
    "impressions",
    "ctr",
    "position",
    "organic_revenue",
    "spend_saved",
    "organic_conversions",
]);
