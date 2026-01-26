// models/Campaign.js
import mongoose from "mongoose";

const CampaignSchema = new mongoose.Schema({
    customerId: { type: String, required: true },
    // Campaign hierarchy
    campaignLevel: { 
        type: String, 
        enum: ["parent", "child", "dwarf"], 
        default: "child" 
    },
    parentCampaignId: { type: String }, // Reference to parent campaign
    
    // Parent campaign fields
    campaignName: { type: String, required: true },
    services: { type: [String], default: [] }, // Multiple services for parent
    responsible: { 
        type: String, 
        enum: ["searchmind", "kunde"], 
        default: "searchmind" 
    },
    media: { type: [String], default: [] }, // Multiple media, bound to services
    countryCode: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    alwaysOn: { type: Boolean, default: false }, // If true, endDate is not required
    totalBudget: { type: Number }, // Total budget for parent campaign
    comment: { type: String }, // Textarea for parent campaigns
    
    // Child/Dwarf campaign fields (legacy support)
    service: { type: String }, // Single service for child campaigns
    campaignFormat: { type: String },
    messageBrief: { type: String },
    b2bOrB2c: { type: String },
    budget: { type: Number }, // Individual budget for child campaigns
    landingpage: { type: String },
    materialFromCustomer: { type: String },
    readyForApproval: { type: Boolean, default: false },
    status: { 
        type: String,
        // Status is optional - will be validated in pre-save hook or application logic
        // Parent campaigns don't have status, only child/dwarf campaigns do
    },
    commentToCustomer: { type: String },
    campaignType: { type: String },
    campaignDimensions: { type: String },
    campaignVariation: { type: String },
    campaignTextToCreative: { type: String },
    campaignTextToCreativeTranslation: { type: String },
    assignedUsers: {
        type: [String],
        default: []
    },
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Campaign || mongoose.model("Campaign", CampaignSchema);
