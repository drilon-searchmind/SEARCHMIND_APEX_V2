import mongoose from "mongoose";

import { fetchFacebookAdsAdPerformance } from "@/lib/facebookAdsAdPerformance";
import { fetchGoogleAdsAdPerformance } from "@/lib/googleAdsAdPerformance";
import { fetchGoogleAdsPPCDashboardMetrics } from "@/lib/googleAdsPpcDashboard";
import { fetchPinterestDashboardMetrics } from "@/lib/pinterestApi";
import {
    fetchSnapchatDashboardMetrics,
    resolveSnapchatAccessTokenForCustomer,
} from "@/lib/snapchatApi";
import { normalizeSnapchatSettings } from "@/lib/snapchatCustomerSettings";
import {
    fetchRedditDashboardMetrics,
    resolveRedditAccessTokenForCustomer,
} from "@/lib/redditApi";
import { normalizeRedditSettings } from "@/lib/redditCustomerSettings";
import {
    fetchBingAdsDashboardMetrics,
    isMicrosoftAdvertisingConfigured,
} from "@/lib/microsoftAdvertisingApi";
import { fetchKlaviyoDashboardMetricsBothPeriods } from "@/lib/klaviyoDashboard";
import { fetchMergedSources } from "@/lib/mergedSourcesApi";
import { parseAdSpendExcludeQueryParam } from "@/lib/adSpendExcludeParam";
import {
    fetchCustomerSegmentationShopifyql,
    fetchCustomerSegmentationShopifyqlFull,
} from "@/lib/customerSegmentationShopifyql";
import { fetchShopifyMarketsCatalog } from "@/lib/shopifyMarketsApi";
import { fetchShopifyProductMetrics } from "@/lib/shopifyProductsApi";
import { buildSeoInsightsBundle } from "@/lib/seoInsightsBundle";
import { fetchSeoDashboardSupplemental } from "@/lib/seoDashboardBundle";
import { getSearchConsoleClient } from "@/lib/searchConsoleClient";
import { fetchApexRadarGoogleAdsOverviewRows } from "@/lib/apexRadarGoogleAdsOverview";
import { fetchApexRadarFacebookOverviewRows } from "@/lib/apexRadarFacebookOverview";
import {
    buildPiFunnelFromAggregates,
    buildPiMonthRowsForYear,
    fetchGooglePiMonthlyByMonthKey,
    fetchGooglePiRangeAggregate,
    priorPeriodRange,
} from "@/lib/apexRadarPerformanceInvestigatorGoogle";
import {
    fetchFacebookPiMonthlyByMonthKey,
    fetchFacebookPiRangeAggregate,
} from "@/lib/apexRadarPerformanceInvestigatorFacebook";
import {
    PI_MONTH_LABELS,
    computePiYearOverYearDiff,
    getDemoFacebookPerformanceInvestigatorPayload,
} from "@/app/(protected)/apex-radar/lib/mockPerformanceInvestigatorData";
import {
    mergeGoogleChannelSettingsIntoCustomers,
    mergeFacebookChannelSettingsIntoCustomers,
} from "@/lib/apexRadarChannelSettingsMerge";
import {
    APEX_RADAR_CHANNEL_GOOGLE_ADS,
    APEX_RADAR_CHANNEL_FACEBOOK,
    APEX_RADAR_CHANNELS,
} from "@/lib/apexRadarChannels";
import { resolvePaidSocialExcludedUserIdsFromDoc } from "@/lib/apexRadarAssignmentExcludedDb";
import { eachDayInRange } from "@/lib/dateRangeUtils";
import { resolveBingWebmasterAccessToken, getBingWebmasterEnv } from "@/lib/bingWebmasterOAuth";
import { resolveBingWebmasterSiteUrl } from "@/lib/bingWebmasterCustomerSite";
import {
    bingWebmasterJsonGet,
    getBingWebmasterApiConfig,
    parseBingJsonResponse,
    parseBingDotNetDate,
} from "@/lib/bingWebmasterApi";
import {
    getCustomerFiltersByParentId,
    googleAdsFiltersDocToClientState,
    metaAdsFiltersDocToClientState,
} from "@/lib/customerFiltersDb";
import { isValidIntegrationId } from "@/lib/customerServiceIntegrations";
import { getDemoPayload, isDemoCustomerId, mergeDemoCustomerDocument } from "@/lib/demoCustomer";
import {
    getDemoBingDashboardForRange,
    getDemoFacebookAdsAdPerformanceForRange,
    getDemoGoogleAdsAdPerformanceForRange,
    getDemoGooglePpcDashboardForRange,
    getDemoKlaviyoDashboardForRange,
    getDemoPinterestDashboardForRange,
    getDemoRedditDashboardForRange,
    getDemoSnapchatDashboardForRange,
    buildDemoApexRadarGoogleAdsOverviewRow,
    buildDemoApexRadarFacebookOverviewRow,
} from "@/lib/demoAdMetrics";
import {
    getDemoMergedSourcesForRange,
    getDemoShopifyqlFullFromMerged,
    getDemoShopifyqlSegmentationFromMerged,
} from "@/lib/demoMergedSources";
import { getCampaignsByAssignedUser } from "@root/lib/campaignOperations";
import { getCustomerById, getAllCustomers } from "@root/lib/customerOperations";
import { parseMcpDateRange, serializeCustomerForMcp } from "@root/lib/mcpApiHelpers";
import { calcBlendedPoasOrZero } from "@/lib/poasMetrics";
import { loadCustomerForMcp } from "@root/lib/mcpDataService";
import { queryParam } from "@root/lib/mcpQuery";
import { sanitizeForMcp } from "@root/lib/mcpSanitize";
import { getOurTools } from "@root/lib/ourToolOperations";
import { getParentCustomerById } from "@root/lib/parentCustomerOperations";
import { fetchParentCustomerAggregated } from "@root/lib/parentCustomerAggregatedFetch";
import ShareOfSearchSnapshot from "@/models/ShareOfSearchSnapshot";
import DataWrappedReport from "@/models/DataWrappedReport";
import SEOBrandKeyword from "@/models/SEOBrandKeyword";
import SEOExactKeywordGroup from "@/models/SEOExactKeywordGroup";
import SEOPartialKeywordGroup from "@/models/SEOPartialKeywordGroup";
import CustomerChannelAudit from "@/models/CustomerChannelAudit";
import AiAnalysisChat from "@/models/AiAnalysisChat";
import CampaignPlannerV2Workspace from "@/models/CampaignPlannerV2Workspace";
import CampaignPlannerComment from "@/models/CampaignPlannerComment";
import ApexRadarAccountAssignment from "@/models/ApexRadarAccountAssignment";
import ApexRadarChannelSettings from "@/models/ApexRadarChannelSettings";
import Customer from "@/models/Customer";

