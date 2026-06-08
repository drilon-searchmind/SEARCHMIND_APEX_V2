import { NextResponse } from "next/server";

import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import { listMcpDataSources } from "@root/lib/mcpDataService";

/**
 * GET /api/mcp/data — list available read-only data sources.
 */
export async function GET(request) {
    try {
        const auth = await validateMcpRequest(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        return NextResponse.json({
            readOnly: true,
            sources: listMcpDataSources(),
        });
    } catch (e) {
        console.error("[mcp data GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to list MCP data sources" },
            { status: 500 }
        );
    }
}
