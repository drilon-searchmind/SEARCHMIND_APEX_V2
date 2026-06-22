import { normalizeBingSiteUrl } from "@/lib/bingWebmasterApi";
import { isDemoCustomerId } from "@/lib/demoCustomer";

const DEMO_BING_WEBMASTER_SITE = "https://demo.example.com/";

/**
 * Normalize and validate Bing Webmaster site URL from customer settings (no DB).
 *
 * @param {string | undefined | null} bingWebmasterSiteUrl - `CustomerSettings.bingWebmasterSiteUrl`
 * @param {string} customerId
 * @returns {{ siteUrl: string } | { error: string, status?: number }}
 */
export function resolveBingWebmasterSiteUrl(bingWebmasterSiteUrl, customerId) {
    if (!customerId) {
        return { error: "customerId is required", status: 400 };
    }
    const siteUrl = (typeof bingWebmasterSiteUrl === "string" ? bingWebmasterSiteUrl : "").trim();
    if (!siteUrl) {
        if (isDemoCustomerId(String(customerId))) {
            return { siteUrl: normalizeBingSiteUrl(DEMO_BING_WEBMASTER_SITE) };
        }
        return {
            error:
                "No Bing site URL — set Bing Webmaster site URL in Property Settings (Config) for this customer.",
            status: 400,
        };
    }
    return { siteUrl: normalizeBingSiteUrl(siteUrl) };
}
