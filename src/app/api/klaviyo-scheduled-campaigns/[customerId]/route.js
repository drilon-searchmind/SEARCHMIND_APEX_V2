import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "../../auth/[...nextauth]/route";
import connectToDatabase from "../../../../../lib/mongodb";
import { getCustomerById } from "../../../../../lib/customerOperations";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoKlaviyoScheduledCampaigns } from "@/lib/demoAdMetrics";
import { fetchKlaviyoScheduledCampaigns } from "@/lib/klaviyoPlanningApi";

/**
 * GET /api/klaviyo-scheduled-campaigns/[customerId]?daysAhead=60&includeDrafts=true
 */
export async function GET(request, { params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const { searchParams } = new URL(request.url);
    const daysAhead = searchParams.get("daysAhead");
    const includeDrafts = searchParams.get("includeDrafts");
    const options = {
        daysAhead: daysAhead != null ? Number(daysAhead) : 60,
        includeDrafts: includeDrafts !== "false",
    };

    if (isDemoCustomerId(customerId)) {
        return NextResponse.json(getDemoKlaviyoScheduledCampaigns(options.daysAhead));
    }

    try {
        await connectToDatabase();
        const customer = await getCustomerById(customerId);
        if (!customer) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }
        if (session.user.isExternal) {
            const sharedIds = (session.user.sharedCustomers || []).map((id) => String(id));
            if (!sharedIds.includes(String(customerId))) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        const apiKey = customer?.CustomerSettings?.klaviyoPrivateApiKey;
        if (!apiKey?.trim()) {
            return NextResponse.json(
                { error: "Klaviyo Private API Key not configured for this customer." },
                { status: 400 }
            );
        }

        const data = await fetchKlaviyoScheduledCampaigns(apiKey.trim(), options);
        return NextResponse.json(data);
    } catch (e) {
        console.error("[klaviyo-scheduled-campaigns GET]", e);
        return NextResponse.json({ error: e.message || "Failed to fetch data" }, { status: 500 });
    }
}
