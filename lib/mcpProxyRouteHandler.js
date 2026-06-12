import { NextResponse } from "next/server";

import dbConnect from "@root/lib/mongodb";
import { validateMcpRequest } from "@root/lib/mcpApiAuth";

/**
 * @param {Request} request
 * @param {(body: Record<string, unknown>, auth: { keyId: string, authMethod?: string }) => Promise<unknown>} executor
 */
export async function handleMcpProxyPost(request, executor) {
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

        const data = await executor(body, {
            keyId: auth.keyId,
            authMethod: auth.authMethod,
        });

        return NextResponse.json(data);
    } catch (e) {
        console.error("[mcp proxy POST]", e);
        const message = e.message || "Proxy request failed";
        const status = /not allowlisted|required|invalid|exceed|rate limit|only select|not configured|not found/i.test(
            message
        )
            ? 400
            : 500;
        return NextResponse.json({ error: message }, { status });
    }
}

/**
 * @param {Request} request
 */
export async function handleMcpProxyAuthGet(request) {
    try {
        const auth = await validateMcpRequest(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        return null;
    } catch (e) {
        console.error("[mcp proxy GET auth]", e);
        return NextResponse.json(
            { error: e.message || "Failed to authorize proxy request" },
            { status: 500 }
        );
    }
}
