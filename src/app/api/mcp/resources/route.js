import { NextResponse } from "next/server";

import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import { listMcpDataSources } from "@root/lib/mcpDataService";
import {
    listMcpCustomerResources,
    listMcpGlobalResources,
} from "@root/lib/mcpResourceService";

/**
 * GET /api/mcp/resources — catalog of all MCP-readable APEX data (no secrets).
 */
export async function GET(request) {
    try {
        const auth = await validateMcpRequest(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        return NextResponse.json({
            readOnly: true,
            metricsSources: listMcpDataSources(),
            customerResources: listMcpCustomerResources(),
            globalResources: listMcpGlobalResources(),
            security: {
                secretsStripped: true,
                writeOperations: false,
            },
        });
    } catch (e) {
        console.error("[mcp resources GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to list resources" },
            { status: 500 }
        );
    }
}
