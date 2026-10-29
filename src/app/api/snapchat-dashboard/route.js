import {
    fetchSnapchatDashboardExtras,
    fetchSnapchatDashboardMetrics,
    resolveSnapchatAccessTokenForCustomer,
} from "@/lib/snapchatApi";
import { getCustomerById } from "../../../../lib/customerOperations";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { normalizeSnapchatSettings } from "@/lib/snapchatCustomerSettings";
import { getDemoSnapDashboardForRange } from "@/lib/demoSnap";

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
        return new Response(JSON.stringify(getDemoSnapDashboardForRange(startDate, endDate)), {
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
        // Audience breakdowns and video, reach and engagement detail are best-effort extras for the dashboard
        if (searchParams.get("extras") !== "0") {
            try {
                const extras = await fetchSnapchatDashboardExtras({ accessToken, adAccountId, startDate, endDate });
                const detailById = new Map(extras.campaign_detail.map((d) => [String(d.campaign_id), d]));
                metrics.top_campaigns = (metrics.top_campaigns || []).map((c) => {
                    const d = detailById.get(String(c.campaign_id));
                    return d ? { ...c, ...d, campaign_id: c.campaign_id } : c;
                });
                metrics.audience = extras.audience;
                metrics.warnings = extras.warnings;
            } catch (eExtras) {
                metrics.audience = {};
                metrics.warnings = [{ part: "extras", message: eExtras?.message || "Extra reports failed" }];
            }
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
