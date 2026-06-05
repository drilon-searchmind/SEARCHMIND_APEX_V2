import { NextResponse } from "next/server";

import { getAllCustomers } from "@root/lib/customerOperations";
import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import { serializeCustomerForMcp } from "@root/lib/mcpApiHelpers";

/**
 * GET /api/mcp/customers — list customers (read-only, no secrets).
 * Authorization: Bearer apex_mcp_…
 */
export async function GET(request) {
    try {
        const auth = await validateMcpRequest(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const { searchParams } = new URL(request.url);
        const includeArchived = searchParams.get("includeArchived") === "1";

        const customers = await getAllCustomers({ includeArchived });
        const list = customers.map((c) => serializeCustomerForMcp(c));

        return NextResponse.json({
            readOnly: true,
            count: list.length,
            customers: list,
        });
    } catch (e) {
        console.error("[mcp customers GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to list customers" },
            { status: 500 }
        );
    }
}
