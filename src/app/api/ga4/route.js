import { runGa4Report } from "@/lib/ga4Api";

export async function GET(req) {
    try {
        const url = new URL(req.url, process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000");
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
        const status = err?.response?.status || 500;
        const message = err?.response?.data || err?.message || "Server error";
        return new Response(JSON.stringify({ error: message }), { status });
    }
}
