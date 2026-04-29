// src/app/api/clickup-team-members/[customerId]/route.js
import Customer from "@/models/Customer";
import connectToDatabase from "@root/lib/mongodb";
import { getDemoPayload, isDemoCustomerId } from "@/lib/demoCustomer";
import { buildCustomerServicesStatus } from "@/lib/clickupCustomerServices";
import { fetchClickupTeamPayloadForCustomer } from "@/lib/clickupCustomerTeamFetch";

export async function GET(request, { params }) {
    try {
        const resolvedParams = await params;
        const customerId = resolvedParams.customerId;

        if (isDemoCustomerId(customerId)) {
            const demo = getDemoPayload("clickupTeamMembers") ?? { members: [] };
            const customerServices =
                demo.customerServices ??
                buildCustomerServicesStatus([
                    "11ce14ac-2324-4f56-83c9-c480c86a3a39",
                    "5ba9c5f7-72ac-4538-ac09-af88da2950b5",
                    "760b9c31-350c-4560-9e9a-a30ba75fd32b",
                    "e1e6850e-3aec-42db-84d1-5e0d29df2ead",
                    "e6db202f-2b5a-42c2-aff6-b9993a34513f",
                ]);
            return Response.json(
                { members: demo.members ?? [], customerServices },
                { status: 200 }
            );
        }

        await connectToDatabase();

        const customer = await Customer.findById(customerId);

        if (!customer) {
            return Response.json({ error: "Customer not found" }, { status: 404 });
        }

        const clickupId = customer?.CustomerSettings?.customerClickupID;

        if (!clickupId) {
            return Response.json(
                { members: [], customerServices: buildCustomerServicesStatus([]) },
                { status: 200 }
            );
        }

        const { members, customerServices } =
            await fetchClickupTeamPayloadForCustomer(clickupId);

        return Response.json({ members, customerServices }, { status: 200 });
    } catch (error) {
        console.error("Error fetching team members:", error);
        return Response.json(
            {
                error: error.message,
                members: [],
                customerServices: buildCustomerServicesStatus([]),
            },
            { status: 500 }
        );
    }
}
