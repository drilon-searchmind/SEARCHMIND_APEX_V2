import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import CustomerChannelAudit from "@/models/CustomerChannelAudit";

function requireInternalStaff(session) {
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.user.isExternal === true && session.user.isAdmin !== true) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return null;
}

/**
 * GET /api/dashboard-audit?customerId=...[&auditId=...]
 * — list audits for customer, or fetch one saved audit by Mongo _id.
 */
export async function GET(request) {
    const denied = requireInternalStaff(await getServerSession(authOptions));
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const auditId = searchParams.get("auditId");

    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
        return NextResponse.json({ error: "Invalid or missing customerId" }, { status: 400 });
    }

    try {
        await connectToDatabase();
        const custOid = new mongoose.Types.ObjectId(customerId);

        if (auditId) {
            if (!mongoose.Types.ObjectId.isValid(auditId)) {
                return NextResponse.json({ error: "Invalid auditId" }, { status: 400 });
            }
            const doc = await CustomerChannelAudit.findOne({
                _id: new mongoose.Types.ObjectId(auditId),
                customerId: custOid,
            }).lean();

            if (!doc) {
                return NextResponse.json({ error: "Audit not found" }, { status: 404 });
            }

            return NextResponse.json({
                auditId: String(doc._id),
                customerId: String(doc.customerId),
                customerName: doc.customerNameSnapshot || "",
                dateRange: doc.dateRange,
                services: (doc.serviceIds || []).map((id) => ({ id })),
                serviceIds: doc.serviceIds || [],
                report: doc.report,
                canonicalOverall: doc.canonicalOverall || doc.report?.canonicalOverall,
                generatedAt: doc.createdAt?.toISOString?.() || new Date().toISOString(),
            });
        }

        const rows = await CustomerChannelAudit.find({ customerId: custOid })
            .sort({ createdAt: -1 })
            .limit(100)
            .select(
                "_id createdAt updatedAt dateRange serviceIds canonicalOverall customerNameSnapshot"
            )
            .lean();

        const audits = rows.map((r) => ({
            auditId: String(r._id),
            createdAt: r.createdAt,
            dateRange: r.dateRange,
            serviceIds: r.serviceIds || [],
            canonicalOverall: r.canonicalOverall,
            customerNameSnapshot: r.customerNameSnapshot || "",
        }));

        return NextResponse.json({ audits });
    } catch (e) {
        console.error("[dashboard-audit GET]", e);
        return NextResponse.json({ error: "Failed to load audits" }, { status: 500 });
    }
}
