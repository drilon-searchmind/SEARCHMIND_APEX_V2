import { postSlackChannelMessage, listSlackChannelsCached } from "@/lib/apexRadarSlack";

export async function listPerformanceBriefSlackChannels() {
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

function isValidSlackPayload(payload) {
    if (!payload || typeof payload !== "object") return false;
    if (typeof payload.text !== "string" || !payload.text.trim()) return false;
    if (!Array.isArray(payload.blocks) || payload.blocks.length === 0) return false;
    return true;
}

/**
 * Post an already-rendered Performance Brief to the assigned Slack channel.
 */
export async function sendPerformanceBriefToSlack({ payload, channelId, channelName }) {
    const slackChannelId = String(channelId || "").trim();
    if (!slackChannelId) {
        return { success: false, error: "No Slack channel assigned for this customer." };
    }
    if (!isValidSlackPayload(payload)) {
        return { success: false, error: "Generate a brief before sending to Slack." };
    }

    const result = await postSlackChannelMessage(slackChannelId, {
        text: payload.text,
        blocks: payload.blocks,
    });
    if (!result.success) return result;

    return {
        success: true,
        channelId: result.channelId,
        channelName: String(channelName || "").replace(/^#/, ""),
        messageTs: result.messageTs,
    };
}
