import mongoose from "mongoose";

const NewsPostSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, index: true, trim: true },
        excerpt: { type: String, default: "" },
        content: { type: String, required: true },
        coverImageUrl: { type: String, default: "" },
        tags: [{ type: String, trim: true }],
        published: { type: Boolean, default: false },
        publishedAt: { type: Date, default: null },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    { timestamps: true }
);

NewsPostSchema.index({ published: 1, publishedAt: -1 });

export default mongoose.models.NewsPost || mongoose.model("NewsPost", NewsPostSchema);
