import { NextResponse } from "next/server";

import { handleMcpProxyAuthGet } from "@root/lib/mcpProxyRouteHandler";
import { listMcpProxyCatalog } from "@root/lib/mcpProxyService";

/**
 * GET /api/mcp/proxy/routes — allowlisted proxy routes and guardrails.
 */
export async function GET(request) {
    const authError = await handleMcpProxyAuthGet(request);
    if (authError) return authError;

    return NextResponse.json(listMcpProxyCatalog());
}
