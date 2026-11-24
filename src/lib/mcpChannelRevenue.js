/**
 * Attributed “omsætning pr. kanal” for Apex MCP — Google / Meta / Email conversion value
 * (platform-attributed revenue), plus store totals and spend for context.
 */
import { fetchFacebookAdsPSDashboardMetrics } from "@/lib/facebookApi";
import { fetchGoogleAdsPPCDashboardMetrics } from "@/lib/googleAdsPpcDashboard";
import {
    getGoogleAdsDeveloperToken,
    getGoogleAdsManagerCustomerId,
    getGoogleAdsOAuthClientId,
    getGoogleAdsOAuthClientSecret,
    getGoogleAdsRefreshToken,
} from "@/lib/googleAdsOAuthEnv";
import { fetchKlaviyoDashboardMetricsBothPeriods } from "@/lib/klaviyoDashboard";
import { fetchMergedSources } from "@/lib/mergedSourcesApi";
import { isValidIntegrationId } from "@/lib/customerServiceIntegrations";
import { getDemoPayload, isDemoCustomerId } from "@/lib/demoCustomer";
import {
    getDemoFacebookCampaignInsightsForRange,
    getDemoGooglePpcDashboardForRange,
    getDemoKlaviyoDashboardForRange,
} from "@/lib/demoAdMetrics";
import { getDemoMergedSourcesForRange } from "@/lib/demoMergedSources";
import { getCustomerById } from "@root/lib/customerOperations";
import {
    aggregateEmFromKlaviyo,
    aggregatePpcFromGoogle,
    aggregatePsFromFacebook,
    roundNum,
} from "@root/lib/weeklyAuditHelpers";

function buildSettings(data) {
    return {
        customerName: data.customerName,
        customerType: data.customerType || "Shopify",
        ...(data.CustomerSettings || {}),
        CustomerStaticExpenses: data.CustomerStaticExpenses || {},
    };
}

function channelBlock({ status, spend, conversionValue, conversions, roas, error }) {
    return {
        status,
        spend: spend == null ? null : roundNum(spend),
        /** Platform-attributed revenue (omsætning pr. kanal). */
        conversionValue: conversionValue == null ? null : roundNum(conversionValue),
        conversions: conversions == null ? null : roundNum(conversions, 2),
        roas: roas == null ? null : roundNum(roas, 2),
        error: error || null,
    };
}

/**
 * @param {string} customerId
 * @param {{ startDate: string, endDate: string }} opts
 */
