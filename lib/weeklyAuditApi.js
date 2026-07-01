import { fetchFacebookAdsPSDashboardMetrics } from "@/lib/facebookApi";
import { fetchGoogleAdsPPCDashboardMetrics } from "@/lib/googleAdsPpcDashboard";
import { fetchKlaviyoDashboardMetricsBothPeriods } from "@/lib/klaviyoDashboard";
import { fetchMergedSources } from "@/lib/mergedSourcesApi";
import { fetchShopifyProductMetrics } from "@/lib/shopifyProductsApi";
import { getSearchConsoleClient } from "@/lib/searchConsoleClient";
import { isValidIntegrationId } from "@/lib/customerServiceIntegrations";
import { getDemoPayload, isDemoCustomerId } from "@/lib/demoCustomer";
import {
    getDemoFacebookCampaignInsightsForRange,
    getDemoGooglePpcDashboardForRange,
    getDemoKlaviyoDashboardForRange,
} from "@/lib/demoAdMetrics";
import { getDemoMergedSourcesForRange } from "@/lib/demoMergedSources";
import { buildDemoSeoMetricsForRange } from "@root/lib/mcpSeoDemo";
import { fetchClickupTeamPayloadForCustomer } from "@/lib/clickupCustomerTeamFetch";
import { getCustomerById } from "@root/lib/customerOperations";
import { serializeCustomerForMcp } from "@root/lib/mcpApiHelpers";
import {
    aggregateBlendedFromMerged,
    aggregateEmFromKlaviyo,
    aggregatePpcFromGoogle,
    aggregatePsFromFacebook,
    aggregateSeoFromGsc,
    buildBlendedSection,
    buildChannelSection,
    detectReturnsAlarm,
    detectZeroSpendAlarm,
    metricCompare,
    resolveServiceStatus,
    resolveWeeklyAuditPreviousPeriod,
    roundNum,
    WEEKLY_AUDIT_SERVICE_MAP,
} from "@root/lib/weeklyAuditHelpers";

function buildMergedSettings(data) {
    return {
        customerName: data.customerName,
        customerType: data.customerType || "Shopify",
        ...(data.CustomerSettings || {}),
        CustomerStaticExpenses: data.CustomerStaticExpenses || {},
    };
}

/**
 * @param {Record<string, unknown>} customerDoc
 */
function buildMetaBlock(customerDoc, periodStart, periodEnd, prevStart, prevEnd, compare) {
    const cs = customerDoc.CustomerSettings || {};
    const serialized = serializeCustomerForMcp(customerDoc);

    return {
        customerId: String(customerDoc._id),
        customerName: customerDoc.customerName || "",
        currency: cs.customerStoreValutaCode || "DKK",
        vatBasis:
            cs.revenueDisplayVat === "incl" || cs.revenueDisplayVat === "incl_shopify"
                ? "incl"
                : "excl",
        revenueType: cs.revenueType === "total_sales" ? "total_sales" : "net_sales",
        periodStart,
        periodEnd,
        prevStart,
        prevEnd,
        compare,
        metricPreference: cs.metricPreference || "ROAS/POAS",
        cogsConfigured: false,
        parentCustomerId: customerDoc.parentCustomer
            ? String(customerDoc.parentCustomer)
            : null,
        generatedAt: new Date().toISOString(),
        integrations: serialized.integrations,
    };
}

/**
 * @param {Array<{ key: string, active: boolean }>} customerServices
 */
function isServiceContracted(customerServices, clickupKey) {
    const row = (customerServices || []).find((s) => s.key === clickupKey);
    return Boolean(row?.active);
}

/**
 * @param {Array<{ username?: string }>} members
 */
function teamResponsibleNames(members) {
    return (members || [])
        .map((m) => m.username)
        .filter(Boolean);
}

async function fetchMergedForPeriod(settings, startDate, endDate, isDemo) {
    if (isDemo) {
        return getDemoMergedSourcesForRange(startDate, endDate, { CustomerSettings: settings }, {});
    }
    return fetchMergedSources(settings, startDate, endDate, {
        dailyBreakdown: true,
        source: "weekly-audit",
    });
}

