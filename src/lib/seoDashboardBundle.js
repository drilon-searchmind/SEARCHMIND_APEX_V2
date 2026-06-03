/**
 * Supplemental SEO dashboard data: GA4 organic, Ahrefs backlinks, estimated spend saved.
 */

import { runGa4Report } from "@/lib/ga4Api";
import {
    ahrefsGet,
    ahrefsReportDate,
    ahrefsTargetFromGscProperty,
    isAhrefsConfigured,
} from "@/lib/ahrefsApi";
import { getCustomerById } from "@root/lib/customerOperations";
import { fetchGoogleAdsMetrics } from "@/lib/googleAdsApi";
import { getCurrencyConversionTable, conversionRateToDkk } from "@/lib/currencyConversionTable";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoPayload } from "@/lib/demoCustomer";
import { numHash } from "@/lib/demoAdMetrics";

const ORGANIC_CHANNEL = "Organic Search";

function mapGa4Rows(data) {
    const dimHeaders = data?.dimensionHeaders || [];
    const metricHeaders = data?.metricHeaders || [];
    const rows = data?.rows || [];
    return rows.map((row) => {
        const out = {};
        dimHeaders.forEach((h, i) => {
            out[h.name] = row.dimensionValues?.[i]?.value;
        });
        metricHeaders.forEach((h, i) => {
            out[h.name] = Number(row.metricValues?.[i]?.value) || 0;
        });
        return out;
    });
}

export function buildDemoSeoSupplemental(startDate, endDate) {
    const template = getDemoPayload("seoDashboardSupplemental") || {};
    const days = [];
    const d = new Date(`${startDate}T12:00:00.000Z`);
    const end = new Date(`${endDate}T12:00:00.000Z`);
    while (d <= end) {
        days.push(d.toISOString().slice(0, 10));
        d.setUTCDate(d.getUTCDate() + 1);
    }
    const organic_daily = days.map((date) => {
        const h = numHash(`seo-ga4-${date}`);
        const conversions = 8 + (h % 5);
        const revenue = 5200 + (h % 1200);
        return { date, conversions, revenue, sessions: 180 + (h % 40) };
    });
    const totalClicks = organic_daily.reduce((s, r) => s + r.sessions, 0);
    return {
        organic_revenue: template.organic_revenue ?? 176440,
        organic_conversions: template.organic_conversions ?? 299,
        avg_cpc: template.avg_cpc ?? 14.2,
        spend_saved: template.spend_saved ?? 22337,
        backlinks: template.backlinks ?? 1706,
        domain_rating: template.domain_rating ?? 38,
        organic_daily,
        ...template,
    };
}

export async function fetchGa4OrganicBundle({ ga4PropertyId, startDate, endDate }) {
    if (!ga4PropertyId) {
        return { organic_revenue: null, organic_conversions: null, organic_daily: [] };
    }

    const channelReport = await runGa4Report({
        propertyId: ga4PropertyId,
        startDate,
        endDate,
        metrics: ["sessions", "transactions", "purchaseRevenue"],
        dimensions: ["sessionDefaultChannelGroup"],
        limit: 50,
    });
    const channelRows = mapGa4Rows(channelReport);
    const organic = channelRows.find(
        (r) => String(r.sessionDefaultChannelGroup || "").toLowerCase() === ORGANIC_CHANNEL.toLowerCase()
    );

    const dailyReport = await runGa4Report({
        propertyId: ga4PropertyId,
        startDate,
        endDate,
        metrics: ["sessions", "transactions", "purchaseRevenue"],
        dimensions: ["date", "sessionDefaultChannelGroup"],
        limit: 100000,
    });
    const dailyRows = mapGa4Rows(dailyReport).filter(
        (r) => String(r.sessionDefaultChannelGroup || "").toLowerCase() === ORGANIC_CHANNEL.toLowerCase()
    );
    const organic_daily = dailyRows.map((r) => ({
        date: r.date,
        sessions: r.sessions || 0,
        conversions: r.transactions || 0,
        revenue: r.purchaseRevenue || 0,
    }));

    return {
        organic_revenue: organic?.purchaseRevenue ?? null,
        organic_conversions: organic?.transactions ?? null,
        organic_daily,
    };
}

