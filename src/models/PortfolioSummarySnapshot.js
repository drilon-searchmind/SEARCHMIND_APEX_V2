import mongoose from "mongoose";

/**
 * Precomputed Black Days / portfolio KPIs for one ecommerce customer + date window.
 * Written by /api/cron/portfolio-summary; read by GET /api/portfolio-summary (no live platform calls).
 */
const PortfolioSummarySnapshotSchema = new mongoose.Schema(
    {
        customerId: { type: String, required: true, index: true },
        /** `${start}_${end}_${compareStart}_${compareEnd}` */
        windowKey: { type: String, required: true, index: true },
        customerName: { type: String, default: "" },
        currency: { type: String, default: "DKK" },
        parentId: { type: String, default: null },
        parentName: { type: String, default: null },
        businessCategory: { type: String, default: "ecommerce" },

        startDate: { type: String, required: true },
        endDate: { type: String, required: true },
        compareStartDate: { type: String, required: true },
        compareEndDate: { type: String, required: true },

        revenue: { type: Number, default: null },
        revenuePrev: { type: Number, default: null },
        orders: { type: Number, default: null },
        ordersPrev: { type: Number, default: null },

        spendTotal: { type: Number, default: null },
        spendTotalPrev: { type: Number, default: null },
        spendGoogle: { type: Number, default: null },
        spendGooglePrev: { type: Number, default: null },
        spendMeta: { type: Number, default: null },
        spendMetaPrev: { type: Number, default: null },
        spendOther: { type: Number, default: null },
        spendOtherPrev: { type: Number, default: null },

        /** Attributed channel revenue (not store channel mix). */
        revenueGoogle: { type: Number, default: null },
        revenueGooglePrev: { type: Number, default: null },
        revenueMeta: { type: Number, default: null },
        revenueMetaPrev: { type: Number, default: null },
        revenueEmail: { type: Number, default: null },
        revenueEmailPrev: { type: Number, default: null },

        grossProfit: { type: Number, default: null },
        grossProfitPrev: { type: Number, default: null },
        cogsConfigured: { type: Boolean, default: false },

        /** Per-source ISO timestamps for this compute. */
        lastSync: {
            type: {
                store: { type: String, default: null },
                google: { type: String, default: null },
                meta: { type: String, default: null },
                klaviyo: { type: String, default: null },
            },
            default: {},
        },
        /** e.g. [{ source, reason, message }] */
        dataGaps: { type: [mongoose.Schema.Types.Mixed], default: [] },
        status: {
            type: String,
            enum: ["ok", "partial", "error", "no_data"],
            default: "ok",
        },
        lastError: { type: String, default: "" },
        computedAt: { type: Date, default: null, index: true },
    },
    { collection: "portfolio_summary_snapshots", timestamps: true }
);

PortfolioSummarySnapshotSchema.index({ customerId: 1, windowKey: 1 }, { unique: true });
PortfolioSummarySnapshotSchema.index({ windowKey: 1, computedAt: -1 });

export default mongoose.models.PortfolioSummarySnapshot ||
    mongoose.model("PortfolioSummarySnapshot", PortfolioSummarySnapshotSchema);
