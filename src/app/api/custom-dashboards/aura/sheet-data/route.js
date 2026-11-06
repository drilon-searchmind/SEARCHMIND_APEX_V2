import connectToDatabase from "@root/lib/mongodb";
import Customer from "@/models/Customer";
import { AURA_CUSTOMER_NAME, fetchAuraSheetData } from "@/lib/auraConversionsSheet";

/** Daily conversions and other cost for the Aura custom dashboard (read from the Aura conversions sheet). */
export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    if (!customerId || !startDate || !endDate) {
        return Response.json({ error: "Missing required query parameters" }, { status: 400 });
    }
    try {
        await connectToDatabase();
        const customer = await Customer.findById(customerId).select("customerName CustomerSettings.customDashboardsEnabled").lean();
        if (
            !customer ||
            customer.customerName !== AURA_CUSTOMER_NAME ||
            customer.CustomerSettings?.customDashboardsEnabled !== true
        ) {
            return Response.json({ error: "Not available for this customer" }, { status: 404 });
        }
        return Response.json(await fetchAuraSheetData(startDate, endDate));
    } catch (err) {
        return Response.json({ error: err.message || "Failed to read the Aura sheet" }, { status: 502 });
    }
}
