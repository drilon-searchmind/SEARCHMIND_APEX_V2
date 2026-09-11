import mongoose from "mongoose";

const PerformanceBriefSlackDeliverySchema = new mongoose.Schema(
    {
        weekKey: { type: String, required: true },
        customerId: { type: String, required: true },
        slackChannelId: { type: String, required: true },
        slackChannelName: { type: String, default: "" },
        runId: { type: mongoose.Schema.Types.ObjectId, ref: "PerformanceBriefCronRun" },
        status: {
            type: String,
            enum: ["sending", "sent", "failed"],
            default: "sending",
        },
        messageTs: { type: String, default: "" },
        error: { type: String, default: "" },
        claimedAt: { type: Date, default: Date.now },
        sentAt: { type: Date },
    },
    { collection: "performance_brief_slack_deliveries" }
);

PerformanceBriefSlackDeliverySchema.index(
    { weekKey: 1, customerId: 1, slackChannelId: 1 },
    { unique: true }
);

export default mongoose.models.PerformanceBriefSlackDelivery ||
    mongoose.model("PerformanceBriefSlackDelivery", PerformanceBriefSlackDeliverySchema);
