import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getAllCustomers } from "@root/lib/customerOperations";
import { serializeAdminCustomerList } from "@root/lib/adminCustomerListApi";
import { isDemoCustomerId, mergeDemoCustomerDocument } from "@/lib/demoCustomer";

function requireAdmin(session) {
    if (!session?.user) return { status: 401, error: "Unauthorized" };
    if (!session.user.isAdmin) return { status: 403, error: "Forbidden" };
    return null;
}

function toPlainCustomer(doc) {
    if (doc && typeof doc.toObject === "function") return doc.toObject();
    return { ...doc };
}

/**
 * GET /api/admin/customers?columns=val_facebook_ad_account,check_pinterest
 * Returns sanitized customer rows for the admin table (no API secrets).
 */
export async function GET(request) {
    try {
        const session = await getServerSession(authOptions);
        const denied = requireAdmin(session);
        if (denied) {
            return NextResponse.json({ error: denied.error }, { status: denied.status });
        }

        const { searchParams } = new URL(request.url);
        const columns = searchParams.get("columns") || "";

        const customers = await getAllCustomers();
        const merged = customers.map((c) => {
            const plain = toPlainCustomer(c);
            const id = String(plain._id);
            if (!isDemoCustomerId(id)) return plain;
            return mergeDemoCustomerDocument(plain);
        });

        const payload = serializeAdminCustomerList(merged, columns);
        return NextResponse.json(payload);
    } catch (e) {
        console.error("[admin customers GET]", e);
        return NextResponse.json(
            { error: e.message || "Failed to load customers" },
            { status: 500 }
        );
    }
}
