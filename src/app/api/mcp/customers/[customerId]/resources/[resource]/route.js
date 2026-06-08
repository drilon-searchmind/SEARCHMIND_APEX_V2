import { NextResponse } from "next/server";

import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import {
    fetchMcpCustomerResource,
    isValidMcpCustomerResource,
    listMcpCustomerResources,
} from "@root/lib/mcpResourceService";

/**
 * GET /api/mcp/customers/[customerId]/resources/[resource]?startDate=&endDate=
 */
export async function GET(request, { params }) {
    try {
        const auth = await validateMcpRequest(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const resolved = await params;
        const customerId = String(resolved?.customerId || "").trim();
        const resource = String(resolved?.resource || "").trim();

        if (!customerId) {
            return NextResponse.json({ error: "customerId is required" }, { status: 400 });
        }
        if (!isValidMcpCustomerResource(resource)) {
            return NextResponse.json(
                {
                    error: `Unknown resource. Available: ${listMcpCustomerResources().join(", ")}`,
                },
                { status: 404 }
            );
        }

        const { searchParams } = new URL(request.url);
        const data = await fetchMcpCustomerResource(customerId, resource, {
            startDate: searchParams.get("startDate") || undefined,
            endDate: searchParams.get("endDate") || undefined,
        });

        return NextResponse.json(data);
    } catch (e) {
        console.error("[mcp customer resource GET]", e);
        const status = /not found/i.test(e.message || "")
            ? 404
            : /required|invalid|exceed|unknown/i.test(e.message || "")
              ? 400
              : 500;
        return NextResponse.json(
            { error: e.message || "Failed to fetch customer resource" },
            { status }
        );
    }
}
