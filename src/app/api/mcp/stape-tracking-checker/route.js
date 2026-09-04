import { NextResponse } from "next/server";
import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import {
    fetchStapeTrackingCheckerLimit,
    startStapeTrackingCheckerJob,
} from "@/lib/stapeTrackingChecker";

/**
 * POST /api/mcp/stape-tracking-checker
 * Body: { customerId?, siteUrl? }
 */
export async function POST(request) {
    try {
        const auth = await validateMcpRequest(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const body = await request.json().catch(() => ({}));
        const customerId = String(body.customerId || "").trim() || undefined;
        const siteUrl = String(body.siteUrl || "").trim() || undefined;

        if (!customerId && !siteUrl) {
            return NextResponse.json(
                { error: "customerId or siteUrl is required" },
                { status: 400 }
            );
        }

        const job = await startStapeTrackingCheckerJob({
            customerId,
            siteUrl,
            requestedBy: auth.email || auth.keyId || "mcp",
        });

        return NextResponse.json(job, { status: job.status === "failed" ? 502 : 202 });
    } catch (e) {
        console.error("[mcp stape-tracking-checker POST]", e);
        const status = e.message === "Customer not found" ? 404 : 400;
        return NextResponse.json({ error: e.message || "Failed to start scan" }, { status });
    }
}

/**
 * GET /api/mcp/stape-tracking-checker — monthly Stape API limit
 */
export async function GET(request) {
    try {
        const auth = await validateMcpRequest(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const limit = await fetchStapeTrackingCheckerLimit();
        return NextResponse.json(limit);
    } catch (e) {
        console.error("[mcp stape-tracking-checker limit GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to fetch Stape limit" },
            { status: 500 }
        );
    }
}
