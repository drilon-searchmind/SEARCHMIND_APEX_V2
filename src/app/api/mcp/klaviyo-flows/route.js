import { NextResponse } from "next/server";

import { getCustomerById } from "@root/lib/customerOperations";
import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoKlaviyoFlowsOverview } from "@/lib/demoAdMetrics";
import { fetchKlaviyoFlowsOverview } from "@/lib/klaviyoPlanningApi";

function parseQueryOptions(searchParams) {
    const includeActions = searchParams.get("includeActions");
    const status = searchParams.get("status");
    const maxFlows = searchParams.get("maxFlows");
    return {
        includeActions: includeActions !== "false",
        status: status || null,
        maxFlows: maxFlows != null ? Number(maxFlows) : 80,
    };
}

/**
 * GET /api/mcp/klaviyo-flows?customerId=&includeActions=true&status=live&maxFlows=80
 */
export async function GET(request) {
    try {
        const auth = await validateMcpRequest(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const { searchParams } = new URL(request.url);
        const customerId = String(searchParams.get("customerId") || "").trim();
        if (!customerId) {
            return NextResponse.json({ error: "customerId is required" }, { status: 400 });
        }

        const options = parseQueryOptions(searchParams);

        if (isDemoCustomerId(customerId)) {
            return NextResponse.json({
                customerId,
                ...getDemoKlaviyoFlowsOverview(),
            });
        }

        const doc = await getCustomerById(customerId);
        if (!doc) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        const apiKey = doc?.CustomerSettings?.klaviyoPrivateApiKey;
        if (!apiKey?.trim()) {
            return NextResponse.json(
                {
                    error:
                        "Klaviyo Private API Key not configured. Add it in Property Settings → Email (Klaviyo). Required scopes: flows:read",
                },
                { status: 400 }
            );
        }

        const data = await fetchKlaviyoFlowsOverview(apiKey.trim(), options);
        return NextResponse.json({ customerId, customerName: doc.customerName || "", ...data });
    } catch (e) {
        console.error("[mcp klaviyo-flows GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to fetch Klaviyo flows" },
            { status: 500 }
        );
    }
}
