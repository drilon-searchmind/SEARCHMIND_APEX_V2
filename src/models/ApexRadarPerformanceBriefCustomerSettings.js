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
        /** Even hour 0–22 (2-hour slots) in Europe/Copenhagen. Default 10 */
        scheduleHour: { type: Number, default: 10, min: 0, max: 22 },
        updatedAt: { type: Date, default: Date.now },
    },
    { collection: "apex_radar_performance_brief_customer_settings" }
);

export default mongoose.models.ApexRadarPerformanceBriefCustomerSettings ||
    mongoose.model(
        "ApexRadarPerformanceBriefCustomerSettings",
        ApexRadarPerformanceBriefCustomerSettingsSchema
    );
