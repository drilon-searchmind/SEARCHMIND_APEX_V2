import mongoose from "mongoose";
import Customer from "@/models/Customer";
import ApexRadarCsCustomerSettings from "@/models/ApexRadarCsCustomerSettings";
import ApexRadarPerformanceBriefCustomerSettings from "@/models/ApexRadarPerformanceBriefCustomerSettings";
import {
    getServiceDashboardConfigWarnings,
    isValidIntegrationId,
} from "@/lib/customerServiceIntegrations";
import {
    pickPreferredSlack,
    setApexRadarCustomerSlackChannel,
} from "@/lib/apexRadarCustomerSlack";
import { isPerformanceBriefCustomerId } from "@/lib/performanceBriefConstants";
import {
    normalizePerformanceBriefSchedule,
    normalizeScheduleDayOfWeek,
    scheduleSendHour,
} from "@/lib/performanceBriefSchedule";

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
 * Uses the same CS + Brief Slack merge as the settings UI (not Brief-only).
 */
export async function listPerformanceBriefCronCustomers() {
    const [briefDocs, csDocs] = await Promise.all([
        ApexRadarPerformanceBriefCustomerSettings.find({})
            .select("customerId slackChannelId slackChannelName scheduleDayOfWeek scheduleHour updatedAt")
            .lean(),
        ApexRadarCsCustomerSettings.find({})
            .select("customerId slackChannelId slackChannelName updatedAt")
            .lean(),
    ]);

    const briefByCustomerId = new Map(briefDocs.map((doc) => [String(doc.customerId), doc]));
    const csByCustomerId = new Map(csDocs.map((doc) => [String(doc.customerId), doc]));

    const candidateIds = new Set();
    for (const doc of briefDocs) {
        if (String(doc.slackChannelId || "").trim()) {
            candidateIds.add(String(doc.customerId));
        }
    }
    for (const doc of csDocs) {
        if (String(doc.slackChannelId || "").trim()) {
            candidateIds.add(String(doc.customerId));
        }
    }

    if (!candidateIds.size) return [];

    const customers = await Customer.find({
        _id: { $in: [...candidateIds] },
        isArchived: { $ne: true },
    })
        .select("_id customerName")
        .sort({ customerName: 1 })
        .lean();

    return customers
        .map((c) => {
            const customerId = String(c._id);
            const briefDoc = briefByCustomerId.get(customerId);
            const csDoc = csByCustomerId.get(customerId);
            const slack = pickPreferredSlack(csDoc, briefDoc);
            if (!slack.slackChannelId) return null;

            return {
                customerId,
                customerName: c.customerName || "Untitled",
                slackChannelId: slack.slackChannelId,
                slackChannelName: slack.slackChannelName,
                scheduleDayOfWeek: normalizeScheduleDayOfWeek(briefDoc?.scheduleDayOfWeek),
                scheduleHour: scheduleSendHour(briefDoc?.scheduleHour),
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

        const cid = new mongoose.Types.ObjectId(customerId);
        const hasSchedulePatch =
            row.scheduleDayOfWeek !== undefined || row.scheduleHour !== undefined;

        let briefDoc = await ApexRadarPerformanceBriefCustomerSettings.findOne({ customerId: cid })
            .select("scheduleDayOfWeek scheduleHour slackChannelId slackChannelName")
            .lean();

        if (hasSchedulePatch) {
            const schedule = normalizePerformanceBriefSchedule({
                scheduleDayOfWeek: row.scheduleDayOfWeek ?? briefDoc?.scheduleDayOfWeek,
                scheduleHour: row.scheduleHour ?? briefDoc?.scheduleHour,
            });
            briefDoc = await ApexRadarPerformanceBriefCustomerSettings.findOneAndUpdate(
                { customerId: cid },
                {
                    $set: {
                        scheduleDayOfWeek: schedule.scheduleDayOfWeek,
                        scheduleHour: schedule.scheduleHour,
                        updatedAt: new Date(),
                    },
                },
                { upsert: true, new: true, runValidators: true }
            ).lean();
        }

        const schedule = normalizePerformanceBriefSchedule(briefDoc || row);
        saved.push({
            customerId,
            slackChannelId: slack?.slackChannelId ?? briefDoc?.slackChannelId,
            slackChannelName: slack?.slackChannelName ?? briefDoc?.slackChannelName,
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
