import { runGa4Report } from "@/lib/ga4Api";
import { mapReportToRows } from "@/lib/ga4ReportUtils";
import { getGa4ConversionEventNames } from "@/lib/ga4ConversionEvents";
import {
    computeGa4Totals,
    fetchGa4Channels,
    fetchGa4Daily,
    fetchGa4EventCatalog,
    fetchGa4TopPages,
} from "@/lib/b2bDashboardApi";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { getCustomerById } from "@root/lib/customerOperations";
import { parseMcpDateRange } from "@root/lib/mcpApiHelpers";

/** Metrics allowed in MCP custom GA4 reports (GA4 Data API names). */
export const MCP_GA4_ALLOWED_METRICS = [
    "sessions",
    "totalUsers",
    "newUsers",
    "activeUsers",
    "engagedSessions",
    "engagementRate",
    "averageSessionDuration",
    "userEngagementDuration",
    "bounceRate",
    "screenPageViews",
    "eventCount",
    "conversions",
    "transactions",
    "purchaseRevenue",
    "ecommercePurchases",
    "itemsPurchased",
    "sessionsPerUser",
    "scrolledUsers",
];

/** Dimensions allowed in MCP custom GA4 reports. */
export const MCP_GA4_ALLOWED_DIMENSIONS = [
    "date",
    "sessionDefaultChannelGroup",
    "firstUserDefaultChannelGroup",
    "pageTitle",
    "pagePath",
    "landingPagePlusQueryString",
    "eventName",
    "country",
    "city",
    "deviceCategory",
    "sessionSource",
    "sessionMedium",
    "sessionCampaignName",
    "newVsReturning",
    "browser",
    "operatingSystem",
];

export const MCP_GA4_DAILY_METRIC_NAMES = [
    "sessions",
    "totalUsers",
    "newUsers",
    "engagedSessions",
    "engagementRate",
    "averageSessionDuration",
    "eventCount",
    "conversions",
    "bounceRate",
    "screenPageViews",
];

const MCP_GA4_METRIC_SET = new Set(MCP_GA4_ALLOWED_METRICS);
const MCP_GA4_DIMENSION_SET = new Set(MCP_GA4_ALLOWED_DIMENSIONS);

function ga4ContextFromCustomer(customer) {
    const demo = customer.isDemo === true || isDemoCustomerId(customer.id);
    const settings = customer.settings || {};
    const propertyId = demo ? "demo" : String(settings.ga4PropertyId || "").trim();
    if (!propertyId && !demo) {
        throw new Error("GA4 property ID not configured for this customer");
    }
    const conversionEventNames = getGa4ConversionEventNames(settings);
    return { demo, propertyId, conversionEventNames, ga4Opts: { demo, conversionEventNames } };
}

function mcpGa4Envelope(customer, startDate, endDate, payload) {
    return {
        readOnly: true,
        source: "ga4",
        customerId: customer.id,
        customerName: customer.customerName,
        customerType: customer.customerType,
        startDate,
        endDate,
        ...payload,
    };
}

/**
 * Daily GA4 metrics + period totals (includes averageSessionDuration).
 * @param {{ id: string, customerName?: string, customerType?: string, settings?: object, isDemo?: boolean }} customer
 */
export async function fetchMcpGa4ForCustomer(customer, startDate, endDate) {
    const { demo, propertyId, ga4Opts } = ga4ContextFromCustomer(customer);
    const daily = await fetchGa4Daily(propertyId, startDate, endDate, ga4Opts);
    const totals = computeGa4Totals(daily);

    return mcpGa4Envelope(customer, startDate, endDate, {
        ga4PropertyId: demo ? null : propertyId,
        dailyMetrics: MCP_GA4_DAILY_METRIC_NAMES,
        daily,
        totals,
    });
}

/**
 * @param {string} customerId
 * @param {Record<string, string>} params
 */
export async function fetchMcpGa4Metrics(customerId, params) {
    const customer = await loadMcpGa4Customer(customerId);
    const { startDate, endDate } = parseMcpDateRange(params);
    return fetchMcpGa4ForCustomer(customer, startDate, endDate);
}

/**
 * @param {string} customerId
 * @param {Record<string, string>} params
 */
export async function fetchMcpGa4Channels(customerId, params) {
    const customer = await loadMcpGa4Customer(customerId);
    const { startDate, endDate } = parseMcpDateRange(params);
    const { demo, propertyId, ga4Opts } = ga4ContextFromCustomer(customer);
    const channels = await fetchGa4Channels(propertyId, startDate, endDate, ga4Opts);
    return mcpGa4Envelope(customer, startDate, endDate, {
        ga4PropertyId: demo ? null : propertyId,
        channels,
    });
}

