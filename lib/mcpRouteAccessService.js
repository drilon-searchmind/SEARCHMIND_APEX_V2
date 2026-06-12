import RouteAccessRequest from "@root/models/RouteAccessRequest";
import { getCustomerById } from "@root/lib/customerOperations";
import {
    isAllowedMcpApexProxyRoute,
    isMcpApexApprovableRoute,
    isMcpApexRouteImplemented,
    listMcpApexApprovableRoutes,
    normalizeApexProxyRoute,
} from "@root/lib/mcpProxyAllowlist";
import { MCP_ROUTE_ACCESS_ADMIN_URL } from "@root/lib/mcpRouteAccessErrors";

/**
 * Auto-log (or reuse pending) when call_apex_api is blocked.
 * @param {{ route: string, customerId: string, reason: string, requestedBy?: string }} input
 */
export async function logBlockedRouteAccessRequest(input) {
    return createRouteAccessRequest(input);
}

/**
 * @param {string} route
 * @param {string} customerId
 */
export async function isMcpApexRouteAccessGranted(route, customerId) {
    const normalizedRoute = normalizeApexProxyRoute(route);
    const id = String(customerId || "").trim();
    if (!normalizedRoute || !id) return false;

    if (isAllowedMcpApexProxyRoute(normalizedRoute)) {
        return true;
    }

    if (!isMcpApexApprovableRoute(normalizedRoute)) {
        return false;
    }

    const approved = await RouteAccessRequest.findOne({
        route: normalizedRoute,
        customerId: id,
        status: "approved",
    })
        .select("_id")
        .lean();

    return Boolean(approved);
}

/**
 * @param {{ route: string, customerId: string, reason?: string, requestedBy?: string }} input
 */
export async function createRouteAccessRequest(input) {
    const route = normalizeApexProxyRoute(input.route);
    const customerId = String(input.customerId || "").trim();
    const reason = String(input.reason || "").trim();
    const requestedBy = String(input.requestedBy || "").trim();

    if (!route) throw new Error("route is required");
    if (!customerId) throw new Error("customerId is required");
    if (!reason) throw new Error("reason is required");

    if (isAllowedMcpApexProxyRoute(route)) {
        return {
            created: false,
            alreadyAllowed: true,
            route,
            customerId,
            message: "This route is already on the default MCP allowlist.",
        };
    }

    const existingPending = await RouteAccessRequest.findOne({
        route,
        customerId,
        status: "pending",
    }).lean();

    if (existingPending) {
        return {
            created: false,
            duplicatePending: true,
            request: serializeRouteAccessRequest(existingPending),
            adminReviewUrl: MCP_ROUTE_ACCESS_ADMIN_URL,
            message:
                "A pending access request for this route and customer already exists.",
        };
    }

    const alreadyApproved = await RouteAccessRequest.findOne({
        route,
        customerId,
        status: "approved",
    }).lean();

    if (alreadyApproved) {
        return {
            created: false,
            alreadyApproved: true,
            request: serializeRouteAccessRequest(alreadyApproved),
            message: "This route is already approved for this customer.",
        };
    }

    let doc;
    try {
        doc = await RouteAccessRequest.create({
            route,
            customerId,
            reason,
            requestedBy,
            status: "pending",
        });
    } catch (e) {
        if (e?.code === 11000) {
            const pending = await RouteAccessRequest.findOne({
                route,
                customerId,
                status: "pending",
            }).lean();
            return {
                created: false,
                duplicatePending: true,
                request: pending ? serializeRouteAccessRequest(pending) : null,
                adminReviewUrl: MCP_ROUTE_ACCESS_ADMIN_URL,
                message:
                    "A pending access request for this route and customer already exists.",
            };
        }
        throw e;
    }

    return {
        created: true,
        request: serializeRouteAccessRequest(doc),
        adminReviewUrl: MCP_ROUTE_ACCESS_ADMIN_URL,
        canBeApproved: isMcpApexRouteImplemented(route),
        message:
            "Access request logged. An APEX admin can review and approve it in the admin UI.",
    };
}

/**
 * @param {{ status?: string }} [query]
 */
export async function listRouteAccessRequests(query = {}) {
    const status = String(query.status || "").trim().toLowerCase();
    const filter = {};
    if (status && ["pending", "approved", "denied"].includes(status)) {
        filter.status = status;
    }

    const rows = await RouteAccessRequest.find(filter)
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();

    const customerIds = [...new Set(rows.map((row) => row.customerId).filter(Boolean))];
    /** @type {Record<string, string>} */
    const customerNames = {};

    await Promise.all(
        customerIds.map(async (customerId) => {
            try {
                const doc = await getCustomerById(customerId);
                if (doc) {
                    const data = doc.toObject ? doc.toObject() : doc;
                    customerNames[customerId] = data.customerName || "";
                }
            } catch {
                customerNames[customerId] = "";
            }
        })
    );

    return rows.map((row) => ({
        ...serializeRouteAccessRequest(row),
        customerName: customerNames[row.customerId] || "",
        canBeApproved: isMcpApexRouteImplemented(row.route),
        isDefaultAllowlisted: isAllowedMcpApexProxyRoute(row.route),
        isApprovableRoute: isMcpApexApprovableRoute(row.route),
    }));
}

/**
 * @param {string} id
 * @param {"approve"|"deny"} action
 * @param {string} reviewerUserId
 */
export async function reviewRouteAccessRequest(id, action, reviewerUserId) {
    const requestId = String(id || "").trim();
    if (!requestId) throw new Error("Request id is required");
    if (action !== "approve" && action !== "deny") {
        throw new Error('action must be "approve" or "deny"');
    }

    const doc = await RouteAccessRequest.findById(requestId);
    if (!doc) throw new Error("Route access request not found");
    if (doc.status !== "pending") {
        throw new Error(`Request is already ${doc.status}`);
    }

    if (action === "approve") {
        if (!isMcpApexRouteImplemented(doc.route)) {
            throw new Error(
                "This route is not implemented in APEX yet — a developer must add the proxy handler before approval."
            );
        }
        if (isAllowedMcpApexProxyRoute(doc.route)) {
            throw new Error("This route is already on the default MCP allowlist.");
        }
    }

    doc.status = action === "approve" ? "approved" : "denied";
    doc.reviewedByUserId = reviewerUserId;
    doc.reviewedAt = new Date();
    await doc.save();

    return {
        request: serializeRouteAccessRequest(doc.toObject()),
        message:
            action === "approve"
                ? "Route access approved for this customer. Retry call_apex_api in a new MCP session."
                : "Route access request denied.",
    };
}

/**
 * @param {Record<string, unknown>} row
 */
function serializeRouteAccessRequest(row) {
    return {
        id: String(row._id),
        route: row.route,
        customerId: row.customerId,
        reason: row.reason || "",
        requestedBy: row.requestedBy || "",
        status: row.status,
        requestedAt: row.createdAt || row.requestedAt || null,
        reviewedAt: row.reviewedAt || null,
        reviewedByUserId: row.reviewedByUserId ? String(row.reviewedByUserId) : null,
    };
}

export function listApprovableMcpApexRoutes() {
    return listMcpApexApprovableRoutes();
}
