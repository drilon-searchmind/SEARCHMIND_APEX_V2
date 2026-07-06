import { getAllCustomers } from "@root/lib/customerOperations";
import connectToDatabase from "@root/lib/mongodb";
import User from "@root/models/User";
import Customer from "@/models/Customer";
import ApexRadarChannelSettings from "@/models/ApexRadarChannelSettings";
import ApexRadarAccountAssignment from "@/models/ApexRadarAccountAssignment";
import { isDemoCustomerId, mergeDemoCustomerDocument } from "@/lib/demoCustomer";
import { fetchApexRadarFacebookOverviewRows } from "@/lib/apexRadarFacebookOverview";
import { fetchApexRadarGoogleAdsOverviewRows } from "@/lib/apexRadarGoogleAdsOverview";
import {
    buildDemoApexRadarFacebookOverviewRow,
    buildDemoApexRadarGoogleAdsOverviewRow,
} from "@/lib/demoAdMetrics";
import {
    APEX_RADAR_CHANNEL_FACEBOOK,
    APEX_RADAR_CHANNEL_GOOGLE_ADS,
    APEX_RADAR_CHANNEL_META,
    APEX_RADAR_CHANNELS,
    isValidApexRadarChannel,
} from "@/lib/apexRadarChannels";
import {
    APEX_RADAR_CONVERSION_ZERO_DAYS_THRESHOLD,
    APEX_RADAR_SPEND_DOD_WARN_PCT_THRESHOLD,
} from "@/lib/apexRadarFacebookOverview";
import { mergeFacebookChannelSettingsIntoCustomers, mergeGoogleChannelSettingsIntoCustomers } from "@/lib/apexRadarChannelSettingsMerge";
import { collectFacebookMonitorAlerts } from "@/lib/apexRadarFacebookMonitor";
import { collectGoogleAdsMonitorAlerts } from "@/lib/apexRadarGoogleAdsMonitor";
import { getEffectiveApexRadarAssignmentUserIds } from "@/lib/apexRadarPaidSocialAssignments";
import { enrichMonitorAlertsWithAssigneeUserIds } from "@/lib/apexRadarAlertAssignees";
import { resolvePaidSocialExcludedUserIdsFromDoc } from "@/lib/apexRadarAssignmentExcludedDb";
import { formatTeamMemberShort } from "@/app/(protected)/apex-radar/lib/mockOverviewData";
import { getApexRadarLast30DaysRange } from "@/lib/apexRadarDateRange";
import { resolveApexRadarSlackPlatformLabel } from "@/lib/apexRadarSlackConfig";
import {
    sendApexRadarActiveWarningsToAssignedUsers,
    sendApexRadarActiveWarningsToSlack,
} from "@/lib/apexRadarSlack";

function toPlainCustomer(doc) {
    if (doc && typeof doc.toObject === "function") return doc.toObject();
    return { ...doc };
}

function googleAdsConfigured() {
    return Boolean(
        process.env.GOOGLE_ADS_CLIENT_ID &&
            process.env.GOOGLE_ADS_CLIENT_SECRET &&
            process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
            process.env.GOOGLE_ADS_REFRESH_TOKEN
    );
}

function parseCronNumberEnv(name, fallback) {
    const raw = process.env[name];
    if (raw == null || raw === "") return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}

function parseCronChannels(channelsInput) {
    if (!channelsInput || channelsInput === "all") {
        return [...APEX_RADAR_CHANNELS];
    }
    const list = String(channelsInput)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const valid = list.filter((ch) => isValidApexRadarChannel(ch));
    return valid.length ? valid : [...APEX_RADAR_CHANNELS];
}

async function loadAssignmentContext(channel) {
    await connectToDatabase();

    const [assignmentDocs, customerDocs, userDocs] = await Promise.all([
        ApexRadarAccountAssignment.find({ channel }).lean(),
        Customer.find({}).select("customerName customerTeam").lean(),
        User.find({ isExternal: { $ne: true }, isArchived: { $ne: true } })
            .select("name clickupId")
            .lean(),
    ]);

    /** @type {Record<string, { userIds: string[], paidSocialExcludedUserIds: string[] }>} */
    const assignmentDetailMap = {};
    await Promise.all(
        assignmentDocs.map(async (doc) => {
            const excluded = await resolvePaidSocialExcludedUserIdsFromDoc(doc);
            assignmentDetailMap[String(doc.customerId)] = {
                userIds: (doc.assignedUserIds || []).map((id) => String(id)),
                paidSocialExcludedUserIds: excluded,
            };
        })
    );

    /** @type {Record<string, object>} */
    const customersById = {};
    for (const customer of customerDocs) {
        customersById[String(customer._id)] = customer;
    }

    const internalUsers = userDocs.map((user) => ({
        id: String(user._id),
        name: user.name,
        clickupId: (user.clickupId && String(user.clickupId).trim()) || "",
    }));

    return { assignmentDetailMap, customersById, internalUsers };
}

