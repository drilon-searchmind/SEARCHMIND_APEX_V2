import mongoose from "mongoose";

const DefaultOverrideSchema = new mongoose.Schema(
    {
        ruleId: { type: String, required: true },
        enabled: { type: Boolean, default: true },
        period: { type: String, enum: ["dod", "wow"], default: undefined },
        dropPct: { type: Number, default: undefined },
    },
    { _id: false }
);

const CustomRuleSchema = new mongoose.Schema(
    {
        id: { type: String, required: true },
        platform: {
            type: String,
            required: true,
            enum: ["google-ads", "meta", "seo", "email"],
        },
        kpi: { type: String, required: true },
        period: { type: String, required: true, enum: ["dod", "wow"] },
        dropPct: { type: Number, required: true },
        enabled: { type: Boolean, default: true },
    },
    { _id: false }
);

const ApexRadarCsCustomerSettingsSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
            unique: true,
        },
        slackChannelId: { type: String, default: "" },
        slackChannelName: { type: String, default: "" },
        defaultOverrides: { type: [DefaultOverrideSchema], default: [] },
        customRules: { type: [CustomRuleSchema], default: [] },
        updatedAt: { type: Date, default: Date.now },
    },
    { collection: "apex_radar_cs_customer_settings" }
);

export default mongoose.models.ApexRadarCsCustomerSettings ||
    mongoose.model("ApexRadarCsCustomerSettings", ApexRadarCsCustomerSettingsSchema);
