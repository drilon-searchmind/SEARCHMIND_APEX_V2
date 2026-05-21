import mongoose from "mongoose";
import { AUDIT_PROMPT_SLUGS } from "@/lib/audit/auditPromptSlugs";

const AuditPromptTemplateSchema = new mongoose.Schema(
    {
        slug: {
            type: String,
            required: true,
            unique: true,
            enum: AUDIT_PROMPT_SLUGS,
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

export default mongoose.models.AuditPromptTemplate ||
    mongoose.model("AuditPromptTemplate", AuditPromptTemplateSchema);
