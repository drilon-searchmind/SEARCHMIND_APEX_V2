import { fetchFacebookAdsPSDashboardMetrics, fetchMetaAdsCampaignList } from "@/lib/facebookApi";
import { fetchGoogleAdsCampaignList } from "@/lib/googleAdsApi";
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
import { runGa4Report } from "@/lib/ga4Api";
import { getSearchConsoleClient } from "@/lib/searchConsoleClient";
import { fetchMergedSources } from "@/lib/mergedSourcesApi";
import { AD_SPEND_CHANNELS } from "@/lib/mergeAdSpendDaily";
import { isValidIntegrationId } from "@/lib/customerServiceIntegrations";
import { getDemoPayload, isDemoCustomerId } from "@/lib/demoCustomer";
import {
    getDemoBingDashboardForRange,
    getDemoFacebookCampaignInsightsForRange,
    getDemoGooglePpcDashboardForRange,
    getDemoKlaviyoDashboardForRange,
    getDemoPinterestDashboardForRange,
    getDemoRedditDashboardForRange,
    getDemoSnapchatDashboardForRange,
} from "@/lib/demoAdMetrics";
import { getDemoMergedSourcesForRange } from "@/lib/demoMergedSources";
import { getDemoGa4TimeseriesForRange } from "@/lib/demoGa4";
import { buildDemoSeoMetricsForRange } from "@root/lib/mcpSeoDemo";
import { getCustomerById } from "@root/lib/customerOperations";
import { parseMcpDateRange } from "@root/lib/mcpApiHelpers";
import {
    fetchMcpExtendedDataSource,
    isValidMcpExtendedDataSource,
    listMcpExtendedDataSources,
} from "@root/lib/mcpExtendedService";

export const MCP_DATA_SOURCES = [
    "facebook",
    "google-ads",
    "pinterest",
    "snapchat",
    "reddit",
    "bing",
    "klaviyo",
    "store",
    "ga4",
    "seo",
    "meta-campaigns",
    "google-campaigns",
    ...listMcpExtendedDataSources(),
];

/**
 * @param {string} customerId
 */
export async function loadCustomerForMcp(customerId) {
    const id = String(customerId || "").trim();
    if (!id) throw new Error("customerId is required");

    if (isDemoCustomerId(id)) {
        const customer = getDemoPayload("customer");
        return {
            id,
            customerName: customer?.customerName || "Demo",
            customerType: customer?.customerType || "Shopify",
            settings: {
                customerName: customer?.customerName,
                customerType: customer?.customerType || "Shopify",
                ...(customer?.CustomerSettings || {}),
                CustomerStaticExpenses: customer?.CustomerStaticExpenses || {},
            },
            isDemo: true,
        };
    }

    const doc = await getCustomerById(id);
    if (!doc) throw new Error("Customer not found");
    const data = doc.toObject ? doc.toObject() : doc;
    return {
        id,
        customerName: data.customerName || "",
        customerType: data.customerType || "Shopify",
        settings: {
            customerName: data.customerName,
            customerType: data.customerType || "Shopify",
            ...(data.CustomerSettings || {}),
            CustomerStaticExpenses: data.CustomerStaticExpenses || {},
        },
        isDemo: false,
    };
}

function mcpEnvelope(source, customer, startDate, endDate, payload) {
    return {
        readOnly: true,
        source,
        customerId: customer.id,
        customerName: customer.customerName,
        customerType: customer.customerType,
        startDate,
        endDate,
        ...payload,
    };
}

function allAdPlatformIds() {
    return AD_SPEND_CHANNELS.map((c) => c.id);
}

