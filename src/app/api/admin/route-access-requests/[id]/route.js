import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@root/lib/mongodb";
import { reviewRouteAccessRequest } from "@root/lib/mcpRouteAccessService";

function requireAdmin(session) {
    if (!session?.user) return { status: 401, error: "Unauthorized" };
    if (!session.user.isAdmin) return { status: 403, error: "Forbidden" };
    return null;
}

/**
 * PATCH /api/admin/route-access-requests/[id]
 * Body: { action: "approve" | "deny" }
 */
export async function PATCH(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        const denied = requireAdmin(session);
        if (denied) {
            return NextResponse.json({ error: denied.error }, { status: denied.status });
        }

        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        const action = String(body.action || "").trim().toLowerCase();

        await dbConnect();
        const result = await reviewRouteAccessRequest(
            id,
            /** @type {"approve"|"deny"} */ (action),
            session.user.id
        );

        return NextResponse.json(result);
    } catch (e) {
        console.error("[admin route-access-requests PATCH]", e);
        const status = /not found|already|must be|not implemented|already on/i.test(
            e.message || ""
        )
            ? 400
            : 500;
        return NextResponse.json(
            { error: e.message || "Failed to review route access request" },
            { status }
        );
    }
}
