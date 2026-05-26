import mongoose from "mongoose";

const PartSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["metric", "operator"],
            required: true,
        },
        value: {
            type: String,
            required: true,
        },
    },
    { _id: false }
);

const CustomKpiSchema = new mongoose.Schema(
    {
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
            index: true,
        },
        name: {
            type: String,
            required: true,
        },
        parts: {
            type: [PartSchema],
            default: [],
        },
        // Legacy format for backward compatibility (metricA, metricB, operator)
        metricA: { type: String, default: "" },
        metricB: { type: String, default: "" },
        operator: { type: String, default: "" },
        /** When set, this KPI's value replaces the matching standard overview metric for this customer. */
        replacesStandardMetricKey: {
            type: String,
            default: null,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

CustomKpiSchema.index({ customer: 1, createdAt: -1 });

export default mongoose.models.CustomKpi ||
    mongoose.model("CustomKpi", CustomKpiSchema);
