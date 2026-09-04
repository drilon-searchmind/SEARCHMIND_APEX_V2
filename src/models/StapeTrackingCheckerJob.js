import mongoose from "mongoose";

const StapeTrackingCheckerJobSchema = new mongoose.Schema(
    {
        siteUrl: { type: String, required: true, trim: true, index: true },
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            default: null,
            index: true,
        },
        customerName: { type: String, default: "" },
        status: {
            type: String,
            enum: ["pending", "complete", "failed"],
            default: "pending",
            index: true,
        },
        requestedBy: {
            type: String,
            default: "",
        },
        webhookToken: { type: String, required: true },
        callbackUrl: { type: String, default: "" },
        stapeResponse: { type: mongoose.Schema.Types.Mixed, default: null },
        result: { type: mongoose.Schema.Types.Mixed, default: null },
        summary: { type: mongoose.Schema.Types.Mixed, default: null },
        error: { type: String, default: "" },
        completedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

StapeTrackingCheckerJobSchema.index({ status: 1, createdAt: -1 });
StapeTrackingCheckerJobSchema.index({ siteUrl: 1, status: 1, createdAt: -1 });

export default mongoose.models.StapeTrackingCheckerJob ||
    mongoose.model("StapeTrackingCheckerJob", StapeTrackingCheckerJobSchema);
