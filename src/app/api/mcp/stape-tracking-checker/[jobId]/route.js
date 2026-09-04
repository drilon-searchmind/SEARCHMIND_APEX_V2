import { NextResponse } from "next/server";
import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import { getStapeTrackingCheckerJob } from "@/lib/stapeTrackingChecker";

/**
 * GET /api/mcp/stape-tracking-checker/[jobId]?waitMs=120000
 */
export async function GET(request, { params }) {
    try {
        const auth = await validateMcpRequest(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const { jobId } = await params;
        const { searchParams } = new URL(request.url);
        const waitMs = searchParams.get("waitMs") ?? searchParams.get("waitSeconds");

        let waitValue = 0;
        if (waitMs != null && waitMs !== "") {
            const n = Number(waitMs);
            waitValue = searchParams.has("waitSeconds") ? n * 1000 : n;
        }

        const job = await getStapeTrackingCheckerJob(jobId, { waitMs: waitValue });
        return NextResponse.json(job);
    } catch (e) {
        const status = e.message === "Job not found" ? 404 : 400;
        return NextResponse.json({ error: e.message || "Failed to fetch job" }, { status });
    }
}
