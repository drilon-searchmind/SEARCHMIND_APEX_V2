import mongoose from "mongoose";

/** Per child customer (Customer._id): Google Ads campaigns excluded from group-view spend. */
const GoogleAdsChildFilterSchema = new mongoose.Schema(
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
    },
    { _id: false }
);

const GoogleAdsFiltersSchema = new mongoose.Schema(
    {
        /** Master toggle for this parent group view only. */
        filterEnabled: { type: Boolean, default: false },
        /** One entry per child property — filters apply per child, not on the parent. */
        children: {
            type: [GoogleAdsChildFilterSchema],
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
            type: GoogleAdsFiltersSchema,
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
