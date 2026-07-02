import {
    APEX_RADAR_CHANNEL_FACEBOOK,
    APEX_RADAR_CHANNEL_GOOGLE_ADS,
    APEX_RADAR_CHANNEL_META,
    APEX_RADAR_SLACK_DEFAULT_WARNINGS_CHANNEL,
    APEX_RADAR_SLACK_PS_WARNINGS_CHANNEL,
    isValidApexRadarChannel,
} from "@/lib/apexRadarChannels";

/**
 * Resolve Slack channel name for Apex Radar warnings / DM summaries.
 * PS defaults to #apex-radar-workspace-ps; PPC (Google Ads) uses #apex-radar-workspace.
 * @param {string} [channel] — `facebook` (PS) or `google-ads`
 */
export function getApexRadarSlackWarningsChannel(channel) {
    const ppcChannel =
        process.env.SLACK_APEX_RADAR_GOOGLE_ADS_WARNINGS_CHANNEL ||
        process.env.SLACK_APEX_RADAR_WARNINGS_CHANNEL ||
        APEX_RADAR_SLACK_DEFAULT_WARNINGS_CHANNEL;

    const ch = String(channel || "").trim();
    if (ch === APEX_RADAR_CHANNEL_FACEBOOK) {
        return (
            process.env.SLACK_APEX_RADAR_PS_WARNINGS_CHANNEL ||
            process.env.SLACK_APEX_RADAR_FACEBOOK_WARNINGS_CHANNEL ||
            APEX_RADAR_SLACK_PS_WARNINGS_CHANNEL
        ).trim();
    }
    if (ch === APEX_RADAR_CHANNEL_GOOGLE_ADS) {
        return ppcChannel.trim();
    }
    return ppcChannel.trim();
}

/**
 * @param {string} [channel]
 * @param {string} [platformLabel]
 */
export function resolveApexRadarSlackPlatformLabel(channel, platformLabel) {
    if (typeof platformLabel === "string" && platformLabel.trim()) {
        return platformLabel.trim();
    }
    if (isValidApexRadarChannel(channel)) {
        return APEX_RADAR_CHANNEL_META[channel]?.label || "Apex Radar";
    }
    return "Apex Radar";
}
