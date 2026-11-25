import { NextResponse } from "next/server";

import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import { parseMcpDateRange } from "@root/lib/mcpApiHelpers";
import { fetchMcpChannelRevenue } from "@/lib/mcpChannelRevenue";

/**
 * GET /api/mcp/channel-revenue?customerId=&startDate=&endDate=
 * Attributed omsætning pr. kanal (Google / Meta / Email) for Apex MCP.
 */
export async function GET(request) {
    try {
        const auth = await validateMcpRequest(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const { searchParams } = new URL(request.url);
        const customerId = String(searchParams.get("customerId") || "").trim();
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        if (!customerId) {
            return NextResponse.json({ error: "customerId is required" }, { status: 400 });
        }

        let range;
        try {
            range = parseMcpDateRange(startDate, endDate);
        } catch (e) {
            return NextResponse.json({ error: e.message }, { status: 400 });
        }

        const data = await fetchMcpChannelRevenue(customerId, range);
        return NextResponse.json(data);
    } catch (e) {
        console.error("[mcp channel-revenue GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to fetch channel revenue" },
            { status: 500 }
        );
    }
}
