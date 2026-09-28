import { fetchLinkedInDashboardMetrics, resolveLinkedInAccessToken } from "@/lib/linkedinApi";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoLinkedInDashboardForRange } from "@/lib/demoAdMetrics";

/**
 * GET /api/linkedin-dashboard?adAccountId=...&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Uses server env LI_ACCESS_TOKEN (see src/lib/linkedinApi.js).
 */
export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const dashboardCustomerId = searchParams.get("dashboardCustomerId");
    const adAccountId = searchParams.get("adAccountId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!adAccountId || !startDate || !endDate) {
        return new Response(
            JSON.stringify({ error: "Missing required query parameters: adAccountId, startDate, endDate" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    if (dashboardCustomerId && isDemoCustomerId(dashboardCustomerId)) {
        return new Response(JSON.stringify(getDemoLinkedInDashboardForRange(startDate, endDate)), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        await resolveLinkedInAccessToken();
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message || "LinkedIn not configured on server" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const log = process.env.DEBUG_LINKEDIN === "1" || process.env.NODE_ENV === "development";
        if (log) {
            console.log("[linkedin-dashboard] GET", { adAccountId: adAccountId.trim(), startDate, endDate });
        }
        const metrics = await fetchLinkedInDashboardMetrics({
            adAccountId: adAccountId.trim(),
            startDate,
            endDate,
        });
        if (log) {
            const m = metrics.metrics_by_date || [];
            const spend = m.reduce((s, r) => s + (Number(r.ad_spend) || 0), 0);
            console.log("[linkedin-dashboard] OK", {
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
        console.error("[linkedin-dashboard] error", msg, err?.stack || "");
        return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
