import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@root/lib/mongodb";
import { listRouteAccessRequests } from "@root/lib/mcpRouteAccessService";

function requireAdmin(session) {
    if (!session?.user) return { status: 401, error: "Unauthorized" };
    if (!session.user.isAdmin) return { status: 403, error: "Forbidden" };
    return null;
}

/**
 * GET /api/admin/route-access-requests?status=pending|approved|denied
 */
export async function GET(request) {
    try {
        const session = await getServerSession(authOptions);
        const denied = requireAdmin(session);
        if (denied) {
            return NextResponse.json({ error: denied.error }, { status: denied.status });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") || "";

        await dbConnect();
        const requests = await listRouteAccessRequests({ status });

        return NextResponse.json({ requests });
    } catch (e) {
        console.error("[admin route-access-requests GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to load route access requests" },
            { status: 500 }
        );
    }
}
