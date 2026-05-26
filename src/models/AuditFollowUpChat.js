import mongoose from "mongoose";

const AuditFollowUpMessageSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["user", "ai", "data_fetch"],
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
        tokensUsed: {
            type: Number,
            default: 0,
        },
        model: {
            type: String,
            default: "",
        },
    },
    { _id: true }
);

const AuditFollowUpChatSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
            index: true,
        },
        /** Mongo _id or session audit id string */
        auditId: {
            type: String,
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            default: "Audit follow-up",
        },
        dateRange: {
            startDate: { type: String, required: true },
            endDate: { type: String, required: true },
        },
        comparisonDateRange: {
            startDate: { type: String, default: null },
            endDate: { type: String, default: null },
        },
        customerNameSnapshot: {
            type: String,
            default: "",
        },
        /** Full audit report at chat creation — context for Claude */
        auditReportSnapshot: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        /** Optional finding snapshot when opened from "Analyze with AI" */
        findingContext: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        /** Live-fetched metrics for this chat only (not written to CustomerChannelAudit). */
        ephemeralDataContext: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
        messages: {
            type: [AuditFollowUpMessageSchema],
            default: [],
        },
        status: {
            type: String,
            enum: ["active", "archived", "deleted"],
            default: "active",
        },
        lastMessage: {
            type: String,
            default: "",
        },
        totalTokensUsed: {
            type: Number,
            default: 0,
        },
        aiModelVersion: {
            type: String,
            default: "",
        },
    },
    { timestamps: true }
);

AuditFollowUpChatSchema.index({ customerId: 1, auditId: 1, status: 1, updatedAt: -1 });
AuditFollowUpChatSchema.index({ userId: 1, createdAt: -1 });

AuditFollowUpChatSchema.pre("save", function updatePreview() {
    if (this.messages?.length > 0) {
        const last = this.messages[this.messages.length - 1];
        this.lastMessage = String(last.content || "").substring(0, 100);
        this.totalTokensUsed = this.messages.reduce((sum, m) => sum + (m.tokensUsed || 0), 0);
    }
});

export default mongoose.models.AuditFollowUpChat ||
    mongoose.model("AuditFollowUpChat", AuditFollowUpChatSchema);
