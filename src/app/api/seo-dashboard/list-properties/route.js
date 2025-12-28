import { NextResponse } from 'next/server';
import { getSearchConsoleClient } from '@/lib/searchConsoleClient';

export async function GET() {
  try {
    const searchconsole = await getSearchConsoleClient();
    const { data } = await searchconsole.sites.list({});
    return NextResponse.json({ sites: data.siteEntry || [] });
  } catch (error) {
    let errorDetails = { message: error.message };
    if (error.response) errorDetails.response = error.response.data || error.response;
    if (error.errors) errorDetails.errors = error.errors;
    return NextResponse.json({ error: errorDetails }, { status: 500 });
  }
}
