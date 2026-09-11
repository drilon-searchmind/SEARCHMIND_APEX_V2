import { NextResponse } from "next/server";
import {
    verifyApexRadarCronRequest,
    isPerformanceBriefCronEnabled,
} from "@/lib/apexRadarCronAuth";
import { runPerformanceBriefCron } from "@/lib/performanceBriefCronJob";

/** Vercel Pro: allow long Meta/Google/Claude fetches per customer batch. */
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
        runId: String(body.runId ?? searchParams.get("runId") ?? "").trim() || undefined,
        continue: parseBoolParam(body.continue ?? searchParams.get("continue"), false),
        force: parseBoolParam(body.force ?? searchParams.get("force"), false),
        skipSchedule: parseBoolParam(body.skipSchedule ?? searchParams.get("skipSchedule"), false),
        send: parseBoolParam(body.send ?? searchParams.get("send"), false),
        dryRun: parseBoolParam(body.dryRun ?? searchParams.get("dryRun"), false),
        testCustomerId:
            String(body.testCustomerId ?? searchParams.get("testCustomerId") ?? "").trim() ||
            undefined,
        testChannelName:
            String(body.testChannelName ?? searchParams.get("testChannelName") ?? "").trim() ||
            undefined,
        testChannelId:
            String(body.testChannelId ?? searchParams.get("testChannelId") ?? "").trim() ||
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
        const result = await runPerformanceBriefCron(options);
        if (result.skipped) {
            return NextResponse.json(result, { status: 200 });
        }
        const status = result.success ? 200 : 207;
        return NextResponse.json(result, { status });
    } catch (err) {
        console.error("[performance-brief/cron]", err);
        return NextResponse.json(
            { error: err?.message || "Performance Brief cron failed" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/cron/performance-brief
 * Vercel Cron + manual trigger (Authorization: Bearer CRON_SECRET).
 *
 * Query params:
 *   runId — resume a specific run
 *   continue=1 — process next batch for runId
 *   force=1 — re-run current week even if completed
 *   skipSchedule=1 — manual trigger (respects per-customer schedule unless --force)
 *   send=1 — allow Slack posts for manual skipSchedule runs (default: dry-run)
 *   testCustomerId — limit run to one customer (manual testing)
 *   testChannelName — override Slack channel e.g. 1337-crm (manual testing)
 */
export async function GET(request) {
    return handleCron(request);
}

/** POST — same as GET; optional JSON body: { runId, continue, force, skipSchedule } */
export async function POST(request) {
    return handleCron(request);
}
