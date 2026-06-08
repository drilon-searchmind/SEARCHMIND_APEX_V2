import { NextResponse } from "next/server";

import dbConnect from "@root/lib/mongodb";
import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import {
    fetchMcpDataSource,
    isValidMcpDataSource,
    listMcpDataSources,
} from "@root/lib/mcpDataService";
import { searchParamsToQuery } from "@root/lib/mcpQuery";

/**
 * GET /api/mcp/data/[source]?customerId=&startDate=&endDate=
 */
export async function GET(request, { params }) {
    try {
        const auth = await validateMcpRequest(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const resolved = await params;
        const source = String(resolved?.source || "").trim();
        if (!isValidMcpDataSource(source)) {
            return NextResponse.json(
                { error: `Unknown source. Available: ${listMcpDataSources().join(", ")}` },
                { status: 404 }
            );
        }

        const { searchParams } = new URL(request.url);
        const query = searchParamsToQuery(searchParams);
        const customerId = String(query.customerId || "").trim();

        if (!customerId) {
            return NextResponse.json({ error: "customerId is required" }, { status: 400 });
        }

        await dbConnect();
        const data = await fetchMcpDataSource(source, customerId, query);
        return NextResponse.json(data);
    } catch (e) {
        console.error("[mcp data source GET]", e);
        const status = /not found|not configured|required|invalid|exceed/i.test(e.message || "")
            ? 400
            : 500;
        return NextResponse.json(
            { error: e.message || "Failed to fetch MCP data" },
            { status }
        );
    }
}
