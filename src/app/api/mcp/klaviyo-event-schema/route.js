import { NextResponse } from "next/server";

import { getCustomerById } from "@root/lib/customerOperations";
import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoKlaviyoMetricsCatalog } from "@/lib/demoAdMetrics";
import { fetchKlaviyoMetricsCatalog } from "@/lib/klaviyoMcpApi";

/**
 * GET /api/mcp/klaviyo-event-schema?customerId=&sampleEventsPerMetric=1&maxMetrics=120
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

        const sampleEventsPerMetric = searchParams.get("sampleEventsPerMetric");
        const maxMetrics = searchParams.get("maxMetrics");

        if (isDemoCustomerId(customerId)) {
            return NextResponse.json({ customerId, ...getDemoKlaviyoMetricsCatalog() });
        }

        const doc = await getCustomerById(customerId);
        if (!doc) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        const apiKey = doc?.CustomerSettings?.klaviyoPrivateApiKey;
        if (!apiKey?.trim()) {
            return NextResponse.json(
                { error: "Klaviyo Private API Key not configured. Required scopes: metrics:read, events:read" },
                { status: 400 }
            );
        }

        const data = await fetchKlaviyoMetricsCatalog(apiKey.trim(), {
            sampleEventsPerMetric:
                sampleEventsPerMetric != null ? Number(sampleEventsPerMetric) : 1,
            maxMetrics: maxMetrics != null ? Number(maxMetrics) : 120,
        });
        return NextResponse.json({ customerId, customerName: doc.customerName || "", ...data });
    } catch (e) {
        console.error("[mcp klaviyo-event-schema GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to fetch Klaviyo event schema" },
            { status: 500 }
        );
    }
}
