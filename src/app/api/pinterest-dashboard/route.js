import { fetchPinterestDashboardMetrics } from "@/lib/pinterestApi";

/**
 * GET /api/pinterest-dashboard?adAccountId=...&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Uses server env PINTEREST_ACCESS_TOKEN (see src/lib/pinterestApi.js).
 */
export async function GET(req) {
    const accessToken = process.env.PINTEREST_ACCESS_TOKEN;
    const { searchParams } = new URL(req.url);
    const adAccountId = searchParams.get("adAccountId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!adAccountId || !startDate || !endDate) {
        return new Response(
            JSON.stringify({ error: "Missing required query parameters: adAccountId, startDate, endDate" }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    if (!accessToken) {
        return new Response(JSON.stringify({ error: "Missing PINTEREST_ACCESS_TOKEN on server" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const log = process.env.DEBUG_PINTEREST === "1" || process.env.NODE_ENV === "development";
        if (log) {
            console.log("[pinterest-dashboard] GET", { adAccountId: adAccountId.trim(), startDate, endDate });
        }
        const metrics = await fetchPinterestDashboardMetrics({
            accessToken,
            adAccountId: adAccountId.trim(),
            startDate,
            endDate,
        });
        if (log) {
            const m = metrics.metrics_by_date || [];
            const spend = m.reduce((s, r) => s + (Number(r.ad_spend) || 0), 0);
            console.log("[pinterest-dashboard] OK", {
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
        console.error("[pinterest-dashboard] error", msg, err?.stack || "");
        return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
