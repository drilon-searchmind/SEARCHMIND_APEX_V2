import mongoose from "mongoose";

/** Shared campaign-planner-v2 state for a customer (all internal users see the same workspace). */
const CampaignPlannerV2WorkspaceSchema = new mongoose.Schema(
	{
		customerId: { type: String, required: true, unique: true, index: true },
		parents: { type: [mongoose.Schema.Types.Mixed], default: [] },
		services: { type: [mongoose.Schema.Types.Mixed], default: [] },
		lineItems: { type: [mongoose.Schema.Types.Mixed], default: [] },
	},
	{ timestamps: true }
);

export default mongoose.models.CampaignPlannerV2Workspace ||
	mongoose.model(
		"CampaignPlannerV2Workspace",
		CampaignPlannerV2WorkspaceSchema
	);
