import mongoose from "mongoose";

const PerChannelSchema = new mongoose.Schema(
    {
        channel: { type: String, required: true },
        label: { type: String, default: "" },
        /** What is compared: "revenue" | "conversions" | "sessions" | "spend". */
        metric: { type: String, default: "" },
        /** True for the channel(s) that drive the headline Indeks. */
        headline: { type: Boolean, default: false },
        current: { type: Number, default: null },
        previous: { type: Number, default: null },
        indeks: { type: Number, default: null },
        status: {
            type: String,
            enum: ["ok", "no_data", "insufficient_history", "not_connected", "error"],
            default: "no_data",
        },
        error: { type: String, default: "" },
    },
    { _id: false }
);

const HistoryEntrySchema = new mongoose.Schema(
    {
        date: { type: String, required: true }, // YYYY-MM-DD (day of computation, Copenhagen)
        indeks: { type: Number, default: null },
    },
    { _id: false }
);

/**
 * One current YoY "Indeks" snapshot per customer (upserted nightly by /api/cron/indeks).
 * 100 = same as last year, above 100 = growth. null = not computable.
 */
const CustomerIndeksSnapshotSchema = new mongoose.Schema(
    {
        customerId: { type: String, required: true, unique: true, index: true },
        customerClickupId: { type: String, required: true, index: true },
        customerName: { type: String, default: "" },
        businessCategory: { type: String, enum: ["ecommerce", "b2b"], default: "ecommerce" },
        /** Metric driving the headline Indeks: "revenue" (ecommerce) or "conversions" (B2B). */
        headlineMetric: { type: String, default: "" },
        indeks: { type: Number, default: null },
        status: {
            type: String,
            enum: ["ok", "no_data", "insufficient_history", "error"],
            default: "no_data",
        },
        lastError: { type: String, default: "" },
        perChannel: { type: [PerChannelSchema], default: [] },
        windowStart: { type: String, default: "" },
        windowEnd: { type: String, default: "" },
        compareStart: { type: String, default: "" },
        compareEnd: { type: String, default: "" },
        computedAt: { type: Date, default: null, index: true },
        /** Last ~90 daily headline values for trends. */
        history: { type: [HistoryEntrySchema], default: [] },
    },
    { collection: "customer_indeks_snapshots", timestamps: true }
);

export default mongoose.models.CustomerIndeksSnapshot ||
    mongoose.model("CustomerIndeksSnapshot", CustomerIndeksSnapshotSchema);
