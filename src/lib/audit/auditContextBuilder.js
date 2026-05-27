import { fetchMergedSources } from "@/lib/mergedSourcesApi";
import { fetchGoogleAdsPPCDashboardMetrics } from "@/lib/googleAdsPpcDashboard";
import { fetchFacebookAdsPSDashboardMetrics } from "@/lib/facebookApi";
import { fetchKlaviyoDashboardMetricsBothPeriods } from "@/lib/klaviyoDashboard";
import {
    getServiceDashboardConfigWarnings,
    isValidIntegrationId,
} from "@/lib/customerServiceIntegrations";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoMergedSourcesForRange } from "@/lib/demoMergedSources";
import { getDemoGooglePpcDashboardForRange, getDemoFacebookCampaignInsightsForRange, getDemoKlaviyoDashboardForRange } from "@/lib/demoAdMetrics";
import { auditGroupIdFromCardId } from "./auditPromptCatalog";
import {
    AUDIT_AHREFS_ANALYST_INSTRUCTION,
    fetchAhrefsAuditBundle,
    shouldFetchAhrefsForAudit,
} from "./auditAhrefsSeo";
import {
    fetchSearchConsoleAuditBundle,
    fetchSearchConsoleComparisonBundle,
} from "./auditSearchConsoleFetch";

/**
 * @param {unknown[]} selections
 * @returns {string[]}
 */
export function resolveAuditGroupsFromSelections(selections) {
    const groups = new Set();
    for (const sel of selections || []) {
        if (!sel || typeof sel !== "object") continue;
        const g =
            sel.groupId ||
            (sel.cardId ? auditGroupIdFromCardId(String(sel.cardId)) : "");
        if (g) groups.add(g);
    }
    return [...groups];
}

/**
 * Which server-side sources to pull based on selected audit tabs (not per-card prompts).
 * @param {string[]} groups
 */
function resolveAuditSourcesForGroups(groups) {
    const sources = new Set();
    for (const g of groups) {
        if (g === "cross") {
            sources.add("merged");
            sources.add("googlePpc");
            sources.add("meta");
            sources.add("searchConsole");
            sources.add("ahrefs");
            sources.add("klaviyo");
        } else if (g === "ppc") {
            sources.add("merged");
            sources.add("googlePpc");
        } else if (g === "ps") {
            sources.add("merged");
            sources.add("meta");
        } else if (g === "seo") {
            sources.add("merged");
            sources.add("searchConsole");
            sources.add("ahrefs");
            sources.add("googlePpc");
        } else if (g === "em") {
            sources.add("merged");
            sources.add("klaviyo");
        }
    }
    return sources;
}

function googleAdsEnv() {
    return {
        developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        clientId: process.env.GOOGLE_ADS_CLIENT_ID,
        clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN,
        managerCustomerId: process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID,
    };
}

function googleAdsEnvReady() {
    const e = googleAdsEnv();
    return Boolean(
        e.developerToken && e.clientId && e.clientSecret && e.refreshToken
    );
}

/**
 * Build audit-only context: keeps the page `dataSnapshot` and adds server-fetched channel data.
 * Does not affect Apex dashboards.
 *
 * @param {{
 *   customer: Record<string, unknown>,
 *   customerId: string,
 *   startDate: string,
 *   endDate: string,
 *   comparisonDateRange?: { startDate: string, endDate: string }|null,
 *   selections: unknown[],
 *   pageSnapshot?: Record<string, unknown>,
 *   ahrefsRepairHints?: Record<string, { select: string, order_by?: string }>,
 * }} opts
 */
