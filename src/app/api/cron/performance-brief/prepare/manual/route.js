import { NextResponse } from "next/server";
import {
    verifyApexRadarCronRequest,
    isPerformanceBriefCronEnabled,
} from "@/lib/apexRadarCronAuth";
import { runPerformanceBriefPrepare } from "@/lib/performanceBriefOutboxPrepare";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function parseBoolParam(value, defaultValue = false) {
    if (value == null || value === "") return defaultValue;
    const v = String(value).trim().toLowerCase();
    if (v === "false" || v === "0" || v === "no" || v === "off") return false;
    if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
    return defaultValue;
}

function parseOptionsFromRequest(request) {
    const { searchParams } = new URL(request.url);
    return {
        manual: true,
        force: true,
        continue: parseBoolParam(searchParams.get("continue"), false),
        chainDepth: Number(searchParams.get("chainDepth") || 0) || 0,
        testCustomerId: String(searchParams.get("testCustomerId") || "").trim() || undefined,
    };
}

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

    const options = parseOptionsFromRequest(request);

    try {
        const result = await runPerformanceBriefPrepare(options);
        const status = result.skipped ? 200 : result.success ? 200 : 207;
        return NextResponse.json(result, { status });
    } catch (err) {
        console.error("[performance-brief/prepare/manual]", err);
        return NextResponse.json(
            { error: err?.message || "Performance Brief manual prepare failed" },
            { status: 500 }
        );
    }
}

/**
 * Manual test CRON A — run from Vercel dashboard ("Run Cron").
 * All Slack customers · today · no schedule filter · auto-chains until done.
 * Deliver step: /api/cron/performance-brief/deliver/manual
 */
export async function GET(request) {
    return handleCron(request);
}

export async function POST(request) {
    return handleCron(request);
}
