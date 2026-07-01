import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "../../auth/[...nextauth]/route";
import connectToDatabase from "../../../../../lib/mongodb";
import { getCustomerById } from "../../../../../lib/customerOperations";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { parseMcpDateRange } from "@root/lib/mcpApiHelpers";
import { fetchWeeklyAudit } from "@root/lib/weeklyAuditApi";

/**
 * GET /api/weekly-audit/[customerId]?periodStart=&periodEnd=&compare=prev_period|yoy
 * Session-authenticated weekly audit (same payload as MCP route).
 */
export async function GET(request, { params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const { searchParams } = new URL(request.url);
    const periodStart =
        searchParams.get("periodStart") || searchParams.get("startDate");
    const periodEnd = searchParams.get("periodEnd") || searchParams.get("endDate");
    const compareRaw = String(searchParams.get("compare") || "prev_period").trim();

    if (!periodStart || !periodEnd) {
        return NextResponse.json(
            { error: "periodStart and periodEnd are required (YYYY-MM-DD)" },
            { status: 400 }
        );
    }

    try {
        parseMcpDateRange(periodStart, periodEnd);
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }

    if (!isDemoCustomerId(customerId)) {
        try {
            await connectToDatabase();
            const customer = await getCustomerById(customerId);
            if (!customer) {
                return NextResponse.json({ error: "Customer not found" }, { status: 404 });
            }
            if (session.user.isExternal) {
                const sharedIds = (session.user.sharedCustomers || []).map((id) => String(id));
                if (!sharedIds.includes(String(customerId))) {
                    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
                }
            }
        } catch (e) {
            console.error("[weekly-audit GET]", e);
            return NextResponse.json({ error: e.message }, { status: 500 });
        }
    }

    try {
        const compare = compareRaw === "yoy" ? "yoy" : "prev_period";
        const data = await fetchWeeklyAudit(customerId, {
            periodStart: String(periodStart).trim(),
            periodEnd: String(periodEnd).trim(),
            compare,
        });
        return NextResponse.json(data);
    } catch (e) {
        console.error("[weekly-audit GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to fetch weekly audit" },
            { status: 500 }
        );
    }
}
