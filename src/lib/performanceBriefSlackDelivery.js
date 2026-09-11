import PerformanceBriefSlackDelivery from "@/models/PerformanceBriefSlackDelivery";

const STALE_SENDING_MS = 15 * 60 * 1000;

/**
 * One Slack post per customer + channel per ISO week.
 * @returns {Promise<{ claim: boolean, reason?: string, deliveryId?: string, messageTs?: string }>}
 */
export async function tryClaimWeeklySlackDelivery({
    weekKey,
    customerId,
    slackChannelId,
    slackChannelName,
    runId,
}) {
    const week = String(weekKey || "").trim();
    const cid = String(customerId || "").trim();
    const channelId = String(slackChannelId || "").trim();

    if (!week || !cid || !channelId) {
        return { claim: false, reason: "invalid_delivery_key" };
    }

    const existing = await PerformanceBriefSlackDelivery.findOne({
        weekKey: week,
        customerId: cid,
        slackChannelId: channelId,
    }).lean();

    if (existing?.status === "sent") {
        return {
            claim: false,
            reason: "already_sent",
            messageTs: existing.messageTs || "",
        };
    }

    if (existing?.status === "sending") {
        const claimedAt = existing.claimedAt ? new Date(existing.claimedAt).getTime() : 0;
        if (Date.now() - claimedAt < STALE_SENDING_MS) {
            return { claim: false, reason: "in_progress" };
        }
    }

    const updated = await PerformanceBriefSlackDelivery.findOneAndUpdate(
        {
            weekKey: week,
            customerId: cid,
            slackChannelId: channelId,
            status: { $ne: "sent" },
        },
        {
            $set: {
                weekKey: week,
                customerId: cid,
                slackChannelId: channelId,
                slackChannelName: String(slackChannelName || "").trim(),
                runId: runId || undefined,
                status: "sending",
                error: "",
                claimedAt: new Date(),
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (!updated) {
        const again = await PerformanceBriefSlackDelivery.findOne({
            weekKey: week,
            customerId: cid,
            slackChannelId: channelId,
        }).lean();
        if (again?.status === "sent") {
            return { claim: false, reason: "already_sent", messageTs: again.messageTs || "" };
        }
        return { claim: false, reason: "in_progress" };
    }

    return { claim: true, deliveryId: String(updated._id) };
}

export async function markWeeklySlackDeliverySent(deliveryId, { messageTs, channelName } = {}) {
    if (!deliveryId) return;
    await PerformanceBriefSlackDelivery.updateOne(
        { _id: deliveryId },
        {
            $set: {
                status: "sent",
                messageTs: String(messageTs || ""),
                slackChannelName: String(channelName || "").replace(/^#/, ""),
                sentAt: new Date(),
                error: "",
            },
        }
    );
}

export async function markWeeklySlackDeliveryFailed(deliveryId, error) {
    if (!deliveryId) return;
    await PerformanceBriefSlackDelivery.updateOne(
        { _id: deliveryId },
        {
            $set: {
                status: "failed",
                error: String(error || "Failed"),
            },
        }
    );
}
