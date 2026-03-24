/**
 * Filter and icon options for Our Tools (data lives in MongoDB via /api/our-tools).
 */
export const TOOL_CATEGORIES = [
    { id: "all", label: "All Tools" },
    { id: "analytics", label: "Analytics & Reporting" },
    { id: "collaboration", label: "Collaboration" },
    { id: "design", label: "Design" },
    { id: "productivity", label: "Productivity" },
    { id: "ppc", label: "PPC" },
    { id: "ps", label: "PS" },
    { id: "seo", label: "SEO" },
    { id: "em", label: "EM" },
];

export const TOOL_CATEGORY_FILTER_OPTIONS = TOOL_CATEGORIES.filter(
    (c) => c.id !== "all"
);

export const TOOL_ICON_OPTIONS = [
    { value: "FiTrendingUp", label: "Trending" },
    { value: "FiActivity", label: "Activity" },
    { value: "FiBarChart2", label: "Bar chart" },
    { value: "FiGrid", label: "Grid" },
    { value: "FiUsers", label: "Users" },
    { value: "FiImage", label: "Image" },
    { value: "FiFileText", label: "Document" },
    { value: "FiClock", label: "Clock" },
    { value: "FiLayers", label: "Layers" },
    { value: "FiSearch", label: "Search" },
];
