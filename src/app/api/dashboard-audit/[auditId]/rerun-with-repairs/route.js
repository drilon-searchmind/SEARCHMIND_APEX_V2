import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import { getCustomerById } from "@root/lib/customerOperations";
import CustomerChannelAudit from "@/models/CustomerChannelAudit";
import { normalizeAuditReport } from "@/lib/channelAuditReport";
import { rerunAuditWithAhrefsRepairs } from "@/lib/audit/auditRerunWithRepairs";
import { rejectClientAuditAiOverrides } from "@/lib/audit/auditAiReadOnlyPolicy";

export async function POST(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (session.user.isExternal === true && session.user.isAdmin !== true) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (session.user.isAdmin !== true) {
            return NextResponse.json(
                { error: "Admin access required" },
                { status: 403 }
            );
        }

        const resolvedParams = await params;
        const auditId = resolvedParams.auditId;
        if (!auditId) {
            return NextResponse.json({ error: "auditId required" }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}));
        try {
            rejectClientAuditAiOverrides(body);
        } catch (overrideErr) {
            return NextResponse.json({ error: overrideErr.message }, { status: 400 });
        }

        await connectToDatabase();
        const doc = await CustomerChannelAudit.findById(auditId).lean();
        if (!doc) {
            return NextResponse.json({ error: "Audit not found" }, { status: 404 });
        }

        const customer = await getCustomerById(String(doc.customerId));
        const plain = typeof customer.toObject === "function" ? customer.toObject() : customer;

        const comparison =
            doc.comparisonDateRange?.startDate && doc.comparisonDateRange?.endDate
                ? {
                      startDate: String(doc.comparisonDateRange.startDate),
                      endDate: String(doc.comparisonDateRange.endDate),
                  }
                : null;

        const result = await rerunAuditWithAhrefsRepairs({
            customer: plain,
            customerId: String(doc.customerId),
            customerName: doc.customerNameSnapshot || plain.customerName || "Customer",
            dateRange: {
                startDate: doc.dateRange.startDate,
                endDate: doc.dateRange.endDate,
            },
            comparisonDateRange: comparison,
            auditSelections: Array.isArray(doc.auditSelections) ? doc.auditSelections : [],
            existingReport: doc.report || {},
        });

        if (!result.ok) {
            return NextResponse.json(
                { error: result.error || "Repair rerun failed" },
                { status: 500 }
            );
        }

        normalizeAuditReport(result.report);

        await CustomerChannelAudit.findByIdAndUpdate(auditId, {
            report: result.report,
            updatedAt: new Date(),
        });

        return NextResponse.json({
            auditId,
            report: result.report,
            repairHints: result.repairHints,
            rerunCount: result.rerunCount,
        });
    } catch (e) {
        console.error("[dashboard-audit/rerun-with-repairs]", e);
        return NextResponse.json(
            { error: e?.message || "Repair rerun failed" },
            { status: 500 }
        );
    }
}
