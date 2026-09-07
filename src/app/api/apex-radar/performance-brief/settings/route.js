import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import { canAccessApexRadar } from "@/lib/apexRadarAccess";
import Customer from "@/models/Customer";
import {
    getApexRadarCustomerSlackChannel,
    setApexRadarCustomerSlackChannel,
} from "@/lib/apexRadarCustomerSlack";
import { isPerformanceBriefCustomerId } from "@/lib/performanceBriefConstants";

function customerIdFromRequest(request, body = null) {
    const { searchParams } = new URL(request.url);
    const fromQuery = String(searchParams.get("customerId") || "").trim();
    if (isPerformanceBriefCustomerId(fromQuery)) return fromQuery;
    const fromBody = String(body?.customerId || "").trim();
    if (isPerformanceBriefCustomerId(fromBody)) return fromBody;
    return "";
}

/**
 * GET /api/apex-radar/performance-brief/settings?customerId=
 */
export async function GET(request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canAccessApexRadar(session.user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const customerId = customerIdFromRequest(request);
    if (!customerId) {
        return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    try {
        await connectToDatabase();
        const exists = await Customer.findById(customerId).select("_id").lean();
        if (!exists) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }
        const settings = await getApexRadarCustomerSlackChannel(customerId);
        return NextResponse.json({
            customerId,
            settings,
        });
    } catch (e) {
        console.error("[apex-radar/performance-brief/settings GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to load Performance Brief settings" },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/apex-radar/performance-brief/settings
 * Body: { customerId?, slackChannelId?, slackChannelName? }
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

    const customerId = customerIdFromRequest(request, body);
    if (!customerId) {
        return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    try {
        await connectToDatabase();
        const exists = await Customer.findById(customerId).select("_id").lean();
        if (!exists) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        const slack = {};
        if (body.slackChannelId !== undefined) slack.slackChannelId = body.slackChannelId;
        if (body.slackChannelName !== undefined) slack.slackChannelName = body.slackChannelName;
        const settings =
            Object.keys(slack).length > 0
                ? await setApexRadarCustomerSlackChannel(customerId, slack)
                : await getApexRadarCustomerSlackChannel(customerId);

        return NextResponse.json({
            customerId,
            settings,
        });
    } catch (e) {
        console.error("[apex-radar/performance-brief/settings PATCH]", e);
        return NextResponse.json(
            { error: e.message || "Failed to save Performance Brief settings" },
            { status: 500 }
        );
    }
}
