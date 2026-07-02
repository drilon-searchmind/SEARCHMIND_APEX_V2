import { NextResponse } from "next/server";

import { getCustomerById } from "@root/lib/customerOperations";
import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import {
    getDemoKlaviyoScheduledCampaigns,
} from "@/lib/demoAdMetrics";
import {
    fetchKlaviyoScheduledCampaigns,
} from "@/lib/klaviyoPlanningApi";

function parseQueryOptions(searchParams) {
    const daysAhead = searchParams.get("daysAhead");
    const includeDrafts = searchParams.get("includeDrafts");
    return {
        daysAhead: daysAhead != null ? Number(daysAhead) : 60,
        includeDrafts: includeDrafts !== "false",
    };
}

/**
 * GET /api/mcp/klaviyo-scheduled-campaigns?customerId=&daysAhead=60&includeDrafts=true
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
                ...getDemoKlaviyoScheduledCampaigns(options.daysAhead),
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
                        "Klaviyo Private API Key not configured. Add it in Property Settings → Email (Klaviyo). Required scopes: campaigns:read",
                },
                { status: 400 }
            );
        }

        const data = await fetchKlaviyoScheduledCampaigns(apiKey.trim(), options);
        return NextResponse.json({ customerId, customerName: doc.customerName || "", ...data });
    } catch (e) {
        console.error("[mcp klaviyo-scheduled-campaigns GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to fetch Klaviyo scheduled campaigns" },
            { status: 500 }
        );
    }
}
