import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import Customer from "@/models/Customer";
import { resolveBingWebmasterSiteUrl } from "@/lib/bingWebmasterCustomerSite";
import { eachDayInRange } from "@/lib/dateRangeUtils";

/**
 * GET ?customerId=&startDate=&endDate=
 * AI Performance (citations, grounding queries) is not exposed on the public Bing Webmaster JSON API yet.
 * Returns a stable shape for the dashboard; series are zero-filled by day until Microsoft ships an endpoint.
 */
export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!customerId) {
        return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }
    if (!startDate || !endDate) {
        return NextResponse.json({ error: "startDate and endDate are required (YYYY-MM-DD)" }, { status: 400 });
    }

    await connectToDatabase();
    const customer = await Customer.findById(customerId).select("CustomerSettings").lean();
    if (!customer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    const siteResolved = resolveBingWebmasterSiteUrl(
        customer.CustomerSettings?.bingWebmasterSiteUrl,
        customerId
    );
    if (siteResolved.error) {
        return NextResponse.json({ error: siteResolved.error }, { status: siteResolved.status || 400 });
    }
    const { siteUrl } = siteResolved;

    const days = eachDayInRange(startDate, endDate);
    const seriesDaily = days.map((date) => ({
        date,
        totalCitations: 0,
        avgCitedPages: 0,
    }));

    const totalCitations = 0;
    const avgCitedPages = 0;

    const groundingQueries = [];

    const aiPerformancePortalUrl = `https://www.bing.com/webmasters/aiperformance?siteUrl=${encodeURIComponent(siteUrl)}`;

    return NextResponse.json({
        siteUrl,
        startDate,
        endDate,
        totalCitations,
        avgCitedPages,
        seriesDaily,
        groundingQueries,
        dataAvailable: false,
        aiPerformancePortalUrl,
        info: "Microsoft has not published a public JSON API for AI Performance (total citations, avg cited pages, grounding queries). The dashboard is ready to wire up when an endpoint is available. Use Open in Bing Webmaster for live data.",
    });
}
