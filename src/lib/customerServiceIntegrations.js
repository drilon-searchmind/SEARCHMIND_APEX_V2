/**
 * Shared integration checks for service dashboards (sidebar warnings, audit scope, etc.).
 */
import { normalizeSnapchatSettings } from "@/lib/snapchatCustomerSettings";
import { normalizeRedditSettings } from "@/lib/redditCustomerSettings";

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
        reddit: (() => {
            const rd = normalizeRedditSettings(s);
            const hasAuth =
                !!(rd.accessToken && rd.accessToken.trim()) ||
                !!(rd.refreshToken?.trim() && rd.appId?.trim() && rd.appSecret?.trim()) ||
                !!(rd.appId?.trim() && rd.appSecret?.trim());
            return !isValidIntegrationId(rd.accountId) || !hasAuth;
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

/** Maps paid-media dashboard channel ids to integration warning keys used above. */
const AD_SPEND_PLATFORM_WARNING_KEY = {
    facebook: "ps",
    google: "ppc",
    pinterest: "pinterest",
    snapchat: "snapchat",
    reddit: "reddit",
    bing: "bing",
};

/**
 * True when Apex should treat this ad platform as connected for this customer
 * (valid account/app IDs, not placeholder "0"/"1", plus OAuth where required).
 * @param {Record<string, unknown>} customerSettings - CustomerSettings
 * @param {"facebook"|"google"|"pinterest"|"snapchat"|"bing"|"reddit"} platformId
 */
export function isAdSpendPlatformConfigured(customerSettings, platformId) {
    const s = customerSettings || {};
    const wk = AD_SPEND_PLATFORM_WARNING_KEY[platformId];
    if (!wk) return false;
    const w = getServiceDashboardConfigWarnings(s);
    return !w[wk];
}
