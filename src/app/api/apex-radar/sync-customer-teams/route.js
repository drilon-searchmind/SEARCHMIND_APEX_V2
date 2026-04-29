import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import mongoose from "mongoose";
import { syncCustomerTeamForCustomerId } from "@/lib/customerTeamSync";

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

/**
 * POST /api/apex-radar/sync-customer-teams
 * Body: { customerIds: string[] }
 * Re-fetch ClickUp roster into Customer.customerTeam for each id (skipped when no ClickUp ID).
 */
export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const raw = body.customerIds;
    if (!Array.isArray(raw)) {
        return NextResponse.json({ error: "customerIds must be an array" }, { status: 400 });
    }

    const ids = [...new Set(raw.map((x) => String(x)).filter((id) => mongoose.Types.ObjectId.isValid(id)))];
    if (ids.length === 0) {
        return NextResponse.json({ error: "No valid customer ids" }, { status: 400 });
    }

    const max = 500;
    if (ids.length > max) {
        return NextResponse.json({ error: `At most ${max} customers per batch` }, { status: 400 });
    }

    const results = [];
    for (const customerId of ids) {
        const r = await syncCustomerTeamForCustomerId(customerId, { dryRun: false });
        results.push(r);
        await sleep(180);
    }

    const summary = {
        total: results.length,
        synced: results.filter((r) => r.ok && !r.skipped && !r?.dryRun).length,
        skipped: results.filter((r) => r.skipped).length,
        errors: results.filter((r) => r.ok === false).length,
    };

    return NextResponse.json({ results, summary });
}
