import { runGa4Report } from "@/lib/ga4Api";
import { fetchMergedSources } from "@/lib/mergedSourcesApi";
import {
    mapReportToRows,
    yyyymmddToIso,
    sumGa4Metric,
    averageGa4Metric,
} from "@/lib/ga4ReportUtils";
import { getDemoPayload, isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoB2BGa4DailyForRange } from "@/lib/demoGa4";
import {
    buildEventNameDimensionFilter,
    getGa4ConversionEventNames,
    hasCustomGa4ConversionEvents,
} from "@/lib/ga4ConversionEvents";
import {
    adSpendByPeriodMap,
    channelSpendTotalsFromMerged,
    totalAdSpendFromMerged,
} from "@/lib/mergeAdSpendDaily";

const GA4_DAILY_METRICS_BASE = [
    "sessions",
    "totalUsers",
    "newUsers",
    "engagedSessions",
    "engagementRate",
    "averageSessionDuration",
    "eventCount",
    "bounceRate",
    "screenPageViews",
];

const GA4_DAILY_METRICS_WITH_DEFAULT_CONVERSIONS = [...GA4_DAILY_METRICS_BASE, "conversions"];

function normalizeGa4DailyRow(row) {
    const date = yyyymmddToIso(row.date);
    return {
        period: date,
        date,
        sessions: Number(row.sessions) || 0,
        totalUsers: Number(row.totalUsers) || 0,
        newUsers: Number(row.newUsers) || 0,
        engagedSessions: Number(row.engagedSessions) || 0,
        engagementRate: Number(row.engagementRate) || 0,
        averageSessionDuration: Number(row.averageSessionDuration) || 0,
        eventCount: Number(row.eventCount) || 0,
        conversions: Number(row.conversions) || 0,
        bounceRate: Number(row.bounceRate) || 0,
        screenPageViews: Number(row.screenPageViews) || 0,
    };
}

function computeGa4Totals(ga4Daily) {
    const sessions = sumGa4Metric(ga4Daily, "sessions");
    const totalUsers = sumGa4Metric(ga4Daily, "totalUsers");
    const newUsers = sumGa4Metric(ga4Daily, "newUsers");
    const engagedSessions = sumGa4Metric(ga4Daily, "engagedSessions");
    const eventCount = sumGa4Metric(ga4Daily, "eventCount");
    const conversions = sumGa4Metric(ga4Daily, "conversions");
    const screenPageViews = sumGa4Metric(ga4Daily, "screenPageViews");
    return {
        sessions,
        totalUsers,
        newUsers,
        engagedSessions,
        engagementRate: averageGa4Metric(ga4Daily, "engagementRate"),
        averageSessionDuration: averageGa4Metric(ga4Daily, "averageSessionDuration"),
        bounceRate: averageGa4Metric(ga4Daily, "bounceRate"),
        eventCount,
        conversions,
        screenPageViews,
    };
}

async function fetchGa4ConversionCountsByDate(
    propertyId,
    startDate,
    endDate,
    eventNames,
    { demo = false } = {}
) {
    if (!eventNames?.length) return {};

    if (demo) {
        const daily = mapReportToRows(getDemoB2BGa4DailyForRange(startDate, endDate)).map(
            normalizeGa4DailyRow
        );
        return Object.fromEntries(daily.map((row) => [row.date, row.conversions]));
    }

    const report = await runGa4Report({
        propertyId,
        startDate,
        endDate,
        metrics: ["eventCount"],
        dimensions: ["date", "eventName"],
        dimensionFilter: buildEventNameDimensionFilter(eventNames),
    });

    const byDate = {};
    for (const row of mapReportToRows(report)) {
        const date = yyyymmddToIso(row.date);
        byDate[date] = (byDate[date] || 0) + (Number(row.eventCount) || 0);
    }
    return byDate;
}

