import { NextResponse } from "next/server";

import { getCustomerById } from "@root/lib/customerOperations";
import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoKlaviyoListsAndSegments } from "@/lib/demoAdMetrics";
import { fetchKlaviyoListsAndSegments } from "@/lib/klaviyoMcpApi";

/**
 * GET /api/mcp/klaviyo-lists-segments?customerId=&maxLists=40&maxSegments=40&includeProfileCounts=true
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

        const maxLists = searchParams.get("maxLists");
        const maxSegments = searchParams.get("maxSegments");
        const includeProfileCounts = searchParams.get("includeProfileCounts");

        if (isDemoCustomerId(customerId)) {
            return NextResponse.json({ customerId, ...getDemoKlaviyoListsAndSegments() });
        }

        const doc = await getCustomerById(customerId);
        if (!doc) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        const apiKey = doc?.CustomerSettings?.klaviyoPrivateApiKey;
        if (!apiKey?.trim()) {
            return NextResponse.json(
                { error: "Klaviyo Private API Key not configured. Required scopes: lists:read, segments:read" },
                { status: 400 }
            );
        }

        const data = await fetchKlaviyoListsAndSegments(apiKey.trim(), {
            maxLists: maxLists != null ? Number(maxLists) : 100,
            maxSegments: maxSegments != null ? Number(maxSegments) : 100,
            includeProfileCounts: includeProfileCounts !== "false",
        });
        return NextResponse.json({ customerId, customerName: doc.customerName || "", ...data });
    } catch (e) {
        console.error("[mcp klaviyo-lists-segments GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to fetch Klaviyo lists and segments" },
            { status: 500 }
        );
    }
}
