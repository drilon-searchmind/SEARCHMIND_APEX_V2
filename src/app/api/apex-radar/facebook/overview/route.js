import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getAllCustomers } from "@root/lib/customerOperations";
import { isDemoCustomerId, mergeDemoCustomerDocument } from "@/lib/demoCustomer";
import { fetchApexRadarFacebookOverviewRows } from "@/lib/apexRadarFacebookOverview";
import { buildDemoApexRadarFacebookOverviewRow } from "@/lib/demoAdMetrics";

function toPlainCustomer(doc) {
    if (doc && typeof doc.toObject === "function") return doc.toObject();
    return { ...doc };
}

/**
 * GET /api/apex-radar/facebook/overview?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&customerId=optional
 *
 * Loads Meta account-level daily insights for all customers (with ad accounts), batched (50 accounts
 * per Graph batch request) with parallel fallback. Respects each customer’s Meta country include/exclude.
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

    const token = process.env.FACEBOOK_APP_TOKEN;
    if (!token) {
        return NextResponse.json({ error: "Facebook token not configured" }, { status: 503 });
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

        const { rows, windows } = await fetchApexRadarFacebookOverviewRows({
            accessToken: token,
            startDate,
            endDate,
            customers,
            isDemoCustomer: isDemoCustomerId,
            buildDemoRow: buildDemoApexRadarFacebookOverviewRow,
        });

        return NextResponse.json({
            rows,
            windows,
            dateRange: { startDate, endDate },
        });
    } catch (e) {
        console.error("[apex-radar/facebook/overview]", e);
        return NextResponse.json({ error: e.message || "Failed to load overview" }, { status: 500 });
    }
}
