import { NextResponse } from "next/server";

import dbConnect from "@root/lib/mongodb";
import { requireMcpServiceKey } from "@root/lib/mcpServiceAuth";
import { verifyMcpOAuthClient } from "@root/lib/mcpApiKeyService";

/**
 * POST /api/mcp/oauth/verify-client
 * Server-to-server: mcp-server-apex validates OAuth client credentials.
 *
 * Headers: X-MCP-Service-Key
 * Body: { clientId, clientSecret? }
 */
export async function POST(request) {
    try {
        const service = requireMcpServiceKey(request);
        if (!service.ok) {
            return NextResponse.json(
                { valid: false, error: service.error },
                { status: service.status }
            );
        }

        const body = await request.json().catch(() => ({}));
        const clientId = body.clientId;
        const clientSecret = body.clientSecret;

        await dbConnect();
        const client = await verifyMcpOAuthClient(clientId, clientSecret);

        if (!client) {
            return NextResponse.json(
                { valid: false, error: "Invalid OAuth client" },
                { status: 401 }
            );
        }

        return NextResponse.json({
            valid: true,
            keyId: client.keyId,
            oauthClientId: client.oauthClientId,
            readOnly: client.readOnly,
            scope: client.accessScope,
        });
    } catch (e) {
        console.error("[mcp oauth verify-client]", e);
        return NextResponse.json(
            { valid: false, error: "Verification failed" },
            { status: 500 }
        );
    }
}