export const MCP_EXTENDED_DATA_SOURCES = [
    "meta-ad-performance",
    "google-ad-performance",
    "google-ppc-dashboard",
    "klaviyo-dashboard",
    "pinterest-dashboard",
    "snapchat-dashboard",
    "reddit-dashboard",
    "bing-dashboard",
    "seo-brand-keywords",
    "seo-exact-keywords",
    "seo-partial-keywords",
    "seo-insights",
];

export const MCP_EXTENDED_CUSTOMER_RESOURCES = [
    "share-of-search",
    "data-wrapped",
    "data-wrapped-reports",
    "shopify-markets",
    "shopify-products",
    "segmentation-shopifyql",
    "dashboard-audit",
    "ai-analysis",
    "ai-analysis-chat",
    "campaign-planner-workspace",
    "campaign-planner-comments",
    "bing-webmaster-site-data",
    "bing-webmaster-ai-performance",
    "merged-sources-filtered",
    "apex-radar-customer-settings",
];

export const MCP_EXTENDED_GLOBAL_RESOURCES = [
    "our-tools",
    "parent-customer-detail",
    "parent-customer-aggregated",
    "parent-customer-filters",
    "user-campaigns",
    "apex-radar-assignments",
    "apex-radar-google-overview",
    "apex-radar-facebook-overview",
    "apex-radar-google-investigator",
    "apex-radar-facebook-investigator",
    "bing-webmaster-status",
    "seo-list-properties",
];

function readOnly(payload) {
    return { readOnly: true, ...sanitizeForMcp(payload) };
}

function buildSettingsFromCustomer(data) {
    return {
        customerName: data.customerName,
        customerType: data.customerType || "Shopify",
        ...(data.CustomerSettings || {}),
        CustomerStaticExpenses: data.CustomerStaticExpenses || {},
    };
}

function buildMergedSourcesQuerySuffix(query) {
    let suffix = "";
    if (queryParam(query, "shopifyMarketNoSelection") === "1") {
        suffix += "&shopifyMarketNoSelection=1";
    }
    const marketsRaw = queryParam(query, "shopifyMarkets");
    if (marketsRaw) {
        suffix += `&shopifyMarkets=${encodeURIComponent(marketsRaw)}`;
    }
    if (queryParam(query, "shopifyMarketFilterAdSpend") === "1") {
        suffix += "&shopifyMarketFilterAdSpend=1";
    }
    const adSpendExclude = queryParam(query, "adSpendExclude");
    if (adSpendExclude) {
        suffix += `&adSpendExclude=${encodeURIComponent(adSpendExclude)}`;
    }
    return suffix;
}

async function gscQuery(searchconsole, siteUrl, body) {
    const { data } = await searchconsole.searchanalytics.query({ siteUrl, requestBody: body });
    return data?.rows || [];
}

function parseShopifyMarketsSelection(query) {
    const raw = queryParam(query, "shopifyMarkets");
    if (!raw) return undefined;
    try {
        const parsed = JSON.parse(decodeURIComponent(raw));
        if (!Array.isArray(parsed)) return undefined;
        return parsed
            .map((row) => ({
                shopifyqlMarketId: String(row?.shopifyqlMarketId ?? row?.id ?? "").trim(),
                handle:
                    row?.handle != null && String(row.handle).trim() !== ""
                        ? String(row.handle).trim()
                        : undefined,
            }))
            .filter((m) => m.shopifyqlMarketId);
    } catch {
        return undefined;
    }
}

function mergedSourcesOptionsFromQuery(query) {
    const excludeAdSpendPlatforms = parseAdSpendExcludeQueryParam(queryParam(query, "adSpendExclude"));
    const shopifyMarketsSelection = parseShopifyMarketsSelection(query);
    const legacyId = queryParam(query, "shopifyMarketId");
    let markets = shopifyMarketsSelection;
    if (!markets && legacyId) {
        markets = [{ shopifyqlMarketId: legacyId, handle: undefined }];
    }

    return {
        dailyBreakdown: queryParam(query, "source") !== "performance-dashboard" ? true : true,
        source: queryParam(query, "source") || "daily-overview",
        excludeAdSpendPlatforms,
        shopifyMarketNoSelection: queryParam(query, "shopifyMarketNoSelection") === "1",
        shopifyMarketsSelection: markets,
        shopifyMarketFilterAdSpend: queryParam(query, "shopifyMarketFilterAdSpend") === "1",
    };
}

function getMonthRange(period) {
    const [year, month] = period.split("-").map(Number);
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { startDate, endDate };
}

function buildWrappedData(merged, customer, period) {
    const [year, month] = period.split("-").map(Number);
    const { shopifyDaily, facebookDaily, googleDaily, grossProfitNetSales } = merged;
    const netRevenue = shopifyDaily.reduce((sum, d) => sum + (d.net_sales || 0), 0);
    const totalSales = shopifyDaily.reduce((sum, d) => sum + (d.total_sales || 0), 0);
    const orders = shopifyDaily.reduce((sum, d) => sum + (d.orders || 0), 0);
    const fbAdspend = facebookDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    const googleAdspend = googleDaily.reduce((sum, d) => sum + (d.spend || 0), 0);
    const totalAdspend = fbAdspend + googleAdspend;
    const settings = customer?.CustomerSettings || {};
    const services = [];
    if (settings.facebookAdAccountId) services.push("PS");
    if (settings.googleAdsCustomerId) services.push("PPC");
    if (settings.googleSearchConsoleProperty) services.push("SEO");
    if (settings.shopifyUrl || settings.wooCommerceApiUrl) services.push("EM");
    if (services.length === 0) services.push("Ecommerce");

    return {
        customerName: customer?.customerName || "Your Store",
        period,
        year,
        month,
        netRevenue,
        orders,
        roas: totalAdspend > 0 ? totalSales / totalAdspend : 0,
        poas: totalAdspend > 0 ? calcBlendedPoasOrZero(grossProfitNetSales, totalAdspend) : 0,
        totalSpend: totalAdspend,
        netAov: orders > 0 ? netRevenue / orders : 0,
        topChannel: fbAdspend >= googleAdspend ? "Facebook" : "Google",
        topChannelShare:
            totalAdspend > 0
                ? Math.round(
                      ((fbAdspend >= googleAdspend ? fbAdspend : googleAdspend) / totalAdspend) * 100
                  )
                : 0,
        services,
    };
}

