import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import dbConnect from "@root/lib/mongodb";
import {
    createMcpApiKey,
    listMcpApiKeysForAdmin,
} from "@root/lib/mcpApiKeyService";

function requireAdmin(session) {
    if (!session?.user) return { status: 401, error: "Unauthorized" };
    if (!session.user.isAdmin) return { status: 403, error: "Forbidden" };
    return null;
}

/**
 * GET /api/admin/mcp-keys — list MCP API keys (no secrets).
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        const denied = requireAdmin(session);
        if (denied) {
            return NextResponse.json({ error: denied.error }, { status: denied.status });
        }

        await dbConnect();
        const keys = await listMcpApiKeysForAdmin();
        return NextResponse.json({ keys });
    } catch (e) {
        console.error("[admin mcp-keys GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to load MCP keys" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/admin/mcp-keys — generate a new key.
 * Body: { name? }
 * Returns plaintext key once in `plaintext`.
 */
export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        const denied = requireAdmin(session);
        if (denied) {
            return NextResponse.json({ error: denied.error }, { status: denied.status });
        }

        const body = await request.json().catch(() => ({}));
        const { name } = body;

        await dbConnect();
        const result = await createMcpApiKey({
            name,
            createdByUserId: session.user.id,
        });

        return NextResponse.json({
            success: true,
            key: result.key,
            plaintext: result.plaintext,
            oauthClientId: result.oauthClientId,
            oauthClientSecret: result.oauthClientSecret,
        });
    } catch (e) {
        console.error("[admin mcp-keys POST]", e);
        const status = /not found|invalid|select at least/i.test(e.message || "")
            ? 400
            : 500;
        return NextResponse.json(
            { error: e.message || "Failed to create MCP key" },
            { status }
        );
    }
}
