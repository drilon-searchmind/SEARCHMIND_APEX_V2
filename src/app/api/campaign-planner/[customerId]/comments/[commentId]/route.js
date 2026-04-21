import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectToDatabase from "@root/lib/mongodb";
import { getCustomerById } from "@root/lib/customerOperations";
import CampaignPlannerComment from "@/models/CampaignPlannerComment";
import {
	resolveRecipientIdsForMentionNotification,
	sendCampaignPlannerMentionNotifications,
} from "@root/lib/campaignPlannerCommentMentions.js";

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

function serializeComment(doc) {
	return {
		id: String(doc._id),
		text: doc.text,
		createdAt: doc.createdAt,
		userName: doc.userName || "",
		userImage: doc.userImage || "",
		userId: String(doc.userId),
	};
}

export async function PATCH(request, { params }) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const resolvedParams = await params;
	const customerId = resolvedParams.customerId;
	const commentId = resolvedParams.commentId;
	if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
		return Response.json({ error: "Invalid customer id" }, { status: 400 });
	}
	if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
		return Response.json({ error: "Invalid comment id" }, { status: 400 });
	}

	let body;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "Invalid JSON body" }, { status: 400 });
	}
	const text = body?.text != null ? String(body.text).trim() : "";
	const campaignTypeName =
		body?.campaignTypeName != null ? String(body.campaignTypeName).trim().slice(0, 500) : "";
	if (!text) {
		return Response.json({ error: "text is required" }, { status: 400 });
	}
	if (text.length > 8000) {
		return Response.json({ error: "Comment is too long" }, { status: 400 });
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
			if (String(accessErr.message || "")
				.toLowerCase()
				.includes("not found")) {
				return Response.json({ error: "Customer not found" }, { status: 404 });
			}
			throw accessErr;
		}

		const doc = await CampaignPlannerComment.findOne({
			_id: commentId,
			customerId,
		});
		if (!doc) {
			return Response.json({ error: "Comment not found" }, { status: 404 });
		}
		if (String(doc.userId) !== String(session.user.id)) {
			return Response.json({ error: "Forbidden" }, { status: 403 });
		}

		const previousText = doc.text;
		doc.text = text;
		await doc.save();

		try {
			const customerName = customer?.customerName || customer?.name || "";
			const recipientIds = await resolveRecipientIdsForMentionNotification(
				text,
				session.user.id,
				previousText
			);
			if (recipientIds.length > 0) {
				await sendCampaignPlannerMentionNotifications({
					customerId: String(customerId),
					lineItemId: String(doc.lineItemId),
					authorUserId: String(session.user.id),
					authorName: session.user.name || session.user.email || "User",
					customerName,
					campaignTypeName,
					recipientUserIds: recipientIds,
				});
			}
		} catch (notifyErr) {
			console.error("campaign-planner mention notifications (PATCH):", notifyErr);
		}

		return Response.json({ comment: serializeComment(doc.toObject()) });
	} catch (error) {
		console.error("campaign-planner comments PATCH:", error);
		return Response.json(
			{ error: error.message || "Failed to update comment" },
			{ status: 500 }
		);
	}
}

export async function DELETE(request, { params }) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return Response.json({ error: "Unauthorized" }, { status: 401 });
	}

	const resolvedParams = await params;
	const customerId = resolvedParams.customerId;
	const commentId = resolvedParams.commentId;
	if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
		return Response.json({ error: "Invalid customer id" }, { status: 400 });
	}
	if (!commentId || !mongoose.Types.ObjectId.isValid(commentId)) {
		return Response.json({ error: "Invalid comment id" }, { status: 400 });
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

		const doc = await CampaignPlannerComment.findOne({
			_id: commentId,
			customerId,
		});
		if (!doc) {
			return Response.json({ error: "Comment not found" }, { status: 404 });
		}
		if (String(doc.userId) !== String(session.user.id)) {
			return Response.json({ error: "Forbidden" }, { status: 403 });
		}

		await CampaignPlannerComment.deleteOne({ _id: commentId, customerId });
		return Response.json({ ok: true });
	} catch (error) {
		console.error("campaign-planner comments DELETE:", error);
		return Response.json(
			{ error: error.message || "Failed to delete comment" },
			{ status: 500 }
		);
	}
}
