import {
    fetchRedditDashboardMetrics,
    resolveRedditAccessTokenForCustomer,
} from "@/lib/redditApi";
import { getCustomerById } from "../../../../lib/customerOperations";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { normalizeRedditSettings } from "@/lib/redditCustomerSettings";
import { getDemoRedditDashboardForRange } from "@/lib/demoAdMetrics";

function mergeRedditServerEnv(red) {
    const r = red || {};
    return {
        ...r,
        appId: (r.appId && String(r.appId).trim()) || (process.env.REDDIT_APP_ID || "").trim() || "",
        appSecret:
            (r.appSecret && String(r.appSecret).trim()) || (process.env.REDDIT_APP_SECRET || "").trim() || "",
    };
}

/**
 * GET /api/reddit-dashboard?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&dashboardCustomerId=...
 * Uses `CustomerSettings.reddit`; optional env `REDDIT_APP_ID`, `REDDIT_APP_SECRET`, `REDDIT_ADS_ACCESS_TOKEN`.
 */
export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const dashboardCustomerId = searchParams.get("dashboardCustomerId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!dashboardCustomerId || !startDate || !endDate) {
        return new Response(
            JSON.stringify({
                error: "Missing required query parameters: dashboardCustomerId, startDate, endDate",
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    if (isDemoCustomerId(dashboardCustomerId)) {
        return new Response(JSON.stringify(getDemoRedditDashboardForRange(startDate, endDate)), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    let reddit;
    try {
        const customer = await getCustomerById(dashboardCustomerId);
        const cs =
            customer && typeof customer.toObject === "function"
                ? customer.toObject()?.CustomerSettings
                : customer?.CustomerSettings;
        reddit = mergeRedditServerEnv(normalizeRedditSettings(cs || {}));
    } catch (e) {
        console.error("[reddit-dashboard] load customer failed", e);
        return new Response(JSON.stringify({ error: "Customer not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
        });
    }

    const accountId = (reddit.accountId || "").trim();
    if (!accountId) {
        return new Response(
            JSON.stringify({
                error:
                    "Missing Reddit ad account id — set Customer Settings → Reddit Ads → Ad account ID (often starts with t2_)",
            }),
            {
                status: 400,
                headers: { "Content-Type": "application/json" },
            }
        );
    }

    let accessToken;
    try {
        accessToken = await resolveRedditAccessTokenForCustomer(reddit);
    } catch (e) {
        const msg = e?.message || String(e);
        return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (!accessToken) {
        return new Response(
            JSON.stringify({
                error:
                    "Missing Reddit Ads authorization: use a user OAuth access token (and refresh token) from the Reddit account that can access this ad account — client id + secret alone only obtain an app token that often cannot read reports. Optionally set REDDIT_ADS_ACCESS_TOKEN. See https://ads-api.reddit.com/docs/v3/",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }

    try {
        const log = process.env.DEBUG_REDDIT === "1" || process.env.NODE_ENV === "development";
        if (log) {
            console.log("[reddit-dashboard] GET", {
                dashboardCustomerId,
                accountId,
                startDate,
                endDate,
            });
        }
        const metrics = await fetchRedditDashboardMetrics({
            accessToken,
            accountId,
            startDate,
            endDate,
            redditUsername: reddit.redditUsername,
        });
        if (log) {
            const m = metrics.metrics_by_date || [];
            const spend = m.reduce((s, r) => s + (Number(r.ad_spend) || 0), 0);
            console.log("[reddit-dashboard] OK", {
                days: m.length,
                totalAdSpend: spend,
                topCampaigns: (metrics.top_campaigns || []).length,
            });
        }
        return new Response(JSON.stringify(metrics), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        const msg = err?.message || String(err);
        console.error("[reddit-dashboard] error", msg, err?.stack || "");
        return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
