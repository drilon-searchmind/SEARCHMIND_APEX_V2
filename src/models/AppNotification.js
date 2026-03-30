import mongoose from "mongoose";

const AppNotificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        title: { type: String, required: true, trim: true },
        body: { type: String, required: true, trim: true },
        linkUrl: { type: String, default: "" },
        imageUrl: { type: String, default: "" },
        category: {
            type: String,
            enum: ["system", "feature", "alert"],
            default: "system",
        },
        readAt: { type: Date, default: null },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    { timestamps: true }
);

AppNotificationSchema.index({ recipient: 1, createdAt: -1 });
AppNotificationSchema.index({ recipient: 1, readAt: 1 });

export default mongoose.models.AppNotification || mongoose.model("AppNotification", AppNotificationSchema);
