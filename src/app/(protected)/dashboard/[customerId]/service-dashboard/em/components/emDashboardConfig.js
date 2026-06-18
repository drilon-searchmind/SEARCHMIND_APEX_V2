import {
    FiMail,
    FiMousePointer,
    FiTrendingUp,
    FiDollarSign,
    FiSend,
    FiUserX,
} from "react-icons/fi";

export const KPI_ROW1 = [
    { key: "revenue", label: "Revenue", icon: FiDollarSign },
    { key: "conversions", label: "Conversions", icon: FiTrendingUp },
    { key: "emails_sent", label: "Emails sent", icon: FiSend },
    { key: "opens", label: "Opens", icon: FiMail },
];

export const KPI_ROW2 = [
    { key: "open_rate", label: "Open rate", icon: FiMail, isRate: true },
    { key: "click_rate", label: "Click rate", icon: FiMousePointer, isRate: true },
    { key: "clicks", label: "Clicks", icon: FiMousePointer },
    { key: "unsubscribes", label: "Unsubscribes", icon: FiUserX },
];

export const METRIC_OPTIONS = [...KPI_ROW1, ...KPI_ROW2];

export const CAMPAIGN_TABLE_COLUMNS = [
    { key: "campaign_name", label: "Campaign", align: "left", format: "text" },
    { key: "opens", label: "Opens", align: "right", format: "number", heatmap: true },
    { key: "clicks", label: "Clicks", align: "right", format: "number", heatmap: true },
    { key: "open_rate", label: "Open rate", align: "right", format: "percent", heatmap: true },
    { key: "click_rate", label: "Click rate", align: "right", format: "percent", heatmap: true },
];
