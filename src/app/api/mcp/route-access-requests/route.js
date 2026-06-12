import { NextResponse } from "next/server";

import dbConnect from "@root/lib/mongodb";
import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import { createRouteAccessRequest } from "@root/lib/mcpRouteAccessService";

function buildRequestedBy(auth, body) {
    const fromBody = String(body.requestedBy || "").trim();
    if (fromBody) return fromBody.slice(0, 200);
    if (auth.email) return auth.email;
    if (auth.keyId) return `mcp-key:${auth.keyId}`;
    return "unknown";
}

/**
 * POST /api/mcp/route-access-requests
 * Body: { route, customerId, reason, requestedBy? }
 */
export async function POST(request) {
    try {
        const auth = await validateMcpRequest(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const body = await request.json().catch(() => ({}));
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        await dbConnect();

        const result = await createRouteAccessRequest({
            route: body.route,
            customerId: body.customerId,
            reason: body.reason,
            requestedBy: buildRequestedBy(auth, body),
        });

        return NextResponse.json({
            readOnly: true,
            ...result,
        });
    } catch (e) {
        console.error("[mcp route-access-requests POST]", e);
        const message = e.message || "Failed to create route access request";
        const status = /required|already|invalid/i.test(message) ? 400 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
