/**
 * Shared integration checks for service dashboards (sidebar warnings, audit scope, etc.).
 */
import { normalizeSnapchatSettings } from "@/lib/snapchatCustomerSettings";

/** Treats empty, "0", and "1" as missing/placeholder (per Customer settings). */
export function isValidIntegrationId(value) {
    const s = String(value ?? "").trim();
    if (!s) return false;
    if (s === "0" || s === "1") return false;
    return true;
}

export function getServiceDashboardConfigWarnings(settings) {
    const s = settings || {};
    return {
        seo: !isValidIntegrationId(s.googleSearchConsoleProperty),
        ppc: !isValidIntegrationId(s.googleAdsCustomerId),
        ps: !isValidIntegrationId(s.facebookAdAccountId),
        pinterest: !isValidIntegrationId(s.pinterestAdAccountId),
        snapchat: (() => {
            const sn = normalizeSnapchatSettings(s);
            const hasAuth =
                !!(sn.accessToken && sn.accessToken.trim()) ||
                (Boolean(sn.clientId?.trim()) &&
                    Boolean(sn.clientSecret?.trim()) &&
                    Boolean(sn.refreshToken?.trim()));
            return !isValidIntegrationId(sn.adAccountId) || !hasAuth;
        })(),
        bing: !(isValidIntegrationId(s.bingAdsAccountId) && isValidIntegrationId(s.bingAdsCustomerId)),
        em: !isValidIntegrationId(s.klaviyoPrivateApiKey),
    };
}

/** Service dashboard segments that Apex can audit when integration is configured. */
export const AUDITABLE_SERVICE_IDS = ["seo", "ppc", "ps", "pinterest", "bing", "em"];

const AUDIT_SERVICE_META = {
    seo: { label: "SEO", warningKey: "seo" },
    ppc: { label: "PPC (Google Ads)", warningKey: "ppc" },
    ps: { label: "PS (Meta Paid Social)", warningKey: "ps" },
    pinterest: { label: "Pinterest", warningKey: "pinterest" },
    bing: { label: "Bing Ads", warningKey: "bing" },
    em: { label: "EM (Klaviyo)", warningKey: "em" },
};

/**
 * @returns {{ id: string, label: string }[]} Channels with valid integration IDs (aligned with Sidebar).
 */
export function getConfiguredAuditServices(customerSettings) {
    const w = getServiceDashboardConfigWarnings(customerSettings);
    return AUDITABLE_SERVICE_IDS.filter((id) => !w[AUDIT_SERVICE_META[id]?.warningKey]).map((id) => ({
        id,
        label: AUDIT_SERVICE_META[id].label,
    }));
}
