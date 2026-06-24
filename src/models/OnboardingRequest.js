import mongoose from "mongoose";

const OnboardingChannelSchema = new mongoose.Schema(
	{
		channelId: { type: String, required: true, trim: true },
		channelName: { type: String, required: true, trim: true },
		status: {
			type: String,
			enum: ["idle", "claimed", "verifying", "verified", "failed"],
			default: "idle",
		},
		fields: {
			type: mongoose.Schema.Types.Mixed,
			default: {},
		},
		verifiedAt: { type: Date, default: null },
	},
	{ _id: false }
);

const OnboardingRequestSchema = new mongoose.Schema(
	{
		email: {
			type: String,
			required: true,
			trim: true,
			lowercase: true,
			index: true,
		},
		fornavn: { type: String, default: "", trim: true },
		efternavn: { type: String, default: "", trim: true },
		tlf: { type: String, default: "", trim: true },
		virksomhed: { type: String, default: "", trim: true },
		status: {
			type: String,
			enum: ["submitted", "in_review", "completed", "cancelled"],
			default: "submitted",
			index: true,
		},
		channels: {
			type: [OnboardingChannelSchema],
			default: [],
		},
		verifiedChannelCount: {
			type: Number,
			default: 0,
		},
		submittedAt: {
			type: Date,
			default: Date.now,
			index: true,
		},
		adminNotes: { type: String, default: "", trim: true },
		reviewedByUserId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			default: null,
		},
		reviewedAt: { type: Date, default: null },
	},
	{ timestamps: true }
);

OnboardingRequestSchema.index({ createdAt: -1 });

export default mongoose.models.OnboardingRequest
	|| mongoose.model("OnboardingRequest", OnboardingRequestSchema);
