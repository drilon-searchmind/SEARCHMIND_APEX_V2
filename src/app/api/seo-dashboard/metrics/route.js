import { NextResponse } from 'next/server';
import { getSearchConsoleClient } from '@/lib/searchConsoleClient';

export async function POST(req) {
    try {
        const { siteUrl, startDate, endDate } = await req.json();
        if (!siteUrl || !startDate || !endDate) {
            return NextResponse.json({ error: 'Missing siteUrl, startDate or endDate' }, { status: 400 });
        }
        const searchconsole = await getSearchConsoleClient();
        // Main metrics by date
        const query = {
            siteUrl,
            requestBody: {
                startDate,
                endDate,
                dimensions: ['date'],
                rowLimit: 1000,
            },
        };
        const { data } = await searchconsole.searchanalytics.query(query);
        // Top keywords
        const queryKeywords = {
            siteUrl,
            requestBody: {
                startDate,
                endDate,
                dimensions: ['query'],
                rowLimit: 10,
                orderBy: [{ field: 'clicks', desc: true }],
            },
        };
        const { data: keywordData } = await searchconsole.searchanalytics.query(queryKeywords);
        // Top URLs
        const queryUrls = {
            siteUrl,
            requestBody: {
                startDate,
                endDate,
                dimensions: ['page'],
                rowLimit: 10,
                orderBy: [{ field: 'clicks', desc: true }],
            },
        };
        const { data: urlData } = await searchconsole.searchanalytics.query(queryUrls);
        return NextResponse.json({
            metrics: data,
            keywords: keywordData,
            urls: urlData,
        });
    } catch (error) {
        let errorDetails = { message: error.message };
        if (error.response) errorDetails.response = error.response.data || error.response;
        if (error.errors) errorDetails.errors = error.errors;
        return NextResponse.json({ error: errorDetails }, { status: 500 });
    }
}
