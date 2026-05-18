import {
    fetchSnapchatDashboardMetrics,
    resolveSnapchatAccessTokenForCustomer,
} from "@/lib/snapchatApi";
import { getCustomerById } from "../../../../lib/customerOperations";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { normalizeSnapchatSettings } from "@/lib/snapchatCustomerSettings";
import { getDemoSnapchatDashboardForRange } from "@/lib/demoAdMetrics";

/**
 * GET /api/snapchat-dashboard?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&dashboardCustomerId=...
 * Loads Marketing API bearer + ad account UUID from Mongo `CustomerSettings.snapchat`.
 * Env fallbacks (`SNAPCHAT_ACCESS_TOKEN` / refresh trio) remain for development only.
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
        return new Response(JSON.stringify(getDemoSnapchatDashboardForRange(startDate, endDate)), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    let snap;
    try {
        const customer = await getCustomerById(dashboardCustomerId);
        const cs =
            customer && typeof customer.toObject === "function"
                ? customer.toObject()?.CustomerSettings
                : customer?.CustomerSettings;
        snap = normalizeSnapchatSettings(cs || {});
    } catch (e) {
        console.error("[snapchat-dashboard] load customer failed", e);
        return new Response(JSON.stringify({ error: "Customer not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
        });
    }

    const adAccountId = snap.adAccountId.trim();
    if (!adAccountId) {
        return new Response(
            JSON.stringify({
                error: "Missing Snapchat ad account ID — set Customer Settings → Snapchat Ads → Ad account UUID",
            }),
            {
                status: 400,
                headers: { "Content-Type": "application/json" },
            }
        );
    }

    let accessToken;
    try {
        accessToken = await resolveSnapchatAccessTokenForCustomer(snap);
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
                    "Missing Snapchat Marketing API authorization: set Client ID + Client secret + Refresh token under Snapchat Ads (recommended), or a short-lived access token, or server env SNAPCHAT_* for development.",
            }),
            {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
    }

    try {
        const log = process.env.DEBUG_SNAPCHAT === "1" || process.env.NODE_ENV === "development";
        if (log) {
            console.log("[snapchat-dashboard] GET", { dashboardCustomerId, adAccountId, startDate, endDate });
        }
        const metrics = await fetchSnapchatDashboardMetrics({
            accessToken,
            adAccountId,
            startDate,
            endDate,
            snapCredentials: snap,
        });
        if (log) {
            const m = metrics.metrics_by_date || [];
            const spend = m.reduce((s, r) => s + (Number(r.ad_spend) || 0), 0);
            console.log("[snapchat-dashboard] OK", {
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
        console.error("[snapchat-dashboard] error", msg, err?.stack || "");
        return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
