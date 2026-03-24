import mongoose from "mongoose";

const TOOL_CATEGORY_VALUES = [
    "analytics",
    "collaboration",
    "design",
    "productivity",
    "ppc",
    "ps",
    "seo",
    "em",
];

const OurToolSchema = new mongoose.Schema(
    {
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
        category: {
            type: String,
            required: true,
            enum: TOOL_CATEGORY_VALUES,
        },
        tags: {
            type: [String],
            default: [],
        },
        url: {
            type: String,
            default: "",
            trim: true,
        },
        icon: {
            type: String,
            default: "FiGrid",
            trim: true,
        },
        badge: {
            type: String,
            default: "",
            trim: true,
        },
        previewImage: {
            type: String,
            default: "",
            trim: true,
        },
        backgroundImage: {
            type: String,
            default: "",
            trim: true,
        },
        order: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

OurToolSchema.index({ order: 1, createdAt: 1 });

export const OUR_TOOL_CATEGORY_VALUES = TOOL_CATEGORY_VALUES;

export default mongoose.models.OurTool ||
    mongoose.model("OurTool", OurToolSchema);
