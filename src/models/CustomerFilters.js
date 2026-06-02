import mongoose from "mongoose";

/** Per child customer (Customer._id): ad campaigns excluded from group-view spend. */
const AdPlatformChildFilterSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
        },
        excludedCampaignIds: {
            type: [String],
            default: [],
        },
        /** Case-insensitive substring match on campaign name (e.g. "retail"). */
        excludedCampaignNameKeywords: {
            type: [String],
            default: [],
        },
    },
    { _id: false }
);

const AdPlatformFiltersSchema = new mongoose.Schema(
    {
        /** Master toggle for this parent group view only. */
        filterEnabled: { type: Boolean, default: false },
        /** One entry per child property — filters apply per child, not on the parent. */
        children: {
            type: [AdPlatformChildFilterSchema],
            default: [],
        },
    },
    { _id: false }
);

const CustomerFiltersSchema = new mongoose.Schema(
    {
        parentCustomerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ParentCustomer",
            required: true,
            unique: true,
            index: true,
        },
        googleAds: {
            type: AdPlatformFiltersSchema,
            default: () => ({ filterEnabled: false, children: [] }),
        },
        metaAds: {
            type: AdPlatformFiltersSchema,
            default: () => ({ filterEnabled: false, children: [] }),
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { collection: "customer_filters" }
);

CustomerFiltersSchema.pre("save", function () {
    this.updatedAt = Date.now();
});

export default mongoose.models.CustomerFilters ||
    mongoose.model("CustomerFilters", CustomerFiltersSchema);
