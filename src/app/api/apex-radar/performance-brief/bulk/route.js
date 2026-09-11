import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import { canAccessApexRadar } from "@/lib/apexRadarAccess";
import {
    listPerformanceBriefBulkCustomers,
    savePerformanceBriefBulkSettings,
} from "@/lib/performanceBriefBulk";

/**
 * GET /api/apex-radar/performance-brief/bulk
 * Active customers + Slack channel assignments for bulk dev run.
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessApexRadar(session.user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        await connectToDatabase();
        const customers = await listPerformanceBriefBulkCustomers();
        return NextResponse.json({ customers });
    } catch (e) {
        console.error("[apex-radar/performance-brief/bulk GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to load bulk Performance Brief customers" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/apex-radar/performance-brief/bulk
 * Body: { updates: [{ customerId, slackChannelId?, slackChannelName?, scheduleDayOfWeek?, scheduleHour? }] }
 */
export async function PATCH(request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessApexRadar(session.user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const updates = Array.isArray(body?.updates) ? body.updates : [];
    if (!updates.length) {
        return NextResponse.json({ error: "updates array is required" }, { status: 400 });
    }

    try {
        await connectToDatabase();
        const saved = await savePerformanceBriefBulkSettings(updates);
        return NextResponse.json({ saved });
    } catch (e) {
        console.error("[apex-radar/performance-brief/bulk PATCH]", e);
        return NextResponse.json(
            { error: e.message || "Failed to save bulk Slack channels" },
            { status: 500 }
        );
    }
}
