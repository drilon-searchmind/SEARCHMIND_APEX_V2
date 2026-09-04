import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getStapeTrackingCheckerJob } from "@/lib/stapeTrackingChecker";

/**
 * GET /api/stape/tracking-checker/[jobId]?waitMs=120000
 */
export async function GET(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { jobId } = await params;
        const { searchParams } = new URL(request.url);
        const waitMs = searchParams.get("waitMs");

        const job = await getStapeTrackingCheckerJob(jobId, {
            waitMs: waitMs != null ? Number(waitMs) : 0,
        });

        return NextResponse.json(job);
    } catch (e) {
        const status = e.message === "Job not found" ? 404 : 400;
        return NextResponse.json({ error: e.message || "Failed to fetch job" }, { status });
    }
}
