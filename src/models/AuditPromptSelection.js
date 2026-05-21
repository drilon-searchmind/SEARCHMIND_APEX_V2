import mongoose from "mongoose";

/**
 * Singleton document tracking which prompt is active per scope (system + each channel).
 * configKey is always "default" for the global library.
 */
const AuditPromptSelectionSchema = new mongoose.Schema(
    {
        configKey: {
            type: String,
            required: true,
            unique: true,
            default: "default",
        },
        systemPromptId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "AuditPrompt",
            default: null,
        },
        channelPromptIds: {
            cross: { type: mongoose.Schema.Types.ObjectId, ref: "AuditPrompt", default: null },
            seo: { type: mongoose.Schema.Types.ObjectId, ref: "AuditPrompt", default: null },
            ppc: { type: mongoose.Schema.Types.ObjectId, ref: "AuditPrompt", default: null },
            ps: { type: mongoose.Schema.Types.ObjectId, ref: "AuditPrompt", default: null },
            em: { type: mongoose.Schema.Types.ObjectId, ref: "AuditPrompt", default: null },
        },
    },
    { timestamps: true }
);

export default mongoose.models.AuditPromptSelection ||
    mongoose.model("AuditPromptSelection", AuditPromptSelectionSchema);
