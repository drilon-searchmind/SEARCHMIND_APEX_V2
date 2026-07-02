import { WebClient } from "@slack/web-api";
import {
    formatApexRadarActiveWarningsSlackMessage,
    formatApexRadarDmDeliverySummarySlackMessage,
} from "@/lib/apexRadarSlackAlerts";
import { getApexRadarSlackWarningsChannel } from "@/lib/apexRadarSlackConfig";

function getSlackBotToken() {
    return (
        process.env.SLACK_BOT_USER_OAUTH_TOKEN ||
        process.env.SLACK_TOKEN ||
        ""
    ).trim();
}

function getSlackClient() {
    const token = getSlackBotToken();
    if (!token) {
        throw new Error(
            "Slack bot token missing. Set SLACK_BOT_USER_OAUTH_TOKEN (or SLACK_TOKEN) in .env."
        );
    }
    return new WebClient(token);
}

function normalizeChannelName(name) {
    return String(name || "")
        .trim()
        .replace(/^#/, "")
        .toLowerCase();
}

/**
 * Resolve a Slack channel ID by name (public or private). Bot must be a member.
 * @param {string} channelName — e.g. apex-radar-workspace or #apex-radar-workspace
 */
export async function resolveSlackChannelIdByName(channelName) {
    const target = normalizeChannelName(channelName);
    if (!target) return null;

    const client = getSlackClient();
    let cursor;
    do {
        const res = await client.conversations.list({
            types: "public_channel,private_channel",
            limit: 200,
            cursor,
        });
        const match = (res.channels || []).find((c) => c.name === target);
        if (match?.id) return match.id;
        cursor = res.response_metadata?.next_cursor;
    } while (cursor);

    return null;
}

/**
 * @param {string} channelIdOrName
 * @param {{ text: string, blocks?: import('@slack/web-api').KnownBlock[] }} message
 */
export async function postSlackChannelMessage(channelIdOrName, message) {
    const client = getSlackClient();
    let channel = String(channelIdOrName || "").trim();

    if (channel.startsWith("#") || (!channel.startsWith("C") && !channel.startsWith("G"))) {
        const resolved = await resolveSlackChannelIdByName(channel);
        if (!resolved) {
            return {
                success: false,
                error: `Slack channel not found: #${normalizeChannelName(channel)}. Invite the bot to the channel.`,
            };
        }
        channel = resolved;
    }

    const res = await client.chat.postMessage({
        channel,
        text: message.text,
        blocks: message.blocks,
        unfurl_links: false,
        unfurl_media: false,
    });

    if (!res.ok) {
        return { success: false, error: res.error || "Failed to post Slack message" };
    }

    return {
        success: true,
        channelId: res.channel,
        messageTs: res.ts,
    };
}

function formatSlackApiError(err) {
    const needed = err?.data?.needed;
    const provided = err?.data?.provided;
    if (err?.code === "slack_webapi_platform_error" && needed) {
        return `Slack missing scope: ${needed}${provided ? ` (have: ${provided})` : ""}`;
    }
    return err?.message || "Failed to send Slack message";
}

/**
 * @param {string} slackUserId
 * @param {{ text: string, blocks?: import('@slack/web-api').KnownBlock[] }} message
 */
export async function postSlackDirectMessage(slackUserId, message) {
    const client = getSlackClient();
    const userId = String(slackUserId || "").trim();
    if (!userId) {
        return { success: false, error: "Slack user ID is required" };
    }

    const open = await client.conversations.open({ users: userId });
    if (!open.ok || !open.channel?.id) {
        return {
            success: false,
            error: open.error || "Failed to open Slack DM",
        };
    }

    const res = await client.chat.postMessage({
        channel: open.channel.id,
        text: message.text,
        blocks: message.blocks,
        unfurl_links: false,
        unfurl_media: false,
    });

    if (!res.ok) {
        return { success: false, error: res.error || "Failed to send Slack DM" };
    }

    return {
        success: true,
        channelId: res.channel,
        messageTs: res.ts,
    };
}

/**
 * Post Active warnings to the configured Apex Radar Slack channel.
 * @param {{ alerts: object[], platformLabel: string, channel?: string, slackChannel?: string }} input
 */
export async function sendApexRadarActiveWarningsToSlack({
    alerts = [],
    platformLabel = "Apex Radar",
    channel,
    slackChannel,
}) {
    const targetChannel =
        slackChannel || getApexRadarSlackWarningsChannel(channel);

    const payload = formatApexRadarActiveWarningsSlackMessage({
        alerts,
        platformLabel,
    });

    try {
        const result = await postSlackChannelMessage(targetChannel, payload);
        return { ...result, channelName: normalizeChannelName(targetChannel) };
    } catch (err) {
        console.error("[apex-radar/slack] post failed:", err);
        return {
            success: false,
            error: formatSlackApiError(err),
        };
    }
}

/**
 * DM Active warnings to assigned team members, then post a delivery summary to the workspace channel.
 * @param {{
 *   alerts: object[],
 *   platformLabel: string,
 *   channel?: string,
 *   usersById: Map<string, { name: string, slackId?: string, clickupId?: string }>,
 *   slackChannel?: string,
 * }} input
 */
export async function sendApexRadarActiveWarningsToAssignedUsers({
    alerts = [],
    platformLabel = "Apex Radar",
    channel,
    usersById = new Map(),
    slackChannel,
}) {
    const list = Array.isArray(alerts) ? alerts : [];
    const sentAt = new Date();

    /** @type {Map<string, object[]>} */
    const alertsByUserId = new Map();
    let unassignedAlertCount = 0;

    for (const alert of list) {
        const assigneeIds = Array.isArray(alert.assigneeUserIds)
            ? alert.assigneeUserIds.filter(Boolean).map(String)
            : [];
        if (!assigneeIds.length) {
            unassignedAlertCount++;
            continue;
        }
        for (const uid of assigneeIds) {
            if (!alertsByUserId.has(uid)) alertsByUserId.set(uid, []);
            alertsByUserId.get(uid).push(alert);
        }
    }

    /** @type {{ name: string, alertCount: number, alerts: object[], slackUserId: string, messageTs?: string }[]} */
    const deliveries = [];
    /** @type {{ name: string, reason: string }[]} */
    const skipped = [];

    for (const [uid, userAlerts] of alertsByUserId) {
        const user = usersById.get(String(uid));
        if (!user) {
            skipped.push({ name: `User ${uid}`, reason: "User not found" });
            continue;
        }
        const slackId = String(user.slackId || "").trim();
        const name = user.name || "Unknown";
        if (!slackId) {
            skipped.push({ name, reason: "No Slack ID configured" });
            continue;
        }

        const payload = formatApexRadarActiveWarningsSlackMessage({
            alerts: userAlerts,
            platformLabel: `${platformLabel} (your accounts)`,
        });

        try {
            const result = await postSlackDirectMessage(slackId, payload);
            if (!result.success) {
                skipped.push({ name, reason: result.error || "DM failed" });
                continue;
            }
            deliveries.push({
                name,
                slackUserId: slackId,
                alertCount: userAlerts.length,
                alerts: userAlerts,
                messageTs: result.messageTs,
            });
        } catch (err) {
            skipped.push({ name, reason: formatSlackApiError(err) });
        }
    }

    const targetChannel =
        slackChannel || getApexRadarSlackWarningsChannel(channel);

    const summaryPayload = formatApexRadarDmDeliverySummarySlackMessage({
        platformLabel,
        sentAt,
        deliveries,
        skipped,
        unassignedAlertCount,
        totalAlertCount: list.length,
    });

    try {
        const summaryResult = await postSlackChannelMessage(targetChannel, summaryPayload);
        if (!summaryResult.success) {
            return {
                success: false,
                error: summaryResult.error || "Failed to post delivery summary",
                deliveries,
                skipped,
                unassignedAlertCount,
                dmSentCount: deliveries.length,
            };
        }

        return {
            success: true,
            channelName: normalizeChannelName(targetChannel),
            channelId: summaryResult.channelId,
            summaryMessageTs: summaryResult.messageTs,
            deliveries: deliveries.map(({ name, alertCount, slackUserId }) => ({
                name,
                alertCount,
                slackUserId,
            })),
            skipped,
            unassignedAlertCount,
            dmSentCount: deliveries.length,
        };
    } catch (err) {
        console.error("[apex-radar/slack] summary post failed:", err);
        return {
            success: false,
            error: formatSlackApiError(err),
            deliveries,
            skipped,
            unassignedAlertCount,
            dmSentCount: deliveries.length,
        };
    }
}
