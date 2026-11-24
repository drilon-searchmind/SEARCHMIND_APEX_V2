import { getCustomDashboards } from "@/app/(protected)/dashboard/[customerId]/custom-dashboards";
import { getSidebarNavVisibility } from "@/lib/sidebarNavVisibility";

/**
 * First custom dashboard URL (Aura → /custom/performance), or /custom index, or Config.
 * @param {object|null|undefined} customer
 * @returns {string|null}
 */
export function getCustomDashboardHomeHref(customer) {
    const id = customer?._id;
    if (!id) return null;
    const dashboards = getCustomDashboards(customer);
    if (dashboards.length > 0) {
        return `/dashboard/${id}/custom/${dashboards[0].slug}`;
    }
    if (customer?.CustomerSettings?.customDashboardsEnabled === true) {
        return `/dashboard/${id}/custom`;
    }
    return `/dashboard/${id}/config`;
}

/**
 * Where "Open customer" / property switcher should land.
 * When Dashboard is hidden in Config → Sidebar, prefer the custom Performance overview.
 * @param {object|null|undefined} customer
 * @returns {string}
 */
export function getCustomerDefaultDashboardHref(customer) {
    const id = customer?._id;
    if (!id) return "/";
    const nav = getSidebarNavVisibility(customer);
    if (!nav.dashboard) {
        return getCustomDashboardHomeHref(customer) || `/dashboard/${id}/config`;
    }
    return `/dashboard/${id}/performance-dashboard`;
}

/**
 * Which Config → Sidebar section owns this dashboard path (if any).
 * @param {string|null|undefined} pathname
 * @returns {"dashboard"|"serviceDashboard"|null}
 */
export function pathRequiresSidebarSection(pathname) {
    if (!pathname || typeof pathname !== "string") return null;
    const path = pathname.split("?")[0];
    const match = path.match(/^\/dashboard\/[^/]+(?:\/(.*))?$/);
    if (!match) return null;
    const rest = match[1] || "";

    if (
        rest === "home" ||
        rest === "performance-dashboard" ||
        rest === "daily-overview" ||
        rest === "analytics" ||
        rest === "ecommerce" ||
        rest === "markets-overview" ||
        rest === "tools/pace-report" ||
        rest.startsWith("tools/pace-report/") ||
        rest === "tools/pnl" ||
        rest.startsWith("tools/pnl/")
    ) {
        return "dashboard";
    }

    if (rest === "service-dashboard" || rest.startsWith("service-dashboard/")) {
        return "serviceDashboard";
    }

    return null;
}

/**
 * If the current path is a hidden sidebar section, return the redirect target; else null.
 * @param {object|null|undefined} customer
 * @param {string} pathname
 * @returns {string|null}
 */
export function getSidebarRestrictedRedirect(customer, pathname) {
    const section = pathRequiresSidebarSection(pathname);
    if (!section || !customer) return null;
    const nav = getSidebarNavVisibility(customer);
    if (nav[section] !== false) return null;
    return getCustomDashboardHomeHref(customer);
}
