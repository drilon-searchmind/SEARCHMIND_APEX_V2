// models/Campaign.js
import mongoose from "mongoose";

const CampaignSchema = new mongoose.Schema({
    customerId: { type: String, required: true },
    service: { type: String, required: true },
    media: { type: String },
    campaignFormat: { type: String },
    countryCode: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    campaignName: { type: String, required: true },
    messageBrief: { type: String },
    b2bOrB2c: { type: String },
    budget: { type: Number },
    landingpage: { type: String },
    materialFromCustomer: { type: String },
    readyForApproval: { type: Boolean, default: false },
    status: { type: String, required: true },
    commentToCustomer: { type: String },
    createdAt: { type: Date, default: Date.now },
    parentCampaignId: { type: String },
    campaignType: { type: String },
    campaignDimensions: { type: String },
    campaignVariation: { type: String },
    campaignTextToCreative: { type: String },
    campaignTextToCreativeTranslation: { type: String }
});

export default mongoose.models.Campaign || mongoose.model("Campaign", CampaignSchema);
