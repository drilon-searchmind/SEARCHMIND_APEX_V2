import mongoose from "mongoose";
import { APEX_RADAR_CHANNELS } from "@/lib/apexRadarChannels";

const ApexRadarChannelSettingsSchema = new mongoose.Schema(
    {
        channel: {
            type: String,
            required: true,
            enum: APEX_RADAR_CHANNELS,
        },
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
        },
        targetBudget: { type: Number, default: null },
        targetMetricType: {
            type: String,
            enum: ["ROAS", "CPA"],
            default: "ROAS",
        },
        targetValue: { type: Number, default: null },
        budgetMode: {
            type: String,
            enum: ["STATIC", "DYNAMIC"],
            default: "DYNAMIC",
        },
        trackingAlertsEnabled: {
            type: Boolean,
            default: true,
        },
        /** Meta PS only: custom action_type values to count as conversions; empty/null = default purchases. */
        trackingConversionActionTypes: {
            type: [String],
            default: undefined,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { collection: "apex_radar_channel_settings" }
);

ApexRadarChannelSettingsSchema.index({ channel: 1, customerId: 1 }, { unique: true });

export default mongoose.models.ApexRadarChannelSettings ||
    mongoose.model("ApexRadarChannelSettings", ApexRadarChannelSettingsSchema);
