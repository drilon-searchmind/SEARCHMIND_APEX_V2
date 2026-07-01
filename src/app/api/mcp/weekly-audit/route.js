import { NextResponse } from "next/server";

import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import { parseMcpDateRange } from "@root/lib/mcpApiHelpers";
import { fetchWeeklyAudit } from "@root/lib/weeklyAuditApi";

/**
 * GET /api/mcp/weekly-audit?customerId=&periodStart=&periodEnd=&compare=prev_period|yoy
 * Compact weekly audit JSON (server-side aggregation). Authorization: Bearer apex_mcp_… or OAuth.
 */
export async function GET(request) {
    try {
        const auth = await validateMcpRequest(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const { searchParams } = new URL(request.url);
        const customerId = String(searchParams.get("customerId") || "").trim();
        const periodStart =
            searchParams.get("periodStart") || searchParams.get("startDate");
        const periodEnd = searchParams.get("periodEnd") || searchParams.get("endDate");
        const compareRaw = String(searchParams.get("compare") || "prev_period").trim();

        if (!customerId) {
            return NextResponse.json({ error: "customerId is required" }, { status: 400 });
        }

        try {
            parseMcpDateRange(periodStart, periodEnd);
        } catch (e) {
            return NextResponse.json({ error: e.message }, { status: 400 });
        }

        const compare = compareRaw === "yoy" ? "yoy" : "prev_period";
        const data = await fetchWeeklyAudit(customerId, {
            periodStart: String(periodStart).trim(),
            periodEnd: String(periodEnd).trim(),
            compare,
        });

        return NextResponse.json(data);
    } catch (e) {
        console.error("[mcp weekly-audit GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to fetch weekly audit" },
            { status: 500 }
        );
    }
}
