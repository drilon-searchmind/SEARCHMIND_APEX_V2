import { NextResponse } from "next/server";
import { verifyApexRadarCronRequest } from "@/lib/apexRadarCronAuth";
import { runCustomerIndeks } from "@/lib/customerIndeksCron";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function bool(value, fallback = false) {
    if (value == null || value === "") return fallback;
    return ["true", "1", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function list(value) {
    return String(value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

async function handle(request) {
    const auth = verifyApexRadarCronRequest(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const sp = new URL(request.url).searchParams;
    const customerIds = list(sp.get("customerId"));
    const clickupIds = list(sp.get("clickupId"));
    const all = bool(sp.get("all"));
    const limit = Number(sp.get("limit")) || undefined;

    if (!customerIds.length && !clickupIds.length && !all && !limit) {
        return NextResponse.json(
            {
                error: "Specify customerId=..., clickupId=..., limit=N or all=true.",
                params: "customerId, clickupId (comma-separated), limit, all=true, dryRun=true, force=false",
            },
            { status: 400 }
        );
    }

    try {
        const result = await runCustomerIndeks({
            customerIds,
            clickupIds,
            all,
            limit,
            dryRun: bool(sp.get("dryRun")),
            // Manual runs recompute regardless of snapshot age unless force=false.
            force: bool(sp.get("force"), true),
        });
        return NextResponse.json(result, { status: result.success ? 200 : 207 });
    } catch (err) {
        console.error("[cron/indeks/manual]", err);
        return NextResponse.json({ error: err?.message || "Manual Indeks run failed" }, { status: 500 });
    }
}

/**
 * Manual trigger / dry-run (Authorization: Bearer CRON_SECRET).
 * Examples:
 *   ?clickupId=abc123&dryRun=true     compute one customer, no DB write
 *   ?limit=3&dryRun=true              compute the 3 oldest customers, no DB write
 *   ?clickupId=abc123                 recompute + store one customer
 *   ?all=true                         recompute + store everyone (bounded by the time budget)
 */
export async function GET(request) {
    return handle(request);
}

export async function POST(request) {
    return handle(request);
}
