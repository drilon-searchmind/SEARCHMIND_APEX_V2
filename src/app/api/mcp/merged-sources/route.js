import { NextResponse } from "next/server";

import { fetchMergedSources } from "@/lib/mergedSourcesApi";
import { getDemoPayload, isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoMergedSourcesForRange } from "@/lib/demoMergedSources";
import { getCustomerById } from "@root/lib/customerOperations";
import { validateMcpRequest } from "@root/lib/mcpApiAuth";
import { parseMcpDateRange } from "@root/lib/mcpApiHelpers";

/**
 * GET /api/mcp/merged-sources?customerId=&startDate=&endDate=
 * Read-only merged revenue + ad spend (same shape as dashboards).
 * Authorization: Bearer apex_mcp_…
 */
export async function GET(request) {
    try {
        const auth = await validateMcpRequest(request);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const { searchParams } = new URL(request.url);
        const customerId = String(searchParams.get("customerId") || "").trim();
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        if (!customerId) {
            return NextResponse.json({ error: "customerId is required" }, { status: 400 });
        }

        let range;
        try {
            range = parseMcpDateRange(startDate, endDate);
        } catch (e) {
            return NextResponse.json({ error: e.message }, { status: 400 });
        }

        if (isDemoCustomerId(customerId)) {
            let customer = null;
            try {
                const doc = await getCustomerById(customerId);
                customer = doc?.toObject ? doc.toObject() : doc;
            } catch {
                customer = getDemoPayload("customer");
            }
            const merged = getDemoMergedSourcesForRange(
                range.startDate,
                range.endDate,
                customer,
                {}
            );
            return NextResponse.json({
                readOnly: true,
                customerId,
                customerName: customer?.customerName || "Demo",
                startDate: range.startDate,
                endDate: range.endDate,
                ...merged,
            });
        }

        const doc = await getCustomerById(customerId);
        if (!doc) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        const data = doc.toObject ? doc.toObject() : doc;
        const settings = {
            customerName: data.customerName,
            customerType: data.customerType || "Shopify",
            ...(data.CustomerSettings || {}),
            CustomerStaticExpenses: data.CustomerStaticExpenses || {},
        };

        const merged = await fetchMergedSources(
            settings,
            range.startDate,
            range.endDate,
            {
                dailyBreakdown: true,
                source: "mcp",
            }
        );

        return NextResponse.json({
            readOnly: true,
            customerId,
            customerName: data.customerName || "",
            customerType: settings.customerType,
            startDate: range.startDate,
            endDate: range.endDate,
            ...merged,
        });
    } catch (e) {
        console.error("[mcp merged-sources GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to fetch merged sources" },
            { status: 500 }
        );
    }
}
