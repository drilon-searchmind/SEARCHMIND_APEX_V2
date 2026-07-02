import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "../../auth/[...nextauth]/route";
import connectToDatabase from "../../../../../lib/mongodb";
import { getCustomerById } from "../../../../../lib/customerOperations";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { getDemoKlaviyoFlowsOverview } from "@/lib/demoAdMetrics";
import { fetchKlaviyoFlowsOverview } from "@/lib/klaviyoPlanningApi";

/**
 * GET /api/klaviyo-flows/[customerId]?includeActions=true&status=live&maxFlows=80
 */
export async function GET(request, { params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const { searchParams } = new URL(request.url);
    const options = {
        includeActions: searchParams.get("includeActions") !== "false",
        status: searchParams.get("status") || null,
        maxFlows: searchParams.get("maxFlows") != null ? Number(searchParams.get("maxFlows")) : 80,
    };

    if (isDemoCustomerId(customerId)) {
        return NextResponse.json(getDemoKlaviyoFlowsOverview());
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

        const data = await fetchKlaviyoFlowsOverview(apiKey.trim(), options);
        return NextResponse.json(data);
    } catch (e) {
        console.error("[klaviyo-flows GET]", e);
        return NextResponse.json({ error: e.message || "Failed to fetch data" }, { status: 500 });
    }
}
