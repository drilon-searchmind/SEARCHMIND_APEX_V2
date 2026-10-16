import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "../../../auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import { getCustomerById } from "@root/lib/customerOperations";
import { normalizeBrandGroups } from "@/lib/shareOfSearchBrandGroups";
import { isDemoCustomerId } from "@/lib/demoCustomer";

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

export async function GET(_request, { params }) {
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
        return Response.json({ brandGroups: [] });
    }

    try {
        await connectToDatabase();
        const customer = await assertCustomerAccess(session, customerId);
        const groups = customer?.CustomerSettings?.shareOfSearch?.brandGroups;
        return Response.json({ brandGroups: normalizeBrandGroups(groups) });
    } catch (error) {
        if (error.statusCode === 403) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        console.error("share-of-search brand-groups GET:", error);
        return Response.json({ error: error.message || "Failed to load groups" }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
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
        return Response.json({ brandGroups: [] });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const brandGroups = normalizeBrandGroups(body.brandGroups);

    try {
        await connectToDatabase();
        await assertCustomerAccess(session, customerId);

        const Customer = mongoose.models.Customer || mongoose.model("Customer", new mongoose.Schema({}, { strict: false }));
        await Customer.findByIdAndUpdate(customerId, {
            $set: { "CustomerSettings.shareOfSearch.brandGroups": brandGroups },
        });

        return Response.json({ brandGroups });
    } catch (error) {
        if (error.statusCode === 403) {
            return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        console.error("share-of-search brand-groups PUT:", error);
        return Response.json({ error: error.message || "Failed to save groups" }, { status: 500 });
    }
}
