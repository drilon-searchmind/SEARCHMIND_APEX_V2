import { getCustomerById } from "../../../../../../lib/customerOperations";
import { isDemoCustomerId, getDemoPayload } from "@/lib/demoCustomer";
import { fetchGa4EventCatalog } from "@/lib/b2bDashboardApi";
import { getGa4ConversionEventNames } from "@/lib/ga4ConversionEvents";
import { isB2BCustomer } from "@/lib/customerBusinessCategory";
import { formatGa4ApiError } from "@/lib/ga4ErrorUtils";

export async function GET(request, { params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || "90daysAgo";
    const endDate = searchParams.get("endDate") || "today";

    try {
        let customer;
        if (isDemoCustomerId(customerId)) {
            customer = getDemoPayload("customer");
            customer.businessCategory = "b2b";
        } else {
            const doc = await getCustomerById(customerId);
            if (!doc) {
                return Response.json({ error: "Customer not found" }, { status: 404 });
            }
            customer = doc.toObject ? doc.toObject() : doc;
        }

        if (!isB2BCustomer(customer) && !isDemoCustomerId(customerId)) {
            return Response.json({ error: "Customer is not configured as B2B" }, { status: 400 });
        }

        const ga4PropertyId = customer?.CustomerSettings?.ga4PropertyId?.trim?.() || "";
        const demo = isDemoCustomerId(customerId);

        if (!ga4PropertyId && !demo) {
            return Response.json(
                { error: "GA4 Property ID is not configured", code: "GA4_NOT_CONFIGURED" },
                { status: 400 }
            );
        }

        const events = await fetchGa4EventCatalog(ga4PropertyId || "demo", startDate, endDate, {
            demo,
        });

        return Response.json({
            events,
            configured: getGa4ConversionEventNames(customer?.CustomerSettings),
        });
    } catch (err) {
        const formatted = formatGa4ApiError(err);
        return Response.json(
            { error: formatted.message, code: formatted.code },
            { status: formatted.status }
        );
    }
}