/**
 * @param {string} source
 * @param {string} customerId
 * @param {Record<string, string | undefined>} query
 */
export async function fetchMcpExtendedDataSource(source, customerId, query = {}) {
    const customer = await loadCustomerForMcp(customerId);
    const startDate = queryParam(query, "startDate");
    const endDate = queryParam(query, "endDate");
    const range = parseMcpDateRange(startDate, endDate);
    const cs = customer.settings;

    switch (source) {
        case "meta-ad-performance": {
            if (customer.isDemo) {
                return readOnly({
                    source,
                    customerId,
                    ...range,
                    metrics: getDemoFacebookAdsAdPerformanceForRange(range.startDate, range.endDate),
                });
            }
            const adAccountId = cs.facebookAdAccountId;
            if (!isValidIntegrationId(adAccountId)) {
                throw new Error("Facebook/Meta ad account not configured");
            }
            const token = process.env.FACEBOOK_APP_TOKEN;
            if (!token) throw new Error("Facebook app token not configured on server");
            const metrics = await fetchFacebookAdsAdPerformance({
                accessToken: token,
                adAccountId,
                startDate: range.startDate,
                endDate: range.endDate,
                metaIdInclude: cs.customerMetaID || undefined,
                metaIdExclude: cs.customerMetaIDExclude || undefined,
            });
            return readOnly({ source, customerId, ...range, metrics });
        }
        case "google-ad-performance": {
            if (customer.isDemo) {
                return readOnly({
                    source,
                    customerId,
                    ...range,
                    metrics: getDemoGoogleAdsAdPerformanceForRange(range.startDate, range.endDate),
                });
            }
            const googleCustomerId = cs.googleAdsCustomerId;
            if (!isValidIntegrationId(googleCustomerId)) {
                throw new Error("Google Ads customer ID not configured");
            }
            const metrics = await fetchGoogleAdsAdPerformance({
                developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
                clientId: process.env.GOOGLE_ADS_CLIENT_ID,
                clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET,
                refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN,
                customerId: googleCustomerId,
                managerCustomerId: process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID,
                startDate: range.startDate,
                endDate: range.endDate,
            });
            return readOnly({ source, customerId, ...range, metrics });
        }
        case "google-ppc-dashboard": {
            if (customer.isDemo) {
                return readOnly({
                    source,
                    customerId,
                    ...range,
                    metrics: getDemoGooglePpcDashboardForRange(range.startDate, range.endDate),
                });
            }
            const googleCustomerId = cs.googleAdsCustomerId;
            if (!isValidIntegrationId(googleCustomerId)) {
                throw new Error("Google Ads customer ID not configured");
            }
            const metrics = await fetchGoogleAdsPPCDashboardMetrics({
                developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
                clientId: process.env.GOOGLE_ADS_CLIENT_ID,
                clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET,
                refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN,
                customerId: googleCustomerId,
                managerCustomerId: process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID,
                startDate: range.startDate,
                endDate: range.endDate,
                countryFilter: cs.googleAdsCountryFilter || undefined,
                countryExclude: cs.googleAdsCountryExclude || undefined,
            });
            return readOnly({ source, customerId, ...range, metrics });
        }
        case "klaviyo-dashboard": {
            const prevStartDate = queryParam(query, "prevStartDate");
            const prevEndDate = queryParam(query, "prevEndDate");
            if (customer.isDemo) {
                return readOnly({
                    source,
                    customerId,
                    ...range,
                    metrics: getDemoKlaviyoDashboardForRange(
                        range.startDate,
                        range.endDate,
                        prevStartDate,
                        prevEndDate
                    ),
                });
            }
            const doc = await getCustomerById(customerId);
            const apiKey = doc?.CustomerSettings?.klaviyoPrivateApiKey;
            if (!apiKey?.trim()) throw new Error("Klaviyo not configured for this customer");
            const metrics = await fetchKlaviyoDashboardMetricsBothPeriods({
                apiKey: apiKey.trim(),
                startDate: range.startDate,
                endDate: range.endDate,
                prevStartDate: prevStartDate || null,
                prevEndDate: prevEndDate || null,
            });
            return readOnly({ source, customerId, ...range, metrics });
        }
        case "pinterest-dashboard": {
            if (customer.isDemo) {
                return readOnly({
                    source,
                    customerId,
                    ...range,
                    metrics: getDemoPinterestDashboardForRange(range.startDate, range.endDate),
                });
            }
            const adAccountId = String(cs.pinterestAdAccountId || "").trim();
            if (!adAccountId) throw new Error("Pinterest ad account not configured");
            const token = String(process.env.PINTEREST_ACCESS_TOKEN || "").trim();
            if (!token) throw new Error("PINTEREST_ACCESS_TOKEN not configured on server");
            const metrics = await fetchPinterestDashboardMetrics({
                accessToken: token,
                adAccountId,
                startDate: range.startDate,
                endDate: range.endDate,
            });
            return readOnly({ source, customerId, ...range, metrics });
        }
        case "snapchat-dashboard": {
            if (customer.isDemo) {
                return readOnly({
                    source,
                    customerId,
                    ...range,
                    metrics: getDemoSnapchatDashboardForRange(range.startDate, range.endDate),
                });
            }
            const snap = normalizeSnapchatSettings(cs.snapchat || {});
            const accessToken = await resolveSnapchatAccessTokenForCustomer(snap);
            const metrics = await fetchSnapchatDashboardMetrics({
                accessToken,
                adAccountId: snap.adAccountId,
                startDate: range.startDate,
                endDate: range.endDate,
            });
            return readOnly({ source, customerId, ...range, metrics });
        }
        case "reddit-dashboard": {
            if (customer.isDemo) {
                return readOnly({
                    source,
                    customerId,
                    ...range,
                    metrics: getDemoRedditDashboardForRange(range.startDate, range.endDate),
                });
            }
            const reddit = normalizeRedditSettings(cs.reddit || {});
            const accessToken = await resolveRedditAccessTokenForCustomer(reddit);
            const metrics = await fetchRedditDashboardMetrics({
                accessToken,
                adAccountId: reddit.adAccountId,
                startDate: range.startDate,
                endDate: range.endDate,
            });
            return readOnly({ source, customerId, ...range, metrics });
        }
        case "bing-dashboard": {
            if (customer.isDemo) {
                return readOnly({
                    source,
                    customerId,
                    ...range,
                    metrics: getDemoBingDashboardForRange(range.startDate, range.endDate),
                });
            }
            if (!isMicrosoftAdvertisingConfigured()) {
                throw new Error("Microsoft Advertising not configured on server");
            }
            const metrics = await fetchBingAdsDashboardMetrics({
                customerSettings: cs,
                startDate: range.startDate,
                endDate: range.endDate,
            });
            return readOnly({ source, customerId, ...range, metrics });
        }
        case "seo-brand-keywords": {
            if (isDemoCustomerId(customerId)) {
                return readOnly({ source, customerId, data: getDemoPayload("seoKeywordsBrand") });
            }
            const doc = await SEOBrandKeyword.findOne({ customer: customerId }).lean();
            return readOnly({
                source,
                customerId,
                data: doc || { keywords: [] },
            });
        }
        case "seo-exact-keywords": {
            if (isDemoCustomerId(customerId)) {
                return readOnly({ source, customerId, groups: getDemoPayload("seoKeywordsExact") || [] });
            }
            const groups = await SEOExactKeywordGroup.find({ customer: customerId }).lean();
            return readOnly({ source, customerId, groups });
        }
        case "seo-partial-keywords": {
            if (isDemoCustomerId(customerId)) {
                return readOnly({ source, customerId, groups: getDemoPayload("seoKeywordsPartial") || [] });
            }
            const groups = await SEOPartialKeywordGroup.find({ customer: customerId }).lean();
            return readOnly({ source, customerId, groups });
        }
        case "seo-insights": {
            const compareStartDate = queryParam(query, "compareStartDate");
            const compareEndDate = queryParam(query, "compareEndDate");
            const siteUrl =
                queryParam(query, "siteUrl") || cs.googleSearchConsoleProperty || cs.ga4PropertyId;
            if (!siteUrl) throw new Error("siteUrl or GSC property required");
            let brandTerms = [];
            if (!isDemoCustomerId(customerId)) {
                const brandDoc = await SEOBrandKeyword.findOne({ customer: customerId }).lean();
                brandTerms = Array.isArray(brandDoc?.keywords) ? brandDoc.keywords : [];
            }
            if (isDemoCustomerId(customerId)) {
                const data = await buildSeoInsightsBundle({
                    customerId,
                    siteUrl,
                    startDate: range.startDate,
                    endDate: range.endDate,
                    brandTerms,
                });
                return readOnly({ source, customerId, ...range, data });
            }
            const searchconsole = await getSearchConsoleClient();
            const hasCompare = Boolean(compareStartDate && compareEndDate);
            const [
                gscKeywords,
                gscPages,
                gscQueryPage,
                gscDateQuery,
                gscKeywordsPrev,
                gscPagesPrev,
            ] = await Promise.all([
                gscQuery(searchconsole, siteUrl, {
                    startDate: range.startDate,
                    endDate: range.endDate,
                    dimensions: ["query"],
                    rowLimit: 500,
                    orderBy: [{ field: "clicks", desc: true }],
                }),
                gscQuery(searchconsole, siteUrl, {
                    startDate: range.startDate,
                    endDate: range.endDate,
                    dimensions: ["page"],
                    rowLimit: 100,
                    orderBy: [{ field: "clicks", desc: true }],
                }),
                gscQuery(searchconsole, siteUrl, {
                    startDate: range.startDate,
                    endDate: range.endDate,
                    dimensions: ["query", "page"],
                    rowLimit: 5000,
                }),
                gscQuery(searchconsole, siteUrl, {
                    startDate: range.startDate,
                    endDate: range.endDate,
                    dimensions: ["date", "query"],
                    rowLimit: 25000,
                }),
                hasCompare
                    ? gscQuery(searchconsole, siteUrl, {
                          startDate: compareStartDate,
                          endDate: compareEndDate,
                          dimensions: ["query"],
                          rowLimit: 500,
                      })
                    : Promise.resolve([]),
                hasCompare
                    ? gscQuery(searchconsole, siteUrl, {
                          startDate: compareStartDate,
                          endDate: compareEndDate,
                          dimensions: ["page"],
                          rowLimit: 100,
                      })
                    : Promise.resolve([]),
            ]);
            const gscClicks = gscKeywords.reduce((s, r) => s + (r.clicks || 0), 0);
            const supplemental = await fetchSeoDashboardSupplemental({
                customerId,
                siteUrl,
                startDate: range.startDate,
                endDate: range.endDate,
                gscClicks,
            });
            const data = await buildSeoInsightsBundle({
                customerId,
                siteUrl,
                startDate: range.startDate,
                endDate: range.endDate,
                compareStartDate,
                compareEndDate,
                gscKeywords,
                gscKeywordsPrev,
                gscPages,
                gscPagesPrev,
                gscQueryPage,
                gscDateQuery,
                supplemental,
                brandTerms,
            });
            return readOnly({ source, customerId, ...range, data });
        }
        default:
            throw new Error(`Unknown extended MCP data source: ${source}`);
    }
}

