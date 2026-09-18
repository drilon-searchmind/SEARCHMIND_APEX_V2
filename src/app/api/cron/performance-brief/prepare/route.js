import { NextResponse } from "next/server";
import {
    verifyApexRadarCronRequest,
    isPerformanceBriefCronEnabled,
} from "@/lib/apexRadarCronAuth";
import { runPerformanceBriefPrepare } from "@/lib/performanceBriefOutboxPrepare";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function handleCron(request) {
    const auth = verifyApexRadarCronRequest(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!isPerformanceBriefCronEnabled()) {
        return NextResponse.json(
            { error: "Performance Brief cron is disabled (PERFORMANCE_BRIEF_CRON_ENABLED=false)." },
            { status: 503 }
        );
    }

    try {
        const result = await runPerformanceBriefPrepare({ force: true });
        const status = result.skipped ? 200 : result.success ? 200 : 207;
        return NextResponse.json(result, { status });
    } catch (err) {
        console.error("[performance-brief/prepare]", err);
        return NextResponse.json(
            { error: err?.message || "Performance Brief prepare failed" },
            { status: 500 }
        );
    }
}

/** GET /api/cron/performance-brief/prepare — CRON A (04:00–08:00 Copenhagen, resume hourly). */
export async function GET(request) {
    return handleCron(request);
}

export async function POST(request) {
    return handleCron(request);
}
