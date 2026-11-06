import { NextResponse } from "next/server";
import { getInputs, requireAuraAccess, setInput } from "@/lib/customDashboardInputs";
import { AURA_INPUT_KEYS, normalizeGoals, sanitizeAuraInput } from "@/lib/auraInputs";

/** GET /api/custom-dashboards/aura/inputs?customerId=... returns the hand-entered Aura values. */
export async function GET(req) {
    const customerId = new URL(req.url).searchParams.get("customerId");
    const access = await requireAuraAccess(customerId);
    if (access.error) return NextResponse.json({ error: access.error.message }, { status: access.error.status });
    const stored = await getInputs(customerId, "aura");
    return NextResponse.json({
        conversions: stored.conversions || [],
        campaigns: stored.campaigns || [],
        goals: normalizeGoals(stored.goals),
    });
}

/** PUT /api/custom-dashboards/aura/inputs  body: { customerId, key, data } replaces one input (internal users only). */
export async function PUT(req) {
    try {
        const { customerId, key, data } = await req.json();
        const access = await requireAuraAccess(customerId, { write: true });
        if (access.error) return NextResponse.json({ error: access.error.message }, { status: access.error.status });
        if (!AURA_INPUT_KEYS.includes(key)) return NextResponse.json({ error: `Unknown input "${key}"` }, { status: 400 });
        const clean = sanitizeAuraInput(key, data);
        await setInput(customerId, "aura", key, clean, access.session.user.email);
        return NextResponse.json({ key, data: clean });
    } catch (err) {
        return NextResponse.json({ error: err.message || "Failed to save" }, { status: 400 });
    }
}