/**
 * @param {string} customerId
 * @param {string} resource
 * @param {Record<string, string | undefined>} query
 */
export async function fetchMcpExtendedCustomerResource(customerId, resource, query = {}) {
    switch (resource) {
        case "share-of-search": {
            if (isDemoCustomerId(customerId)) {
                return readOnly({ customerId, items: getDemoPayload("shareOfSearchHistory") || [] });
            }
            const items = await ShareOfSearchSnapshot.find({ customerId })
                .sort({ createdAt: -1 })
                .limit(50)
                .lean();
            return readOnly({ customerId, items });
        }
        case "data-wrapped": {
            const period = queryParam(query, "period");
            if (!period || !/^\d{4}-\d{2}$/.test(period)) {
                throw new Error("period is required (YYYY-MM)");
            }
            const { startDate, endDate } = getMonthRange(period);
            if (isDemoCustomerId(customerId)) {
                const customer = getDemoPayload("customer");
                const merged = getDemoMergedSourcesForRange(startDate, endDate, customer, {});
                return readOnly({
                    customerId,
                    period,
                    wrapped: buildWrappedData(merged, customer, period),
                });
            }
            const doc = await getCustomerById(customerId);
            if (!doc) throw new Error("Customer not found");
            const data = doc.toObject ? doc.toObject() : doc;
            const merged = await fetchMergedSources(buildSettingsFromCustomer(data), startDate, endDate, {
                dailyBreakdown: true,
            });
            return readOnly({
                customerId,
                period,
                wrapped: buildWrappedData(merged, data, period),
            });
        }
        case "data-wrapped-reports": {
            if (isDemoCustomerId(customerId)) {
                return readOnly({ customerId, reports: getDemoPayload("dataWrappedReports") });
            }
            const reports = await DataWrappedReport.find({ customerId })
                .sort({ period: -1 })
                .lean();
            return readOnly({ customerId, reports });
        }
        case "shopify-markets": {
            if (isDemoCustomerId(customerId)) {
                return readOnly({ customerId, ...(getDemoPayload("shopifyMarkets") || { markets: [] }) });
            }
            const doc = await getCustomerById(customerId);
            if (!doc) throw new Error("Customer not found");
            const cs = doc.CustomerSettings || {};
            const shop = cs.shopifyUrl;
            const token = cs.shopifyApiPassword;
            if (!shop || !token) throw new Error("Shopify not configured");
            const { markets } = await fetchShopifyMarketsCatalog(shop, token);
            return readOnly({ customerId, markets: markets || [] });
        }
        case "shopify-products": {
            const range = parseMcpDateRange(queryParam(query, "startDate"), queryParam(query, "endDate"));
            if (isDemoCustomerId(customerId)) {
                return readOnly({
                    customerId,
                    ...range,
                    products: getDemoPayload("shopifyProducts") || [],
                });
            }
            const doc = await getCustomerById(customerId);
            if (!doc) throw new Error("Customer not found");
            const data = doc.toObject ? doc.toObject() : doc;
            const settings = {
                ...buildSettingsFromCustomer(data),
                shopifyUrl: data.CustomerSettings?.shopifyUrl,
                shopifyApiPassword: data.CustomerSettings?.shopifyApiPassword,
            };
            const products = await fetchShopifyProductMetrics(
                settings,
                range.startDate,
                range.endDate,
                { fast: queryParam(query, "fast") === "true" }
            );
            return readOnly({ customerId, ...range, products });
        }
        case "segmentation-shopifyql": {
            const range = parseMcpDateRange(queryParam(query, "startDate"), queryParam(query, "endDate"));
            const full = queryParam(query, "full") === "true";
            if (isDemoCustomerId(customerId)) {
                const customer = getDemoPayload("customer");
                const excludeAdSpendPlatforms = parseAdSpendExcludeQueryParam(
                    queryParam(query, "adSpendExclude")
                );
                const merged = getDemoMergedSourcesForRange(
                    range.startDate,
                    range.endDate,
                    customer,
                    { excludeAdSpendPlatforms }
                );
                const data = full
                    ? getDemoShopifyqlFullFromMerged(merged)
                    : getDemoShopifyqlSegmentationFromMerged(merged);
                return readOnly({ customerId, ...range, data });
            }
            const doc = await getCustomerById(customerId);
            if (!doc) throw new Error("Customer not found");
            const mergedSourcesQuerySuffix = buildMergedSourcesQuerySuffix(query);
            const data = full
                ? await fetchCustomerSegmentationShopifyqlFull(
                      customerId,
                      range.startDate,
                      range.endDate,
                      { mergedSourcesQuerySuffix }
                  )
                : await fetchCustomerSegmentationShopifyql(
                      customerId,
                      range.startDate,
                      range.endDate
                  );
            return readOnly({ customerId, ...range, data });
        }
        case "dashboard-audit": {
            if (!mongoose.Types.ObjectId.isValid(customerId)) {
                throw new Error("Invalid customerId");
            }
            const auditId = queryParam(query, "auditId");
            const custOid = new mongoose.Types.ObjectId(customerId);
            if (auditId) {
                if (!mongoose.Types.ObjectId.isValid(auditId)) {
                    throw new Error("Invalid auditId");
                }
                const doc = await CustomerChannelAudit.findOne({
                    _id: new mongoose.Types.ObjectId(auditId),
                    customerId: custOid,
                }).lean();
                if (!doc) throw new Error("Audit not found");
                return readOnly({
                    customerId,
                    auditId: String(doc._id),
                    dateRange: doc.dateRange,
                    comparisonDateRange: doc.comparisonDateRange || null,
                    report: doc.report,
                    canonicalOverall: doc.canonicalOverall || doc.report?.canonicalOverall,
                    generatedAt: doc.createdAt,
                });
            }
            const rows = await CustomerChannelAudit.find({ customerId: custOid })
                .sort({ createdAt: -1 })
                .limit(100)
                .select("_id createdAt dateRange serviceIds canonicalOverall customerNameSnapshot")
                .lean();
            return readOnly({
                customerId,
                audits: rows.map((r) => ({
                    auditId: String(r._id),
                    createdAt: r.createdAt,
                    dateRange: r.dateRange,
                    serviceIds: r.serviceIds || [],
                    canonicalOverall: r.canonicalOverall,
                    customerNameSnapshot: r.customerNameSnapshot || "",
                })),
            });
        }
        case "ai-analysis": {
            const dashboardType = queryParam(query, "dashboardType");
            const filter = { customerId, status: "active" };
            if (dashboardType) filter.dashboardType = dashboardType;
            const chats = await AiAnalysisChat.find(filter).sort({ updatedAt: -1 }).limit(50).lean();
            return readOnly({ customerId, chats });
        }
        case "ai-analysis-chat": {
            const chatId = queryParam(query, "chatId");
            if (!chatId) throw new Error("chatId is required");
            const chat = await AiAnalysisChat.findOne({ _id: chatId, customerId }).lean();
            if (!chat) throw new Error("Chat not found");
            return readOnly({ customerId, chat });
        }
        case "campaign-planner-workspace": {
            if (isDemoCustomerId(customerId)) {
                return readOnly({
                    customerId,
                    parents: [],
                    services: [],
                    lineItems: [],
                    customFormats: [],
                    extraMediaByService: {},
                });
            }
            const workspace = await CampaignPlannerV2Workspace.findOne({ customerId }).lean();
            return readOnly({
                customerId,
                ...(workspace || {
                    parents: [],
                    services: [],
                    lineItems: [],
                    customFormats: [],
                    extraMediaByService: {},
                }),
            });
        }
        case "campaign-planner-comments": {
            const lineItemId = queryParam(query, "lineItemId");
            if (!lineItemId) throw new Error("lineItemId is required");
            const comments = await CampaignPlannerComment.find({ customerId, lineItemId })
                .sort({ createdAt: 1 })
                .lean();
            return readOnly({ customerId, lineItemId, comments });
        }
        case "bing-webmaster-site-data":
            return fetchMcpBingWebmasterSiteData(customerId, query);
        case "bing-webmaster-ai-performance":
            return fetchMcpBingWebmasterAiPerformance(customerId, query);
        case "merged-sources-filtered": {
            const range = parseMcpDateRange(queryParam(query, "startDate"), queryParam(query, "endDate"));
            if (isDemoCustomerId(customerId)) {
                const customer = getDemoPayload("customer");
                const merged = getDemoMergedSourcesForRange(
                    range.startDate,
                    range.endDate,
                    customer,
                    mergedSourcesOptionsFromQuery(query)
                );
                return readOnly({ customerId, ...range, ...merged });
            }
            const doc = await getCustomerById(customerId);
            if (!doc) throw new Error("Customer not found");
            const data = doc.toObject ? doc.toObject() : doc;
            const merged = await fetchMergedSources(
                buildSettingsFromCustomer(data),
                range.startDate,
                range.endDate,
                mergedSourcesOptionsFromQuery(query)
            );
            return readOnly({ customerId, ...range, ...merged });
        }
        case "apex-radar-customer-settings": {
            if (isDemoCustomerId(customerId)) {
                return readOnly({ customerId, google: null, facebook: null });
            }
            const [google, facebook] = await Promise.all([
                ApexRadarChannelSettings.findOne({
                    channel: APEX_RADAR_CHANNEL_GOOGLE_ADS,
                    customerId,
                }).lean(),
                ApexRadarChannelSettings.findOne({
                    channel: APEX_RADAR_CHANNEL_FACEBOOK,
                    customerId,
                }).lean(),
            ]);
            return readOnly({ customerId, google, facebook });
        }
        default:
            throw new Error(`Unknown extended customer resource: ${resource}`);
    }
}

