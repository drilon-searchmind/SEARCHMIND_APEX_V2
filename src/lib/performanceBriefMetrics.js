import { getCustomerById } from "@root/lib/customerOperations";
import { isValidIntegrationId } from "@/lib/customerServiceIntegrations";
import { buildPerformanceBriefWindows } from "@/lib/performanceBriefDates";
import { fetchPerformanceBriefMeta } from "@/lib/performanceBriefMeta";
import { fetchPerformanceBriefGoogle } from "@/lib/performanceBriefGoogle";
import { analyzePerformanceBriefWithClaude } from "@/lib/performanceBriefClaude";
import { formatPerformanceBriefSlack } from "@/lib/performanceBriefSlackPreview";

function toPlain(doc) {
    if (!doc) return null;
    if (typeof doc.toObject === "function") return doc.toObject();
    return { ...doc };
}

function unavailable(skipReason) {
    return { configured: false, skipReason };
}

function errorPlatform(error) {
    return { configured: true, error: String(error || "Unknown error") };
}

/**
 * Fetch Meta + Google Ads windows, ask Claude for narrative, render Slack payload.
 * @param {string} customerId
 */
export async function generatePerformanceBrief(customerId) {
    const customerDoc = await getCustomerById(customerId);
    const customer = toPlain(customerDoc);
    if (!customer) throw new Error("Customer not found");

    const settings = customer.CustomerSettings || {};
    const windows = buildPerformanceBriefWindows();
    const currency = String(settings.customerStoreValutaCode || "DKK").toUpperCase();
    const customerName = customer.customerName || "Unnamed customer";

    const metaId = String(settings.facebookAdAccountId || "").trim();
    const googleId = String(settings.googleAdsCustomerId || "").trim();
    const accessToken = String(process.env.FACEBOOK_APP_TOKEN || "").trim();

    const [metaResult, googleResult] = await Promise.all([
        (async () => {
            if (!isValidIntegrationId(metaId)) return unavailable("no_facebook_ad_account");
            if (!accessToken) return unavailable("facebook_token_missing");
            try {
                return await fetchPerformanceBriefMeta({
                    customerId: String(customer._id),
                    accessToken,
                    adAccountId: metaId,
                    metaIdInclude: settings.customerMetaID || "",
                    metaIdExclude: settings.customerMetaIDExclude || "",
                    windows,
                });
            } catch (e) {
                return errorPlatform(e?.message || e);
            }
        })(),
        (async () => {
            if (!isValidIntegrationId(googleId)) return unavailable("no_google_ads_customer_id");
            try {
                return await fetchPerformanceBriefGoogle({
                    customerId: String(customer._id),
                    windows,
                });
            } catch (e) {
                return errorPlatform(e?.message || e);
            }
        })(),
    ]);

    const compact = {
        customer: {
            customerId: String(customer._id),
            customerName,
            currency,
            vatBasis: settings.revenueDisplayVat || "excl",
        },
        windows: {
            isoWeek: windows.isoWeek,
            yesterday: windows.yesterday,
            last7: windows.last7,
            prev7: windows.prev7,
            last14: windows.last14,
            prev14: windows.prev14,
        },
        meta: metaResult,
        google: googleResult,
    };

    const narrative = await analyzePerformanceBriefWithClaude(compact);
    const slackPreview = formatPerformanceBriefSlack({
        compact,
        narrative,
        channelName: "",
    });

    return {
        customer: compact.customer,
        windows: compact.windows,
        meta: metaResult,
        google: googleResult,
        narrative,
        slackPreview,
        claude: {
            configured: narrative.configured,
            model: narrative.model || null,
            error: narrative.error || null,
        },
    };
}
