import { NextResponse } from "next/server";
import {
    verifyApexRadarCronRequest,
    isPerformanceBriefCronEnabled,
} from "@/lib/apexRadarCronAuth";
import { runPerformanceBriefDeliver } from "@/lib/performanceBriefOutboxDeliver";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function parseBoolParam(value, defaultValue = false) {
    if (value == null || value === "") return defaultValue;
    const v = String(value).trim().toLowerCase();
    if (v === "false" || v === "0" || v === "no" || v === "off") return false;
    if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
    return defaultValue;
}

function parseOptionsFromRequest(request, body = {}) {
    const { searchParams } = new URL(request.url);
    return {
        force: parseBoolParam(body.force ?? searchParams.get("force"), false),
        skipSchedule: parseBoolParam(body.skipSchedule ?? searchParams.get("skipSchedule"), false),
        dryRun: parseBoolParam(body.dryRun ?? searchParams.get("dryRun"), false),
        testCustomerId:
            String(body.testCustomerId ?? searchParams.get("testCustomerId") ?? "").trim() ||
            undefined,
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

    let body = {};
    if (request.method === "POST") {
        try {
            body = await request.json();
        } catch {
            body = {};
        }
    }

    const options = parseOptionsFromRequest(request, body);

    try {
        const result = await runPerformanceBriefDeliver(options);
        const status = result.skipped ? 200 : result.success ? 200 : 207;
        return NextResponse.json(result, { status });
    } catch (err) {
        console.error("[performance-brief/deliver]", err);
        return NextResponse.json(
            { error: err?.message || "Performance Brief deliver failed" },
            { status: 500 }
        );
    }
}

/** GET /api/cron/performance-brief/deliver — CRON B (every 4 hours) */
export async function GET(request) {
    return handleCron(request);
}

export async function POST(request) {
    return handleCron(request);
}