async function fetchMcpBingWebmasterSiteData(customerId, query) {
    const startDate = queryParam(query, "startDate");
    const endDate = queryParam(query, "endDate");
    const customer = await Customer.findById(customerId).select("CustomerSettings").lean();
    if (!customer) throw new Error("Customer not found");
    const siteResolved = resolveBingWebmasterSiteUrl(
        customer.CustomerSettings?.bingWebmasterSiteUrl,
        customerId
    );
    if (siteResolved.error) throw new Error(siteResolved.error);
    const { siteUrl } = siteResolved;

    const { apiKey } = getBingWebmasterApiConfig();
    let authCtx = null;
    if (!apiKey) {
        authCtx = await resolveBingWebmasterAccessToken();
        if (!authCtx.accessToken) {
            throw new Error("Bing Webmaster auth not configured");
        }
    }

    const sitesResult = await bingWebmasterJsonGet("GetUserSites", {}, authCtx);
    if (!sitesResult.res?.ok) throw new Error("GetUserSites failed");
    const trafficResult = await bingWebmasterJsonGet("GetRankAndTrafficStats", { siteUrl }, authCtx);
    if (!trafficResult.res?.ok) throw new Error("GetRankAndTrafficStats failed");

    const sitesJson = await parseBingJsonResponse(sitesResult.res);
    const trafficJson = await parseBingJsonResponse(trafficResult.res);
    const sitesList = Array.isArray(sitesJson?.d) ? sitesJson.d : [];
    let trafficRows = (Array.isArray(trafficJson?.d) ? trafficJson.d : [])
        .map((row) => {
            const d = row?.Date != null ? parseBingDotNetDate(String(row.Date)) : null;
            return {
                date: d ? d.toISOString().slice(0, 10) : null,
                impressions: row?.Impressions ?? null,
                clicks: row?.Clicks ?? null,
            };
        })
        .filter((r) => r.date)
        .sort((a, b) => (a.date < b.date ? -1 : 1));

    if (startDate && endDate) {
        trafficRows = trafficRows.filter((r) => r.date >= startDate && r.date <= endDate);
    } else {
        trafficRows = trafficRows.slice(-90);
    }

    return readOnly({
        customerId,
        siteUrl,
        sites: sitesList.map((s) => ({ url: s.Url, isVerified: s.IsVerified })),
        traffic: trafficRows,
    });
}

