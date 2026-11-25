/**
 * Per-customer sidebar section visibility (Config → Sidebar).
 * Only applied when custom dashboards are enabled; otherwise all sections show as usual.
 */

export const SIDEBAR_NAV_SECTIONS = [
    {
        key: "dashboard",
        label: "Dashboard",
        description: "Overview, Daily, Pace Report, P&L, Ecommerce / Analytics, Markets",
    },
    {
        key: "serviceDashboard",
        label: "Service Dashboard",
        description: "SEO, PPC, PS, Pinterest, LinkedIn, Snapchat, Reddit, Bing, Email",
    },
    {
        key: "custom",
        label: "Custom",
        description: "Hardcoded custom dashboards (e.g. Aura Performance, Pace, …)",
    },
    {
        key: "misc",
        label: "Misc",
        description: "Campaign Planner, Share of Search, Price Index (Config stays in the menu either way)",
    },
];

export const DEFAULT_SIDEBAR_NAV_VISIBILITY = {
    dashboard: true,
    serviceDashboard: true,
    custom: true,
    misc: true,
};

/**
 * @param {unknown} raw
 * @returns {{ dashboard: boolean, serviceDashboard: boolean, custom: boolean, misc: boolean }}
 */
export function normalizeSidebarNavVisibility(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const out = { ...DEFAULT_SIDEBAR_NAV_VISIBILITY };
    for (const { key } of SIDEBAR_NAV_SECTIONS) {
        if (Object.prototype.hasOwnProperty.call(src, key)) {
            out[key] = src[key] !== false;
        }
    }
    return out;
}

/**
 * Effective section visibility for the customer sidebar.
 * When custom dashboards are off, everything stays visible (legacy behaviour).
 * @param {object|null|undefined} customer
 */
export function getSidebarNavVisibility(customer) {
    const settings = customer?.CustomerSettings || customer || {};
    const customOn = settings.customDashboardsEnabled === true;
    if (!customOn) return { ...DEFAULT_SIDEBAR_NAV_VISIBILITY };
    return normalizeSidebarNavVisibility(settings.sidebarNavVisibility);
}
