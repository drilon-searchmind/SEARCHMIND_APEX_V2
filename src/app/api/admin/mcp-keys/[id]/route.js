import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@root/lib/mongodb";
import {
    revokeMcpApiKey,
    updateMcpApiKey,
} from "@root/lib/mcpApiKeyService";

function requireAdmin(session) {
    if (!session?.user) return { status: 401, error: "Unauthorized" };
    if (!session.user.isAdmin) return { status: 403, error: "Forbidden" };
    return null;
}

/**
 * PATCH /api/admin/mcp-keys/[id] — update label.
 */
export async function PATCH(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        const denied = requireAdmin(session);
        if (denied) {
            return NextResponse.json({ error: denied.error }, { status: denied.status });
        }

        const resolvedParams = await params;
        const id = resolvedParams?.id;
        const body = await request.json().catch(() => ({}));

        await dbConnect();
        const key = await updateMcpApiKey(id, {
            name: body.name,
        });

        return NextResponse.json({ success: true, key });
    } catch (e) {
        console.error("[admin mcp-keys PATCH]", e);
        const status = /not found|invalid|revoked|select at least/i.test(e.message || "")
            ? 400
            : 500;
        return NextResponse.json(
            { error: e.message || "Failed to update MCP key" },
            { status }
        );
    }
}

/**
 * DELETE /api/admin/mcp-keys/[id] — revoke key (soft delete).
 */
export async function DELETE(_request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        const denied = requireAdmin(session);
        if (denied) {
            return NextResponse.json({ error: denied.error }, { status: denied.status });
        }

        const resolvedParams = await params;
        const id = resolvedParams?.id;

        await dbConnect();
        const key = await revokeMcpApiKey(id, session.user.id);
        return NextResponse.json({ success: true, key });
    } catch (e) {
        console.error("[admin mcp-keys DELETE]", e);
        const status = /not found|invalid/i.test(e.message || "") ? 400 : 500;
        return NextResponse.json(
            { error: e.message || "Failed to revoke MCP key" },
            { status }
        );
    }
}
