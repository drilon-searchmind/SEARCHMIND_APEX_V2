import { handleMcpProxyPost } from "@root/lib/mcpProxyRouteHandler";
import { executeMcpApexProxy } from "@root/lib/mcpProxyService";

/**
 * POST /api/mcp/proxy/apex
 * Body: { route, customerId, params?, accessReason? }
 */
export async function POST(request) {
    return handleMcpProxyPost(request, async (body, auth) => {
        const route = String(body.route || "").trim();
        const customerId = String(body.customerId || "").trim();
        const params =
            body.params && typeof body.params === "object" && !Array.isArray(body.params)
                ? body.params
                : {};
        const accessReason = String(body.accessReason || "").trim();

        if (!route) throw new Error("route is required");

        return executeMcpApexProxy(route, customerId, params, {
            ...auth,
            accessReason,
        });
    });
}
