import mongoose from "mongoose";

const SCOPE_VALUES = ["tools", "news"];

const ContentTagSchema = new mongoose.Schema(
    {
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        label: { type: String, required: true, trim: true },
        color: {
            type: String,
            default: "#64748b",
            trim: true,
        },
        scopes: {
            type: [
                {
                    type: String,
                    enum: SCOPE_VALUES,
                },
            ],
            default: ["tools", "news"],
        },
    },
    { timestamps: true }
);

ContentTagSchema.index({ scopes: 1, label: 1 });

export const CONTENT_TAG_SCOPE_VALUES = SCOPE_VALUES;

export default mongoose.models.ContentTag || mongoose.model("ContentTag", ContentTagSchema);