async function loadOverviewRows(channel, dateRange) {
    let customers = await getAllCustomers();
    customers = customers.map((c) => {
        const plain = toPlainCustomer(c);
        const id = String(plain._id);
        if (!isDemoCustomerId(id)) return plain;
        return mergeDemoCustomerDocument(plain);
    });

    await connectToDatabase();

    if (channel === APEX_RADAR_CHANNEL_FACEBOOK) {
        const token = process.env.FACEBOOK_APP_TOKEN;
        if (!token) {
            return { skipped: true, reason: "Facebook token not configured", rows: [] };
        }

        const channelSettingsDocs = await ApexRadarChannelSettings.find({
            channel: APEX_RADAR_CHANNEL_FACEBOOK,
            customerId: { $in: customers.map((c) => c._id) },
        }).lean();
        customers = mergeFacebookChannelSettingsIntoCustomers(customers, channelSettingsDocs);

        const { rows } = await fetchApexRadarFacebookOverviewRows({
            accessToken: token,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            customers,
            isDemoCustomer: isDemoCustomerId,
            buildDemoRow: buildDemoApexRadarFacebookOverviewRow,
        });

        return { rows, dateRange };
    }

    if (channel === APEX_RADAR_CHANNEL_GOOGLE_ADS) {
        if (!googleAdsConfigured()) {
            return { skipped: true, reason: "Google Ads API not configured", rows: [] };
        }

        const channelSettingsDocs = await ApexRadarChannelSettings.find({
            channel: APEX_RADAR_CHANNEL_GOOGLE_ADS,
            customerId: { $in: customers.map((c) => c._id) },
        }).lean();
        customers = mergeGoogleChannelSettingsIntoCustomers(customers, channelSettingsDocs);

        const { rows } = await fetchApexRadarGoogleAdsOverviewRows({
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            customers,
            isDemoCustomer: isDemoCustomerId,
            buildDemoRow: buildDemoApexRadarGoogleAdsOverviewRow,
        });

        return { rows, dateRange };
    }

    return { skipped: true, reason: "Invalid channel", rows: [] };
}

function buildMonitorAlertsForChannel(channel, rows, context, thresholds) {
    const { assignmentDetailMap, customersById, internalUsers } = context;

    const alertOpts = {
        spendDodThresholdPct: thresholds.spendDodThresholdPct,
        conversionZeroDaysThreshold: thresholds.conversionZeroDaysThreshold,
        getTeamMemberNames: (row) => {
            const detail = assignmentDetailMap[row.id] || {
                userIds: [],
                paidSocialExcludedUserIds: [],
            };
            const cust = customersById[row.id] || null;
            const effective = getEffectiveApexRadarAssignmentUserIds(
                detail,
                cust,
                internalUsers,
                channel
            );
            return effective
                .map((uid) => {
                    const u = internalUsers.find((x) => String(x.id) === String(uid));
                    return formatTeamMemberShort(u?.name || "");
                })
                .filter(Boolean);
        },
    };

    const collected =
        channel === APEX_RADAR_CHANNEL_FACEBOOK
            ? collectFacebookMonitorAlerts(rows, alertOpts)
            : collectGoogleAdsMonitorAlerts(rows, alertOpts);

    return enrichMonitorAlertsWithAssigneeUserIds(collected, {
        assignmentDetailMap,
        customersById,
        internalUsers,
        channel,
    });
}

async function loadSlackUsersByAssigneeIds(assigneeIds) {
    /** @type {Map<string, { name: string, slackId?: string, clickupId?: string }>} */
    const usersById = new Map();
    if (!assigneeIds.length) return usersById;

    await connectToDatabase();
    const docs = await User.find({ _id: { $in: assigneeIds } })
        .select("name slackId clickupId")
        .lean();

    for (const doc of docs) {
        usersById.set(String(doc._id), {
            name: doc.name,
            slackId: doc.slackId || "",
            clickupId: doc.clickupId || "",
        });
    }

    return usersById;
}

