import { getSearchConsoleClient } from "@/lib/searchConsoleClient";
import { isDemoCustomerId, getDemoPayload } from "@/lib/demoCustomer";
import { eachDayInclusive, numHash } from "@/lib/demoAdMetrics";

function buildDemoSeoMetricsForRange(startDate, endDate) {
    const template = getDemoPayload("seoDashboardMetrics") || {};
    const rows = eachDayInclusive(startDate, endDate).map((date) => {
        const h = numHash(`seo-${date}`);
        return {
            keys: [date],
            clicks: 20 + (h % 15),
            impressions: 800 + (h % 200),
            ctr: 0.03,
            position: 12 + (h % 8),
        };
    });
    return {
        metrics: { rows },
        keywords: template.keywords || { rows: [] },
        urls: template.urls || { rows: [] },
    };
}

function trimGscRows(data, max = 500) {
    if (!data?.rows || !Array.isArray(data.rows)) return data;
    return { ...data, rows: data.rows.slice(0, max) };
}

/**
 * Fetch Search Console datasets used by SEO audits (audit-only; not used by dashboards).
 * @param {{
 *   siteUrl: string,
 *   startDate: string,
 *   endDate: string,
 *   customerId?: string,
 * }} opts
 */
export async function fetchSearchConsoleAuditBundle(opts) {
    const { siteUrl, startDate, endDate, customerId } = opts;
    if (!siteUrl || !startDate || !endDate) {
        return { included: false, reason: "Missing siteUrl or date range" };
    }

    if (customerId && isDemoCustomerId(customerId)) {
        const demo = buildDemoSeoMetricsForRange(startDate, endDate);
        return {
            included: true,
            siteUrl,
            demo: true,
            metricsByDate: demo.metrics,
            topQueries: demo.keywords,
            topPages: demo.urls,
            queryByPage: { rows: [] },
        };
    }

    const searchconsole = await getSearchConsoleClient();

    async function query(dimensions, rowLimit, orderBy) {
        const requestBody = {
            startDate,
            endDate,
            dimensions,
            rowLimit,
        };
        if (orderBy) requestBody.orderBy = orderBy;
        const { data } = await searchconsole.searchanalytics.query({
            siteUrl,
            requestBody,
        });
        return data;
    }

    const [metricsByDate, topQueries, topPages, queryByPage] = await Promise.all([
        query(["date"], 1000),
        query(["query"], 150, [{ field: "clicks", sortOrder: "DESCENDING" }]),
        query(["page"], 80, [{ field: "clicks", sortOrder: "DESCENDING" }]),
        query(["query", "page"], 250, [{ field: "clicks", sortOrder: "DESCENDING" }]),
    ]);

    return {
        included: true,
        siteUrl,
        metricsByDate: trimGscRows(metricsByDate, 400),
        topQueries: trimGscRows(topQueries, 150),
        topPages: trimGscRows(topPages, 80),
        queryByPage: trimGscRows(queryByPage, 250),
    };
}

/**
 * Comparison-period GSC (daily + top queries) for YoY / period-over-period SEO cards.
 */
export async function fetchSearchConsoleComparisonBundle(opts) {
    const { siteUrl, startDate, endDate, customerId } = opts;
    if (!siteUrl || !startDate || !endDate) return null;

    if (customerId && isDemoCustomerId(customerId)) {
        const demo = buildDemoSeoMetricsForRange(startDate, endDate);
        return {
            metricsByDate: demo.metrics,
            topQueries: demo.keywords,
        };
    }

    const searchconsole = await getSearchConsoleClient();
    const requestBase = { startDate, endDate, rowLimit: 1000 };

    const [metricsRes, queriesRes] = await Promise.all([
        searchconsole.searchanalytics.query({
            siteUrl,
            requestBody: { ...requestBase, dimensions: ["date"] },
        }),
        searchconsole.searchanalytics.query({
            siteUrl,
            requestBody: {
                ...requestBase,
                dimensions: ["query"],
                rowLimit: 100,
                orderBy: [{ field: "clicks", sortOrder: "DESCENDING" }],
            },
        }),
    ]);

    return {
        metricsByDate: trimGscRows(metricsRes.data, 400),
        topQueries: trimGscRows(queriesRes.data, 100),
    };
}
