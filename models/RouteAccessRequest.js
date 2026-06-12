import mongoose from "mongoose";

const RouteAccessRequestSchema = new mongoose.Schema(
    {
        route: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        customerId: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        reason: {
            type: String,
            default: "",
            trim: true,
        },
        requestedBy: {
            type: String,
            default: "",
            trim: true,
        },
        status: {
            type: String,
            enum: ["pending", "approved", "denied"],
            default: "pending",
            index: true,
        },
        reviewedByUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        reviewedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

RouteAccessRequestSchema.index({ route: 1, customerId: 1, status: 1 });
RouteAccessRequestSchema.index(
    { route: 1, customerId: 1 },
    {
        unique: true,
        partialFilterExpression: { status: "pending" },
    }
);

export default mongoose.models.RouteAccessRequest ||
    mongoose.model("RouteAccessRequest", RouteAccessRequestSchema);
