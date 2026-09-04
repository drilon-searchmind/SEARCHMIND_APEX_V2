import mongoose from "mongoose";

const ApexRadarCsMerchantSnapshotSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
        },
        date: { type: String, required: true },
        approved: { type: Number, default: 0 },
        limited: { type: Number, default: 0 },
        notEligible: { type: Number, default: 0 },
        pending: { type: Number, default: 0 },
        other: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
        capturedAt: { type: Date, default: Date.now },
    },
    { collection: "apex_radar_cs_merchant_snapshots" }
);

ApexRadarCsMerchantSnapshotSchema.index({ customerId: 1, date: 1 }, { unique: true });

export default mongoose.models.ApexRadarCsMerchantSnapshot ||
    mongoose.model("ApexRadarCsMerchantSnapshot", ApexRadarCsMerchantSnapshotSchema);
