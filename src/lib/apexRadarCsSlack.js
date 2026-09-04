import { postSlackChannelMessage, listSlackChannelsCached } from "@/lib/apexRadarSlack";
import { formatApexRadarCsSlackPreview } from "@/lib/apexRadarCsSlackPreview";

export { formatApexRadarCsSlackPreview };

/**
 * List public + private Slack channels the bot can see.
 * Bot must be invited to private channels to post later.
 */
export async function listApexRadarCsSlackChannels() {
    const raw = await listSlackChannelsCached();
    const channels = raw.map((c) => ({
        id: c.id,
        name: c.name,
        isPrivate: Boolean(c.is_private),
        isMember: Boolean(c.is_member),
    }));
    channels.sort((a, b) => a.name.localeCompare(b.name));
    return channels;
}

/**
 * Post CS alerts to the customer's assigned Slack channel.
 * @param {{ alerts: object[], customerName: string, channelId: string, channelName?: string }} input
 */
export async function sendApexRadarCsAlertsToSlack({
    alerts = [],
    customerName,
    channelId,
    channelName,
}) {
    const slackChannelId = String(channelId || "").trim();
    if (!slackChannelId) {
        return { success: false, error: "No Slack channel assigned for this customer." };
    }

    const payload = formatApexRadarCsSlackPreview({
        alerts,
        customerName,
        channelName,
    });

    const result = await postSlackChannelMessage(slackChannelId, payload);
    if (!result.success) {
        return result;
    }

    return {
        success: true,
        channelId: result.channelId,
        channelName: String(channelName || "").replace(/^#/, ""),
        messageTs: result.messageTs,
        alertCount: alerts.length,
    };
}
