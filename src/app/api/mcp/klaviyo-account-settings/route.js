import { NextResponse } from "next/server";

import { getCustomerById } from "@root/lib/customerOperations";
import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoKlaviyoAccountContext } from "@/lib/demoAdMetrics";
import { fetchKlaviyoAccountContext } from "@/lib/klaviyoMcpApi";

/**
 * GET /api/mcp/klaviyo-account-settings?customerId=
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

        if (isDemoCustomerId(customerId)) {
            return NextResponse.json({ customerId, ...getDemoKlaviyoAccountContext() });
        }

        const doc = await getCustomerById(customerId);
        if (!doc) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        const apiKey = doc?.CustomerSettings?.klaviyoPrivateApiKey;
        if (!apiKey?.trim()) {
            return NextResponse.json(
                { error: "Klaviyo Private API Key not configured. Required scopes: accounts:read, metrics:read" },
                { status: 400 }
            );
        }

        const data = await fetchKlaviyoAccountContext(apiKey.trim());
        return NextResponse.json({ customerId, customerName: doc.customerName || "", ...data });
    } catch (e) {
        console.error("[mcp klaviyo-account-settings GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to fetch Klaviyo account settings" },
            { status: 500 }
        );
    }
}
