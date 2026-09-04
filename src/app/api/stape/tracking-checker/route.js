import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
    fetchStapeTrackingCheckerLimit,
    startStapeTrackingCheckerJob,
} from "@/lib/stapeTrackingChecker";

/**
 * POST /api/stape/tracking-checker
 * Body: { customerId?, siteUrl? }
 */
export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
            requestedBy: session.user.email,
        });

        return NextResponse.json(job, { status: job.status === "failed" ? 502 : 202 });
    } catch (e) {
        console.error("[stape tracking-checker POST]", e);
        const status = e.message === "Customer not found" ? 404 : 400;
        return NextResponse.json({ error: e.message || "Failed to start scan" }, { status });
    }
}

/**
 * GET /api/stape/tracking-checker — monthly Stape API limit
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const limit = await fetchStapeTrackingCheckerLimit();
        return NextResponse.json(limit);
    } catch (e) {
        console.error("[stape tracking-checker limit GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to fetch Stape limit" },
            { status: 500 }
        );
    }
}
