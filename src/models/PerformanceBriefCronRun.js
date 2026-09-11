import mongoose from "mongoose";

const PerformanceBriefCronCustomerSchema = new mongoose.Schema(
    {
        customerId: { type: String, required: true },
        customerName: { type: String, default: "" },
        slackChannelId: { type: String, default: "" },
        slackChannelName: { type: String, default: "" },
        status: {
            type: String,
            enum: ["pending", "running", "success", "error", "skipped"],
            default: "pending",
        },
        error: { type: String, default: "" },
        finishedAt: { type: Date },
    },
    { _id: false }
);

const PerformanceBriefCronRunSchema = new mongoose.Schema(
    {
        weekKey: { type: String, required: true, unique: true },
        status: {
            type: String,
            enum: ["pending", "running", "completed", "failed"],
            default: "pending",
        },
        startedAt: { type: Date, default: Date.now },
        finishedAt: { type: Date },
        batchLockUntil: { type: Date },
        customers: { type: [PerformanceBriefCronCustomerSchema], default: [] },
        stats: {
            total: { type: Number, default: 0 },
            success: { type: Number, default: 0 },
            failed: { type: Number, default: 0 },
            skipped: { type: Number, default: 0 },
            pending: { type: Number, default: 0 },
        },
    },
    { collection: "performance_brief_cron_runs" }
);

export default mongoose.models.PerformanceBriefCronRun ||
    mongoose.model("PerformanceBriefCronRun", PerformanceBriefCronRunSchema);
