import { NextResponse } from "next/server";

import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import {
    fetchMcpGlobalResource,
    isValidMcpGlobalResource,
    listMcpGlobalResources,
} from "@root/lib/mcpResourceService";
import { searchParamsToQuery } from "@root/lib/mcpQuery";

/**
 * GET /api/mcp/global/[resource]
 */
export async function GET(request, { params }) {
    try {
        const auth = await validateMcpRequest(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const resolved = await params;
        const resource = String(resolved?.resource || "").trim();

        if (!isValidMcpGlobalResource(resource)) {
            return NextResponse.json(
                {
                    error: `Unknown resource. Available: ${listMcpGlobalResources().join(", ")}`,
                },
                { status: 404 }
            );
        }

        const { searchParams } = new URL(request.url);
        const data = await fetchMcpGlobalResource(resource, searchParamsToQuery(searchParams));
        return NextResponse.json(data);
    } catch (e) {
        console.error("[mcp global resource GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to fetch global resource" },
            { status: 500 }
        );
    }
}
