import mongoose from "mongoose";
import ApexRadarPerformanceBriefCustomerSettings from "@/models/ApexRadarPerformanceBriefCustomerSettings";
import { getApexRadarCustomerSlackChannel } from "@/lib/apexRadarCustomerSlack";
import { isPerformanceBriefCustomerId } from "@/lib/performanceBriefConstants";
import { normalizePerformanceBriefSchedule } from "@/lib/performanceBriefSchedule";
import { savePerformanceBriefBulkSettings } from "@/lib/performanceBriefBulk";

function mapBriefSettingsRow(briefSettings = {}) {
    const schedule = normalizePerformanceBriefSchedule(briefSettings);
    return {
        slackChannelId: String(briefSettings.slackChannelId || "").trim(),
        slackChannelName: String(briefSettings.slackChannelName || "").trim(),
        scheduleDayOfWeek: schedule.scheduleDayOfWeek,
        scheduleHour: schedule.scheduleHour,
    };
}

/**
 * Slack + cron schedule for one customer (Performance Brief settings UI).
 */
export async function getPerformanceBriefCustomerSettings(customerId) {
    const cid = String(customerId || "").trim();
    const [slack, briefDoc] = await Promise.all([
        getApexRadarCustomerSlackChannel(cid),
        ApexRadarPerformanceBriefCustomerSettings.findOne({
            customerId: new mongoose.Types.ObjectId(cid),
        })
            .select("scheduleDayOfWeek scheduleHour slackChannelId slackChannelName")
            .lean(),
    ]);

    return mapBriefSettingsRow({
        slackChannelId: slack.slackChannelId,
        slackChannelName: slack.slackChannelName,
        scheduleDayOfWeek: briefDoc?.scheduleDayOfWeek,
        scheduleHour: briefDoc?.scheduleHour,
    });
}

/**
 * @param {string} customerId
 * @param {{
 *   slackChannelId?: string,
 *   slackChannelName?: string,
 *   scheduleDayOfWeek?: number,
 *   scheduleHour?: number,
 * }} patch
 */
export async function savePerformanceBriefCustomerSettings(customerId, patch = {}) {
    const cid = String(customerId || "").trim();
    if (!isPerformanceBriefCustomerId(cid)) {
        throw new Error("Invalid customerId");
    }

    await savePerformanceBriefBulkSettings([
        {
            customerId: cid,
            ...patch,
        },
    ]);

    return getPerformanceBriefCustomerSettings(cid);
}