async function fetchFacebookData(customer, startDate, endDate) {
    if (customer.isDemo) {
        return mcpEnvelope("facebook", customer, startDate, endDate, {
            metrics: getDemoFacebookCampaignInsightsForRange(startDate, endDate),
        });
    }

    const cs = customer.settings;
    const adAccountId = cs.facebookAdAccountId;
    if (!isValidIntegrationId(adAccountId)) {
        throw new Error("Facebook/Meta ad account not configured for this customer");
    }

    const token = process.env.FACEBOOK_APP_TOKEN;
    if (!token) throw new Error("Facebook app token not configured on server");

    const metrics = await fetchFacebookAdsPSDashboardMetrics({
        accessToken: token,
        adAccountId,
        startDate,
        endDate,
        metaIdInclude: cs.customerMetaID || undefined,
        metaIdExclude: cs.customerMetaIDExclude || undefined,
    });

    return mcpEnvelope("facebook", customer, startDate, endDate, { metrics });
}

async function fetchGoogleAdsData(customer, startDate, endDate) {
    if (customer.isDemo) {
        return mcpEnvelope("google-ads", customer, startDate, endDate, {
            metrics: getDemoGooglePpcDashboardForRange(startDate, endDate),
        });
    }

    const cs = customer.settings;
    const googleCustomerId = cs.googleAdsCustomerId;
    if (!isValidIntegrationId(googleCustomerId)) {
        throw new Error("Google Ads customer ID not configured for this customer");
    }

    const metrics = await fetchGoogleAdsPPCDashboardMetrics({
        developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        clientId: process.env.GOOGLE_ADS_CLIENT_ID,
        clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN,
        customerId: googleCustomerId,
        managerCustomerId: process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID,
        startDate,
        endDate,
        countryFilter: cs.googleAdsCountryFilter || undefined,
        countryExclude: cs.googleAdsCountryExclude || undefined,
    });

    return mcpEnvelope("google-ads", customer, startDate, endDate, { metrics });
}

async function fetchPinterestData(customer, startDate, endDate) {
    if (customer.isDemo) {
        return mcpEnvelope("pinterest", customer, startDate, endDate, {
            metrics: getDemoPinterestDashboardForRange(startDate, endDate),
        });
    }

    const adAccountId = String(customer.settings.pinterestAdAccountId || "").trim();
    if (!adAccountId) throw new Error("Pinterest ad account not configured for this customer");

    const token = String(process.env.PINTEREST_ACCESS_TOKEN || "").trim();
    if (!token) throw new Error("PINTEREST_ACCESS_TOKEN not configured on server");

    const metrics = await fetchPinterestDashboardMetrics({
        accessToken: token,
        adAccountId,
        startDate,
        endDate,
    });

    return mcpEnvelope("pinterest", customer, startDate, endDate, { metrics });
}

async function fetchSnapchatData(customer, startDate, endDate) {
    if (customer.isDemo) {
        return mcpEnvelope("snapchat", customer, startDate, endDate, {
            metrics: getDemoSnapchatDashboardForRange(startDate, endDate),
        });
    }

    const snap = normalizeSnapchatSettings(customer.settings.snapchat || {});
    if (!snap.adAccountId?.trim()) {
        throw new Error("Snapchat ad account not configured for this customer");
    }

    const accessToken = await resolveSnapchatAccessTokenForCustomer(snap);
    if (!accessToken) throw new Error("Snapchat access token unavailable for this customer");

    const metrics = await fetchSnapchatDashboardMetrics({
        accessToken,
        adAccountId: snap.adAccountId.trim(),
        startDate,
        endDate,
    });

    return mcpEnvelope("snapchat", customer, startDate, endDate, { metrics });
}

async function fetchRedditData(customer, startDate, endDate) {
    if (customer.isDemo) {
        return mcpEnvelope("reddit", customer, startDate, endDate, {
            metrics: getDemoRedditDashboardForRange(startDate, endDate),
        });
    }

    const reddit = normalizeRedditSettings(customer.settings.reddit || {});
    if (!reddit.adAccountId?.trim()) {
        throw new Error("Reddit ad account not configured for this customer");
    }

    const accessToken = await resolveRedditAccessTokenForCustomer({
        ...reddit,
        appId: reddit.appId || process.env.REDDIT_APP_ID || "",
        appSecret: reddit.appSecret || process.env.REDDIT_APP_SECRET || "",
    });
    if (!accessToken) throw new Error("Reddit access token unavailable for this customer");

    const metrics = await fetchRedditDashboardMetrics({
        accessToken,
        adAccountId: reddit.adAccountId.trim(),
        startDate,
        endDate,
    });

    return mcpEnvelope("reddit", customer, startDate, endDate, { metrics });
}

