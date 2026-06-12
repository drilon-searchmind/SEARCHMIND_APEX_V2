import { runGa4Report } from "@/lib/ga4Api";
import { getDemoPayload, isDemoCustomerId } from "@/lib/demoCustomer";
import { filterGa4DemoRowsByRange, getDemoGa4TimeseriesForRange } from "@/lib/demoGa4";
import { formatGa4ApiError } from "@/lib/ga4ErrorUtils";

function pickDemoGa4Response(searchParams) {
    const metrics = searchParams.get("metrics")?.split(",").filter(Boolean) || [];
    const dimensions = searchParams.get("dimensions")?.split(",").filter(Boolean) || [];
    if (dimensions.includes("date") && metrics.includes("totalUsers")) {
        return getDemoPayload("ga4Timeseries");
    }
    if (dimensions.includes("sessionDefaultChannelGroup") && !dimensions.includes("yearMonth")) {
        return getDemoPayload("ga4Channels");
    }
    if (dimensions.includes("pageTitle")) {
        return getDemoPayload("ga4Pages");
    }
    if (dimensions.includes("yearMonth") && dimensions.includes("sessionDefaultChannelGroup")) {
        return getDemoPayload("ga4Acquisition");
    }
    if (dimensions.includes("deviceCategory")) {
        return getDemoPayload("ga4Devices");
    }
    return getDemoPayload("ga4Timeseries");
}

function buildDemoGa4ForRequest(searchParams) {
    const startDate = searchParams.get("startDate") || "2025-01-01";
    const endDate = searchParams.get("endDate") || startDate;
    const metrics = searchParams.get("metrics")?.split(",").filter(Boolean) || [];
    const dimensions = searchParams.get("dimensions")?.split(",").filter(Boolean) || [];

    if (dimensions.includes("date") && metrics.includes("totalUsers")) {
        return getDemoGa4TimeseriesForRange(startDate, endDate);
    }

    const base = pickDemoGa4Response(searchParams);
    const filtered = filterGa4DemoRowsByRange(base, startDate, endDate);
    if (filtered?.rows?.length) return filtered;
    return base;
}

export async function GET(req) {
    try {
        const url = new URL(req.url, process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000");
        const customerId = url.searchParams.get("customerId");
        if (customerId && isDemoCustomerId(customerId)) {
            const data = buildDemoGa4ForRequest(url.searchParams);
            return new Response(JSON.stringify(data, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
        }
        const propertyId = url.searchParams.get("propertyId") || "460732795";
        const startDate = url.searchParams.get("startDate") || undefined;
        const endDate = url.searchParams.get("endDate") || undefined;
        const metrics = url.searchParams.get("metrics")?.split(",").filter(Boolean) || undefined;
        const dimensions = url.searchParams.get("dimensions")?.split(",").filter(Boolean) || undefined;
        const limitParam = url.searchParams.get("limit");
        const limit = limitParam ? Number(limitParam) : undefined;

        const data = await runGa4Report({ propertyId, startDate, endDate, metrics, dimensions, limit });
        return new Response(JSON.stringify(data, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (err) {
        const formatted = formatGa4ApiError(err);
        return new Response(
            JSON.stringify({ error: formatted.message, code: formatted.code }, null, 2),
            { status: formatted.status, headers: { "Content-Type": "application/json" } }
        );
    }
}
