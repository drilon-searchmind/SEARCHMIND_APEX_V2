import { NextResponse } from "next/server";

import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import { fetchMcpCustomerDetail } from "@root/lib/mcpResourceService";

/**
 * GET /api/mcp/customers/[customerId]
 * Full sanitized customer record (settings, objectives, team cache — no API secrets).
 */
export async function GET(request, { params }) {
    try {
        const auth = await validateMcpRequest(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const resolved = await params;
        const customerId = String(resolved?.customerId || "").trim();
        if (!customerId) {
            return NextResponse.json({ error: "customerId is required" }, { status: 400 });
        }

        const data = await fetchMcpCustomerDetail(customerId);
        return NextResponse.json(data);
    } catch (e) {
        console.error("[mcp customer detail GET]", e);
        const status = /not found/i.test(e.message || "") ? 404 : 500;
        return NextResponse.json(
            { error: e.message || "Failed to fetch customer" },
            { status }
        );
    }
}
