import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import OnboardingRequest from "@/models/OnboardingRequest";

function requireAdmin(session) {
	if (!session?.user) return { status: 401, error: "Unauthorized" };
	if (!session.user.isAdmin) return { status: 403, error: "Forbidden" };
	return null;
}

const VALID_STATUSES = new Set(["submitted", "in_review", "completed", "cancelled"]);

/** PATCH /api/admin/onboarding-requests/[id] — update review status / notes */
export async function PATCH(request, { params }) {
	try {
		const session = await getServerSession(authOptions);
		const denied = requireAdmin(session);
		if (denied) {
			return NextResponse.json({ error: denied.error }, { status: denied.status });
		}

		const resolvedParams = await params;
		const id = resolvedParams.id;
		const body = await request.json();

		await connectToDatabase();

		const doc = await OnboardingRequest.findById(id);
		if (!doc) {
			return NextResponse.json({ error: "Not found" }, { status: 404 });
		}

		if (body.status != null) {
			const nextStatus = String(body.status).trim();
			if (!VALID_STATUSES.has(nextStatus)) {
				return NextResponse.json({ error: "Invalid status" }, { status: 400 });
			}
			doc.status = nextStatus;
			doc.reviewedAt = new Date();
			if (session.user.id) {
				doc.reviewedByUserId = session.user.id;
			}
		}

		if (body.adminNotes != null) {
			doc.adminNotes = String(body.adminNotes).trim();
		}

		await doc.save();

		return NextResponse.json({
			message: "Onboarding request updated",
			id: String(doc._id),
			status: doc.status,
		});
	} catch (e) {
		console.error("[admin/onboarding-requests PATCH]", e);
		return NextResponse.json(
			{ error: e.message || "Failed to update onboarding request" },
			{ status: 500 }
		);
	}
}
