import { NextResponse } from "next/server";
import { verifyApexRadarCronRequest, isApexRadarCronEnabled } from "@/lib/apexRadarCronAuth";
import { runApexRadarSlackCron } from "@/lib/apexRadarCronJob";

/** Vercel Pro: allow long Meta/Google fetches. Hobby caps at 60s. */
export const maxDuration = 300;

export const dynamic = "force-dynamic";

function parseBoolParam(value, defaultValue = true) {
    if (value == null || value === "") return defaultValue;
    const v = String(value).trim().toLowerCase();
    if (v === "false" || v === "0" || v === "no" || v === "off") return false;
    if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
    return defaultValue;
}

function parseOptionsFromRequest(request, body = {}) {
    const { searchParams } = new URL(request.url);

    const channels =
        body.channels ??
        searchParams.get("channels") ??
        searchParams.get("channel") ??
        "all";

    const sendChannel = parseBoolParam(
        body.sendChannel ?? searchParams.get("sendChannel"),
        !parseBoolParam(body.skipChannel ?? searchParams.get("skipChannel"), false)
    );

    const sendDm = parseBoolParam(
        body.sendDm ?? searchParams.get("sendDm"),
        !parseBoolParam(body.skipDm ?? searchParams.get("skipDm"), false)
    );

    return { channels, sendChannel, sendDm };
}

async function handleCron(request) {
    const auth = verifyApexRadarCronRequest(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!isApexRadarCronEnabled()) {
        return NextResponse.json(
            { error: "Apex Radar cron is disabled (APEX_RADAR_CRON_ENABLED=false)." },
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
        const result = await runApexRadarSlackCron(options);
        const status = result.success ? 200 : 207;
        return NextResponse.json(result, { status });
    } catch (err) {
        console.error("[apex-radar/cron]", err);
        return NextResponse.json(
            { error: err?.message || "Cron job failed" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/cron/apex-radar-slack
 * Vercel Cron + manual trigger (Authorization: Bearer CRON_SECRET).
 *
 * Query params (manual):
 *   channels=all|facebook|google-ads|facebook,google-ads
 *   skipChannel=true|false
 *   skipDm=true|false
 */
export async function GET(request) {
    return handleCron(request);
}

/** POST — same as GET; optional JSON body: { channels, sendChannel, sendDm, skipChannel, skipDm } */
export async function POST(request) {
    return handleCron(request);
}
