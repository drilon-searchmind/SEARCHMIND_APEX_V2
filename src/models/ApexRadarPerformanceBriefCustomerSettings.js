import mongoose from "mongoose";

const ApexRadarPerformanceBriefCustomerSettingsSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
            unique: true,
        },
        slackChannelId: { type: String, default: "" },
        slackChannelName: { type: String, default: "" },
        updatedAt: { type: Date, default: Date.now },
    },
    { collection: "apex_radar_performance_brief_customer_settings" }
);

export default mongoose.models.ApexRadarPerformanceBriefCustomerSettings ||
    mongoose.model(
        "ApexRadarPerformanceBriefCustomerSettings",
        ApexRadarPerformanceBriefCustomerSettingsSchema
    );
