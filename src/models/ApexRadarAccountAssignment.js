import mongoose from "mongoose";
import { APEX_RADAR_CHANNELS } from "@/lib/apexRadarChannels";

const ApexRadarAccountAssignmentSchema = new mongoose.Schema(
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
        assignedUserIds: {
            type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
            default: [],
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { collection: "apex_radar_account_assignments" }
);

ApexRadarAccountAssignmentSchema.index({ channel: 1, customerId: 1 }, { unique: true });

export default mongoose.models.ApexRadarAccountAssignment ||
    mongoose.model("ApexRadarAccountAssignment", ApexRadarAccountAssignmentSchema);
