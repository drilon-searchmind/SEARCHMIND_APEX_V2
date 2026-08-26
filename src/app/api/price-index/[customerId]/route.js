import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "../../auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import {
    getCustomerById,
    updateCustomerMerchantCenterSettings,
} from "@root/lib/customerOperations";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import { isValidIntegrationId } from "@/lib/customerServiceIntegrations";
import {
    demoPriceShaperData,
    fetchPriceShaperData,
    resolveReportCountryCode,
} from "@/lib/merchantCenter/priceShaperData";
import { normalizeMerchantAccountSlot } from "@/lib/merchantCenter/merchantCenterAuth";
import { MerchantAccessError } from "@/lib/merchantCenter/merchantCenterAccounts";

async function assertCustomerAccess(session, customerId) {
    const customer = await getCustomerById(customerId);
    if (session.user.isExternal) {
        const sharedIds = (session.user.sharedCustomers || []).map((id) => String(id));
        if (!sharedIds.includes(String(customerId))) {
            const err = new Error("Forbidden");
            err.statusCode = 403;
            throw err;
        }
    }
    return customer;
}

export async function GET(request, { params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
        return Response.json({ error: "Invalid customer id" }, { status: 400 });
    }

    const url = new URL(request.url);
    const includeAllProducts = url.searchParams.get("products") === "all";

    if (isDemoCustomerId(customerId)) {
        return Response.json(demoPriceShaperData({ includeAllProducts }));
    }

    try {
        await connectToDatabase();
        let customer;
        try {
            customer = await assertCustomerAccess(session, customerId);
        } catch (accessErr) {
            if (accessErr.statusCode === 403) {
                return Response.json({ error: "Forbidden" }, { status: 403 });
            }
            if (String(accessErr.message || "").toLowerCase().includes("not found")) {
                return Response.json({ error: "Customer not found" }, { status: 404 });
            }
            throw accessErr;
        }

        const settings = customer.CustomerSettings || {};
        const merchantAccountId = settings.googleMerchantCenterId;
        if (!isValidIntegrationId(merchantAccountId)) {
            return Response.json(
                {
                    error: "Merchant Center account ID is not configured for this customer",
                    code: "NOT_CONFIGURED",
                },
                { status: 400 }
            );
        }

        const accountSlot = normalizeMerchantAccountSlot(settings.googleMerchantAccountSlot);
        const reportCountryCode = resolveReportCountryCode(settings.customerStoreValutaCode);

        const data = await fetchPriceShaperData({
            merchantAccountId,
            accountSlot,
            reportCountryCode,
            includeAllProducts,
        });

        return Response.json(data);
    } catch (error) {
        if (error instanceof MerchantAccessError || error?.code === "NO_MERCHANT_ACCESS") {
            const isAdmin = session.user.isAdmin === true;
            return Response.json(
                {
                    error: isAdmin
                        ? error.adminMessage || error.message
                        : error.userMessage || error.message,
                    code: error.code || "NO_MERCHANT_ACCESS",
                    ...(isAdmin
                        ? {
                              merchantAccountId: error.merchantAccountId,
                              configuredSlot: error.configuredSlot,
                              accessibleAccounts: error.accessibleAccounts,
                          }
                        : {}),
                },
                { status: 403 }
            );
        }
        if (error.statusCode === 403) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        if (String(error.message || "").toLowerCase().includes("not found")) {
            return Response.json({ error: "Customer not found" }, { status: 404 });
        }
        console.error("price-index GET:", error);
        return Response.json(
            { error: error.message || "Failed to load Price Index data" },
            { status: 500 }
        );
    }
}

export async function PATCH(request, { params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const customerId = resolvedParams.customerId;
    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
        return Response.json({ error: "Invalid customer id" }, { status: 400 });
    }

    if (isDemoCustomerId(customerId)) {
        return Response.json({ error: "Demo customer settings cannot be saved" }, { status: 400 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const merchantAccountId = String(body.googleMerchantCenterId ?? "").trim();
    if (!isValidIntegrationId(merchantAccountId)) {
        return Response.json(
            { error: "Enter a valid Merchant Center account ID" },
            { status: 400 }
        );
    }

    const accountSlot = normalizeMerchantAccountSlot(body.googleMerchantAccountSlot);

    try {
        await connectToDatabase();
        try {
            await assertCustomerAccess(session, customerId);
        } catch (accessErr) {
            if (accessErr.statusCode === 403) {
                return Response.json({ error: "Forbidden" }, { status: 403 });
            }
            if (String(accessErr.message || "").toLowerCase().includes("not found")) {
                return Response.json({ error: "Customer not found" }, { status: 404 });
            }
            throw accessErr;
        }

        const customer = await updateCustomerMerchantCenterSettings(customerId, {
            googleMerchantCenterId: merchantAccountId,
            googleMerchantAccountSlot: accountSlot,
        });

        const settings = customer.CustomerSettings || {};
        return Response.json({
            ok: true,
            googleMerchantCenterId: settings.googleMerchantCenterId,
            googleMerchantAccountSlot: normalizeMerchantAccountSlot(
                settings.googleMerchantAccountSlot
            ),
        });
    } catch (error) {
        if (error.statusCode === 403) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        if (String(error.message || "").toLowerCase().includes("not found")) {
            return Response.json({ error: "Customer not found" }, { status: 404 });
        }
        console.error("price-index PATCH:", error);
        return Response.json(
            { error: error.message || "Failed to save Merchant Center settings" },
            { status: 500 }
        );
    }
}