export async function fetchMcpChannelRevenue(customerId, opts) {
    const startDate = String(opts.startDate || "").trim();
    const endDate = String(opts.endDate || "").trim();
    if (!startDate || !endDate) {
        throw new Error("startDate and endDate are required (YYYY-MM-DD)");
    }

    const isDemo = isDemoCustomerId(customerId);
    let customerDoc;
    if (isDemo) {
        customerDoc = getDemoPayload("customer");
        customerDoc._id = customerId;
    } else {
        const doc = await getCustomerById(customerId);
        if (!doc) throw new Error("Customer not found");
        customerDoc = doc.toObject ? doc.toObject() : doc;
    }

    const settings = buildSettings(customerDoc);
    const currency = settings.customerStoreValutaCode || "DKK";
    const vatBasis =
        settings.revenueDisplayVat === "incl" || settings.revenueDisplayVat === "incl_shopify"
            ? "incl"
            : "excl";

    const [merged, googleRes, metaRes, emailRes] = await Promise.all([
        (async () => {
            if (isDemo) {
                return getDemoMergedSourcesForRange(startDate, endDate, customerDoc, {});
            }
            return fetchMergedSources(settings, startDate, endDate, {});
        })(),
        (async () => {
            try {
                if (isDemo) {
                    return {
                        ok: true,
                        data: getDemoGooglePpcDashboardForRange(startDate, endDate),
                    };
                }
                const googleCustomerId = String(settings.googleAdsCustomerId || "").trim();
                if (!isValidIntegrationId(googleCustomerId.split(/[,\s]+/)[0])) {
                    return { ok: false, reason: "not_configured" };
                }
                const data = await fetchGoogleAdsPPCDashboardMetrics({
                    developerToken: getGoogleAdsDeveloperToken(),
                    clientId: getGoogleAdsOAuthClientId(),
                    clientSecret: getGoogleAdsOAuthClientSecret(),
                    refreshToken: getGoogleAdsRefreshToken(),
                    customerId: googleCustomerId,
                    managerCustomerId: getGoogleAdsManagerCustomerId(),
                    startDate,
                    endDate,
                    countryFilter: settings.googleAdsCountryFilter || undefined,
                    countryExclude: settings.googleAdsCountryExclude || undefined,
                });
                return { ok: true, data };
            } catch (e) {
                return { ok: false, reason: e.message || "fetch_failed" };
            }
        })(),
        (async () => {
            try {
                if (isDemo) {
                    return {
                        ok: true,
                        data: {
                            metrics_by_date: getDemoFacebookCampaignInsightsForRange(
                                startDate,
                                endDate
                            ),
                            top_campaigns: [],
                        },
                    };
                }
                const adAccountId = settings.facebookAdAccountId;
                if (!isValidIntegrationId(adAccountId)) {
                    return { ok: false, reason: "not_configured" };
                }
                const token = process.env.FACEBOOK_APP_TOKEN;
                if (!token) return { ok: false, reason: "Facebook app token not configured" };
                const data = await fetchFacebookAdsPSDashboardMetrics({
                    accessToken: token,
                    adAccountId,
                    startDate,
                    endDate,
                    metaIdInclude: settings.customerMetaID || undefined,
                    metaIdExclude: settings.customerMetaIDExclude || undefined,
                });
                return { ok: true, data };
            } catch (e) {
                return { ok: false, reason: e.message || "fetch_failed" };
            }
        })(),
        (async () => {
            try {
                if (isDemo) {
                    const current = getDemoKlaviyoDashboardForRange(startDate, endDate);
                    return {
                        ok: true,
                        current: current.metrics_by_date?.[0] || {},
                    };
                }
                const apiKey = String(settings.klaviyoPrivateApiKey || "").trim();
                if (!apiKey) return { ok: false, reason: "not_configured" };
                const result = await fetchKlaviyoDashboardMetricsBothPeriods({
                    apiKey,
                    startDate,
                    endDate,
                    prevStartDate: startDate,
                    prevEndDate: endDate,
                });
                return { ok: true, current: result.metrics_by_date?.[0] || {} };
            } catch (e) {
                return { ok: false, reason: e.message || "fetch_failed" };
            }
        })(),
    ]);

    const shopifyDaily = merged?.shopifyDaily || [];
    const store = {
        totalSales: roundNum(shopifyDaily.reduce((s, d) => s + (d.total_sales || 0), 0)),
        netSales: roundNum(shopifyDaily.reduce((s, d) => s + (d.net_sales || 0), 0)),
        orders: roundNum(shopifyDaily.reduce((s, d) => s + (d.orders || 0), 0), 0),
    };

    let google = channelBlock({ status: "unavailable" });
    if (googleRes.ok) {
        const agg = aggregatePpcFromGoogle(googleRes.data?.metrics_by_date);
        google = channelBlock({
            status: "ok",
            spend: agg.spend,
            conversionValue: agg.conversionValue,
            conversions: agg.conversions,
            roas: agg.roas,
        });
    } else if (googleRes.reason === "not_configured") {
        google = channelBlock({ status: "not_configured" });
    } else {
        google = channelBlock({ status: "error", error: googleRes.reason });
    }

    let meta = channelBlock({ status: "unavailable" });
    if (metaRes.ok) {
        const agg = aggregatePsFromFacebook(metaRes.data?.metrics_by_date);
        meta = channelBlock({
            status: "ok",
            spend: agg.spend,
            conversionValue: agg.conversionValue,
            conversions: agg.conversions,
            roas: agg.roas,
        });
    } else if (metaRes.reason === "not_configured") {
        meta = channelBlock({ status: "not_configured" });
    } else {
        meta = channelBlock({ status: "error", error: metaRes.reason });
    }

    let email = {
        status: "unavailable",
        attributedRevenue: null,
        error: null,
    };
    if (emailRes.ok) {
        const em = aggregateEmFromKlaviyo(emailRes.current, {}, store.netSales);
        email = {
            status: "ok",
            attributedRevenue: roundNum(em.attributedRevenue),
            error: null,
        };
    } else if (emailRes.reason === "not_configured") {
        email = { status: "not_configured", attributedRevenue: null, error: null };
    } else {
        email = { status: "error", attributedRevenue: null, error: emailRes.reason };
    }

    /** Also surface daily conversionValue from merged sources when present. */
    const sumDailyConversion = (rows) =>
        roundNum((rows || []).reduce((s, d) => s + (Number(d.conversionValue) || 0), 0));

    return {
        readOnly: true,
        customerId: String(customerDoc._id),
        customerName: customerDoc.customerName || "",
        currency,
        vatBasis,
        startDate,
        endDate,
        definition:
            "conversionValue / attributedRevenue = platform-attributed revenue (omsætning pr. kanal). Not Shopify sales_channel mix.",
        store,
        channels: {
            google,
            meta,
            email,
        },
        /** Convenience totals from channels above. */
        totals: {
            attributedPaidRevenue: roundNum(
                (google.conversionValue || 0) + (meta.conversionValue || 0)
            ),
            attributedEmailRevenue: email.attributedRevenue,
            paidSpend: roundNum((google.spend || 0) + (meta.spend || 0)),
        },
        /** Daily series from merged-sources (includes conversionValue when available). */
        daily: {
            googleConversionValue: sumDailyConversion(merged?.googleDaily),
            metaConversionValue: sumDailyConversion(merged?.facebookDaily),
        },
    };
}
