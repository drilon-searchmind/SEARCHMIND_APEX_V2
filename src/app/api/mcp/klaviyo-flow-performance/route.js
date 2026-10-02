import { NextResponse } from "next/server";

import { getCustomerById } from "@root/lib/customerOperations";
import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoKlaviyoFlowMessagePerformance } from "@/lib/demoAdMetrics";
import { fetchKlaviyoFlowMessagePerformance } from "@/lib/klaviyoDashboard";

/**
 * GET /api/mcp/klaviyo-flow-performance?customerId=&startDate=&endDate=&flowId=
 */
export async function GET(request) {
    try {
        const auth = await validateMcpRequest(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const { searchParams } = new URL(request.url);
        const customerId = String(searchParams.get("customerId") || "").trim();
        const startDate = String(searchParams.get("startDate") || "").trim();
        const endDate = String(searchParams.get("endDate") || "").trim();
        const flowId = searchParams.get("flowId");

        if (!customerId || !startDate || !endDate) {
            return NextResponse.json(
                { error: "customerId, startDate, and endDate are required" },
                { status: 400 }
            );
        }

        if (isDemoCustomerId(customerId)) {
            return NextResponse.json({
                customerId,
                ...getDemoKlaviyoFlowMessagePerformance(startDate, endDate, flowId),
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
                        "Klaviyo Private API Key not configured. Required scopes: flows:read, metrics:read",
                },
                { status: 400 }
            );
        }

        const data = await fetchKlaviyoFlowMessagePerformance({
            apiKey: apiKey.trim(),
            startDate,
            endDate,
            flowId: flowId ? String(flowId).trim() : null,
        });
        return NextResponse.json({ customerId, customerName: doc.customerName || "", ...data });
    } catch (e) {
        console.error("[mcp klaviyo-flow-performance GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to fetch Klaviyo flow message performance" },
            { status: 500 }
        );
    }
}
