import { getCustomerById } from "../../../../../lib/customerOperations";
import { isDemoCustomerId, getDemoPayload } from "@/lib/demoCustomer";
import { parseAdSpendExcludeQueryParam } from "@/lib/adSpendExcludeParam";
import { fetchB2BDashboardData } from "@/lib/b2bDashboardApi";
import { isB2BCustomer } from "@/lib/customerBusinessCategory";
import { formatGa4ApiError } from "@/lib/ga4ErrorUtils";

export async function GET(request, { params }) {
    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const compareStartDate = searchParams.get("compareStartDate");
    const compareEndDate = searchParams.get("compareEndDate");
    const source = searchParams.get("source") || "b2b-dashboard";
    const excludeAdSpendPlatforms = parseAdSpendExcludeQueryParam(searchParams.get("adSpendExclude"));

    if (!startDate || !endDate) {
        return Response.json({ error: "Missing startDate or endDate" }, { status: 400 });
    }

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

        const fetchOptions = {
            source,
            excludeAdSpendPlatforms,
            customerId,
        };

        const current = await fetchB2BDashboardData(customer, startDate, endDate, fetchOptions);

        let comparison = null;
        if (compareStartDate && compareEndDate) {
            comparison = await fetchB2BDashboardData(
                customer,
                compareStartDate,
                compareEndDate,
                fetchOptions
            );
        }

        return Response.json({ current, comparison });
    } catch (err) {
        const formatted = formatGa4ApiError(err);
        return Response.json(
            { error: formatted.message, code: formatted.code },
            { status: formatted.status }
        );
    }
}
