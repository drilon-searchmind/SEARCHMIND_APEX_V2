import { NextResponse } from "next/server";
import { verifyApexRadarCronRequest } from "@/lib/apexRadarCronAuth";
import {
    isPortfolioSummaryCronEnabled,
    runPortfolioSummary,
} from "@/lib/portfolioSummaryCron";
import {
    isWithinPortfolioSummaryDayHours,
    isWithinPortfolioSummarySeason,
} from "@/lib/portfolioSummaryWindows";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function handle(request) {
    const auth = verifyApexRadarCronRequest(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    if (!isPortfolioSummaryCronEnabled()) {
        return NextResponse.json(
            { error: "Portfolio summary cron is disabled (PORTFOLIO_SUMMARY_CRON_ENABLED=false)." },
            { status: 503 }
        );
    }
    if (!isWithinPortfolioSummarySeason()) {
        return NextResponse.json({
            skipped: true,
            reason: "outside_season",
            detail: "Scheduled portfolio-summary only runs in November 2026 (Copenhagen). Use /manual to force.",
        });
    }
    if (!isWithinPortfolioSummaryDayHours()) {
        return NextResponse.json({
            skipped: true,
            reason: "outside_day_hours",
            detail: "Scheduled portfolio-summary only runs 08:00–23:00 Copenhagen. Use /manual to force.",
        });
    }

    try {
        const result = await runPortfolioSummary();
        return NextResponse.json(result, { status: result.success ? 200 : 207 });
    } catch (err) {
        console.error("[cron/portfolio-summary]", err);
        return NextResponse.json(
            { error: err?.message || "Portfolio summary cron failed" },
            { status: 500 }
        );
    }
}

/** GET /api/cron/portfolio-summary — every 5 min in November only (see vercel.json). */
export async function GET(request) {
    return handle(request);
}

export async function POST(request) {
    return handle(request);
}
