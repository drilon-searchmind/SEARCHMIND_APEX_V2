import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import Customer from "@/models/Customer";
import { fetchMetaAdsCampaignList } from "@/lib/facebookApi";
import { isValidIntegrationId } from "@/lib/customerServiceIntegrations";
import { isDemoCustomerId, mergeDemoCustomerDocument } from "@/lib/demoCustomer";

export async function GET(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const resolved = await params;
        const customerId = resolved.customerId;
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        if (!startDate || !endDate) {
            return NextResponse.json(
                { error: "Missing startDate or endDate" },
                { status: 400 }
            );
        }

        const accessToken = process.env.FACEBOOK_APP_TOKEN;
        if (!accessToken) {
            return NextResponse.json(
                { error: "Facebook app token is not configured" },
                { status: 500 }
            );
        }

        await connectToDatabase();
        let customer = await Customer.findById(customerId).lean();
        if (!customer) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }
        if (isDemoCustomerId(String(customerId))) {
            customer = mergeDemoCustomerDocument(customer);
        }

        const facebookAdAccountId = customer.CustomerSettings?.facebookAdAccountId;
        if (!isValidIntegrationId(facebookAdAccountId)) {
            return NextResponse.json({
                campaigns: [],
                notConfigured: true,
            });
        }

        if (isDemoCustomerId(String(customerId))) {
            return NextResponse.json({
                campaigns: [
                    { id: "2001", name: "Prospecting - DK" },
                    { id: "2002", name: "Retargeting" },
                    { id: "2003", name: "Retail Stores Promo" },
                ],
            });
        }

        const campaigns = await fetchMetaAdsCampaignList(
            facebookAdAccountId,
            startDate,
            endDate,
            accessToken
        );

        return NextResponse.json({ campaigns });
    } catch (e) {
        console.error("[meta-ads-campaigns] GET:", e);
        return NextResponse.json(
            { error: e.message || "Failed to load Meta campaigns" },
            { status: 500 }
        );
    }
}