async function fetchBingData(customer, startDate, endDate) {
    if (customer.isDemo) {
        return mcpEnvelope("bing", customer, startDate, endDate, {
            metrics: getDemoBingDashboardForRange(startDate, endDate),
        });
    }

    if (!isMicrosoftAdvertisingConfigured()) {
        throw new Error("Microsoft Advertising not configured on server");
    }

    const cs = customer.settings;
    if (!cs.bingAdsCustomerId?.trim() || !cs.bingAdsAccountId?.trim()) {
        throw new Error("Microsoft/Bing Ads not configured for this customer");
    }

    const metrics = await fetchBingAdsDashboardMetrics({
        customerId: cs.bingAdsCustomerId.trim(),
        accountId: cs.bingAdsAccountId.trim(),
        startDate,
        endDate,
    });

    return mcpEnvelope("bing", customer, startDate, endDate, { metrics });
}

async function fetchKlaviyoData(customer, startDate, endDate) {
    if (customer.isDemo) {
        return mcpEnvelope("klaviyo", customer, startDate, endDate, {
            metrics: getDemoKlaviyoDashboardForRange(startDate, endDate, null, null),
        });
    }

    const apiKey = String(customer.settings.klaviyoPrivateApiKey || "").trim();
    if (!apiKey) throw new Error("Klaviyo API key not configured for this customer");

    const metrics = await fetchKlaviyoDashboardMetricsBothPeriods({
        apiKey,
        startDate,
        endDate,
        prevStartDate: null,
        prevEndDate: null,
    });

    return mcpEnvelope("klaviyo", customer, startDate, endDate, { metrics });
}

async function fetchStoreData(customer, startDate, endDate) {
    if (customer.isDemo) {
        const merged = getDemoMergedSourcesForRange(startDate, endDate, getDemoPayload("customer"), {});
        return mcpEnvelope("store", customer, startDate, endDate, {
            storeDaily: merged.shopifyDaily || [],
            grossProfitNetSales: merged.grossProfitNetSales,
            grossProfitTotalSales: merged.grossProfitTotalSales,
        });
    }

    const merged = await fetchMergedSources(customer.settings, startDate, endDate, {
        dailyBreakdown: true,
        source: "mcp",
        excludeAdSpendPlatforms: allAdPlatformIds(),
    });

    return mcpEnvelope("store", customer, startDate, endDate, {
        storeDaily: merged.shopifyDaily || [],
        grossProfitNetSales: merged.grossProfitNetSales,
        grossProfitTotalSales: merged.grossProfitTotalSales,
    });
}

async function fetchGa4Data(customer, startDate, endDate) {
    if (customer.isDemo) {
        return mcpEnvelope("ga4", customer, startDate, endDate, {
            report: getDemoGa4TimeseriesForRange(startDate, endDate),
        });
    }

    const propertyId = String(customer.settings.ga4PropertyId || "").trim();
    if (!propertyId) throw new Error("GA4 property ID not configured for this customer");

    const report = await runGa4Report({
        propertyId,
        startDate,
        endDate,
        metrics: ["totalUsers", "sessions", "screenPageViews", "bounceRate"],
        dimensions: ["date"],
    });

    return mcpEnvelope("ga4", customer, startDate, endDate, { report });
}

