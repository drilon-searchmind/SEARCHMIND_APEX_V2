import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchFacebookAdsAdPerformance } from "@/lib/facebookAdsAdPerformance";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoFacebookAdsAdPerformanceForRange } from "@/lib/demoAdMetrics";

export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const FACEBOOK_APP_TOKEN = process.env.FACEBOOK_APP_TOKEN;
    const { searchParams } = new URL(req.url);
    const adAccountId = searchParams.get("adAccountId");
    const since = searchParams.get("since");
    const until = searchParams.get("until");
    const dashboardCustomerId = searchParams.get("dashboardCustomerId");
    const metaIdInclude = searchParams.get("customerMetaID") || searchParams.get("metaIdInclude") || "";
    const metaIdExclude = searchParams.get("customerMetaIDExclude") || searchParams.get("metaIdExclude") || "";

    if (!adAccountId || !since || !until) {
        return NextResponse.json({ error: "Missing adAccountId, since, or until" }, { status: 400 });
    }

    if (dashboardCustomerId && isDemoCustomerId(dashboardCustomerId)) {
        return NextResponse.json(getDemoFacebookAdsAdPerformanceForRange(since, until));
    }

    try {
        const data = await fetchFacebookAdsAdPerformance({
            accessToken: FACEBOOK_APP_TOKEN,
            adAccountId,
            startDate: since,
            endDate: until,
            metaIdInclude: metaIdInclude || undefined,
            metaIdExclude: metaIdExclude || undefined,
        });
        return NextResponse.json(data);
    } catch (err) {
        console.error("[facebook-ads-ad-performance]", err);
        return NextResponse.json({ error: err.message || "Failed to load ad performance" }, { status: 500 });
    }
}