async function fetchTopSellers(settings, startDate, endDate, isDemo) {
    if (isDemo) {
        const products = getDemoPayload("shopifyProducts") || [];
        return products
            .slice()
            .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
            .slice(0, 5)
            .map((p) => ({
                title: p.title || p.name || "Product",
                revenue: roundNum(p.totalRevenue),
                units: p.unitsSold ?? p.units ?? 0,
            }));
    }
    const type = settings.customerType || "Shopify";
    if (type !== "Shopify" && type !== "ShopifyMarkets") return [];
    if (!settings.shopifyUrl || !settings.shopifyApiPassword) return [];

    try {
        const products = await fetchShopifyProductMetrics(settings, startDate, endDate, {
            fast: true,
        });
        return (products || []).slice(0, 5).map((p) => ({
            title: p.title || "Product",
            revenue: roundNum(p.totalRevenue),
            units: p.unitsSold ?? 0,
        }));
    } catch (e) {
        console.warn("[weekly-audit] top sellers:", e.message);
        return [];
    }
}

async function fetchPpcMetrics(settings, startDate, endDate, isDemo) {
    if (isDemo) {
        const metrics = getDemoGooglePpcDashboardForRange(startDate, endDate);
        return { ok: true, data: metrics, error: null, empty: false };
    }
    const googleCustomerId = settings.googleAdsCustomerId;
    if (!isValidIntegrationId(googleCustomerId)) {
        return { ok: false, data: null, error: null, empty: false };
    }
    try {
        const metrics = await fetchGoogleAdsPPCDashboardMetrics({
            developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
            clientId: process.env.GOOGLE_ADS_CLIENT_ID,
            clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET,
            refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN,
            customerId: googleCustomerId,
            managerCustomerId: process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID,
            startDate,
            endDate,
            countryFilter: settings.googleAdsCountryFilter || undefined,
            countryExclude: settings.googleAdsCountryExclude || undefined,
        });
        const spend = (metrics.metrics_by_date || []).reduce(
            (s, d) => s + (parseFloat(d.ad_spend) || 0),
            0
        );
        return {
            ok: true,
            data: metrics,
            error: null,
            empty: spend === 0,
        };
    } catch (e) {
        return { ok: false, data: null, error: e.message, empty: false };
    }
}

async function fetchPsMetrics(settings, startDate, endDate, isDemo) {
    if (isDemo) {
        const metrics = getDemoFacebookCampaignInsightsForRange(startDate, endDate);
        return { ok: true, data: { metrics_by_date: metrics, top_campaigns: [] }, error: null, empty: false };
    }
    const adAccountId = settings.facebookAdAccountId;
    if (!isValidIntegrationId(adAccountId)) {
        return { ok: false, data: null, error: null, empty: false };
    }
    const token = process.env.FACEBOOK_APP_TOKEN;
    if (!token) {
        return { ok: false, data: null, error: "Facebook app token not configured", empty: false };
    }
    try {
        const metrics = await fetchFacebookAdsPSDashboardMetrics({
            accessToken: token,
            adAccountId,
            startDate,
            endDate,
            metaIdInclude: settings.customerMetaID || undefined,
            metaIdExclude: settings.customerMetaIDExclude || undefined,
        });
        const spend = (metrics.metrics_by_date || []).reduce(
            (s, d) => s + (parseFloat(d.ad_spend) || 0),
            0
        );
        return { ok: true, data: metrics, error: null, empty: spend === 0 };
    } catch (e) {
        return { ok: false, data: null, error: e.message, empty: false };
    }
}

async function fetchSeoMetrics(settings, startDate, endDate, isDemo) {
    if (isDemo) {
        return {
            ok: true,
            data: buildDemoSeoMetricsForRange(startDate, endDate),
            error: null,
            empty: false,
        };
    }
    const siteUrl = String(settings.googleSearchConsoleProperty || "").trim();
    if (!siteUrl) {
        return { ok: false, data: null, error: null, empty: false };
    }
    try {
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
        const clicks = (daily.rows || []).reduce((s, r) => s + (r.clicks || 0), 0);
        return {
            ok: true,
            data: { daily, topKeywords },
            error: null,
            empty: clicks === 0,
        };
    } catch (e) {
        return { ok: false, data: null, error: e.message, empty: false };
    }
}

async function fetchEmMetrics(settings, startDate, endDate, prevStart, prevEnd, isDemo) {
    if (isDemo) {
        const current = getDemoKlaviyoDashboardForRange(startDate, endDate);
        const previous = getDemoKlaviyoDashboardForRange(prevStart, prevEnd);
        const curRow = current.metrics_by_date?.[0] || {};
        const prevRow = previous.metrics_by_date?.[0] || {};
        return {
            ok: true,
            current: curRow,
            previous: prevRow,
            error: null,
            empty: (curRow.recipients ?? 0) === 0,
        };
    }
    const apiKey = String(settings.klaviyoPrivateApiKey || "").trim();
    if (!apiKey) {
        return { ok: false, current: {}, previous: {}, error: null, empty: false };
    }
    try {
        const result = await fetchKlaviyoDashboardMetricsBothPeriods({
            apiKey,
            startDate,
            endDate,
            prevStartDate: prevStart,
            prevEndDate: prevEnd,
        });
        const curRow = result.metrics_by_date?.[0] || {};
        const prevRow = result.metrics_by_date_prev?.[0] || {};
        return {
            ok: true,
            current: curRow,
            previous: prevRow,
            error: null,
            empty: (curRow.recipients ?? 0) === 0,
        };
    } catch (e) {
        return { ok: false, current: {}, previous: {}, error: e.message, empty: false };
    }
}

