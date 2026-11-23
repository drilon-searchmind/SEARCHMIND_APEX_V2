import { NextResponse } from "next/server";
import { verifyCrmIndeksApiKey } from "@/lib/customerIndeksApiAuth";
import { verifyApexRadarCronRequest } from "@/lib/apexRadarCronAuth";
import { readPortfolioSummary } from "@/lib/portfolioSummaryRead";

export const dynamic = "force-dynamic";

/**
 * GET /api/portfolio-summary
 * Fast read of precomputed ecommerce portfolio KPIs (no live platform calls).
 *
 * Auth (one of):
 *   - x-api-key: <CRM_INDEKS_API_KEY>
 *   - Authorization: Bearer <CRON_SECRET>
 *
 * Query: startDate, endDate, compareStartDate, compareEndDate (optional — defaults to Black Days window)
 */
export async function GET(request) {
    const apiKey = verifyCrmIndeksApiKey(request);
    const cron = verifyApexRadarCronRequest(request);
    if (!apiKey.ok && !cron.ok) {
        return NextResponse.json(
            { error: apiKey.error || cron.error || "Unauthorized" },
            { status: apiKey.status === 503 ? 503 : 401 }
        );
    }

    try {
        const sp = new URL(request.url).searchParams;
        const data = await readPortfolioSummary({
            startDate: sp.get("startDate") || undefined,
            endDate: sp.get("endDate") || undefined,
            compareStartDate: sp.get("compareStartDate") || undefined,
            compareEndDate: sp.get("compareEndDate") || undefined,
        });

        return NextResponse.json(data, {
            headers: {
                "Cache-Control": "public, max-age=300, s-maxage=300",
            },
        });
    } catch (err) {
        console.error("[portfolio-summary]", err);
        return NextResponse.json(
            { error: err?.message || "Failed to read portfolio summary" },
            { status: 500 }
        );
    }
}
