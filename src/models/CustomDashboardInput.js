import mongoose from "mongoose";

/**
 * Values that are typed in by hand for a custom dashboard (things an ad platform API cannot provide),
 * for example daily conversions or planned campaign budgets. One document per customer, dashboard and key.
 */
const CustomDashboardInputSchema = new mongoose.Schema(
    {
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
        },
        /** Dashboard module name, for example "aura". */
        dashboard: { type: String, required: true },
        /** What the data is, for example "conversions", "campaigns" or "goals". */
        key: { type: String, required: true },
        data: { type: mongoose.Schema.Types.Mixed, default: null },
        updatedBy: { type: String, default: "" },
    },
    { timestamps: true }
);

CustomDashboardInputSchema.index({ customer: 1, dashboard: 1, key: 1 }, { unique: true });

export default mongoose.models.CustomDashboardInput ||
    mongoose.model("CustomDashboardInput", CustomDashboardInputSchema);
