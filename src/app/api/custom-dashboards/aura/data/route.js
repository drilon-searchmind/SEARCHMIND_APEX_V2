import { NextResponse } from "next/server";
import { getInputs, requireAuraAccess } from "@/lib/customDashboardInputs";
import { conversionSeries, normalizeGoals, otherCostSeries } from "@/lib/auraInputs";
import { auraCostChannelForCustomerName } from "@/lib/auraCustomerProfile";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/custom-dashboards/aura/data?customerId&startDate&endDate
 * Daily conversions and "Other" cost built from the hand-entered Aura inputs, plus the monthly goals.
 */
export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    if (!ISO.test(startDate || "") || !ISO.test(endDate || "") || endDate < startDate) {
        return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    const access = await requireAuraAccess(customerId);
    if (access.error) return NextResponse.json({ error: access.error.message }, { status: access.error.status });
    const stored = await getInputs(customerId, "aura");
    const costChannel = auraCostChannelForCustomerName(access.customer.customerName);
    return NextResponse.json({
        conversions: conversionSeries(stored.conversions, startDate, endDate),
        otherCost: otherCostSeries(stored.campaigns, startDate, endDate, costChannel),
        goals: normalizeGoals(stored.goals),
    });
}
