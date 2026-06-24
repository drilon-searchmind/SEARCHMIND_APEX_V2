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

function serializeRequest(doc) {
	const plain = doc.toObject ? doc.toObject() : doc;
	return {
		id: String(plain._id),
		email: plain.email,
		fornavn: plain.fornavn,
		efternavn: plain.efternavn,
		tlf: plain.tlf,
		virksomhed: plain.virksomhed,
		status: plain.status,
		channels: plain.channels ?? [],
		verifiedChannelCount: plain.verifiedChannelCount ?? 0,
		submittedAt: plain.submittedAt ?? plain.createdAt,
		adminNotes: plain.adminNotes ?? "",
		reviewedAt: plain.reviewedAt,
		createdAt: plain.createdAt,
		updatedAt: plain.updatedAt,
	};
}

/** GET /api/admin/onboarding-requests?status=submitted|in_review|completed|cancelled */
export async function GET(request) {
	try {
		const session = await getServerSession(authOptions);
		const denied = requireAdmin(session);
		if (denied) {
			return NextResponse.json({ error: denied.error }, { status: denied.status });
		}

		const { searchParams } = new URL(request.url);
		const status = searchParams.get("status")?.trim() ?? "";

		await connectToDatabase();

		const filter = {};
		if (status) filter.status = status;

		const rows = await OnboardingRequest.find(filter).sort({ submittedAt: -1 }).limit(200).lean();

		return NextResponse.json({
			requests: rows.map(serializeRequest),
		});
	} catch (e) {
		console.error("[admin/onboarding-requests GET]", e);
		return NextResponse.json(
			{ error: e.message || "Failed to load onboarding requests" },
			{ status: 500 }
		);
	}
}
