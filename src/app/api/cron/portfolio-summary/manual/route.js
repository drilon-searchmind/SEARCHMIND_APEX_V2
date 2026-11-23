import { NextResponse } from "next/server";
import { verifyApexRadarCronRequest } from "@/lib/apexRadarCronAuth";
import { runPortfolioSummary } from "@/lib/portfolioSummaryCron";

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
    const all = bool(sp.get("all"));
    const limit = Number(sp.get("limit")) || undefined;

    if (!customerIds.length && !all && !limit) {
        return NextResponse.json(
            {
                error: "Specify customerId=..., limit=N or all=true.",
                params:
                    "customerId, limit, all=true, dryRun=true, force=true, startDate, endDate, compareStartDate, compareEndDate",
            },
            { status: 400 }
        );
    }

    try {
        const result = await runPortfolioSummary({
            customerIds,
            all,
            limit,
            dryRun: bool(sp.get("dryRun")),
            force: bool(sp.get("force"), true),
            startDate: sp.get("startDate") || undefined,
            endDate: sp.get("endDate") || undefined,
            compareStartDate: sp.get("compareStartDate") || undefined,
            compareEndDate: sp.get("compareEndDate") || undefined,
        });
        return NextResponse.json(result, { status: result.success ? 200 : 207 });
    } catch (err) {
        console.error("[cron/portfolio-summary/manual]", err);
        return NextResponse.json(
            { error: err?.message || "Manual portfolio summary failed" },
            { status: 500 }
        );
    }
}

/**
 * Manual / dry-run (Authorization: Bearer CRON_SECRET).
 * Examples:
 *   ?limit=3&dryRun=true
 *   ?customerId=<id>&force=true
 *   ?all=true&startDate=2026-11-01&endDate=2026-11-22
 */
export async function GET(request) {
    return handle(request);
}

export async function POST(request) {
    return handle(request);
}