async function fetchGa4Daily(
    propertyId,
    startDate,
    endDate,
    { demo = false, conversionEventNames = [] } = {}
) {
    const useCustomConversions = conversionEventNames.length > 0;
    let report;
    if (demo) {
        report = getDemoB2BGa4DailyForRange(startDate, endDate);
    } else {
        report = await runGa4Report({
            propertyId,
            startDate,
            endDate,
            metrics: useCustomConversions
                ? GA4_DAILY_METRICS_BASE
                : GA4_DAILY_METRICS_WITH_DEFAULT_CONVERSIONS,
            dimensions: ["date"],
        });
    }

    let rows = mapReportToRows(report).map(normalizeGa4DailyRow);

    if (useCustomConversions) {
        const conversionsByDate = await fetchGa4ConversionCountsByDate(
            propertyId,
            startDate,
            endDate,
            conversionEventNames,
            { demo }
        );
        rows = rows.map((row) => ({
            ...row,
            conversions: conversionsByDate[row.date] || 0,
        }));
    }

    return rows.sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchGa4Channels(
    propertyId,
    startDate,
    endDate,
    { demo = false, conversionEventNames = [] } = {}
) {
    const useCustomConversions = conversionEventNames.length > 0;
    let baseRows;
    if (demo) {
        baseRows = mapReportToRows(getDemoPayload("ga4Channels"));
    } else {
        const report = await runGa4Report({
            propertyId,
            startDate,
            endDate,
            metrics: useCustomConversions
                ? ["sessions", "totalUsers"]
                : ["sessions", "totalUsers", "conversions"],
            dimensions: ["sessionDefaultChannelGroup"],
            limit: 20,
        });
        baseRows = mapReportToRows(report);
    }

    let conversionsByChannel = null;
    if (useCustomConversions) {
        if (demo) {
            conversionsByChannel = Object.fromEntries(
                baseRows.map((row) => [
                    row.sessionDefaultChannelGroup || "(not set)",
                    Math.round((Number(row.conversions) || 0) * 0.9),
                ])
            );
        } else {
            const convReport = await runGa4Report({
                propertyId,
                startDate,
                endDate,
                metrics: ["eventCount"],
                dimensions: ["sessionDefaultChannelGroup", "eventName"],
                dimensionFilter: buildEventNameDimensionFilter(conversionEventNames),
                limit: 10000,
            });
            conversionsByChannel = {};
            for (const row of mapReportToRows(convReport)) {
                const channel = row.sessionDefaultChannelGroup || "(not set)";
                conversionsByChannel[channel] =
                    (conversionsByChannel[channel] || 0) + (Number(row.eventCount) || 0);
            }
        }
    }

    return baseRows
        .map((row) => {
            const channel = row.sessionDefaultChannelGroup || "(not set)";
            return {
                channel,
                sessions: Number(row.sessions) || 0,
                totalUsers: Number(row.totalUsers) || 0,
                conversions: useCustomConversions
                    ? conversionsByChannel?.[channel] || 0
                    : Number(row.conversions) || 0,
            };
        })
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 8);
}

