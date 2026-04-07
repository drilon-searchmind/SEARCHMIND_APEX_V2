import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import Customer from "@/models/Customer";
import { resolveBingWebmasterAccessToken } from "@/lib/bingWebmasterOAuth";
import { resolveBingWebmasterSiteUrl } from "@/lib/bingWebmasterCustomerSite";
import {
    bingWebmasterJsonGet,
    getBingWebmasterApiConfig,
    parseBingJsonResponse,
    parseBingDotNetDate,
} from "@/lib/bingWebmasterApi";
import { eachDayInRange } from "@/lib/dateRangeUtils";

function normalizeForCompare(url) {
    try {
        const p = new URL(url);
        const path = p.pathname === "/" ? "" : p.pathname.replace(/\/$/, "");
        return `${p.origin}${path}`.toLowerCase();
    } catch {
        return String(url).toLowerCase().replace(/\/$/, "");
    }
}

function attachRefreshedCookie(res, refreshedFromApi, tokenSource) {
    if (refreshedFromApi?.access_token && tokenSource === "cookie-refresh") {
        const secure = process.env.NODE_ENV === "production";
        const exp = Number(refreshedFromApi.expires_in) || 3600;
        res.cookies.set("bing_wm_access_token", refreshedFromApi.access_token, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            path: "/",
            maxAge: Math.max(60, exp - 120),
        });
    }
}

/**
 * GET ?customerId= — Bing Webmaster JSON: GetUserSites + GetRankAndTrafficStats for the customer site.
 * AI Performance UI in Bing has no public JSON method; we link to it from the dashboard.
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

    const { apiKey } = getBingWebmasterApiConfig();
    let authCtx = null;
    if (!apiKey) {
        authCtx = await resolveBingWebmasterAccessToken();
        if (!authCtx.accessToken) {
            return NextResponse.json(
                {
                    error:
                        "No Bing auth — set MICROSOFT_BING_WEBMASTER_API_KEY or connect OAuth / set MICROSOFT_BING_ACCESS_TOKEN.",
                },
                { status: 401 }
            );
        }
    }

    const sitesResult = await bingWebmasterJsonGet("GetUserSites", {}, authCtx);
    if (!sitesResult.res) {
        return NextResponse.json({ error: sitesResult.error || "Bing request failed" }, { status: sitesResult.status || 401 });
    }
    if (!sitesResult.res.ok) {
        const errBody = await parseBingJsonResponse(sitesResult.res);
        return NextResponse.json(
            { error: "GetUserSites failed", bing: errBody, status: sitesResult.status },
            { status: 502 }
        );
    }

    const trafficResult = await bingWebmasterJsonGet("GetRankAndTrafficStats", { siteUrl }, authCtx);
    if (!trafficResult.res) {
        return NextResponse.json({ error: trafficResult.error || "Bing request failed" }, { status: trafficResult.status || 401 });
    }
    if (!trafficResult.res.ok) {
        const errBody = await parseBingJsonResponse(trafficResult.res);
        return NextResponse.json(
            { error: "GetRankAndTrafficStats failed", bing: errBody, status: trafficResult.status },
            { status: 502 }
        );
    }

    const sitesJson = await parseBingJsonResponse(sitesResult.res);
    const trafficJson = await parseBingJsonResponse(trafficResult.res);

    const sitesList = Array.isArray(sitesJson?.d) ? sitesJson.d : [];
    const trafficRaw = Array.isArray(trafficJson?.d) ? trafficJson.d : [];

    const siteNorm = normalizeForCompare(siteUrl);
    const siteInAccount = sitesList.some((s) => s?.Url && normalizeForCompare(s.Url) === siteNorm);

    let trafficRows = trafficRaw
        .map((row) => {
            const d = row?.Date != null ? parseBingDotNetDate(String(row.Date)) : null;
            return {
                date: d ? d.toISOString().slice(0, 10) : null,
                impressions: row?.Impressions ?? null,
                clicks: row?.Clicks ?? null,
            };
        })
        .filter((r) => r.date)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    if (startDate && endDate) {
        trafficRows = trafficRows.filter((r) => r.date >= startDate && r.date <= endDate);
    } else {
        trafficRows = trafficRows.slice(-90);
    }

    const crawlResult = await bingWebmasterJsonGet("GetCrawlStats", { siteUrl }, authCtx);
    let crawlStats = null;
    let crawlError = null;
    if (crawlResult.res?.ok) {
        const crawlJson = await parseBingJsonResponse(crawlResult.res);
        const crawlRaw = Array.isArray(crawlJson?.d) ? crawlJson.d : [];
        const crawlParsed = crawlRaw
            .map((row) => {
                const d = row?.Date != null ? parseBingDotNetDate(String(row.Date)) : null;
                return {
                    date: d ? d.toISOString().slice(0, 10) : null,
                    inIndex: row?.InIndex ?? null,
                    crawledPages: row?.CrawledPages ?? null,
                    crawlErrors: row?.CrawlErrors ?? null,
                    inLinks: row?.InLinks ?? null,
                    code2xx: row?.Code2xx ?? null,
                    code4xx: row?.Code4xx ?? null,
                    code5xx: row?.Code5xx ?? null,
                    blockedByRobotsTxt: row?.BlockedByRobotsTxt ?? null,
                };
            })
            .filter((r) => r.date)
            .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
        const latest = crawlParsed[0] || null;
        crawlStats = { latest, rows: crawlParsed.slice(0, 60) };
    } else if (crawlResult.res) {
        const errBody = await parseBingJsonResponse(crawlResult.res);
        crawlError = errBody?.Message || errBody?.message || "GetCrawlStats failed";
    }

    let rangeStart = startDate;
    let rangeEnd = endDate;
    if (!rangeStart || !rangeEnd) {
        rangeStart = trafficRows[0]?.date || new Date().toISOString().slice(0, 10);
        rangeEnd = trafficRows[trafficRows.length - 1]?.date || rangeStart;
    }
    const aiDays = eachDayInRange(rangeStart, rangeEnd);
    const aiSeriesDaily = aiDays.map((date) => ({
        date,
        totalCitations: 0,
        avgCitedPages: 0,
    }));

    const aiPerformancePortalUrl = `https://www.bing.com/webmasters/aiperformance?siteUrl=${encodeURIComponent(siteUrl)}`;
    const bingPropertyUrl = `https://www.bing.com/webmasters/home?siteUrl=${encodeURIComponent(siteUrl)}`;

    const payload = {
        ok: true,
        siteUrl,
        dateRange: { startDate: rangeStart, endDate: rangeEnd },
        tokenSource: trafficResult.tokenSource || sitesResult.tokenSource,
        sites: sitesList.map((s) => ({
            url: s.Url,
            isVerified: s.IsVerified,
        })),
        siteInAccount,
        traffic: trafficRows,
        crawlStats,
        crawlError,
        aiPerformance: {
            seriesDaily: aiSeriesDaily,
            groundingQueries: [],
            dataAvailable: false,
            portalUrl: aiPerformancePortalUrl,
        },
        aiPerformancePortalUrl,
        bingPropertyUrl,
    };

    const out = NextResponse.json(payload);
    attachRefreshedCookie(out, authCtx?.refreshedFromApi, authCtx?.tokenSource);
    return out;
}
