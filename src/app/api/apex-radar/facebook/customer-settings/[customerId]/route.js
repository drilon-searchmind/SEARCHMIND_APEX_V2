import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import Customer from "@/models/Customer";
import { isDemoCustomerId } from "@/lib/demoCustomer";

function parseOptionalNumber(v) {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/**
 * PATCH /api/apex-radar/facebook/customer-settings/[customerId]
 * Body: { targetBudget?, targetMetricType?: 'ROAS'|'CPA', targetValue?, budgetMode?: 'STATIC'|'DYNAMIC' }
 */
export async function PATCH(request, { params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolved = await params;
    const customerId = resolved.customerId;
    if (!customerId) {
        return NextResponse.json({ error: "Missing customer id" }, { status: 400 });
    }

    if (isDemoCustomerId(customerId)) {
        return NextResponse.json({ error: "Demo customers cannot be edited" }, { status: 403 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const targetMetricType = body.targetMetricType === "CPA" ? "CPA" : "ROAS";
    const budgetMode = body.budgetMode === "STATIC" ? "STATIC" : "DYNAMIC";
    const targetBudget = parseOptionalNumber(body.targetBudget);
    const targetValue = parseOptionalNumber(body.targetValue);

    if (body.targetBudget !== null && body.targetBudget !== undefined && body.targetBudget !== "" && targetBudget === null) {
        return NextResponse.json({ error: "Invalid targetBudget" }, { status: 400 });
    }
    if (body.targetValue !== null && body.targetValue !== undefined && body.targetValue !== "" && targetValue === null) {
        return NextResponse.json({ error: "Invalid targetValue" }, { status: 400 });
    }

    try {
        await connectToDatabase();
        const updated = await Customer.findByIdAndUpdate(
            customerId,
            {
                $set: {
                    "customerApexRadarSettings.facebook.targetBudget": targetBudget,
                    "customerApexRadarSettings.facebook.targetMetricType": targetMetricType,
                    "customerApexRadarSettings.facebook.targetValue": targetValue,
                    "customerApexRadarSettings.facebook.budgetMode": budgetMode,
                    updatedAt: new Date(),
                },
            },
            { new: true, runValidators: true }
        ).lean();

        if (!updated) {
            return NextResponse.json({ error: "Customer not found" }, { status: 404 });
        }

        return NextResponse.json({
            customerId: String(updated._id),
            customerApexRadarSettings: updated.customerApexRadarSettings || {},
        });
    } catch (e) {
        console.error("[apex-radar/facebook/customer-settings PATCH]", e);
        return NextResponse.json({ error: e.message || "Failed to save settings" }, { status: 500 });
    }
}
