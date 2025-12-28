import { NextResponse } from 'next/server';
import { getSearchConsoleClient } from '@/lib/searchConsoleClient';

export async function POST(req) {
    try {
        const { siteUrl, startDate, endDate } = await req.json();
        if (!siteUrl || !startDate || !endDate) {
            return NextResponse.json({ error: 'Missing siteUrl, startDate or endDate' }, { status: 400 });
        }
        const searchconsole = await getSearchConsoleClient();
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
        return NextResponse.json({ metrics: data });
    } catch (error) {
        let errorDetails = { message: error.message };
        if (error.response) errorDetails.response = error.response.data || error.response;
        if (error.errors) errorDetails.errors = error.errors;
        return NextResponse.json({ error: errorDetails }, { status: 500 });
    }
}
