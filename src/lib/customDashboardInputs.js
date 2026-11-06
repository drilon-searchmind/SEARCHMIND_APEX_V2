import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import Customer from "@/models/Customer";
import CustomDashboardInput from "@/models/CustomDashboardInput";

/** The customer allowed to use the Aura inputs API (must also have "Custom dashboards" switched on). */
export const AURA_CUSTOMER_NAME = "Aura DK";

/**
 * Session and customer check shared by the Aura input routes.
 * Returns { error: { message, status } } or { session, customer }. Writing is limited to internal users.
 */
export async function requireAuraAccess(customerId, { write = false } = {}) {
    const session = await getServerSession(authOptions);
    if (!session?.user) return { error: { message: "Unauthorized", status: 401 } };
    if (!customerId) return { error: { message: "Missing customerId", status: 400 } };
    if (session.user.isExternal) {
        const shared = (session.user.sharedCustomers || []).map((id) => String(id));
        if (write || !shared.includes(String(customerId))) return { error: { message: "Forbidden", status: 403 } };
    }
    await connectToDatabase();
    const customer = await Customer.findById(customerId).select("customerName CustomerSettings.customDashboardsEnabled").lean();
    if (
        !customer ||
        customer.customerName !== AURA_CUSTOMER_NAME ||
        customer.CustomerSettings?.customDashboardsEnabled !== true
    ) {
        return { error: { message: "Not available for this customer", status: 404 } };
    }
    return { session, customer };
}

export async function getInputs(customerId, dashboard) {
    const docs = await CustomDashboardInput.find({ customer: customerId, dashboard }).lean();
    return Object.fromEntries(docs.map((d) => [d.key, d.data]));
}

export async function setInput(customerId, dashboard, key, data, updatedBy) {
    await CustomDashboardInput.findOneAndUpdate(
        { customer: customerId, dashboard, key },
        { $set: { data, updatedBy: updatedBy || "" } },
        { upsert: true, new: true }
    );
}
