import { NextResponse } from "next/server";

import { validateMcpRequest } from "@root/lib/mcpApiAuth";

/**
 * Verify an MCP API key (Bearer token).
 * Used by mcp-server-apex on Railway before serving MCP tools.
 *
 * GET or POST /api/mcp/auth/verify
 * Authorization: Bearer apex_mcp_...
 */
async function handleVerify(request) {
    const result = await validateMcpRequest(request);

    if (!result.ok) {
        return NextResponse.json(
            {
                valid: false,
                error: result.error,
            },
            { status: result.status }
        );
    }

    return NextResponse.json({
        valid: true,
        readOnly: result.readOnly,
        scope: result.scope,
        keyId: result.keyId,
    });
}

export async function GET(request) {
    try {
        return await handleVerify(request);
    } catch (e) {
        console.error("[mcp auth verify GET]", e);
        return NextResponse.json(
            { valid: false, error: "Verification failed" },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    try {
        return await handleVerify(request);
    } catch (e) {
        console.error("[mcp auth verify POST]", e);
        return NextResponse.json(
            { valid: false, error: "Verification failed" },
            { status: 500 }
        );
    }
}
