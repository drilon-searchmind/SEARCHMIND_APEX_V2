import { NextResponse } from "next/server";
import { verifyApexRadarCronRequest } from "@/lib/apexRadarCronAuth";
import {
    isCustomerIndeksCronEnabled,
    isWithinIndeksWindow,
    runCustomerIndeks,
} from "@/lib/customerIndeksCron";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function handleCron(request) {
    const auth = verifyApexRadarCronRequest(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    if (!isCustomerIndeksCronEnabled()) {
        return NextResponse.json(
            { error: "Customer Indeks cron is disabled (CUSTOMER_INDEKS_CRON_ENABLED=false)." },
            { status: 503 }
        );
    }
    if (!isWithinIndeksWindow()) {
        return NextResponse.json({ skipped: true, reason: "outside_night_window" });
    }

    try {
        const result = await runCustomerIndeks();
        return NextResponse.json(result, { status: result.success ? 200 : 207 });
    } catch (err) {
        console.error("[cron/indeks]", err);
        return NextResponse.json({ error: err?.message || "Indeks cron failed" }, { status: 500 });
    }
}

/**
 * GET /api/cron/indeks — scheduled (see vercel.json). Runs only inside the Copenhagen night window,
 * processes the oldest snapshots first, and resumes on every subsequent trigger until all are fresh.
 */
export async function GET(request) {
    return handleCron(request);
}

export async function POST(request) {
    return handleCron(request);
}
