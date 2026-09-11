import mongoose from "mongoose";

const ApexRadarPerformanceBriefCustomerSettingsSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true,
            unique: true,
        },
        slackChannelId: { type: String, default: "" },
        slackChannelName: { type: String, default: "" },
        /** dayjs day(): 0=Sun … 6=Sat. Default Monday=1 */
        scheduleDayOfWeek: { type: Number, default: 1, min: 0, max: 6 },
        /** Hour 0–23 in Europe/Copenhagen. Default 10 */
        scheduleHour: { type: Number, default: 10, min: 0, max: 23 },
        updatedAt: { type: Date, default: Date.now },
    },
    { collection: "apex_radar_performance_brief_customer_settings" }
);

export default mongoose.models.ApexRadarPerformanceBriefCustomerSettings ||
    mongoose.model(
        "ApexRadarPerformanceBriefCustomerSettings",
        ApexRadarPerformanceBriefCustomerSettingsSchema
    );
