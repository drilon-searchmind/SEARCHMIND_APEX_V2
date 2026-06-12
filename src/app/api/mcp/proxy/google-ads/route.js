import { handleMcpProxyPost } from "@root/lib/mcpProxyRouteHandler";
import { executeMcpGoogleAdsProxyCall } from "@root/lib/mcpProxyService";

/**
 * POST /api/mcp/proxy/google-ads
 * Body: { customerId, query }
 */
export async function POST(request) {
    return handleMcpProxyPost(request, async (body, auth) => {
        const customerId = String(body.customerId || "").trim();
        const query = String(body.query || body.gaql || "").trim();

        if (!query) throw new Error("query is required");

        return executeMcpGoogleAdsProxyCall(customerId, query, auth);
    });
}
