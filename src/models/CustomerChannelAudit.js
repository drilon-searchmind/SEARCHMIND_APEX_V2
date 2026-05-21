import mongoose from "mongoose";

const CustomerChannelAuditSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
            index: true,
        },
        createdByUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },
        dateRange: {
            startDate: { type: String, required: true },
            endDate: { type: String, required: true },
        },
        comparisonDateRange: {
            startDate: { type: String, default: null },
            endDate: { type: String, default: null },
        },
        serviceIds: {
            type: [String],
            default: [],
        },
        /** Selected audit cards + custom prompts from Run Audit modal */
        auditSelections: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        outputFormat: {
            type: String,
            default: "json",
        },
        /** Full structured report (includes channels, crossChannelNotes, etc.) */
        report: {
            type: mongoose.Schema.Types.Mixed,
            required: true,
        },
        /** Mean of channel healthScore values; matches UI “Overall health”. */
        canonicalOverall: {
            score: { type: Number, default: null },
            grade: { type: String, default: "—" },
        },
        customerNameSnapshot: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }
);

CustomerChannelAuditSchema.index({ customerId: 1, createdAt: -1 });

export default mongoose.models.CustomerChannelAudit ||
    mongoose.model("CustomerChannelAudit", CustomerChannelAuditSchema);
