import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getAllCustomers } from "@root/lib/customerOperations";
import connectToDatabase from "@root/lib/mongodb";
import { isDemoCustomerId, mergeDemoCustomerDocument } from "@/lib/demoCustomer";
import { fetchApexRadarGoogleAdsOverviewRows } from "@/lib/apexRadarGoogleAdsOverview";
import { buildDemoApexRadarGoogleAdsOverviewRow } from "@/lib/demoAdMetrics";
import { APEX_RADAR_CHANNEL_GOOGLE_ADS } from "@/lib/apexRadarChannels";
import ApexRadarChannelSettings from "@/models/ApexRadarChannelSettings";
import { mergeGoogleChannelSettingsIntoCustomers } from "@/lib/apexRadarChannelSettingsMerge";

function toPlainCustomer(doc) {
    if (doc && typeof doc.toObject === "function") return doc.toObject();
    return { ...doc };
}

function googleAdsConfigured() {
    return Boolean(
        process.env.GOOGLE_ADS_CLIENT_ID &&
            process.env.GOOGLE_ADS_CLIENT_SECRET &&
            process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
            process.env.GOOGLE_ADS_REFRESH_TOKEN
    );
}

/**
 * GET /api/apex-radar/google-ads/overview?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&customerId=optional
 */
export async function GET(req) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const customerId = searchParams.get("customerId");

    if (!startDate || !endDate) {
        return NextResponse.json(
            { error: "startDate and endDate are required (YYYY-MM-DD)" },
            { status: 400 }
        );
    }

    if (endDate < startDate) {
        return NextResponse.json({ error: "endDate must be on or after startDate" }, { status: 400 });
    }

    if (!googleAdsConfigured()) {
        return NextResponse.json({ error: "Google Ads API not configured" }, { status: 503 });
    }

    try {
        let customers = await getAllCustomers();
        customers = customers.map((c) => {
            const plain = toPlainCustomer(c);
            const id = String(plain._id);
            if (!isDemoCustomerId(id)) return plain;
            return mergeDemoCustomerDocument(plain);
        });

        if (customerId) {
            customers = customers.filter((c) => String(c._id) === String(customerId));
        }

        await connectToDatabase();
        const channelSettingsDocs = await ApexRadarChannelSettings.find({
            channel: APEX_RADAR_CHANNEL_GOOGLE_ADS,
            customerId: { $in: customers.map((c) => c._id) },
        }).lean();
        customers = mergeGoogleChannelSettingsIntoCustomers(customers, channelSettingsDocs);

        const { rows, windows } = await fetchApexRadarGoogleAdsOverviewRows({
            startDate,
            endDate,
            customers,
            isDemoCustomer: isDemoCustomerId,
            buildDemoRow: buildDemoApexRadarGoogleAdsOverviewRow,
        });

        return NextResponse.json({
            rows,
            windows,
            dateRange: { startDate, endDate },
        });
    } catch (e) {
        console.error("[apex-radar/google-ads/overview]", e);
        return NextResponse.json({ error: e.message || "Failed to load overview" }, { status: 500 });
    }
}
