import { NextResponse } from "next/server";
import { getInputs, requireAuraAccess } from "@/lib/customDashboardInputs";
import { normalizeFilter } from "@/lib/auraInputs";

/**
 * GET /api/custom-dashboards/aura/filter?customerId=...
 * The account wide campaign filter every Aura dashboard uses. Readable by everyone with access to the customer,
 * saved by internal users through PUT /api/custom-dashboards/aura/inputs (key "filter").
 */
export async function GET(req) {
    const customerId = new URL(req.url).searchParams.get("customerId");
    const access = await requireAuraAccess(customerId);
    if (access.error) return NextResponse.json({ error: access.error.message }, { status: access.error.status });
    const stored = await getInputs(customerId, "aura");
    return NextResponse.json({ filter: normalizeFilter(stored.filter) });
}
