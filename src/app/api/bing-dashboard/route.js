import { isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoBingDashboardForRange } from "@/lib/demoAdMetrics";
import {
    fetchBingAdsDashboardMetrics,
    isMicrosoftAdvertisingConfigured,
} from "@/lib/microsoftAdvertisingApi";
import { getCustomerById } from "../../../../lib/customerOperations";

function toPlain(doc) {
    if (doc && typeof doc.toObject === "function") return doc.toObject();
    return doc;
}

/**
 * GET /api/bing-dashboard?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&dashboardCustomerId=...
 * Optional legacy: adAccountId=... (ignored; account + customer IDs are read from the customer record).
 *
 * Demo customers: static demo series.
 * Live: requires env Microsoft Advertising credentials + customer `bingAdsCustomerId` + `bingAdsAccountId`.
 */
export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const dashboardCustomerId = searchParams.get("dashboardCustomerId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
        return new Response(JSON.stringify({ error: "Missing required query parameters: startDate, endDate" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (!dashboardCustomerId) {
        return new Response(JSON.stringify({ error: "Missing dashboardCustomerId" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (isDemoCustomerId(dashboardCustomerId)) {
        return new Response(JSON.stringify(getDemoBingDashboardForRange(startDate, endDate)), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (!isMicrosoftAdvertisingConfigured()) {
        return new Response(
            JSON.stringify({
                error:
                    "Microsoft Advertising is not configured on the server. Set MICROSOFT_ADVERTISING_DEVELOPER_TOKEN, MICROSOFT_ADVERTISING_CLIENT_ID, MICROSOFT_ADVERTISING_CLIENT_SECRET, and MICROSOFT_ADVERTISING_REFRESH_TOKEN in the environment.",
            }),
            { status: 503, headers: { "Content-Type": "application/json" } }
        );
    }

    try {
        const doc = await getCustomerById(dashboardCustomerId);
        const customer = toPlain(doc);
        const settings = customer?.CustomerSettings || {};
        const accountId = String(settings.bingAdsAccountId || "").trim();
        const msCustomerId = String(settings.bingAdsCustomerId || "").trim();

        if (!accountId || !msCustomerId) {
            return new Response(
                JSON.stringify({
                    error:
                        "Missing bingAdsAccountId or bingAdsCustomerId in customer settings. Add them under Config → Microsoft Advertising.",
                }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        const payload = await fetchBingAdsDashboardMetrics({
            customerId: msCustomerId,
            accountId,
            startDate,
            endDate,
        });

        return new Response(JSON.stringify(payload), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        const msg = err?.message || String(err);
        console.error("[bing-dashboard]", msg);
        return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
