import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import Customer from "@/models/Customer";
import { fetchGoogleAdsCampaignList } from "@/lib/googleAdsApi";
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

        await connectToDatabase();
        let customer = await Customer.findById(customerId).lean();
        if (!customer) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }
        if (isDemoCustomerId(String(customerId))) {
            customer = mergeDemoCustomerDocument(customer);
        }

        const googleAdsCustomerId = customer.CustomerSettings?.googleAdsCustomerId;
        if (!isValidIntegrationId(googleAdsCustomerId)) {
            return NextResponse.json({
                campaigns: [],
                notConfigured: true,
            });
        }

        if (isDemoCustomerId(String(customerId))) {
            return NextResponse.json({
                campaigns: [
                    { id: "1001", name: "Brand Search", status: "ENABLED" },
                    { id: "1002", name: "Shopping - DK", status: "ENABLED" },
                    { id: "1003", name: "Performance Max", status: "PAUSED" },
                ],
            });
        }

        const campaigns = await fetchGoogleAdsCampaignList(
            googleAdsCustomerId,
            startDate,
            endDate,
            { quietLog: false }
        );

        return NextResponse.json({ campaigns });
    } catch (e) {
        console.error("[google-ads-campaigns] GET:", e);
        return NextResponse.json(
            { error: e.message || "Failed to load Google Ads campaigns" },
            { status: 500 }
        );
    }
}
