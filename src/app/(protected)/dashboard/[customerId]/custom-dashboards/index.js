/**
 * Registry of hardcoded custom dashboards. See README.md in this folder.
 * Client-safe: modules only reference their dashboard components through next/dynamic.
 */
import aura from "./Aura";

/** Add new customer modules here (one file per customer). */
const CUSTOM_DASHBOARD_MODULES = [aura];

function normalizeName(name) {
    return String(name || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

/** The module registered for this customer (matched on customerName), or null. */
export function getCustomDashboardModule(customer) {
    const name = normalizeName(customer?.customerName);
    if (!name) return null;
    return (
        CUSTOM_DASHBOARD_MODULES.find((m) => m.customerNames.some((n) => normalizeName(n) === name)) || null
    );
}

/** True when the Custom menu setting is on for this customer. */
export function isCustomDashboardsEnabled(customer) {
    return customer?.CustomerSettings?.customDashboardsEnabled === true;
}

/** Dashboards to list in the sidebar: empty unless the setting is on and a module exists. */
export function getCustomDashboards(customer) {
    if (!isCustomDashboardsEnabled(customer)) return [];
    return getCustomDashboardModule(customer)?.dashboards || [];
}

export function findCustomDashboard(customer, slug) {
    return getCustomDashboards(customer).find((d) => d.slug === slug) || null;
}