export async function fetchAhrefsBacklinkStats(siteUrl, endDate) {
    const target = ahrefsTargetFromGscProperty(siteUrl);
    if (!target || !isAhrefsConfigured()) {
        return { backlinks: null, domain_rating: null };
    }
    try {
        const date = ahrefsReportDate(endDate);
        const dr = await ahrefsGet("/site-explorer/domain-rating", {
            target,
            date,
            mode: "subdomains",
        });
        const drRow = dr?.domain_rating ?? dr?.metrics?.domain_rating;
        const domain_rating =
            typeof drRow === "number" ? drRow : Number(dr?.domain_rating?.domain_rating ?? dr?.domain_rating) || null;

        const links = await ahrefsGet("/site-explorer/all-backlinks", {
            target,
            date,
            mode: "subdomains",
            limit: 1,
            select: "url_from",
        });
        const backlinks =
            Number(links?.metrics?.live ?? links?.live ?? links?.backlinks ?? links?.count) ||
            (Array.isArray(links?.backlinks) ? links.backlinks.length : null);

        return { backlinks, domain_rating };
    } catch {
        return { backlinks: null, domain_rating: null };
    }
}

/**
 * Account avg CPC for "Spend saved" (organic GSC clicks × avg CPC). Uses the same
 * Google Ads account as PPC — not the PPC dashboard bundle.
 */
export async function fetchAvgCpcForCustomer(customerId, startDate, endDate) {
    if (!customerId || isDemoCustomerId(customerId)) return 14.2;
    if (!process.env.GOOGLE_ADS_REFRESH_TOKEN) return null;

    try {
        const customer = await getCustomerById(customerId);
        const settings = customer?.CustomerSettings || {};
        const googleAdsCustomerId = settings.googleAdsCustomerId;
        if (!googleAdsCustomerId) return null;

        const { metrics, currencyCode } = await fetchGoogleAdsMetrics(
            googleAdsCustomerId,
            startDate,
            endDate,
            settings.googleAdsCountryFilter,
            settings.googleAdsCountryExclude,
            { quietLog: true }
        );
        const currencyData = (await getCurrencyConversionTable()).data;
        const conversionRate = conversionRateToDkk(currencyCode, currencyData);

        let spendDkk = 0;
        let clicks = 0;
        for (const row of metrics || []) {
            const cost = row.metrics?.cost_micros ? row.metrics.cost_micros / 1e6 : 0;
            spendDkk += cost * conversionRate;
            clicks += row.metrics?.clicks || 0;
        }
        return clicks > 0 ? spendDkk / clicks : null;
    } catch {
        return null;
    }
}

export async function fetchSeoDashboardSupplemental({ customerId, siteUrl, startDate, endDate, gscClicks }) {
    if (customerId && isDemoCustomerId(customerId)) {
        return buildDemoSeoSupplemental(startDate, endDate);
    }

    const customer = customerId ? await getCustomerById(customerId) : null;
    const ga4PropertyId = customer?.CustomerSettings?.ga4PropertyId;

    const [ga4, ahrefs, avgCpc] = await Promise.all([
        fetchGa4OrganicBundle({ ga4PropertyId, startDate, endDate }),
        fetchAhrefsBacklinkStats(siteUrl, endDate),
        fetchAvgCpcForCustomer(customerId, startDate, endDate),
    ]);

    const clicks = gscClicks ?? 0;
    const spend_saved = avgCpc != null && clicks > 0 ? clicks * avgCpc : null;

    return {
        ...ga4,
        ...ahrefs,
        avg_cpc: avgCpc,
        spend_saved,
    };
}
