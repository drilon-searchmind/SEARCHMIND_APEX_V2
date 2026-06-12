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
     * @param {Record<string, unknown> | null} [requestResult]
     */
    constructor(route, customerId, requestResult = null) {
        super(`Route not allowlisted: ${route}`);
        this.name = "McpRouteNotAllowlistedError";
        this.code = "ROUTE_NOT_ALLOWLISTED";
        this.route = route;
        this.customerId = customerId;
        this.requestResult = requestResult;
    }

    toJson() {
        const requestLogged = Boolean(
            this.requestResult &&
                (this.requestResult.created ||
                    this.requestResult.duplicatePending ||
                    this.requestResult.alreadyApproved)
        );

        const userMessage = requestLogged
            ? `I don't have access to this resource yet. A request has been sent to your APEX admin to enable it. You can review it here: ${MCP_ROUTE_ACCESS_ADMIN_URL}`
            : "I don't have access to this resource yet. Ask your admin to approve route access in APEX.";

        return {
            error: this.message,
            code: this.code,
            route: this.route,
            customerId: this.customerId,
            readOnly: true,
            adminReviewUrl: MCP_ROUTE_ACCESS_ADMIN_URL,
            requestLogged,
            requestId: this.requestResult?.request?.id || null,
            requestStatus: this.requestResult?.request?.status || null,
            suggestedAction: requestLogged
                ? "Tell the user access is blocked, that a request was logged automatically, and share adminReviewUrl. Retry call_apex_api after admin approval."
                : "Share adminReviewUrl with the user. Optionally call request_route_access if that tool is available.",
            userMessage,
        };
    }
}
