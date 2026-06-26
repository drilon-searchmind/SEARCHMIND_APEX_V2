import { NextResponse } from 'next/server';
import { getSearchConsoleClient } from '@/lib/searchConsoleClient';
import { getDemoPayload, isDemoCustomerId } from '@/lib/demoCustomer';
import { eachDayInclusive, numHash } from '@/lib/demoAdMetrics';
import {
    buildDemoSeoSupplemental,
    fetchSeoDashboardSupplemental,
} from '@/lib/seoDashboardBundle';
import { loadSeoKeywordFilterConfigForCustomer } from '@/lib/seoKeywordSettingsLoader';
import {
    filterGscQueryRows,
    aggregateGscQueryRowsToDaily,
    hasActiveKeywordGroupFilters,
    queryMatchesKeywordGroupFilters,
} from '@/lib/seoKeywordFilters';

function gscClicksFromRows(rows) {
    return (rows || []).reduce((s, r) => s + (r.clicks || 0), 0);
}

function buildDemoSeoMetricsForRange(startDate, endDate) {
    const template = getDemoPayload('seoDashboardMetrics') || {};
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
        supplemental: buildDemoSeoSupplemental(startDate, endDate),
        appliedFilters: [],
    };
}

export async function POST(req) {
    try {
        const body = await req.json();
        const { siteUrl, startDate, endDate, customerId } = body;
        if (customerId && isDemoCustomerId(customerId)) {
            return NextResponse.json(buildDemoSeoMetricsForRange(startDate, endDate));
        }
        if (!siteUrl || !startDate || !endDate) {
            return NextResponse.json({ error: 'Missing siteUrl, startDate or endDate' }, { status: 400 });
        }
        const searchconsole = await getSearchConsoleClient();
        const { config, appliedFilters } = await loadSeoKeywordFilterConfigForCustomer(customerId);
        const groupFiltersActive = hasActiveKeywordGroupFilters(config);

        const query = {
            siteUrl,
            requestBody: {
                startDate,
                endDate,
                dimensions: ['date'],
                rowLimit: 1000,
            },
        };
        const queryKeywords = {
            siteUrl,
            requestBody: {
                startDate,
                endDate,
                dimensions: ['query'],
                rowLimit: 500,
                orderBy: [{ field: 'clicks', desc: true }],
            },
        };
        const queryUrls = {
            siteUrl,
            requestBody: {
                startDate,
                endDate,
                dimensions: ['page'],
                rowLimit: 100,
                orderBy: [{ field: 'clicks', desc: true }],
            },
        };

        const fetches = [
            searchconsole.searchanalytics.query(query),
            searchconsole.searchanalytics.query(queryKeywords),
            searchconsole.searchanalytics.query(queryUrls),
        ];

        if (groupFiltersActive) {
            fetches.push(
                searchconsole.searchanalytics.query({
                    siteUrl,
                    requestBody: {
                        startDate,
                        endDate,
                        dimensions: ['date', 'query'],
                        rowLimit: 25000,
                    },
                })
            );
        }

        const results = await Promise.all(fetches);
        const { data } = results[0];
        const { data: keywordData } = results[1];
        const { data: urlData } = results[2];
        const dateQueryData = groupFiltersActive ? results[3]?.data : null;

        let metricsRows = data?.rows || [];
        let keywordRows = keywordData?.rows || [];

        if (groupFiltersActive) {
            keywordRows = filterGscQueryRows(keywordRows, config);
            const dateQueryFiltered = (dateQueryData?.rows || []).filter((row) =>
                queryMatchesKeywordGroupFilters(row.keys?.[1], config)
            );
            metricsRows = aggregateGscQueryRowsToDaily(dateQueryFiltered);
        }

        const gscClicks = gscClicksFromRows(metricsRows);
        const supplemental = await fetchSeoDashboardSupplemental({
            customerId,
            siteUrl,
            startDate,
            endDate,
            gscClicks,
        });

        return NextResponse.json({
            metrics: { rows: metricsRows },
            keywords: { rows: keywordRows },
            urls: urlData,
            supplemental,
            appliedFilters,
        });
    } catch (error) {
        let errorDetails = { message: error.message };
        if (error.response) errorDetails.response = error.response.data || error.response;
        if (error.errors) errorDetails.errors = error.errors;
        return NextResponse.json({ error: errorDetails }, { status: 500 });
    }
}