/**
 * @param {string} customerId
 * @param {Record<string, string>} params
 */
export async function fetchMcpGa4TopPages(customerId, params) {
    const customer = await loadMcpGa4Customer(customerId);
    const { startDate, endDate } = parseMcpDateRange(params);
    const { demo, propertyId } = ga4ContextFromCustomer(customer);
    const topPages = await fetchGa4TopPages(propertyId, startDate, endDate, { demo });
    return mcpGa4Envelope(customer, startDate, endDate, {
        ga4PropertyId: demo ? null : propertyId,
        topPages,
    });
}

/**
 * @param {string} customerId
 * @param {Record<string, string>} params
 */
export async function fetchMcpGa4Events(customerId, params) {
    const customer = await loadMcpGa4Customer(customerId);
    const { startDate, endDate } = parseMcpDateRange(params);
    const { demo, propertyId } = ga4ContextFromCustomer(customer);
    const limit = params.limit != null ? Math.min(Number(params.limit) || 500, 500) : 500;
    const events = await fetchGa4EventCatalog(propertyId, startDate, endDate, { demo });
    return mcpGa4Envelope(customer, startDate, endDate, {
        ga4PropertyId: demo ? null : propertyId,
        events: events.slice(0, limit),
    });
}

function parseCsvAllowlist(raw, allowedSet, label) {
    const parts = String(raw || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (!parts.length) {
        throw new Error(`${label} is required (comma-separated allowlisted names)`);
    }
    const invalid = parts.filter((p) => !allowedSet.has(p));
    if (invalid.length) {
        throw new Error(
            `Unknown ${label}: ${invalid.join(", ")}. Allowed: ${[...allowedSet].join(", ")}`
        );
    }
    return parts;
}

/**
 * Custom allowlisted GA4 report (read-only).
 * @param {string} customerId
 * @param {Record<string, string>} params — metrics, dimensions (comma-separated), optional limit
 */
export async function fetchMcpGa4CustomReport(customerId, params) {
    const customer = await loadMcpGa4Customer(customerId);
    const { startDate, endDate } = parseMcpDateRange(params);
    const { demo, propertyId } = ga4ContextFromCustomer(customer);

    const metrics = parseCsvAllowlist(params.metrics, MCP_GA4_METRIC_SET, "metrics");
    const dimensions = parseCsvAllowlist(params.dimensions, MCP_GA4_DIMENSION_SET, "dimensions");
    const limitRaw = params.limit != null ? Number(params.limit) : 1000;
    const limit = Math.min(Math.max(limitRaw || 1000, 1), 10000);

    if (demo) {
        const { getDemoB2BGa4DailyForRange } = await import("@/lib/demoGa4");
        const rows = mapReportToRows(getDemoB2BGa4DailyForRange(startDate, endDate)).map((row) => {
            const out = {};
            for (const d of dimensions) out[d] = row[d] ?? row.date;
            for (const m of metrics) out[m] = row[m] ?? 0;
            return out;
        });
        return mcpGa4Envelope(customer, startDate, endDate, {
            ga4PropertyId: null,
            metrics,
            dimensions,
            limit,
            rowCount: rows.length,
            rows,
            demo: true,
        });
    }

    const report = await runGa4Report({
        propertyId,
        startDate,
        endDate,
        metrics,
        dimensions,
        limit,
    });

    const rows = mapReportToRows(report).map((row) => {
        const out = {};
        for (const d of dimensions) out[d] = row[d] ?? null;
        for (const m of metrics) out[m] = Number(row[m]) || 0;
        return out;
    });

    return mcpGa4Envelope(customer, startDate, endDate, {
        ga4PropertyId: propertyId,
        metrics,
        dimensions,
        limit,
        rowCount: rows.length,
        rows,
    });
}

async function loadMcpGa4Customer(customerId) {
    const id = String(customerId || "").trim();
    if (!id) throw new Error("customerId is required");

    if (isDemoCustomerId(id)) {
        const { getDemoPayload } = await import("@/lib/demoCustomer");
        const customer = getDemoPayload("customer");
        return {
            id,
            customerName: customer?.customerName || "Demo",
            customerType: customer?.customerType || "Shopify",
            settings: {
                ...(customer?.CustomerSettings || {}),
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
        settings: data.CustomerSettings || {},
        isDemo: false,
    };
}