/**
 * Server-side weekly audit — compact JSON for MCP / cron / reports.
 *
 * @param {string} customerId
 * @param {{ periodStart: string, periodEnd: string, compare?: 'prev_period'|'yoy' }} opts
 */
export async function fetchWeeklyAudit(customerId, opts) {
    const periodStart = String(opts.periodStart || "").trim();
    const periodEnd = String(opts.periodEnd || "").trim();
    const compare = opts.compare === "yoy" ? "yoy" : "prev_period";

    if (!periodStart || !periodEnd) {
        throw new Error("periodStart and periodEnd are required (YYYY-MM-DD)");
    }

    const { prevStart, prevEnd } = resolveWeeklyAuditPreviousPeriod(
        periodStart,
        periodEnd,
        compare
    );

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

    const settings = buildMergedSettings(customerDoc);
    const meta = buildMetaBlock(customerDoc, periodStart, periodEnd, prevStart, prevEnd, compare);

    const [mergedCurrent, mergedPrevious, clickupPayload, topSellers] = await Promise.all([
        fetchMergedForPeriod(settings, periodStart, periodEnd, isDemo),
        fetchMergedForPeriod(settings, prevStart, prevEnd, isDemo),
        (async () => {
            if (isDemo) {
                const demo = getDemoPayload("clickupTeamMembers") ?? { members: [] };
                return {
                    members: demo.members ?? [],
                    customerServices: demo.customerServices ?? [],
                };
            }
            const clickupId = settings.customerClickupID;
            if (!clickupId) return { members: [], customerServices: [] };
            try {
                return await fetchClickupTeamPayloadForCustomer(String(clickupId).trim());
            } catch (e) {
                console.warn("[weekly-audit] clickup:", e.message);
                return { members: [], customerServices: [] };
            }
        })(),
        fetchTopSellers(settings, periodStart, periodEnd, isDemo),
    ]);

    const blendedCurrent = aggregateBlendedFromMerged(mergedCurrent);
    const blendedPrevious = aggregateBlendedFromMerged(mergedPrevious);
    const fetchCogs = settings.fetchCogsFromStore === true;
    const cogsFromStore =
        fetchCogs &&
        (mergedCurrent.shopifyDaily || []).some((d) => (parseFloat(d.cost_of_goods_sold) || 0) > 0);
    meta.cogsConfigured = Boolean(cogsFromStore || (fetchCogs && blendedCurrent.grossProfitNet > 0));
    const responsible = teamResponsibleNames(clickupPayload.members);
    const customerServices = clickupPayload.customerServices || [];

    const [ppcCur, ppcPrev, psCur, psPrev, seoCur, seoPrev, emResult] = await Promise.all([
        fetchPpcMetrics(settings, periodStart, periodEnd, isDemo),
        fetchPpcMetrics(settings, prevStart, prevEnd, isDemo),
        fetchPsMetrics(settings, periodStart, periodEnd, isDemo),
        fetchPsMetrics(settings, prevStart, prevEnd, isDemo),
        fetchSeoMetrics(settings, periodStart, periodEnd, isDemo),
        fetchSeoMetrics(settings, prevStart, prevEnd, isDemo),
        fetchEmMetrics(settings, periodStart, periodEnd, prevStart, prevEnd, isDemo),
    ]);

    /** @type {Record<string, { status: string, responsible: string[], note?: string|null }>} */
    const services = {};
    /** @type {Array<{ service: string, reason: string, message: string }>} */
    const dataGaps = [];

    for (const [outKey, cfg] of Object.entries(WEEKLY_AUDIT_SERVICE_MAP)) {
        const contracted = isServiceContracted(customerServices, cfg.clickupKey);
        const integrationOn = Boolean(meta.integrations[cfg.integrationKey]);
        let fetchResult = { ok: false, error: null, empty: false };

        if (outKey === "ppc") fetchResult = ppcCur;
        else if (outKey === "ps") fetchResult = psCur;
        else if (outKey === "seo") fetchResult = seoCur;
        else if (outKey === "em") fetchResult = emResult;

        const block = resolveServiceStatus(
            outKey,
            contracted,
            integrationOn,
            fetchResult,
            responsible
        );
        services[outKey] = block;

        if (block.status === "access_error" || block.status === "contracted_not_connected") {
            dataGaps.push({
                service: outKey,
                reason: block.status,
                message: block.note || block.status,
            });
        }
    }

    const returnsCompare = metricCompare(blendedCurrent.returns, blendedPrevious.returns);
    const flags = {
        returnsAlarm: detectReturnsAlarm(returnsCompare, mergedCurrent.shopifyDaily),
        zeroSpendAlarm: detectZeroSpendAlarm(
            aggregatePpcFromGoogle(ppcCur.data?.metrics_by_date).zeroSpendLastDay,
            aggregatePsFromFacebook(psCur.data?.metrics_by_date).zeroSpendLastDay,
            services.ppc.status === "active",
            services.ps.status === "active"
        ),
        dataGaps,
    };

    /** @type {Record<string, unknown>} */
    const result = {
        readOnly: true,
        meta,
        services,
        integrations: meta.integrations,
        blended: buildBlendedSection(blendedCurrent, blendedPrevious),
        topSellers,
        flags,
    };

    if (services.ppc.status === "active" && ppcCur.data) {
        const cur = aggregatePpcFromGoogle(
            ppcCur.data.metrics_by_date,
            ppcCur.data.top_campaigns,
            ppcCur.data.impression_share_daily
        );
        const prev = aggregatePpcFromGoogle(
            ppcPrev.data?.metrics_by_date,
            ppcPrev.data?.top_campaigns,
            ppcPrev.data?.impression_share_daily
        );
        result.ppc = buildChannelSection(cur, prev, [
            "spend",
            "roas",
            "poas",
            "conversions",
            "conversionValue",
            "cpa",
            "ctr",
            "cpc",
            "impressionShare",
            "isLostBudgetPct",
            "isLostRankPct",
            "zeroSpendLastDay",
        ]);
    }

    if (services.ps.status === "active" && psCur.data) {
        const cur = aggregatePsFromFacebook(psCur.data.metrics_by_date, psCur.data.top_campaigns);
        const prev = aggregatePsFromFacebook(
            psPrev.data?.metrics_by_date,
            psPrev.data?.top_campaigns
        );
        result.ps = buildChannelSection(cur, prev, [
            "spend",
            "roas",
            "conversions",
            "conversionValue",
            "cpa",
            "frequency",
            "linkCtr",
            "conversionType",
            "zeroSpendLastDay",
            "funnelAvailable",
            "newVsReturningAvailable",
            "topCampaigns",
        ]);
    }

    if (services.seo.status === "active" && seoCur.data) {
        const cur = aggregateSeoFromGsc(seoCur.data, periodEnd);
        const prev = aggregateSeoFromGsc(seoPrev.data || {}, prevEnd);
        result.seo = {
            clicks: metricCompare(cur.clicks, prev.clicks),
            impressions: metricCompare(cur.impressions, prev.impressions),
            ctr: { current: cur.ctr, previous: prev.ctr },
            avgPosition: { current: cur.avgPosition, previous: prev.avgPosition },
            brandClassified: cur.brandClassified,
            brandedSharePct: cur.brandedSharePct,
            nonBrandedSharePct: cur.nonBrandedSharePct,
            seoValueEstimate: cur.seoValueEstimate,
            seoValueMethod: cur.seoValueMethod,
            gscDelayWarning: cur.gscDelayWarning,
            topNonBrandKeywords: cur.topNonBrandKeywords,
        };
    }

    if (services.em.status === "active" && emResult.ok) {
        const curAgg = aggregateEmFromKlaviyo(
            emResult.current,
            emResult.previous,
            blendedCurrent.netSales
        );
        const prevAgg = aggregateEmFromKlaviyo(
            emResult.previous,
            {},
            blendedPrevious.netSales
        );
        result.em = {
            attributedRevenue: metricCompare(curAgg.attributedRevenue, prevAgg.attributedRevenue),
            shareOfTotalPct: curAgg.shareOfTotalPct,
            orders: metricCompare(curAgg.orders, prevAgg.orders),
            openRate: { current: curAgg.openRate, previous: prevAgg.openRate },
            clickRate: { current: curAgg.clickRate, previous: prevAgg.clickRate },
            recipients: metricCompare(curAgg.recipients, prevAgg.recipients),
            unsubscribes: metricCompare(curAgg.unsubscribes, prevAgg.unsubscribes),
            listGrowthAvailable: false,
            empty: curAgg.empty,
        };
    }

    return result;
}
