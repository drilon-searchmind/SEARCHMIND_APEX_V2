import mongoose from "mongoose";
import { AUDIT_PROMPT_SCOPES } from "@/lib/audit/auditPromptScopes";

const AuditPromptSchema = new mongoose.Schema(
    {
        scope: {
            type: String,
            required: true,
            enum: AUDIT_PROMPT_SCOPES,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: "",
            trim: true,
        },
        body: {
            type: String,
            required: true,
            validate: {
                validator: (v) => typeof v === "string" && v.trim().length > 0,
                message: "Prompt body cannot be empty",
            },
        },
        sortOrder: {
            type: Number,
            default: 0,
        },
        updatedByUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    { timestamps: true }
);

AuditPromptSchema.index({ scope: 1, sortOrder: 1 });

export default mongoose.models.AuditPrompt || mongoose.model("AuditPrompt", AuditPromptSchema);