export async function buildAuditContext(opts) {
    const {
        customer,
        customerId,
        startDate,
        endDate,
        comparisonDateRange = null,
        selections = [],
        pageSnapshot = {},
        ahrefsRepairHints = null,
    } = opts;

    const settings = /** @type {Record<string, unknown>} */ (
        customer?.CustomerSettings || {}
    );
    const groups = resolveAuditGroupsFromSelections(selections);
    const sources = resolveAuditSourcesForGroups(groups);
    const warnings = getServiceDashboardConfigWarnings(settings);
    const demo = isDemoCustomerId(String(customerId));

    /** @type {Record<string, unknown>} */
    const serverEnrichment = {
        fetchedAt: new Date().toISOString(),
        groups,
        sources: [...sources],
        errors: [],
    };

    const ctx = {
        _auditContextVersion: 1,
        pageSnapshot:
            pageSnapshot && typeof pageSnapshot === "object" ? pageSnapshot : {},
        customerContext: {
            customerType: customer?.customerType || "Shopify",
            revenueType: settings.customerRevenueType || "total_sales",
            metricPreference: settings.metricPreference || "ROAS/POAS",
            fetchCogsFromStore: settings.fetchCogsFromStore === true,
            shopifyOnlineStoreOnly: settings.shopifyOnlineStoreOnly === true,
            storeCurrency: settings.customerStoreValutaCode || "DKK",
        },
        serverEnrichment,
        ahrefsAnalystNote: null,
    };

    const pushError = (source, message) => {
        serverEnrichment.errors.push({ source, message: String(message) });
    };

    /** Skip optional ad platforms that are not configured (audit does not use them). */
    const excludeAdSpendPlatforms = [];
    if (warnings.pinterest) excludeAdSpendPlatforms.push("pinterest");
    if (warnings.snapchat) excludeAdSpendPlatforms.push("snapchat");
    if (warnings.reddit) excludeAdSpendPlatforms.push("reddit");
    if (warnings.bing) excludeAdSpendPlatforms.push("bing");

    if (sources.has("merged")) {
        try {
            if (demo) {
                const m = getDemoMergedSourcesForRange(startDate, endDate, customer, {});
                const shopifyDaily = m.shopifyDaily || [];
                const spendSum = (rows) =>
                    (rows || []).reduce((s, d) => s + (parseFloat(d.spend) || 0), 0);
                const totalAdspend =
                    spendSum(m.facebookDaily) +
                    spendSum(m.googleDaily) +
                    spendSum(m.pinterestDaily) +
                    spendSum(m.snapchatDaily) +
                    spendSum(m.bingDaily) +
                    spendSum(m.redditDaily);
                serverEnrichment.shopify = {
                    daily: shopifyDaily,
                    aggregates: {
                        totalSales: shopifyDaily.reduce(
                            (s, d) => s + (parseFloat(d.total_sales) || 0),
                            0
                        ),
                        netRevenue: shopifyDaily.reduce(
                            (s, d) => s + (parseFloat(d.net_sales) || 0),
                            0
                        ),
                        orders: shopifyDaily.reduce(
                            (s, d) => s + (parseInt(d.orders, 10) || 0),
                            0
                        ),
                        totalAdspend,
                        grossProfitNetSales: m.grossProfitNetSales,
                        demo: true,
                    },
                };
                serverEnrichment.adSpend = {
                    facebookDaily: m.facebookDaily || [],
                    googleDaily: m.googleDaily || [],
                    pinterestDaily: m.pinterestDaily || [],
                    snapchatDaily: m.snapchatDaily || [],
                    bingDaily: m.bingDaily || [],
                    redditDaily: m.redditDaily || [],
                };
            } else {
                const merged = await fetchMergedSources(
                    {
                        ...settings,
                        customerName: customer?.customerName,
                        CustomerStaticExpenses: customer?.CustomerStaticExpenses || {},
                    },
                    startDate,
                    endDate,
                    {
                        source: "dashboard-audit",
                        dailyBreakdown: true,
                        excludeAdSpendPlatforms,
                    }
                );
                const shopifyDaily = merged.shopifyDaily || [];
                const spendSum = (rows) =>
                    (rows || []).reduce((s, d) => s + (parseFloat(d.spend) || 0), 0);
                const totalAdspend =
                    spendSum(merged.facebookDaily) +
                    spendSum(merged.googleDaily) +
                    spendSum(merged.pinterestDaily) +
                    spendSum(merged.snapchatDaily) +
                    spendSum(merged.bingDaily) +
                    spendSum(merged.redditDaily);
                serverEnrichment.shopify = {
                    daily: shopifyDaily,
                    aggregates: {
                        totalSales: shopifyDaily.reduce(
                            (s, d) => s + (parseFloat(d.total_sales) || 0),
                            0
                        ),
                        netRevenue: shopifyDaily.reduce(
                            (s, d) => s + (parseFloat(d.net_sales) || 0),
                            0
                        ),
                        orders: shopifyDaily.reduce(
                            (s, d) => s + (parseInt(d.orders, 10) || 0),
                            0
                        ),
                        totalAdspend,
                        grossProfitNetSales: merged.grossProfitNetSales,
                        POASNetProfit:
                            totalAdspend > 0
                                ? (merged.grossProfitNetSales || 0) / totalAdspend
                                : 0,
                        CACTotalSales: merged.CACTotalSales,
                    },
                    calculations: merged.calculationsData?.valueLabels || null,
                };
                serverEnrichment.adSpend = {
                    facebookDaily: merged.facebookDaily || [],
                    googleDaily: merged.googleDaily || [],
                    pinterestDaily: merged.pinterestDaily || [],
                    snapchatDaily: merged.snapchatDaily || [],
                    bingDaily: merged.bingDaily || [],
                    redditDaily: merged.redditDaily || [],
                };
            }
        } catch (e) {
            pushError("merged", e?.message || e);
        }
    }

    const gscProperty = String(settings.googleSearchConsoleProperty || "").trim();
    const gscReady = isValidIntegrationId(gscProperty);

    if (sources.has("searchConsole") && gscReady) {
        try {
            serverEnrichment.searchConsole = await fetchSearchConsoleAuditBundle({
                siteUrl: gscProperty,
                startDate,
                endDate,
                customerId: String(customerId),
            });
            if (comparisonDateRange?.startDate && comparisonDateRange?.endDate) {
                serverEnrichment.searchConsoleComparison =
                    await fetchSearchConsoleComparisonBundle({
                        siteUrl: gscProperty,
                        startDate: comparisonDateRange.startDate,
                        endDate: comparisonDateRange.endDate,
                        customerId: String(customerId),
                    });
            }
        } catch (e) {
            pushError("searchConsole", e?.message || e);
        }
    } else if (sources.has("searchConsole")) {
        serverEnrichment.searchConsole = {
            included: false,
            reason: "Google Search Console property not configured",
        };
    }

    if (sources.has("ahrefs") && shouldFetchAhrefsForAudit(selections, settings)) {
        try {
            serverEnrichment.ahrefs = await fetchAhrefsAuditBundle({
                googleSearchConsoleProperty: gscProperty,
                startDate,
                endDate,
                comparisonDateRange,
                repairHints: ahrefsRepairHints || undefined,
            });
            ctx.ahrefsAnalystNote = AUDIT_AHREFS_ANALYST_INSTRUCTION;
        } catch (e) {
            pushError("ahrefs", e?.message || e);
            serverEnrichment.ahrefs = { included: false, error: String(e?.message || e) };
        }
    }

    if (sources.has("googlePpc") && !warnings.ppc && googleAdsEnvReady()) {
        try {
            if (demo) {
                serverEnrichment.googleAds = {
                    ...getDemoGooglePpcDashboardForRange(startDate, endDate),
                    demo: true,
                };
            } else {
                const env = googleAdsEnv();
                serverEnrichment.googleAds = await fetchGoogleAdsPPCDashboardMetrics({
                    ...env,
                    customerId: String(settings.googleAdsCustomerId || "").trim(),
                    startDate,
                    endDate,
                    countryFilter: settings.googleAdsCountryFilter || undefined,
                    countryExclude: settings.googleAdsCountryExclude || undefined,
                });
            }
        } catch (e) {
            pushError("googleAds", e?.message || e);
        }
    } else if (sources.has("googlePpc") && warnings.ppc) {
        serverEnrichment.googleAds = {
            included: false,
            reason: "Google Ads customer ID not configured — skipped fetch",
        };
    }

    if (sources.has("meta") && !warnings.ps && process.env.FACEBOOK_APP_TOKEN) {
        try {
            const adAccountId = String(settings.facebookAdAccountId || "").trim();
            if (demo) {
                serverEnrichment.meta = {
                    ...getDemoFacebookCampaignInsightsForRange(startDate, endDate),
                    demo: true,
                };
            } else if (adAccountId) {
                serverEnrichment.meta = await fetchFacebookAdsPSDashboardMetrics({
                    accessToken: process.env.FACEBOOK_APP_TOKEN,
                    adAccountId,
                    startDate,
                    endDate,
                    metaIdInclude: settings.customerMetaID || undefined,
                    metaIdExclude: settings.customerMetaIDExclude || undefined,
                });
            }
        } catch (e) {
            pushError("meta", e?.message || e);
        }
    } else if (sources.has("meta") && warnings.ps) {
        serverEnrichment.meta = {
            included: false,
            reason: "Meta ad account not configured — skipped fetch",
        };
    }

    if (sources.has("klaviyo") && !warnings.em) {
        const apiKey = String(settings.klaviyoPrivateApiKey || "").trim();
        if (apiKey) {
            try {
                if (demo) {
                    serverEnrichment.klaviyo = getDemoKlaviyoDashboardForRange(
                        startDate,
                        endDate,
                        comparisonDateRange?.startDate,
                        comparisonDateRange?.endDate
                    );
                } else {
                    const prevStart = comparisonDateRange?.startDate || null;
                    const prevEnd = comparisonDateRange?.endDate || null;
                    serverEnrichment.klaviyo =
                        await fetchKlaviyoDashboardMetricsBothPeriods({
                            apiKey,
                            startDate,
                            endDate,
                            prevStartDate: prevStart,
                            prevEndDate: prevEnd,
                        });
                }
            } catch (e) {
                pushError("klaviyo", e?.message || e);
            }
        }
    } else if (sources.has("klaviyo") && warnings.em) {
        serverEnrichment.klaviyo = {
            included: false,
            reason: "Klaviyo not configured — skipped fetch",
        };
    }

    return ctx;
}