async function fetchGa4TopPages(propertyId, startDate, endDate, { demo = false } = {}) {
    let report;
    if (demo) {
        report = getDemoPayload("ga4Pages");
    } else {
        report = await runGa4Report({
            propertyId,
            startDate,
            endDate,
            metrics: ["screenPageViews", "sessions"],
            dimensions: ["pageTitle"],
            limit: 10,
        });
    }
    return mapReportToRows(report)
        .map((row) => ({
            page: row.pageTitle || "(not set)",
            pageviews: Number(row.screenPageViews) || 0,
            sessions: Number(row.sessions) || 0,
        }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 8);
}

/** List GA4 events with counts for conversion picker UI. */
export async function fetchGa4EventCatalog(
    propertyId,
    startDate,
    endDate,
    { demo = false } = {}
) {
    if (demo) {
        return [
            { name: "generate_lead", count: 42 },
            { name: "form_submit", count: 28 },
            { name: "contact_click", count: 15 },
            { name: "demo_request", count: 9 },
        ];
    }

    const report = await runGa4Report({
        propertyId,
        startDate,
        endDate,
        metrics: ["eventCount"],
        dimensions: ["eventName"],
        limit: 500,
        orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
    });

    return mapReportToRows(report)
        .map((row) => ({
            name: row.eventName || "(not set)",
            count: Number(row.eventCount) || 0,
        }))
        .filter((e) => e.name && e.name !== "(not set)")
        .sort((a, b) => b.count - a.count);
}

function buildMergedSettings(customer) {
    return {
        customerName: customer.customerName,
        customerType: customer.customerType || "Other",
        ...(customer.CustomerSettings || {}),
        CustomerStaticExpenses: customer.CustomerStaticExpenses || {},
    };
}

/**
 * Fetches GA4 analytics + ad spend for B2B dashboard pages.
 * @param {object} customer - Full customer document
 * @param {string} startDate
 * @param {string} endDate
 * @param {object} [options]
 */
export async function fetchB2BDashboardData(customer, startDate, endDate, options = {}) {
    const customerSettings = customer?.CustomerSettings || {};
    const ga4PropertyId = customerSettings.ga4PropertyId?.trim?.() || "";
    const conversionEventNames = getGa4ConversionEventNames(customerSettings);
    const demo = options.customerId && isDemoCustomerId(options.customerId);

    const merged = await fetchMergedSources(buildMergedSettings(customer), startDate, endDate, {
        skipShopifyFetch: true,
        dailyBreakdown: true,
        source: options.source || "b2b-dashboard",
        excludeAdSpendPlatforms: options.excludeAdSpendPlatforms,
    });

    let ga4Daily = [];
    let ga4Channels = [];
    let ga4TopPages = [];

    if (ga4PropertyId || demo) {
        const propertyId = ga4PropertyId || "demo";
        const ga4Opts = { demo, conversionEventNames };
        [ga4Daily, ga4Channels, ga4TopPages] = await Promise.all([
            fetchGa4Daily(propertyId, startDate, endDate, ga4Opts),
            fetchGa4Channels(propertyId, startDate, endDate, ga4Opts),
            fetchGa4TopPages(propertyId, startDate, endDate, { demo }),
        ]);
    }

    const ga4Totals = computeGa4Totals(ga4Daily);
    const totalAdSpend = totalAdSpendFromMerged(merged);
    const channelSpendTotals = channelSpendTotalsFromMerged(merged);
    const adSpendByPeriod = adSpendByPeriodMap(merged);

    const costPerSession = ga4Totals.sessions > 0 ? totalAdSpend / ga4Totals.sessions : 0;
    const costPerConversion = ga4Totals.conversions > 0 ? totalAdSpend / ga4Totals.conversions : 0;
    const conversionRate =
        ga4Totals.sessions > 0 ? (ga4Totals.conversions / ga4Totals.sessions) * 100 : 0;

    return {
        ga4Configured: Boolean(ga4PropertyId) || demo,
        ga4PropertyId: ga4PropertyId || null,
        ga4ConversionEventNames: conversionEventNames,
        ga4ConversionSource: hasCustomGa4ConversionEvents(customerSettings) ? "custom" : "default",
        ga4Daily,
        ga4Totals,
        ga4Channels,
        ga4TopPages,
        ...merged,
        totalAdSpend,
        channelSpendTotals,
        adSpendByPeriod,
        efficiency: {
            costPerSession,
            costPerConversion,
            conversionRate,
        },
    };
}

/**
 * Builds daily rows merging GA4 metrics with ad spend per day.
 * @deprecated Import from `@/lib/b2bDashboard/buildB2BDailyRows` instead (client-safe).
 */
export { buildB2BDailyRows } from "@/lib/b2bDashboard/buildB2BDailyRows";
