import { handleMcpProxyPost } from "@root/lib/mcpProxyRouteHandler";
import { executeMcpMetaProxyCall } from "@root/lib/mcpProxyService";

/**
 * POST /api/mcp/proxy/meta
 * Body: { endpoint, customerId, params? }
 */
export async function POST(request) {
    return handleMcpProxyPost(request, async (body, auth) => {
        const endpoint = String(body.endpoint || "").trim();
        const customerId = String(body.customerId || "").trim();
        const params =
            body.params && typeof body.params === "object" && !Array.isArray(body.params)
                ? body.params
                : {};

        if (!endpoint) throw new Error("endpoint is required");

        return executeMcpMetaProxyCall(endpoint, customerId, params, auth);
    });
}
