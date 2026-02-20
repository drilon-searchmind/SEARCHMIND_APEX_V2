import { NextResponse } from "next/server";
import {
    updateCustomKpi,
    deleteCustomKpi,
} from "../../../../../../lib/customKpiOperations";

function serializeKpi(kpi) {
    const obj = kpi.toObject ? kpi.toObject() : kpi;
    return {
        ...obj,
        id: obj._id?.toString() || obj.id,
    };
}

// PUT /api/custom-kpis/[customerId]/[kpiId] - Update a custom KPI
export async function PUT(request, { params }) {
    const resolvedParams = await params;
    const { customerId, kpiId } = resolvedParams;

    if (!customerId || !kpiId) {
        return NextResponse.json(
            { error: "Customer ID and KPI ID required" },
            { status: 400 }
        );
    }

    try {
        const body = await request.json();
        const { name, parts, metricA, metricB, operator } = body;

        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (parts !== undefined)
            updateData.parts = Array.isArray(parts) ? parts : [];
        if (metricA !== undefined) updateData.metricA = metricA || "";
        if (metricB !== undefined) updateData.metricB = metricB || "";
        if (operator !== undefined) updateData.operator = operator || "";

        const kpi = await updateCustomKpi(kpiId, updateData, customerId);
        return NextResponse.json(serializeKpi(kpi));
    } catch (error) {
        console.error("Error updating custom KPI:", error);
        if (error.message === "Custom KPI not found") {
            return NextResponse.json(
                { error: "Custom KPI not found" },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { error: "Failed to update custom KPI" },
            { status: 500 }
        );
    }
}

// DELETE /api/custom-kpis/[customerId]/[kpiId] - Delete a custom KPI
export async function DELETE(request, { params }) {
    const resolvedParams = await params;
    const { customerId, kpiId } = resolvedParams;

    if (!customerId || !kpiId) {
        return NextResponse.json(
            { error: "Customer ID and KPI ID required" },
            { status: 400 }
        );
    }

    try {
        const kpi = await deleteCustomKpi(kpiId, customerId);
        return NextResponse.json({
            message: "Custom KPI deleted successfully",
            kpi: serializeKpi(kpi),
        });
    } catch (error) {
        console.error("Error deleting custom KPI:", error);
        if (error.message === "Custom KPI not found") {
            return NextResponse.json(
                { error: "Custom KPI not found" },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { error: "Failed to delete custom KPI" },
            { status: 500 }
        );
    }
}
