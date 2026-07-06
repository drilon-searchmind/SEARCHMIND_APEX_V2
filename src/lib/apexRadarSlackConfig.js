import {
    APEX_RADAR_CHANNEL_FACEBOOK,
    APEX_RADAR_CHANNEL_GOOGLE_ADS,
    APEX_RADAR_CHANNEL_META,
    APEX_RADAR_SLACK_DEFAULT_WARNINGS_CHANNEL,
    APEX_RADAR_SLACK_PS_WARNINGS_CHANNEL,
    isValidApexRadarChannel,
} from "@/lib/apexRadarChannels";

/**
 * Resolve Slack channel name for Apex Radar DM delivery summaries.
 * Meta PS → #apex-radar-workspace-ps only. Google Ads → #apex-radar-workspace only.
 * @param {string} channel — `facebook` (PS) or `google-ads` (required)
 */
export function getApexRadarSlackWarningsChannel(channel) {
    const ch = String(channel || "").trim();

    if (ch === APEX_RADAR_CHANNEL_FACEBOOK) {
        return (
            process.env.SLACK_APEX_RADAR_PS_WARNINGS_CHANNEL ||
            process.env.SLACK_APEX_RADAR_FACEBOOK_WARNINGS_CHANNEL ||
            APEX_RADAR_SLACK_PS_WARNINGS_CHANNEL
        ).trim();
    }

    if (ch === APEX_RADAR_CHANNEL_GOOGLE_ADS) {
        return (
            process.env.SLACK_APEX_RADAR_GOOGLE_ADS_WARNINGS_CHANNEL ||
            process.env.SLACK_APEX_RADAR_WARNINGS_CHANNEL ||
            APEX_RADAR_SLACK_DEFAULT_WARNINGS_CHANNEL
        ).trim();
    }

    throw new Error(
        `Slack channel requires a valid Apex Radar platform (facebook or google-ads), got: ${channel || "(missing)"}`
    );
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
