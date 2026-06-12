export const MCP_ROUTE_ACCESS_ADMIN_URL =
    "https://apex.searchmind.tech/admin/route-requests";

/**
 * Thrown when call_apex_api hits a route that is not on the default allowlist
 * and has no approved access grant for the customer.
 */
export class McpRouteNotAllowlistedError extends Error {
    /**
     * @param {string} route
     * @param {string} customerId
     */
    constructor(route, customerId) {
        super(`Route not allowlisted: ${route}`);
        this.name = "McpRouteNotAllowlistedError";
        this.code = "ROUTE_NOT_ALLOWLISTED";
        this.route = route;
        this.customerId = customerId;
    }

    toJson() {
        return {
            error: this.message,
            code: this.code,
            route: this.route,
            customerId: this.customerId,
            readOnly: true,
            adminReviewUrl: MCP_ROUTE_ACCESS_ADMIN_URL,
            suggestedAction:
                "Call request_route_access with route, customerId, and a short reason describing what data you need.",
            userMessage:
                "I don't have access to this resource yet. Ask your admin to approve route access in APEX, or call request_route_access to log a permission request.",
        };
    }
}
