import { handleMcpProxyPost } from "@root/lib/mcpProxyRouteHandler";
import { executeMcpShopifyProxyCall } from "@root/lib/mcpProxyService";

/**
 * POST /api/mcp/proxy/shopify
 * Body: { queryType, customerId, params? }
 */
export async function POST(request) {
    return handleMcpProxyPost(request, async (body, auth) => {
        const queryType = String(body.queryType || body.query_type || "").trim();
        const customerId = String(body.customerId || "").trim();
        const params =
            body.params && typeof body.params === "object" && !Array.isArray(body.params)
                ? body.params
                : {};

        if (!queryType) throw new Error("queryType is required");

        return executeMcpShopifyProxyCall(queryType, customerId, params, auth);
    });
}
