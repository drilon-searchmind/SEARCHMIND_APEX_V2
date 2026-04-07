import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchGoogleAdsAdPerformance } from "@/lib/googleAdsAdPerformance";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoGoogleAdsAdPerformanceForRange } from "@/lib/demoAdMetrics";

export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const GOOGLE_ADS_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
    const GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const GOOGLE_ADS_REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;
    const GOOGLE_ADS_MANAGER_CUSTOMER_ID = process.env.GOOGLE_ADS_MANAGER_CUSTOMER_ID;

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const dashboardCustomerId = searchParams.get("dashboardCustomerId");

    if (!customerId || !startDate || !endDate) {
        return NextResponse.json({ error: "Missing customerId, startDate, or endDate" }, { status: 400 });
    }

    if (dashboardCustomerId && isDemoCustomerId(dashboardCustomerId)) {
        return NextResponse.json(getDemoGoogleAdsAdPerformanceForRange(startDate, endDate));
    }

    try {
        const data = await fetchGoogleAdsAdPerformance({
            developerToken: GOOGLE_ADS_DEVELOPER_TOKEN,
            clientId: GOOGLE_ADS_CLIENT_ID,
            clientSecret: GOOGLE_ADS_CLIENT_SECRET,
            refreshToken: GOOGLE_ADS_REFRESH_TOKEN,
            customerId,
            managerCustomerId: GOOGLE_ADS_MANAGER_CUSTOMER_ID,
            startDate,
            endDate,
        });
        return NextResponse.json(data);
    } catch (err) {
        console.error("[google-ads-ad-performance]", err);
        return NextResponse.json({ error: err.message || "Failed to load ad performance" }, { status: 500 });
    }
}
