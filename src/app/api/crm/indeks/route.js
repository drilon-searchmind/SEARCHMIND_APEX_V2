import { NextResponse } from "next/server";
import connectToDatabase from "@root/lib/mongodb";
import Customer from "@/models/Customer";
import CustomerIndeksSnapshot from "@/models/CustomerIndeksSnapshot";
import { verifyCrmIndeksApiKey } from "@/lib/customerIndeksApiAuth";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { rollUpClickupGroup } from "@/lib/customerIndeksAggregate";

export const dynamic = "force-dynamic";

/**
 * GET /api/crm/indeks — stored Indeks for all customers with a ClickUp id.
 * Header: x-api-key: <CRM_INDEKS_API_KEY>. Never triggers live platform calls.
 */
export async function GET(request) {
    const auth = verifyCrmIndeksApiKey(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        await connectToDatabase();

        const [customers, snapshots] = await Promise.all([
            Customer.find({
                isArchived: { $ne: true },
                "CustomerSettings.customerClickupID": { $nin: ["", null] },
            })
                .select("_id customerName businessCategory CustomerSettings.customerClickupID")
                .lean(),
            CustomerIndeksSnapshot.find({}).select("-history -_id -__v").lean(),
        ]);

        const snapshotById = new Map(snapshots.map((s) => [s.customerId, s]));

        // Several Apex customers can share one ClickUp id → one rolled-up row per ClickUp id.
        const groups = new Map();
        for (const c of customers) {
            if (isDemoCustomerId(String(c._id))) continue;
            const clickupId = String(c.CustomerSettings?.customerClickupID || "").trim();
            if (!clickupId) continue;
            if (!groups.has(clickupId)) groups.set(clickupId, []);
            groups.get(clickupId).push({
                clickupId,
                name: c.customerName || "",
                category: c.businessCategory === "b2b" ? "b2b" : "ecommerce",
                snap: snapshotById.get(String(c._id)) || null,
            });
        }
        const rows = [...groups.entries()].map(([clickupId, members]) =>
            rollUpClickupGroup(clickupId, members)
        );

        return NextResponse.json({
            generatedAt: new Date().toISOString(),
            count: rows.length,
            customers: rows,
        });
    } catch (err) {
        console.error("[crm/indeks]", err);
        return NextResponse.json({ error: "Failed to read Indeks snapshots." }, { status: 500 });
    }
}