async function fetchMcpBingWebmasterAiPerformance(customerId, query) {
    const range = parseMcpDateRange(queryParam(query, "startDate"), queryParam(query, "endDate"));
    const customer = await Customer.findById(customerId).select("CustomerSettings").lean();
    if (!customer) throw new Error("Customer not found");
    const siteResolved = resolveBingWebmasterSiteUrl(
        customer.CustomerSettings?.bingWebmasterSiteUrl,
        customerId
    );
    if (siteResolved.error) throw new Error(siteResolved.error);
    const aiDays = eachDayInRange(range.startDate, range.endDate);
    return readOnly({
        customerId,
        siteUrl: siteResolved.siteUrl,
        ...range,
        aiPerformance: {
            seriesDaily: aiDays.map((date) => ({
                date,
                totalCitations: 0,
                avgCitedPages: 0,
            })),
            dataAvailable: false,
        },
    });
}

/**
 * @param {string} resource
 * @param {Record<string, string | undefined>} query
 */
export async function fetchMcpExtendedGlobalResource(resource, query = {}) {
    switch (resource) {
        case "our-tools": {
            const tools = await getOurTools();
            return readOnly({
                tools: tools.map((t) => (t.toObject ? t.toObject() : t)),
            });
        }
        case "parent-customer-detail": {
            const parentId = queryParam(query, "parentId");
            if (!parentId) throw new Error("parentId is required");
            const parent = await getParentCustomerById(parentId);
            if (!parent) throw new Error("Parent customer not found");
            const obj = parent.toObject ? parent.toObject() : parent;
            return readOnly({
                id: String(obj._id),
                name: obj.name || "",
                customers: (obj.customers || []).map((c) => serializeCustomerForMcp(c)),
            });
        }
        case "parent-customer-aggregated": {
            const parentId = queryParam(query, "parentId");
            if (!parentId) throw new Error("parentId is required");
            const data = await fetchParentCustomerAggregated(parentId, query);
            return readOnly(data);
        }
        case "parent-customer-filters": {
            const parentId = queryParam(query, "parentId");
            if (!parentId) throw new Error("parentId is required");
            const doc = await getCustomerFiltersByParentId(parentId);
            return readOnly({
                parentId,
                googleAds: googleAdsFiltersDocToClientState(doc),
                metaAds: metaAdsFiltersDocToClientState(doc),
            });
        }
        case "user-campaigns": {
            const userId = queryParam(query, "userId");
            if (!userId) throw new Error("userId is required");
            const campaigns = await getCampaignsByAssignedUser(userId);
            return readOnly({ userId, campaigns: sanitizeForMcp(campaigns) });
        }
        case "apex-radar-assignments": {
            const channel = queryParam(query, "channel");
            if (!channel || !APEX_RADAR_CHANNELS.includes(channel)) {
                throw new Error("channel is required (facebook or google-ads)");
            }
            const docs = await ApexRadarAccountAssignment.find({ channel }).lean();
            /** @type {Record<string, { userIds: string[], paidSocialExcludedUserIds: string[] }>} */
            const assignments = {};
            for (const d of docs) {
                const excluded = await resolvePaidSocialExcludedUserIdsFromDoc(d);
                assignments[String(d.customerId)] = {
                    userIds: (d.assignedUserIds || []).map(String),
                    paidSocialExcludedUserIds: excluded,
                };
            }
            return readOnly({ channel, assignments });
        }
        case "apex-radar-google-overview":
            return fetchApexRadarOverview("google-ads", query);
        case "apex-radar-facebook-overview":
            return fetchApexRadarOverview("facebook", query);
        case "apex-radar-google-investigator":
            return fetchApexRadarInvestigator("google-ads", query);
        case "apex-radar-facebook-investigator":
            return fetchApexRadarInvestigator("facebook", query);
        case "bing-webmaster-status": {
            const env = getBingWebmasterEnv();
            const { apiKey: webmasterApiKey } = getBingWebmasterApiConfig();
            return readOnly({
                env: {
                    hasClientId: !!env.clientId,
                    hasClientSecret: !!env.clientSecret,
                    hasRedirectUri: !!env.redirectUri,
                    apiJsonBase: env.apiJsonBase,
                    hasEnvAccessToken: !!env.accessTokenFromEnv,
                    hasEnvRefreshToken: !!env.refreshTokenFromEnv,
                    hasWebmasterApiKey: !!webmasterApiKey,
                },
            });
        }
        case "seo-list-properties": {
            const searchconsole = await getSearchConsoleClient();
            const { data } = await searchconsole.sites.list();
            return readOnly({ sites: data?.siteEntry || [] });
        }
        default:
            throw new Error(`Unknown extended global resource: ${resource}`);
    }
}