async function fetchSeoData(customer, startDate, endDate) {
    if (customer.isDemo) {
        return mcpEnvelope("seo", customer, startDate, endDate, {
            metrics: buildDemoSeoMetricsForRange(startDate, endDate),
        });
    }

    const siteUrl = String(customer.settings.googleSearchConsoleProperty || "").trim();
    if (!siteUrl) throw new Error("Google Search Console property not configured for this customer");

    const searchconsole = await getSearchConsoleClient();
    const { data: daily } = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
            startDate,
            endDate,
            dimensions: ["date"],
            rowLimit: 1000,
        },
    });
    const { data: topKeywords } = await searchconsole.searchanalytics.query({
        siteUrl,
        requestBody: {
            startDate,
            endDate,
            dimensions: ["query"],
            rowLimit: 100,
            orderBy: [{ field: "clicks", desc: true }],
        },
    });

    return mcpEnvelope("seo", customer, startDate, endDate, {
        metrics: { daily, topKeywords },
        siteUrl,
    });
}

async function fetchMetaCampaigns(customer, startDate, endDate) {
    if (customer.isDemo) {
        return mcpEnvelope("meta-campaigns", customer, startDate, endDate, {
            campaigns: [
                { id: "2001", name: "Prospecting - DK" },
                { id: "2002", name: "Retargeting" },
                { id: "2003", name: "Retail Stores Promo" },
            ],
        });
    }

    const cs = customer.settings;
    const adAccountId = cs.facebookAdAccountId;
    if (!isValidIntegrationId(adAccountId)) {
        throw new Error("Facebook/Meta ad account not configured for this customer");
    }

    const token = process.env.FACEBOOK_APP_TOKEN;
    if (!token) throw new Error("Facebook app token not configured on server");

    const campaigns = await fetchMetaAdsCampaignList(
        adAccountId,
        startDate,
        endDate,
        token
    );

    return mcpEnvelope("meta-campaigns", customer, startDate, endDate, { campaigns });
}

async function fetchGoogleCampaigns(customer, startDate, endDate) {
    if (customer.isDemo) {
        return mcpEnvelope("google-campaigns", customer, startDate, endDate, {
            campaigns: [
                { id: "1001", name: "Brand Search", status: "ENABLED" },
                { id: "1002", name: "Shopping - DK", status: "ENABLED" },
                { id: "1003", name: "Performance Max", status: "PAUSED" },
            ],
        });
    }

    const googleCustomerId = customer.settings.googleAdsCustomerId;
    if (!isValidIntegrationId(googleCustomerId)) {
        throw new Error("Google Ads customer ID not configured for this customer");
    }

    const campaigns = await fetchGoogleAdsCampaignList(googleCustomerId, startDate, endDate, {
        quietLog: false,
    });

    return mcpEnvelope("google-campaigns", customer, startDate, endDate, { campaigns });
}

const FETCHERS = {
    facebook: fetchFacebookData,
    "google-ads": fetchGoogleAdsData,
    pinterest: fetchPinterestData,
    snapchat: fetchSnapchatData,
    reddit: fetchRedditData,
    bing: fetchBingData,
    klaviyo: fetchKlaviyoData,
    store: fetchStoreData,
    ga4: fetchGa4Data,
    seo: fetchSeoData,
    "meta-campaigns": fetchMetaCampaigns,
    "google-campaigns": fetchGoogleCampaigns,
};

/**
 * @param {string} source
 * @param {string} customerId
 * @param {Record<string, string | undefined>} query
 */
export async function fetchMcpDataSource(source, customerId, query = {}) {
    const src = String(source || "").trim();
    if (isValidMcpExtendedDataSource(src)) {
        return fetchMcpExtendedDataSource(src, customerId, query);
    }
    if (!FETCHERS[src]) {
        throw new Error(`Unknown MCP data source: ${src}`);
    }

    const range = parseMcpDateRange(query.startDate, query.endDate);
    const customer = await loadCustomerForMcp(customerId);
    return FETCHERS[src](customer, range.startDate, range.endDate);
}

export function isValidMcpDataSource(source) {
    const src = String(source || "").trim();
    return Object.hasOwn(FETCHERS, src) || isValidMcpExtendedDataSource(src);
}

export function listMcpDataSources() {
    return [...MCP_DATA_SOURCES];
}
