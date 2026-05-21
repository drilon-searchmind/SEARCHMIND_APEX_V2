import { getServiceDashboardConfigWarnings } from "@/lib/customerServiceIntegrations";

/**
 * Data sources shown in Run Audit modal (aligned with audit-prompts.md).
 * @param {Record<string, unknown>} customer
 * @param {Record<string, unknown>} [settings]
 */
export function getAuditDataSources(customer, settings) {
    const s = settings || customer?.CustomerSettings || {};
    const w = getServiceDashboardConfigWarnings(s);
    const isShopify = customer?.customerType === "Shopify";

    return [
        { id: "shopify", label: "Shopify", connected: isShopify },
        { id: "google_ads", label: "Google Ads", connected: !w.ppc },
        { id: "meta", label: "Meta", connected: !w.ps },
        { id: "klaviyo", label: "Klaviyo", connected: !w.em },
        { id: "search_console", label: "Search Console", connected: !w.seo },
        { id: "ahrefs", label: "Ahrefs", connected: false },
    ];
}

/**
 * Which audit tabs are enabled for this customer.
 * @param {Record<string, unknown>} customer
 */
export function getAuditTabConnectivity(customer) {
    const s = customer?.CustomerSettings || {};
    const w = getServiceDashboardConfigWarnings(s);
    const hasAnyChannel = !w.ppc || !w.ps || !w.seo || !w.em;
    return {
        cross: hasAnyChannel || customer?.customerType === "Shopify",
        ppc: !w.ppc,
        ps: !w.ps,
        seo: !w.seo,
        em: !w.em,
    };
}