/**
 * Run Slack notifications for one Apex Radar channel (PS or PPC).
 * @param {string} channel
 * @param {{
 *   sendChannel?: boolean,
 *   sendDm?: boolean,
 *   dateRange?: { startDate: string, endDate: string },
 *   spendDodThresholdPct?: number,
 *   conversionZeroDaysThreshold?: number,
 * }} [options]
 */
export async function runApexRadarSlackCronForChannel(channel, options = {}) {
    const sendChannel = options.sendChannel !== false;
    const sendDm = options.sendDm !== false;
    const dateRange = options.dateRange || getApexRadarLast30DaysRange();
    const thresholds = {
        spendDodThresholdPct:
            options.spendDodThresholdPct ??
            parseCronNumberEnv("APEX_RADAR_CRON_DOD_THRESHOLD", APEX_RADAR_SPEND_DOD_WARN_PCT_THRESHOLD),
        conversionZeroDaysThreshold:
            options.conversionZeroDaysThreshold ??
            parseCronNumberEnv(
                "APEX_RADAR_CRON_CONVERSION_DAYS",
                APEX_RADAR_CONVERSION_ZERO_DAYS_THRESHOLD
            ),
    };

    const platformLabel = APEX_RADAR_CHANNEL_META[channel]?.label || resolveApexRadarSlackPlatformLabel(channel);

    const overview = await loadOverviewRows(channel, dateRange);
    if (overview.skipped) {
        return {
            channel,
            platformLabel,
            success: true,
            skipped: true,
            reason: overview.reason,
            alertCount: 0,
            dateRange,
        };
    }

    const context = await loadAssignmentContext(channel);
    const alerts = buildMonitorAlertsForChannel(channel, overview.rows || [], context, thresholds);

    /** @type {Record<string, unknown>} */
    const result = {
        channel,
        platformLabel,
        success: true,
        skipped: false,
        alertCount: alerts.length,
        dateRange,
        thresholds,
        channelPost: null,
        dmDelivery: null,
    };

    if (!alerts.length) {
        result.message = "No active warnings — nothing sent.";
        return result;
    }

    if (sendChannel) {
        const channelPost = await sendApexRadarActiveWarningsToSlack({
            alerts,
            platformLabel,
            channel,
        });
        result.channelPost = {
            success: channelPost.success,
            channelName: channelPost.channelName,
            error: channelPost.error,
        };
        if (!channelPost.success) {
            result.success = false;
        }
    }

    if (sendDm) {
        const assigneeIds = [
            ...new Set(
                alerts.flatMap((alert) =>
                    (Array.isArray(alert.assigneeUserIds) ? alert.assigneeUserIds : []).map(String)
                )
            ),
        ];
        const usersById = await loadSlackUsersByAssigneeIds(assigneeIds);

        const dmDelivery = await sendApexRadarActiveWarningsToAssignedUsers({
            alerts,
            platformLabel,
            channel,
            usersById,
        });
        result.dmDelivery = {
            success: dmDelivery.success,
            channelName: dmDelivery.channelName,
            dmSentCount: dmDelivery.dmSentCount,
            skipped: dmDelivery.skipped,
            unassignedAlertCount: dmDelivery.unassignedAlertCount,
            error: dmDelivery.error,
        };
        if (!dmDelivery.success) {
            result.success = false;
        }
    }

    return result;
}

/**
 * Daily cron: PS + PPC Active warnings → Slack channel + assigned user DMs.
 * @param {{
 *   channels?: string | string[],
 *   sendChannel?: boolean,
 *   sendDm?: boolean,
 * }} [options]
 */
export async function runApexRadarSlackCron(options = {}) {
    const channelsRaw = options.channels ?? "all";
    const channels = Array.isArray(channelsRaw)
        ? parseCronChannels(channelsRaw.join(","))
        : parseCronChannels(channelsRaw);

    const ranAt = new Date().toISOString();
    const results = [];

    for (const channel of channels) {
        try {
            results.push(
                await runApexRadarSlackCronForChannel(channel, {
                    sendChannel: options.sendChannel,
                    sendDm: options.sendDm,
                })
            );
        } catch (err) {
            console.error(`[apex-radar/cron] ${channel} failed:`, err);
            results.push({
                channel,
                success: false,
                error: err?.message || "Channel job failed",
            });
        }
    }

    return {
        success: results.every((r) => r.success !== false),
        ranAt,
        results,
    };
}
