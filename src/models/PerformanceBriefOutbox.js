import mongoose from "mongoose";

const PerformanceBriefOutboxSchema = new mongoose.Schema(
    {
        customerId: { type: String, required: true },
        customerName: { type: String, default: "" },
        weekKey: { type: String, required: true },
        deliverDate: { type: String, required: true },
        scheduleDayOfWeek: { type: Number, required: true },
        scheduleHour: { type: Number, required: true },
        slackChannelId: { type: String, default: "" },
        slackChannelName: { type: String, default: "" },
        slackPayload: {
            text: { type: String, default: "" },
            blocks: { type: Array, default: [] },
        },
        status: {
            type: String,
            enum: ["ready", "sent", "failed", "prepare_failed"],
            default: "ready",
        },
        testMode: { type: Boolean, default: false },
        preparedAt: { type: Date },
        sentAt: { type: Date },
        messageTs: { type: String, default: "" },
        error: { type: String, default: "" },
        expiresAt: { type: Date },
    },
    { collection: "performance_brief_outbox" }
);

PerformanceBriefOutboxSchema.index({ customerId: 1, weekKey: 1 }, { unique: true });
PerformanceBriefOutboxSchema.index({ deliverDate: 1, status: 1, scheduleHour: 1 });
PerformanceBriefOutboxSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.PerformanceBriefOutbox ||
    mongoose.model("PerformanceBriefOutbox", PerformanceBriefOutboxSchema);
