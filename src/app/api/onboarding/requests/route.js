import { NextResponse } from "next/server";
import connectToDatabase from "@root/lib/mongodb";
import { normalizeOnboardingLead } from "@/lib/onboardingLead";
import { ONBOARDING_CHANNELS } from "@/lib/onboardingAccessData";
import OnboardingRequest from "@/models/OnboardingRequest";

const VALID_CHANNEL_IDS = new Set(ONBOARDING_CHANNELS.map((c) => c.id));
const VALID_STATUSES = new Set(["idle", "claimed", "verifying", "verified", "failed"]);

function normalizeChannels(rawChannels) {
	if (!Array.isArray(rawChannels)) return [];
	return rawChannels
		.filter((row) => row && VALID_CHANNEL_IDS.has(String(row.channelId)))
		.map((row) => {
			const channelId = String(row.channelId);
			const meta = ONBOARDING_CHANNELS.find((c) => c.id === channelId);
			const status = VALID_STATUSES.has(row.status) ? row.status : "idle";
			return {
				channelId,
				channelName: meta?.name ?? String(row.channelName ?? channelId),
				status,
				fields:
					row.fields && typeof row.fields === "object" && !Array.isArray(row.fields)
						? row.fields
						: {},
				verifiedAt: row.verifiedAt ? new Date(row.verifiedAt) : null,
			};
		});
}

/** POST /api/onboarding/requests — public submit from onboarding access flow */
export async function POST(request) {
	try {
		const body = await request.json();
		const lead = normalizeOnboardingLead(body?.lead ?? body);

		if (!lead.email) {
			return NextResponse.json({ error: "Email is required" }, { status: 400 });
		}

		const channels = normalizeChannels(body?.channels);
		const verifiedChannelCount = channels.filter((c) => c.status === "verified").length;

		if (verifiedChannelCount < 1) {
			return NextResponse.json(
				{ error: "At least one verified channel is required" },
				{ status: 400 }
			);
		}

		await connectToDatabase();

		const doc = await OnboardingRequest.create({
			email: lead.email,
			fornavn: lead.fornavn,
			efternavn: lead.efternavn,
			tlf: lead.tlf,
			virksomhed: lead.virksomhed,
			status: "submitted",
			channels,
			verifiedChannelCount,
			submittedAt: new Date(),
		});

		return NextResponse.json(
			{
				id: String(doc._id),
				message: "Onboarding request submitted",
			},
			{ status: 201 }
		);
	} catch (e) {
		console.error("[onboarding/requests POST]", e);
		return NextResponse.json(
			{ error: e.message || "Failed to submit onboarding request" },
			{ status: 500 }
		);
	}
}
