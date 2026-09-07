import mongoose from "mongoose";
import ApexRadarCsCustomerSettings from "@/models/ApexRadarCsCustomerSettings";
import ApexRadarPerformanceBriefCustomerSettings from "@/models/ApexRadarPerformanceBriefCustomerSettings";

export function normalizeApexRadarSlackChannel({ slackChannelId, slackChannelName } = {}) {
    return {
        slackChannelId: String(slackChannelId || "").trim(),
        slackChannelName: String(slackChannelName || "")
            .trim()
            .replace(/^#/, ""),
    };
}

function fromDoc(doc) {
    const slack = normalizeApexRadarSlackChannel(doc);
    return {
        ...slack,
        updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).getTime() : 0,
    };
}

function pickPreferredSlack(csDoc, briefDoc) {
    const cs = fromDoc(csDoc);
    const brief = fromDoc(briefDoc);
    const csHas = Boolean(cs.slackChannelId);
    const briefHas = Boolean(brief.slackChannelId);
    if (csHas && !briefHas) {
        return { slackChannelId: cs.slackChannelId, slackChannelName: cs.slackChannelName };
    }
    if (briefHas && !csHas) {
        return { slackChannelId: brief.slackChannelId, slackChannelName: brief.slackChannelName };
    }
    if (!csHas && !briefHas) {
        return { slackChannelId: "", slackChannelName: "" };
    }
    if (brief.updatedAt > cs.updatedAt) {
        return { slackChannelId: brief.slackChannelId, slackChannelName: brief.slackChannelName };
    }
    return { slackChannelId: cs.slackChannelId, slackChannelName: cs.slackChannelName };
}

/**
 * Shared Slack channel for Alerts (CS) and Performance Brief.
 * Reads both stores so a channel set in either surface is used in both.
 */
export async function getApexRadarCustomerSlackChannel(customerId) {
    const [csDoc, briefDoc] = await Promise.all([
        ApexRadarCsCustomerSettings.findOne({ customerId })
            .select("slackChannelId slackChannelName updatedAt")
            .lean(),
        ApexRadarPerformanceBriefCustomerSettings.findOne({ customerId })
            .select("slackChannelId slackChannelName updatedAt")
            .lean(),
    ]);
    return pickPreferredSlack(csDoc, briefDoc);
}

/**
 * Persist Slack channel on both Alerts and Performance Brief settings.
 */
export async function setApexRadarCustomerSlackChannel(customerId, slack = {}) {
    const cid = new mongoose.Types.ObjectId(String(customerId));
    const update = { updatedAt: new Date() };
    if (slack.slackChannelId !== undefined) {
        update.slackChannelId = String(slack.slackChannelId || "").trim();
    }
    if (slack.slackChannelName !== undefined) {
        update.slackChannelName = String(slack.slackChannelName || "")
            .trim()
            .replace(/^#/, "");
    }

    const [csDoc] = await Promise.all([
        ApexRadarCsCustomerSettings.findOneAndUpdate(
            { customerId: cid },
            { $set: update },
            { upsert: true, new: true, runValidators: true }
        ).lean(),
        ApexRadarPerformanceBriefCustomerSettings.findOneAndUpdate(
            { customerId: cid },
            { $set: update },
            { upsert: true, new: true, runValidators: true }
        ).lean(),
    ]);

    return normalizeApexRadarSlackChannel(csDoc);
}
