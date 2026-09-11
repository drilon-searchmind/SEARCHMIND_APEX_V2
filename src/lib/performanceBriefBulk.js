import mongoose from "mongoose";
import Customer from "@/models/Customer";
import ApexRadarPerformanceBriefCustomerSettings from "@/models/ApexRadarPerformanceBriefCustomerSettings";
import {
    getServiceDashboardConfigWarnings,
    isValidIntegrationId,
} from "@/lib/customerServiceIntegrations";
import { setApexRadarCustomerSlackChannel } from "@/lib/apexRadarCustomerSlack";
import { isPerformanceBriefCustomerId } from "@/lib/performanceBriefConstants";
import { normalizePerformanceBriefSchedule } from "@/lib/performanceBriefSchedule";

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
 * Active customers eligible for Performance Brief bulk run (non-archived).
 */
export async function listPerformanceBriefBulkCustomers() {
    const customers = await Customer.find({ isArchived: { $ne: true } })
        .select("_id customerName isArchived CustomerSettings")
        .sort({ customerName: 1 })
        .lean();

    const ids = customers.map((c) => c._id);
    const settingsDocs = await ApexRadarPerformanceBriefCustomerSettings.find({
        customerId: { $in: ids },
    })
        .select("customerId slackChannelId slackChannelName scheduleDayOfWeek scheduleHour")
        .lean();

    const settingsByCustomerId = new Map(
        settingsDocs.map((doc) => [String(doc.customerId), doc])
    );

    return customers.map((c) => {
        const settings = c.CustomerSettings || {};
        const warnings = getServiceDashboardConfigWarnings(settings);
        const briefSettings = mapBriefSettingsRow(settingsByCustomerId.get(String(c._id)) || {});
        return {
            customerId: String(c._id),
            customerName: c.customerName || "Untitled",
            isArchived: Boolean(c.isArchived),
            ...briefSettings,
            integrations: {
                meta: !warnings.ps,
                googleAds: !warnings.ppc,
            },
            metaConfigured: isValidIntegrationId(settings.facebookAdAccountId),
            googleConfigured: isValidIntegrationId(settings.googleAdsCustomerId),
        };
    });
}

/**
 * Active customers with a Performance Brief Slack channel assigned (cron queue).
 */
export async function listPerformanceBriefCronCustomers() {
    const settingsDocs = await ApexRadarPerformanceBriefCustomerSettings.find({
        slackChannelId: { $exists: true, $nin: ["", null] },
    })
        .select("customerId slackChannelId slackChannelName scheduleDayOfWeek scheduleHour")
        .lean();

    if (!settingsDocs.length) return [];

    const customerIds = settingsDocs.map((doc) => doc.customerId);
    const customers = await Customer.find({
        _id: { $in: customerIds },
        isArchived: { $ne: true },
    })
        .select("_id customerName")
        .sort({ customerName: 1 })
        .lean();

    const settingsByCustomerId = new Map(
        settingsDocs.map((doc) => [String(doc.customerId), doc])
    );

    return customers
        .map((c) => {
            const briefSettings = mapBriefSettingsRow(settingsByCustomerId.get(String(c._id)) || {});
            if (!briefSettings.slackChannelId) return null;
            return {
                customerId: String(c._id),
                customerName: c.customerName || "Untitled",
                ...briefSettings,
            };
        })
        .filter(Boolean);
}

/**
 * @param {{
 *   customerId: string,
 *   slackChannelId?: string,
 *   slackChannelName?: string,
 *   scheduleDayOfWeek?: number,
 *   scheduleHour?: number,
 * }[]} updates
 */
export async function savePerformanceBriefBulkSettings(updates = []) {
    const saved = [];
    for (const row of updates) {
        const customerId = String(row?.customerId || "").trim();
        if (!isPerformanceBriefCustomerId(customerId)) continue;

        let slack = null;
        if (row.slackChannelId !== undefined || row.slackChannelName !== undefined) {
            slack = await setApexRadarCustomerSlackChannel(customerId, {
                slackChannelId: row.slackChannelId,
                slackChannelName: row.slackChannelName,
            });
        }

        const schedule = normalizePerformanceBriefSchedule(row);
        const cid = new mongoose.Types.ObjectId(customerId);
        await ApexRadarPerformanceBriefCustomerSettings.findOneAndUpdate(
            { customerId: cid },
            {
                $set: {
                    scheduleDayOfWeek: schedule.scheduleDayOfWeek,
                    scheduleHour: schedule.scheduleHour,
                    updatedAt: new Date(),
                },
            },
            { upsert: true, new: true, runValidators: true }
        );

        saved.push({
            customerId,
            slackChannelId: slack?.slackChannelId,
            slackChannelName: slack?.slackChannelName,
            scheduleDayOfWeek: schedule.scheduleDayOfWeek,
            scheduleHour: schedule.scheduleHour,
        });
    }
    return saved;
}

/** @deprecated Use savePerformanceBriefBulkSettings */
export async function savePerformanceBriefBulkSlackChannels(updates = []) {
    return savePerformanceBriefBulkSettings(updates);
}
