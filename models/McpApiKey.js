import mongoose from "mongoose";

const McpApiKeySchema = new mongoose.Schema(
    {
        /** Human-readable label (e.g. "Claude Code — team") */
        name: {
            type: String,
            default: "",
            trim: true,
        },
        /** bcrypt hash of the full plaintext key */
        keyHash: {
            type: String,
            required: true,
        },
        /** First characters of the key for admin identification (never the secret) */
        keyPrefix: {
            type: String,
            required: true,
            index: true,
        },
        /** MCP keys are read-only; no write tools are exposed */
        readOnly: {
            type: Boolean,
            default: true,
            immutable: true,
        },
        createdByUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        revokedAt: {
            type: Date,
            default: null,
        },
        revokedByUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        lastUsedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

McpApiKeySchema.index({ revokedAt: 1, createdAt: -1 });

export default mongoose.models.McpApiKey ||
    mongoose.model("McpApiKey", McpApiKeySchema);
