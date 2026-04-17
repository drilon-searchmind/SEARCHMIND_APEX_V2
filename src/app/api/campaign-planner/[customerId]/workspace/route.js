import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import { getCustomerById } from "@root/lib/customerOperations";
import { isDemoCustomerId } from "@/lib/demoCustomer";
import CampaignPlannerV2Workspace from "@/models/CampaignPlannerV2Workspace";

async function assertCustomerAccess(session, customerId) {
	const customer = await getCustomerById(customerId);
	if (session.user.isExternal) {
		const sharedIds = (session.user.sharedCustomers || []).map((id) =>
			String(id)
		);
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

	if (isDemoCustomerId(customerId)) {
		return Response.json({ parents: [], services: [], lineItems: [] });
	}

	try {
		await connectToDatabase();
		try {
			await assertCustomerAccess(session, customerId);
		} catch (accessErr) {
			if (accessErr.statusCode === 403) {
				return Response.json({ error: "Forbidden" }, { status: 403 });
			}
			if (String(accessErr.message || "")
				.toLowerCase()
				.includes("not found")) {
				return Response.json({ error: "Customer not found" }, { status: 404 });
			}
			throw accessErr;
		}

		const doc = await CampaignPlannerV2Workspace.findOne({ customerId }).lean();
		if (!doc) {
			return Response.json({ parents: [], services: [], lineItems: [] });
		}
		return Response.json({
			parents: doc.parents || [],
			services: doc.services || [],
			lineItems: doc.lineItems || [],
			updatedAt: doc.updatedAt,
		});
	} catch (error) {
		console.error("campaign-planner workspace GET:", error);
		return Response.json(
			{ error: error.message || "Failed to load workspace" },
			{ status: 500 }
		);
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

	let body;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const { parents, services, lineItems } = body || {};
	if (!Array.isArray(parents) || !Array.isArray(services) || !Array.isArray(lineItems)) {
		return Response.json(
			{ error: "parents, services, and lineItems must be arrays" },
			{ status: 400 }
		);
	}

	if (isDemoCustomerId(customerId)) {
		return Response.json({ ok: true });
	}

	try {
		await connectToDatabase();
		try {
			await assertCustomerAccess(session, customerId);
		} catch (accessErr) {
			if (accessErr.statusCode === 403) {
				return Response.json({ error: "Forbidden" }, { status: 403 });
			}
			if (String(accessErr.message || "")
				.toLowerCase()
				.includes("not found")) {
				return Response.json({ error: "Customer not found" }, { status: 404 });
			}
			throw accessErr;
		}

		await CampaignPlannerV2Workspace.findOneAndUpdate(
			{ customerId },
			{ $set: { parents, services, lineItems } },
			{ upsert: true, new: true }
		);

		return Response.json({ ok: true });
	} catch (error) {
		console.error("campaign-planner workspace PUT:", error);
		return Response.json(
			{ error: error.message || "Failed to save workspace" },
			{ status: 500 }
		);
	}
}