async function fetchApexRadarOverview(channel, query) {
    const range = parseMcpDateRange(queryParam(query, "startDate"), queryParam(query, "endDate"));
    const filterCustomerId = queryParam(query, "customerId");

    let customers = await getAllCustomers();
    customers = customers.map((c) => {
        const plain = c.toObject ? c.toObject() : c;
        const id = String(plain._id);
        if (!isDemoCustomerId(id)) return plain;
        return mergeDemoCustomerDocument(plain);
    });
    if (filterCustomerId) {
        customers = customers.filter((c) => String(c._id) === filterCustomerId);
    }

    const channelKey =
        channel === "google-ads" ? APEX_RADAR_CHANNEL_GOOGLE_ADS : APEX_RADAR_CHANNEL_FACEBOOK;
    const channelSettingsDocs = await ApexRadarChannelSettings.find({
        channel: channelKey,
        customerId: { $in: customers.map((c) => c._id) },
    }).lean();

    if (channel === "google-ads") {
        customers = mergeGoogleChannelSettingsIntoCustomers(customers, channelSettingsDocs);
        const { rows, windows } = await fetchApexRadarGoogleAdsOverviewRows({
            startDate: range.startDate,
            endDate: range.endDate,
            customers,
            isDemoCustomer: isDemoCustomerId,
            buildDemoRow: buildDemoApexRadarGoogleAdsOverviewRow,
        });
        return readOnly({ channel, ...range, rows, windows });
    }

    const token = process.env.FACEBOOK_APP_TOKEN;
    if (!token) throw new Error("Facebook token not configured");
    customers = mergeFacebookChannelSettingsIntoCustomers(customers, channelSettingsDocs);
    const { rows, windows } = await fetchApexRadarFacebookOverviewRows({
        accessToken: token,
        startDate: range.startDate,
        endDate: range.endDate,
        customers,
        isDemoCustomer: isDemoCustomerId,
        buildDemoRow: buildDemoApexRadarFacebookOverviewRow,
    });
    return readOnly({ channel, ...range, rows, windows });
}

