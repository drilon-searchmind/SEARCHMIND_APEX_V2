import mongoose from "mongoose";
import { AUDIT_CHANNEL_SCOPES } from "@/lib/audit/auditPromptScopes";

const channelActiveShape = {};
for (const ch of AUDIT_CHANNEL_SCOPES) {
    channelActiveShape[ch] = [{ type: mongoose.Schema.Types.ObjectId, ref: "AuditPrompt" }];
}

/**
 * Singleton: which prompts are active in Run Audit.
 * - system: exactly one active system prompt
 * - each channel: zero or more active prompts (all shown in Run Audit)
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
        channelActivePromptIds: channelActiveShape,
        /** @deprecated Legacy single selection — migrated to channelActivePromptIds on load */
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
