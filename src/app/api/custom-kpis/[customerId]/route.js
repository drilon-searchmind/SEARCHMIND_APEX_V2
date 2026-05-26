import { NextResponse } from "next/server";
import {
    getCustomKpisByCustomerId,
    createCustomKpi,
} from "../../../../../lib/customKpiOperations";
import { getDemoPayload, isDemoCustomerId } from "@/lib/demoCustomer";

function serializeKpi(kpi) {
    const obj = kpi.toObject ? kpi.toObject() : kpi;
    return {
        ...obj,
        id: obj._id?.toString() || obj.id,
    };
}

// GET /api/custom-kpis/[customerId] - Get all custom KPIs for a customer
export async function GET(request, { params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;

    if (!customerId) {
        return NextResponse.json(
            { error: "Customer ID required" },
            { status: 400 }
        );
    }

    if (isDemoCustomerId(customerId)) {
        return NextResponse.json(getDemoPayload("customKpis"));
    }

    try {
        const kpis = await getCustomKpisByCustomerId(customerId);
        const serialized = kpis.map(serializeKpi);
        return NextResponse.json(serialized);
    } catch (error) {
        console.error("Error fetching custom KPIs:", error);
        return NextResponse.json(
            { error: "Failed to fetch custom KPIs" },
            { status: 500 }
        );
    }
}

// POST /api/custom-kpis/[customerId] - Create a new custom KPI
export async function POST(request, { params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;

    if (!customerId) {
        return NextResponse.json(
            { error: "Customer ID required" },
            { status: 400 }
        );
    }

    try {
        const body = await request.json();
        const { name, parts, metricA, metricB, operator, replacesStandardMetricKey } = body;

        if (!name || !name.trim()) {
            return NextResponse.json(
                { error: "KPI name is required" },
                { status: 400 }
            );
        }

        const kpiData = {
            name: name.trim(),
            parts: Array.isArray(parts) ? parts : [],
            metricA: metricA || "",
            metricB: metricB || "",
            operator: operator || "",
            replacesStandardMetricKey: replacesStandardMetricKey || null,
        };

        const kpi = await createCustomKpi(customerId, kpiData);
        return NextResponse.json(serializeKpi(kpi), { status: 201 });
    } catch (error) {
        console.error("Error creating custom KPI:", error);
        return NextResponse.json(
            { error: "Failed to create custom KPI" },
            { status: 500 }
        );
    }
}
