import mongoose from 'mongoose';

/** Threaded discussion on a campaign-planner-v2 line item (client UUID `lineItemId`). */
const CampaignPlannerCommentSchema = new mongoose.Schema({
	customerId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'Customer',
		required: true,
		index: true,
	},
	lineItemId: {
		type: String,
		required: true,
		index: true,
		trim: true,
	},
	userId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User',
		required: true,
	},
	userName: { type: String, default: '' },
	userImage: { type: String, default: '' },
	text: { type: String, required: true, trim: true },
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

CampaignPlannerCommentSchema.index({ customerId: 1, lineItemId: 1, createdAt: 1 });

export default mongoose.models.CampaignPlannerComment ||
	mongoose.model('CampaignPlannerComment', CampaignPlannerCommentSchema);