async function fetchApexRadarInvestigator(channel, query) {
    const customerId = queryParam(query, "customerId");
    const funnelStartDate = queryParam(query, "funnelStartDate");
    const funnelEndDate = queryParam(query, "funnelEndDate");
    if (!customerId || !funnelStartDate || !funnelEndDate) {
        throw new Error("customerId, funnelStartDate, and funnelEndDate are required");
    }
    const currentYear =
        Number(queryParam(query, "currentYear")) || new Date().getUTCFullYear();
    const previousYear = currentYear - 1;
    const now = new Date();

    if (isDemoCustomerId(customerId)) {
        const demo = getDemoFacebookPerformanceInvestigatorPayload(currentYear, previousYear);
        const { prevStart, prevEnd } = priorPeriodRange(funnelStartDate, funnelEndDate);
        return readOnly({
            channel,
            customerId,
            ...demo,
            funnelRange: {
                startDate: funnelStartDate,
                endDate: funnelEndDate,
                compareStart: prevStart,
                compareEnd: prevEnd,
            },
        });
    }

    let customer = await getCustomerById(customerId);
    if (!customer) throw new Error("Customer not found");
    customer = customer.toObject ? customer.toObject() : customer;
    const settings = customer.CustomerSettings || {};

    if (channel === "google-ads") {
        const googleAdsCustomerId = String(settings.googleAdsCustomerId || "").trim();
        if (!googleAdsCustomerId) {
            return readOnly({
                channel,
                customerId,
                currentYear,
                previousYear,
                currentYearRows: buildPiMonthRowsForYear(currentYear, PI_MONTH_LABELS, new Map(), now),
                previousYearRows: buildPiMonthRowsForYear(previousYear, PI_MONTH_LABELS, new Map(), now),
                diffRows: [],
                funnel: buildPiFunnelFromAggregates({}, {}),
                funnelRange: { startDate: funnelStartDate, endDate: funnelEndDate },
            });
        }
        const since = `${previousYear}-01-01`;
        const until = `${currentYear}-12-31`;
        const byMonth = await fetchGooglePiMonthlyByMonthKey({
            googleAdsCustomerId,
            since,
            until,
            countryFilter: settings.googleAdsCountryFilter || undefined,
            countryExclude: settings.googleAdsCountryExclude || undefined,
        });
        const currentYearRows = buildPiMonthRowsForYear(currentYear, PI_MONTH_LABELS, byMonth, now);
        const previousYearRows = buildPiMonthRowsForYear(previousYear, PI_MONTH_LABELS, byMonth, now);
        const { prevStart, prevEnd } = priorPeriodRange(funnelStartDate, funnelEndDate);
        const [curAgg, prevAgg] = await Promise.all([
            fetchGooglePiRangeAggregate({
                googleAdsCustomerId,
                since: funnelStartDate,
                until: funnelEndDate,
                countryFilter: settings.googleAdsCountryFilter || undefined,
                countryExclude: settings.googleAdsCountryExclude || undefined,
            }),
            fetchGooglePiRangeAggregate({
                googleAdsCustomerId,
                since: prevStart,
                until: prevEnd,
                countryFilter: settings.googleAdsCountryFilter || undefined,
                countryExclude: settings.googleAdsCountryExclude || undefined,
            }),
        ]);
        return readOnly({
            channel,
            customerId,
            currentYear,
            previousYear,
            currentYearRows,
            previousYearRows,
            diffRows: computePiYearOverYearDiff(currentYearRows, previousYearRows),
            funnel: buildPiFunnelFromAggregates(curAgg || {}, prevAgg || {}),
            funnelRange: {
                startDate: funnelStartDate,
                endDate: funnelEndDate,
                compareStart: prevStart,
                compareEnd: prevEnd,
            },
        });
    }

    const token = process.env.FACEBOOK_APP_TOKEN;
    if (!token) throw new Error("Facebook token not configured");
    const adId = String(settings.facebookAdAccountId || "").trim();
    const metaInclude = settings.customerMetaID || "";
    const metaExclude = settings.customerMetaIDExclude || "";
    if (!adId) {
        return readOnly({
            channel,
            customerId,
            currentYear,
            previousYear,
            currentYearRows: buildPiMonthRowsForYear(currentYear, PI_MONTH_LABELS, new Map(), now),
            previousYearRows: buildPiMonthRowsForYear(previousYear, PI_MONTH_LABELS, new Map(), now),
            diffRows: [],
            funnel: buildPiFunnelFromAggregates({}, {}),
            funnelRange: { startDate: funnelStartDate, endDate: funnelEndDate },
        });
    }
    const since = `${previousYear}-01-01`;
    const until = `${currentYear}-12-31`;
    const byMonth = await fetchFacebookPiMonthlyByMonthKey({
        accessToken: token,
        adAccountId: adId,
        since,
        until,
        metaIdInclude: metaInclude,
        metaIdExclude: metaExclude,
    });
    const currentYearRows = buildPiMonthRowsForYear(currentYear, PI_MONTH_LABELS, byMonth, now);
    const previousYearRows = buildPiMonthRowsForYear(previousYear, PI_MONTH_LABELS, byMonth, now);
    const { prevStart, prevEnd } = priorPeriodRange(funnelStartDate, funnelEndDate);
    const [curAgg, prevAgg] = await Promise.all([
        fetchFacebookPiRangeAggregate({
            accessToken: token,
            adAccountId: adId,
            since: funnelStartDate,
            until: funnelEndDate,
            metaIdInclude: metaInclude,
            metaIdExclude: metaExclude,
        }),
        fetchFacebookPiRangeAggregate({
            accessToken: token,
            adAccountId: adId,
            since: prevStart,
            until: prevEnd,
            metaIdInclude: metaInclude,
            metaIdExclude: metaExclude,
        }),
    ]);
    return readOnly({
        channel,
        customerId,
        currentYear,
        previousYear,
        currentYearRows,
        previousYearRows,
        diffRows: computePiYearOverYearDiff(currentYearRows, previousYearRows),
        funnel: buildPiFunnelFromAggregates(curAgg, prevAgg),
        funnelRange: {
            startDate: funnelStartDate,
            endDate: funnelEndDate,
            compareStart: prevStart,
            compareEnd: prevEnd,
        },
    });
}

export function isValidMcpExtendedDataSource(source) {
    return MCP_EXTENDED_DATA_SOURCES.includes(String(source || "").trim());
}

export function isValidMcpExtendedCustomerResource(resource) {
    return MCP_EXTENDED_CUSTOMER_RESOURCES.includes(String(resource || "").trim());
}

export function isValidMcpExtendedGlobalResource(resource) {
    return MCP_EXTENDED_GLOBAL_RESOURCES.includes(String(resource || "").trim());
}

export function listMcpExtendedDataSources() {
    return [...MCP_EXTENDED_DATA_SOURCES];
}

export function listMcpExtendedCustomerResources() {
    return [...MCP_EXTENDED_CUSTOMER_RESOURCES];
}

export function listMcpExtendedGlobalResources() {
    return [...MCP_EXTENDED_GLOBAL_RESOURCES];
}
